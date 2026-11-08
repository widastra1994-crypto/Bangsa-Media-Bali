-- ============================================================================
-- PEMBAYARAN / TAGIHAN TAMBAHAN
-- acc_invoice_items: rincian baris invoice dengan keterangan bebas (mis.
-- "Iklan Meta Ads Desember", "Revisi tambahan"). kind = 'project' untuk
-- baris harga proyek, 'extra' untuk tagihan tambahan (dipakai laporan
-- profitabilitas). Invoice lama tanpa rincian tetap tampil seperti biasa.
-- invoice_type baru 'additional' = Tagihan Tambahan untuk proyek yang sudah
-- berjalan (pendapatan tetap masuk Pendapatan Jasa Proyek di Buku Besar).
-- ============================================================================
alter table public.acc_invoices drop constraint if exists acc_invoices_invoice_type_check;
alter table public.acc_invoices add constraint acc_invoices_invoice_type_check check (invoice_type in
  ('project_deposit', 'project_settlement', 'domain_renewal', 'server_renewal', 'recurring_retainer', 'additional'));

create table if not exists public.acc_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.acc_invoices(id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount numeric(15,2) not null check (amount >= 0),
  kind text not null default 'extra' check (kind in ('project', 'extra')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists acc_invoice_items_invoice_idx on public.acc_invoice_items(invoice_id);
alter table public.acc_invoice_items enable row level security;

drop policy if exists ii_select on public.acc_invoice_items;
create policy ii_select on public.acc_invoice_items for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
drop policy if exists ii_client_select on public.acc_invoice_items;
create policy ii_client_select on public.acc_invoice_items for select to authenticated
  using (public.current_role_name() = 'client' and invoice_id in (
    select i.id from public.acc_invoices i join public.acc_clients c on c.id = i.client_id where c.client_user_id = auth.uid()));
drop policy if exists ii_insert on public.acc_invoice_items;
create policy ii_insert on public.acc_invoice_items for insert to authenticated
  with check (public.current_role_name() in ('owner', 'admin', 'staff'));
drop policy if exists ii_update on public.acc_invoice_items;
create policy ii_update on public.acc_invoice_items for update to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff')) with check (public.current_role_name() in ('owner', 'admin', 'staff'));
drop policy if exists ii_delete on public.acc_invoice_items;
create policy ii_delete on public.acc_invoice_items for delete to authenticated
  using (public.current_role_name() in ('owner', 'admin'));

-- Invoice + rinciannya dibuat sekaligus (satu transaksi), total = jumlah rincian.
create or replace function public.invoice_create_with_items(
  p_client_id uuid, p_project_id uuid, p_invoice_type text, p_due date, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_total numeric(15,2);
  v_inv uuid;
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses untuk membuat invoice.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Isi minimal satu rincian tagihan.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where length(trim(coalesce(e->>'description', ''))) = 0 or coalesce((e->>'amount')::numeric, -1) < 0) then
    raise exception 'Setiap rincian wajib punya keterangan dan nominal.';
  end if;
  if p_project_id is not null and not exists (select 1 from public.acc_projects where id = p_project_id and client_id = p_client_id) then
    raise exception 'Proyek tidak cocok dengan klien.';
  end if;

  select sum((e->>'amount')::numeric) into v_total from jsonb_array_elements(p_items) e;
  if v_total <= 0 then raise exception 'Total tagihan harus lebih dari 0.'; end if;

  insert into public.acc_invoices (client_id, project_id, invoice_type, subtotal, tax_type, tax_amount, total_amount, due_date, status)
  values (p_client_id, p_project_id, p_invoice_type, v_total, 'none', 0, v_total, coalesce(p_due, public.gl_local_date(now())), 'sent')
  returning id into v_inv;

  insert into public.acc_invoice_items (invoice_id, description, amount, kind, sort)
  select v_inv, trim(e->>'description'), (e->>'amount')::numeric, coalesce(nullif(e->>'kind', ''), 'extra'), (ord - 1)::int
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);

  return v_inv;
end;
$$;
revoke execute on function public.invoice_create_with_items(uuid, uuid, text, date, jsonb) from public, anon;
grant execute on function public.invoice_create_with_items(uuid, uuid, text, date, jsonb) to authenticated;

-- Halaman invoice publik: rincian dari tagihan tambahan ikut tampil.
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
      select jsonb_agg(x.item order by x.ord1, x.ord2) from (
        select 0 as ord1, ii.sort as ord2, jsonb_build_object('label', ii.description, 'amount', ii.amount) as item
        from public.acc_invoice_items ii where ii.invoice_id = i.id
        union all
        select 1, extract(epoch from r.created_at)::int, jsonb_build_object(
          'label', public.asset_type_label(a.asset_type) || ' ' || coalesce(a.domain_name, ''),
          'period_start', r.period_start, 'period_end', r.period_end, 'amount', r.sell_price)
        from public.acc_asset_renewals r join public.acc_digital_assets a on a.id = r.asset_id
        where r.invoice_id = i.id and r.status <> 'cancelled') x), '[]'::jsonb))
  from public.acc_invoices i
  join public.acc_clients c on c.id = i.client_id
  left join public.acc_projects p on p.id = i.project_id
  where i.public_token = p_token and i.status <> 'draft';
$$;
revoke execute on function public.get_public_invoice(uuid) from public;
grant execute on function public.get_public_invoice(uuid) to anon, authenticated;
