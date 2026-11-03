-- ============================================================================
-- REKAP ASET DIGITAL & PERPANJANGAN OTOMATIS
--  * Satu baris acc_digital_assets = satu layanan (domain / server / SSL /
--    email / lainnya), boleh tanpa proyek (klien yang hanya beli domain atau
--    hanya beli server).
--  * acc_asset_renewals: riwayat perpanjangan; satu invoice bisa berisi
--    beberapa aset klien yang sama. Invoice Lunas -> masa aktif maju otomatis.
--  * acc_admin_notifications + acc_notification_reads: lonceng admin dengan
--    status baca per pengguna.
--  * asset_daily_maintenance(): dijalankan pg_cron tiap pagi; menerbitkan
--    invoice perpanjangan (H-30), membuat notifikasi, set masa tenggang.
--    Email ke klien tetap dikirim Edge Function daily-reminders.
--  * acc_invoices.public_token + get_public_invoice(): link invoice untuk
--    dibagikan via WhatsApp/email tanpa login.
-- ============================================================================

-- ---------- 1. Kolom aset ----------
alter table public.acc_digital_assets
  add column if not exists asset_type text not null default 'domain',
  add column if not exists client_id uuid references public.acc_clients(id) on delete cascade,
  add column if not exists vendor_id uuid references public.acc_vendors(id) on delete set null,
  add column if not exists cost_price numeric(15,2) not null default 0,
  add column if not exists sell_price numeric(15,2) not null default 0,
  add column if not exists cycle_months int not null default 12,
  add column if not exists auto_invoice boolean not null default true,
  add column if not exists record_cost boolean not null default true,
  add column if not exists notes text;
alter table public.acc_digital_assets alter column project_id drop not null;
alter table public.acc_digital_assets drop constraint if exists acc_digital_assets_asset_type_check;
alter table public.acc_digital_assets add constraint acc_digital_assets_asset_type_check
  check (asset_type in ('domain', 'server', 'ssl', 'email', 'other'));
alter table public.acc_digital_assets drop constraint if exists acc_digital_assets_cycle_check;
alter table public.acc_digital_assets add constraint acc_digital_assets_cycle_check
  check (cycle_months in (1, 3, 6, 12, 24, 36));
create index if not exists acc_digital_assets_client_idx on public.acc_digital_assets(client_id);
create index if not exists acc_digital_assets_expiry_idx on public.acc_digital_assets(expiry_date);

create or replace function public.asset_type_label(p_type text)
returns text language sql immutable set search_path = public as $$
  select case p_type when 'domain' then 'Domain' when 'server' then 'Hosting/Server' when 'ssl' then 'SSL'
    when 'email' then 'Email Bisnis' else 'Layanan' end;
$$;

