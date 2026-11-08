-- ============================================================================
-- RINCIAN PERPANJANGAN ASET
-- Satu aset bisa punya beberapa baris biaya perpanjangan (hosting, backup,
-- email bisnis, lisensi, maintenance, ...) masing-masing dengan modal & jual.
-- acc_digital_assets.cost_price / sell_price = total baris (dijaga trigger),
-- jadi rekap & laporan yang sudah ada tetap jalan.
-- Saat invoice perpanjangan terbit, rincian disalin ke acc_asset_renewals.lines
-- (snapshot) sehingga invoice menampilkan setiap baris dan perubahan harga
-- berikutnya tidak mengubah invoice lama.
-- ============================================================================
create table if not exists public.acc_asset_price_items (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.acc_digital_assets(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  cost_price numeric(15,2) not null default 0 check (cost_price >= 0),
  sell_price numeric(15,2) not null default 0 check (sell_price >= 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists acc_asset_price_items_asset_idx on public.acc_asset_price_items(asset_id);
alter table public.acc_asset_price_items enable row level security;
drop policy if exists api_select on public.acc_asset_price_items;
create policy api_select on public.acc_asset_price_items for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
-- Penulisan hanya lewat asset_save_price_items / trigger (SECURITY DEFINER).

alter table public.acc_asset_renewals add column if not exists lines jsonb not null default '[]'::jsonb;

-- Total baris -> kolom harga aset.
create or replace function public.asset_price_items_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_asset uuid := coalesce(new.asset_id, old.asset_id);
begin
  update public.acc_digital_assets a
  set cost_price = t.c, sell_price = t.s
  from (select sum(cost_price) c, sum(sell_price) s from public.acc_asset_price_items where asset_id = v_asset) t
  where a.id = v_asset and t.c is not null
    and (a.cost_price is distinct from t.c or a.sell_price is distinct from t.s);
  return null;
end;
$$;
drop trigger if exists trg_asset_price_items_sync on public.acc_asset_price_items;
create trigger trg_asset_price_items_sync after insert or update or delete on public.acc_asset_price_items
  for each row execute function public.asset_price_items_sync();

-- Aset baru (mis. dari Form Transaksi) otomatis punya satu baris rincian.
create or replace function public.asset_default_price_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.acc_asset_price_items where asset_id = new.id) then
    insert into public.acc_asset_price_items (asset_id, description, cost_price, sell_price)
    values (new.id, trim(public.asset_type_label(new.asset_type) || ' ' || coalesce(new.domain_name, '')), coalesce(new.cost_price, 0), coalesce(new.sell_price, 0));
  end if;
  return null;
end;
$$;
drop trigger if exists trg_asset_default_price_item on public.acc_digital_assets;
create trigger trg_asset_default_price_item after insert on public.acc_digital_assets
  for each row execute function public.asset_default_price_item();

-- Data lama: satu baris dari harga yang sudah ada.
insert into public.acc_asset_price_items (asset_id, description, cost_price, sell_price)
select a.id, trim(public.asset_type_label(a.asset_type) || ' ' || coalesce(a.domain_name, '')), a.cost_price, a.sell_price
from public.acc_digital_assets a
where not exists (select 1 from public.acc_asset_price_items i where i.asset_id = a.id);

-- Simpan seluruh rincian aset sekaligus (ganti semua baris).
create or replace function public.asset_save_price_items(p_asset_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses.';
  end if;
  if not exists (select 1 from public.acc_digital_assets where id = p_asset_id) then
    raise exception 'Aset tidak ditemukan.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Isi minimal satu rincian perpanjangan.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where length(trim(coalesce(e->>'description', ''))) = 0
                or coalesce((e->>'cost_price')::numeric, 0) < 0 or coalesce((e->>'sell_price')::numeric, 0) < 0) then
    raise exception 'Setiap rincian wajib punya keterangan, dan nominal tidak boleh minus.';
  end if;

  delete from public.acc_asset_price_items where asset_id = p_asset_id;
  insert into public.acc_asset_price_items (asset_id, description, cost_price, sell_price, sort)
  select p_asset_id, trim(e->>'description'), coalesce((e->>'cost_price')::numeric, 0), coalesce((e->>'sell_price')::numeric, 0), (ord - 1)::int
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);
end;
$$;
revoke execute on function public.asset_save_price_items(uuid, jsonb) from public, anon;
grant execute on function public.asset_save_price_items(uuid, jsonb) to authenticated;
revoke execute on function public.asset_price_items_sync() from public, anon, authenticated;
revoke execute on function public.asset_default_price_item() from public, anon, authenticated;

-- Invoice perpanjangan: salin rincian ke renewal.lines. Bila nominal aset
-- diubah manual saat menerbitkan, rincian digabung jadi satu baris.
create or replace function public.asset_issue_renewal(p_asset_ids uuid[], p_amounts numeric[] default null, p_due date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_clients uuid[];
  v_projects uuid[];
  v_has_null_project boolean;
  v_all_non_domain boolean;
  v_min_expiry date;
  v_total numeric(15,2) := 0;
  v_inv uuid;
  v_today date := public.gl_local_date(now());
  v_start date;
  v_price numeric(15,2);
  v_lines jsonb;
  v_items_total numeric(15,2);
  a record;
begin
  if coalesce(array_length(p_asset_ids, 1), 0) = 0 then
    raise exception 'Pilih minimal satu aset.';
  end if;

  select count(*), array_agg(distinct client_id), array_agg(distinct project_id) filter (where project_id is not null),
         bool_or(project_id is null), bool_and(asset_type <> 'domain'), min(expiry_date)
    into v_n, v_clients, v_projects, v_has_null_project, v_all_non_domain, v_min_expiry
  from public.acc_digital_assets where id = any(p_asset_ids);

  if v_n <> (select count(distinct x) from unnest(p_asset_ids) x) then
    raise exception 'Aset tidak ditemukan.';
  end if;
  if array_length(v_clients, 1) <> 1 or v_clients[1] is null then
    raise exception 'Semua aset dalam satu invoice harus milik klien yang sama, dan aset harus punya klien.';
  end if;
  if exists (select 1 from public.acc_asset_renewals where asset_id = any(p_asset_ids) and status = 'invoiced') then
    raise exception 'Sebagian aset sudah punya invoice perpanjangan yang belum lunas. Bagikan invoice itu atau batalkan dulu.';
  end if;

  for a in select * from public.acc_digital_assets where id = any(p_asset_ids) loop
    v_total := v_total + coalesce(p_amounts[array_position(p_asset_ids, a.id)], nullif(a.sell_price, 0), a.cost_price);
  end loop;

  insert into public.acc_invoices (client_id, project_id, invoice_type, subtotal, total_amount, due_date, status)
  values (v_clients[1],
          case when array_length(v_projects, 1) = 1 and not v_has_null_project then v_projects[1] end,
          case when v_all_non_domain then 'server_renewal' else 'domain_renewal' end,
          v_total, v_total, coalesce(p_due, greatest(v_min_expiry, v_today), v_today), 'sent')
  returning id into v_inv;

  for a in select * from public.acc_digital_assets where id = any(p_asset_ids) order by array_position(p_asset_ids, id) loop
    v_start := coalesce(a.expiry_date, v_today);
    v_price := coalesce(p_amounts[array_position(p_asset_ids, a.id)], nullif(a.sell_price, 0), a.cost_price);
    select coalesce(jsonb_agg(jsonb_build_object('description', description, 'cost_price', cost_price, 'sell_price', sell_price) order by sort, created_at), '[]'::jsonb),
           coalesce(sum(sell_price), 0)
      into v_lines, v_items_total
    from public.acc_asset_price_items where asset_id = a.id;
    if v_items_total <> v_price then
      v_lines := jsonb_build_array(jsonb_build_object('description',
        trim(public.asset_type_label(a.asset_type) || ' ' || coalesce(a.domain_name, '')), 'cost_price', a.cost_price, 'sell_price', v_price));
    end if;
    insert into public.acc_asset_renewals (asset_id, invoice_id, period_start, period_end, cost_price, sell_price, status, lines)
    values (a.id, v_inv, v_start, (v_start + make_interval(months => a.cycle_months))::date, a.cost_price, v_price, 'invoiced', v_lines);
  end loop;

  update public.acc_digital_assets set status = 'pending_renewal' where id = any(p_asset_ids) and status = 'active';
  return v_inv;
end;
$$;
revoke execute on function public.asset_issue_renewal(uuid[], numeric[], date) from public, anon, authenticated;

-- Halaman invoice publik: perpanjangan ditampilkan per baris rincian.
create or replace function public.get_public_invoice(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number, 'invoice_type', i.invoice_type, 'subtotal', i.subtotal,
      'tax_amount', i.tax_amount, 'total_amount', i.total_amount, 'paid_amount', i.paid_amount,
      'pph23_amount', i.pph23_amount, 'due_date', i.due_date, 'status', i.status, 'created_at', i.created_at,
      'project_name', p.website_name),
    'client', jsonb_build_object('company_name', c.company_name, 'pic_name', c.pic_name, 'address', c.address),
    'items', coalesce((
      select jsonb_agg(x.item order by x.ord1, x.ord2, x.ord3) from (
        select 0 as ord1, ii.sort as ord2, 0::bigint as ord3, jsonb_build_object('label', ii.description, 'amount', ii.amount) as item
        from public.acc_invoice_items ii where ii.invoice_id = i.id
        union all
        select 1, extract(epoch from r.created_at)::int, l.ord, jsonb_build_object(
          'label', 'Perpanjangan ' || (l.e->>'description'),
          'period_start', r.period_start, 'period_end', r.period_end, 'amount', (l.e->>'sell_price')::numeric)
        from public.acc_asset_renewals r
        cross join lateral jsonb_array_elements(r.lines) with ordinality as l(e, ord)
        where r.invoice_id = i.id and r.status <> 'cancelled'
        union all
        select 1, extract(epoch from r.created_at)::int, 0, jsonb_build_object(
          'label', 'Perpanjangan ' || public.asset_type_label(a.asset_type) || ' ' || coalesce(a.domain_name, ''),
          'period_start', r.period_start, 'period_end', r.period_end, 'amount', r.sell_price)
        from public.acc_asset_renewals r join public.acc_digital_assets a on a.id = r.asset_id
        where r.invoice_id = i.id and r.status <> 'cancelled' and jsonb_array_length(r.lines) = 0) x), '[]'::jsonb))
  from public.acc_invoices i
  join public.acc_clients c on c.id = i.client_id
  left join public.acc_projects p on p.id = i.project_id
  where i.public_token = p_token and i.status <> 'draft';
$$;
revoke execute on function public.get_public_invoice(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;

-- Jenis layanan baru: Langganan/Lisensi (Google Workspace, lisensi plugin, dsb.).
alter table public.acc_digital_assets drop constraint if exists acc_digital_assets_asset_type_check;
alter table public.acc_digital_assets add constraint acc_digital_assets_asset_type_check
  check (asset_type in ('domain', 'server', 'ssl', 'email', 'subscription', 'other'));
create or replace function public.asset_type_label(p_type text)
returns text language sql immutable set search_path = public as $$
  select case p_type when 'domain' then 'Domain' when 'server' then 'Hosting/Server' when 'ssl' then 'SSL'
    when 'email' then 'Email Bisnis' when 'subscription' then 'Langganan/Lisensi' else 'Layanan' end;
$$;