-- Jurnal biaya aset kini memakai cost_price dan hanya bila record_cost aktif.
create or replace function public.gl_post_digital_asset(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_total numeric;
begin
  select a.*, p.website_name into r
  from public.acc_digital_assets a left join public.acc_projects p on p.id = a.project_id
  where a.id = p_id;

  v_total := case when found and r.record_cost then coalesce(r.cost_price, 0) else 0 end;
  if v_total <= 0 then
    perform public.gl_replace_entry('digital_asset', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  perform public.gl_replace_entry('digital_asset', p_id, coalesce(r.registration_date, public.gl_local_date(r.created_at)),
    'Biaya ' || lower(public.asset_type_label(r.asset_type)) || ' ' || coalesce(r.domain_name, r.website_name, ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc('exp_hosting'), v_total, 0, null, r.project_id),
      public.gl_line(public.gl_acc('cash_unassigned'), 0, v_total, 'Rekening belum dipilih', r.project_id)
    ));
end;
$$;

drop trigger if exists trg_gl_digital_asset_upd on public.acc_digital_assets;
create trigger trg_gl_digital_asset_upd after update on public.acc_digital_assets for each row
  when (old.cost_price is distinct from new.cost_price or old.record_cost is distinct from new.record_cost
     or old.registration_date is distinct from new.registration_date or old.project_id is distinct from new.project_id
     or old.asset_type is distinct from new.asset_type or old.domain_name is distinct from new.domain_name)
  execute function public.gl_trg_digital_asset();

-- Pisahkan data lama: baris berisi domain + server menjadi dua aset.
update public.acc_digital_assets a set client_id = p.client_id
from public.acc_projects p where p.id = a.project_id and a.client_id is null;

insert into public.acc_digital_assets
  (project_id, client_id, asset_type, vendor_id, server_vendor_id, domain_name, registration_date, expiry_date,
   cost_price, sell_price, status, created_at)
select project_id, client_id, 'server', server_vendor_id, server_vendor_id, domain_name, registration_date, expiry_date,
   server_cost, server_cost, status, created_at
from public.acc_digital_assets
where coalesce(domain_cost, 0) > 0 and coalesce(server_cost, 0) > 0 and cost_price = 0;

update public.acc_digital_assets
set asset_type = 'domain', vendor_id = domain_vendor_id, cost_price = domain_cost, sell_price = domain_cost, server_vendor_id = null
where coalesce(domain_cost, 0) > 0 and coalesce(server_cost, 0) > 0 and cost_price = 0;

update public.acc_digital_assets
set asset_type = 'server', vendor_id = server_vendor_id, cost_price = server_cost, sell_price = server_cost
where cost_price = 0 and coalesce(server_cost, 0) > 0 and coalesce(domain_cost, 0) = 0;

update public.acc_digital_assets
set vendor_id = coalesce(vendor_id, domain_vendor_id, server_vendor_id), cost_price = coalesce(domain_cost, 0), sell_price = coalesce(domain_cost, 0)
where cost_price = 0 and vendor_id is null;

-- Kolom lama domain_cost/server_cost tetap diisi (dibaca kode lama).
create or replace function public.asset_sync_legacy_cost()
returns trigger language plpgsql set search_path = public as $$
begin
  new.domain_cost := case when new.asset_type = 'domain' then new.cost_price else 0 end;
  new.server_cost := case when new.asset_type = 'domain' then 0 else new.cost_price end;
  return new;
end;
$$;
drop trigger if exists trg_asset_sync_legacy_cost on public.acc_digital_assets;
create trigger trg_asset_sync_legacy_cost before insert or update on public.acc_digital_assets
  for each row execute function public.asset_sync_legacy_cost();
update public.acc_digital_assets set cost_price = cost_price;

do $$ declare v uuid; begin
  for v in select id from public.acc_digital_assets loop perform public.gl_post_digital_asset(v); end loop;
end $$;

drop policy if exists client_own_select on public.acc_digital_assets;
create policy client_own_select on public.acc_digital_assets for select using (
  public.current_role_name() = 'client' and (
    client_id in (select id from public.acc_clients where client_user_id = auth.uid())
    or project_id in (select p.id from public.acc_projects p join public.acc_clients c on c.id = p.client_id where c.client_user_id = auth.uid())
  ));

-- ---------- 2. Pengaturan pengingat ----------
create table if not exists public.acc_reminder_settings (
  id int primary key default 1 check (id = 1),
  renew_days int not null default 30 check (renew_days between 7 and 90),
  site_url text not null default 'https://bangsamediabali.com',
  wa_template text not null default E'Halo {pic},\n\nKami dari {brand} ingin menginformasikan layanan berikut akan segera berakhir:\n{layanan}\n\nTagihan perpanjangan: *{total}*\nNo. invoice: {nomor}\nJatuh tempo: {jatuh_tempo}\n\nDetail & unduh invoice:\n{link}\n\nTerima kasih.',
  updated_at timestamptz not null default now()
);
insert into public.acc_reminder_settings (id) values (1) on conflict (id) do nothing;
alter table public.acc_reminder_settings enable row level security;
drop policy if exists rs_select on public.acc_reminder_settings;
create policy rs_select on public.acc_reminder_settings for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
drop policy if exists rs_update on public.acc_reminder_settings;
create policy rs_update on public.acc_reminder_settings for update to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (id = 1);

-- ---------- 3. Riwayat perpanjangan ----------
create table if not exists public.acc_asset_renewals (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.acc_digital_assets(id) on delete cascade,
  invoice_id uuid references public.acc_invoices(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  cost_price numeric(15,2) not null default 0,
  sell_price numeric(15,2) not null default 0,
  status text not null default 'invoiced' check (status in ('invoiced', 'paid', 'cancelled', 'manual')),
  paid_at date,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists acc_asset_renewals_period_uq on public.acc_asset_renewals(asset_id, period_start) where status <> 'cancelled';
create index if not exists acc_asset_renewals_invoice_idx on public.acc_asset_renewals(invoice_id);
alter table public.acc_asset_renewals enable row level security;
drop policy if exists ar_select on public.acc_asset_renewals;
create policy ar_select on public.acc_asset_renewals for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));

-- ---------- 4. Link publik & log berbagi invoice ----------
alter table public.acc_invoices add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists acc_invoices_public_token_uq on public.acc_invoices(public_token);

create table if not exists public.acc_invoice_shares (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.acc_invoices(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'link', 'auto_email')),
  shared_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists acc_invoice_shares_invoice_idx on public.acc_invoice_shares(invoice_id);
alter table public.acc_invoice_shares enable row level security;
drop policy if exists is_select on public.acc_invoice_shares;
create policy is_select on public.acc_invoice_shares for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
drop policy if exists is_insert on public.acc_invoice_shares;
create policy is_insert on public.acc_invoice_shares for insert to authenticated
  with check (public.current_role_name() in ('owner', 'admin', 'staff') and shared_by = auth.uid() and channel <> 'auto_email');

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
      select jsonb_agg(jsonb_build_object(
        'label', public.asset_type_label(a.asset_type) || ' ' || coalesce(a.domain_name, ''),
        'period_start', r.period_start, 'period_end', r.period_end, 'amount', r.sell_price) order by r.created_at)
      from public.acc_asset_renewals r join public.acc_digital_assets a on a.id = r.asset_id
      where r.invoice_id = i.id and r.status <> 'cancelled'), '[]'::jsonb))
  from public.acc_invoices i
  join public.acc_clients c on c.id = i.client_id
  left join public.acc_projects p on p.id = i.project_id
  where i.public_token = p_token and i.status <> 'draft';
$$;
revoke execute on function public.get_public_invoice(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;

-- ---------- 5. Terbitkan invoice perpanjangan ----------
-- Fungsi inti (tanpa cek peran) dipakai job harian; dari aplikasi lewat
-- asset_create_renewal_invoice yang memeriksa peran.
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
    insert into public.acc_asset_renewals (asset_id, invoice_id, period_start, period_end, cost_price, sell_price, status)
    values (a.id, v_inv, v_start, (v_start + make_interval(months => a.cycle_months))::date, a.cost_price,
            coalesce(p_amounts[array_position(p_asset_ids, a.id)], nullif(a.sell_price, 0), a.cost_price), 'invoiced');
  end loop;

  update public.acc_digital_assets set status = 'pending_renewal' where id = any(p_asset_ids) and status = 'active';
  return v_inv;
end;
$$;
revoke execute on function public.asset_issue_renewal(uuid[], numeric[], date) from public, anon, authenticated;

create or replace function public.asset_create_renewal_invoice(p_asset_ids uuid[], p_amounts numeric[] default null, p_due date default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses untuk menerbitkan invoice.';
  end if;
  return public.asset_issue_renewal(p_asset_ids, p_amounts, p_due);
end;
$$;
revoke execute on function public.asset_create_renewal_invoice(uuid[], numeric[], date) from public, anon;
grant execute on function public.asset_create_renewal_invoice(uuid[], numeric[], date) to authenticated;

-- Perpanjangan yang dibayar di luar sistem invoice (mis. sudah dibayar tunai
-- sebelum ada invoice): catat & majukan masa aktif.
create or replace function public.asset_mark_renewed(p_asset_id uuid, p_notes text default null)
returns date language plpgsql security definer set search_path = public as $$
declare
  a public.acc_digital_assets%rowtype;
  v_start date;
  v_end date;
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses.';
  end if;
  select * into a from public.acc_digital_assets where id = p_asset_id;
  if not found then raise exception 'Aset tidak ditemukan.'; end if;
  if exists (select 1 from public.acc_asset_renewals where asset_id = p_asset_id and status = 'invoiced') then
    raise exception 'Aset ini sudah punya invoice perpanjangan. Catat pembayarannya di menu Invoice, masa aktif akan maju otomatis.';
  end if;
  v_start := coalesce(a.expiry_date, public.gl_local_date(now()));
  v_end := (v_start + make_interval(months => a.cycle_months))::date;
  insert into public.acc_asset_renewals (asset_id, period_start, period_end, cost_price, sell_price, status, paid_at, notes)
  values (a.id, v_start, v_end, a.cost_price, a.sell_price, 'manual', public.gl_local_date(now()), p_notes);
  update public.acc_digital_assets set expiry_date = v_end, status = 'active' where id = a.id;
  return v_end;
end;
$$;
revoke execute on function public.asset_mark_renewed(uuid, text) from public, anon;
grant execute on function public.asset_mark_renewed(uuid, text) to authenticated;

-- ---------- 6. Status invoice -> perpanjangan ----------
-- SECURITY DEFINER: riwayat perpanjangan hanya bisa diubah lewat fungsi ini,
-- sedangkan pembayaran bisa dicatat Staff.
create or replace function public.invoice_refresh_status(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv public.acc_invoices%rowtype;
  v_paid numeric(15,2);
  v_due numeric(15,2);
  v_status text;
  r record;
begin
  select * into inv from public.acc_invoices where id = p_invoice_id;
  if not found then return; end if;
  select coalesce(sum(amount_paid), 0) into v_paid from public.acc_payments where invoice_id = p_invoice_id;
  v_due := coalesce(inv.total_amount, 0) - coalesce(inv.pph23_amount, 0);

  v_status := case
    when inv.status = 'cancelled' then inv.status
    when v_paid >= v_due and inv.total_amount > 0 then 'paid'
    when v_paid > 0 then 'partial'
    when inv.status in ('paid', 'partial') then 'sent'
    else inv.status end;

  if v_status is distinct from inv.status or v_paid is distinct from inv.paid_amount then
    update public.acc_invoices set paid_amount = v_paid, status = v_status, updated_at = now() where id = p_invoice_id;
  end if;

  -- Efek samping hanya saat invoice baru berubah menjadi Lunas.
  if v_status = 'paid' and inv.status is distinct from 'paid' then
    if inv.project_id is not null then
      update public.acc_commissions set status = 'payable'
      where project_id = inv.project_id and status = 'pending';
    end if;

    if exists (select 1 from public.acc_asset_renewals where invoice_id = p_invoice_id) then
      for r in select * from public.acc_asset_renewals where invoice_id = p_invoice_id and status = 'invoiced' loop
        update public.acc_asset_renewals set status = 'paid', paid_at = public.gl_local_date(now()) where id = r.id;
        update public.acc_digital_assets
        set expiry_date = greatest(coalesce(expiry_date, r.period_end), r.period_end), status = 'active', last_checked_at = now()
        where id = r.asset_id;
      end loop;
    elsif inv.invoice_type in ('domain_renewal', 'server_renewal') and inv.project_id is not null then
      -- Invoice perpanjangan lama (sebelum ada riwayat perpanjangan).
      update public.acc_digital_assets
      set expiry_date = (coalesce(expiry_date, current_date) + interval '1 year')::date,
          status = 'active',
          last_checked_at = now()
      where project_id = inv.project_id;
    end if;

  -- Pembayaran dihapus/dikurangi sehingga tidak lagi Lunas: kembalikan masa aktif.
  elsif inv.status = 'paid' and v_status <> 'paid' then
    for r in select * from public.acc_asset_renewals where invoice_id = p_invoice_id and status = 'paid' loop
      update public.acc_asset_renewals set status = 'invoiced', paid_at = null where id = r.id;
      update public.acc_digital_assets set expiry_date = r.period_start, status = 'pending_renewal'
      where id = r.asset_id and expiry_date = r.period_end;
    end loop;
  end if;
end;
$$;

create or replace function public.invoice_trg_cancel_renewals()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.acc_asset_renewals set status = 'cancelled' where invoice_id = new.id and status = 'invoiced';
  update public.acc_digital_assets a set status = case when a.expiry_date < public.gl_local_date(now()) then 'grace_period' else 'active' end
  where a.status = 'pending_renewal'
    and a.id in (select asset_id from public.acc_asset_renewals where invoice_id = new.id)
    and not exists (select 1 from public.acc_asset_renewals r where r.asset_id = a.id and r.status = 'invoiced');
  return null;
end;
$$;
drop trigger if exists trg_invoice_cancel_renewals on public.acc_invoices;
create trigger trg_invoice_cancel_renewals after update of status on public.acc_invoices
  for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.invoice_trg_cancel_renewals();
revoke execute on function public.invoice_trg_cancel_renewals() from public, anon, authenticated;

-- ---------- 7. Notifikasi lonceng ----------
create table if not exists public.acc_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'medium' check (severity in ('high', 'medium', 'low')),
  title text not null,
  body text,
  asset_id uuid references public.acc_digital_assets(id) on delete cascade,
  invoice_id uuid references public.acc_invoices(id) on delete set null,
  client_id uuid references public.acc_clients(id) on delete cascade,
  stage text not null default '',
  cycle_date date not null default '1970-01-01',
  tab text not null default 'acc-assets',
  created_at timestamptz not null default now()
);
create unique index if not exists acc_admin_notifications_uq on public.acc_admin_notifications(kind, asset_id, stage, cycle_date);
create index if not exists acc_admin_notifications_created_idx on public.acc_admin_notifications(created_at desc);
alter table public.acc_admin_notifications enable row level security;
drop policy if exists an_select on public.acc_admin_notifications;
create policy an_select on public.acc_admin_notifications for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));

create table if not exists public.acc_notification_reads (
  notification_id uuid not null references public.acc_admin_notifications(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table public.acc_notification_reads enable row level security;
drop policy if exists nr_own on public.acc_notification_reads;
create policy nr_own on public.acc_notification_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- 8. Job harian ----------
create or replace function public.asset_daily_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.acc_reminder_settings%rowtype;
  v_today date := public.gl_local_date(now());
  g record;
  x record;
  d int;
  v_stage text;
  v_inv int := 0;
  v_notif int := 0;
  v_rows int;
begin
  select * into s from public.acc_reminder_settings where id = 1;
  if not found then s.renew_days := 30; end if;

  update public.acc_digital_assets set status = 'grace_period'
  where status in ('active', 'pending_renewal') and expiry_date < v_today;

  -- Invoice perpanjangan otomatis, digabung per klien & tanggal habis yang sama.
  -- Siklus yang invoicenya pernah dibatalkan tidak diterbitkan ulang otomatis.
  for g in
    select a.client_id, a.expiry_date, array_agg(a.id order by a.asset_type, a.domain_name) as ids
    from public.acc_digital_assets a
    where a.auto_invoice and a.client_id is not null and a.expiry_date is not null
      and a.status in ('active', 'pending_renewal', 'grace_period')
      and a.expiry_date - v_today between -30 and s.renew_days
      and not exists (select 1 from public.acc_asset_renewals r where r.asset_id = a.id and (r.period_start = a.expiry_date or r.status = 'invoiced'))
    group by a.client_id, a.expiry_date
  loop
    perform public.asset_issue_renewal(g.ids, null, g.expiry_date);
    v_inv := v_inv + 1;
  end loop;

  for x in
    select a.*, c.company_name,
      (select r.invoice_id from public.acc_asset_renewals r where r.asset_id = a.id and r.status = 'invoiced' order by r.created_at desc limit 1) as open_invoice_id
    from public.acc_digital_assets a left join public.acc_clients c on c.id = a.client_id
    where a.status in ('active', 'pending_renewal', 'grace_period') and a.expiry_date is not null
      and a.expiry_date - v_today between -30 and 30
  loop
    d := x.expiry_date - v_today;
    v_stage := case when d < 0 then 'lewat' when d = 0 then 'h0' when d = 1 then 'h1' when d <= 7 then 'h7' when d <= 14 then 'h14' else 'h30' end;
    insert into public.acc_admin_notifications (kind, severity, title, body, asset_id, invoice_id, client_id, stage, cycle_date)
    values ('asset_expiry', case when d <= 7 then 'high' else 'medium' end,
      public.asset_type_label(x.asset_type) || ' ' || coalesce(x.domain_name, '') ||
        case when d < 0 then ' sudah lewat ' || (-d) || ' hari' when d = 0 then ' habis hari ini' else ' habis ' || d || ' hari lagi' end,
      coalesce(x.company_name, '-') || ' · ' || to_char(x.expiry_date, 'DD-MM-YYYY') ||
        case when x.open_invoice_id is null then ' · belum ada invoice' else '' end,
      x.id, x.open_invoice_id, x.client_id, v_stage, x.expiry_date)
    on conflict (kind, asset_id, stage, cycle_date) do nothing;
    get diagnostics v_rows = row_count;
    v_notif := v_notif + v_rows;
  end loop;

  return jsonb_build_object('invoices', v_inv, 'notifications', v_notif);
end;
$$;
revoke execute on function public.asset_daily_maintenance() from public, anon, authenticated;
revoke execute on function public.asset_sync_legacy_cost() from public, anon, authenticated;
revoke execute on function public.invoice_refresh_status(uuid) from public, anon;
grant execute on function public.invoice_refresh_status(uuid) to authenticated;

-- Jalan tiap hari 08.30 WITA, sebelum Edge Function daily-reminders (09.00 WITA) mengirim email.
select cron.unschedule('asset-daily-maintenance') where exists (select 1 from cron.job where jobname = 'asset-daily-maintenance');
select cron.schedule('asset-daily-maintenance', '30 0 * * *', 'select public.asset_daily_maintenance()');
