-- ============================================================================
-- HAPUS PROYEK BATAL
-- project_delete(id, dry_run): Owner/Admin menghapus proyek berstatus Batal
-- beserta invoice, pembayaran, pengeluaran, komisi, aset digital, kontrak,
-- langganan, tugas & jam kerja. Jurnal Buku Besar ikut terhapus lewat trigger
-- masing-masing tabel, sehingga proyek hilang dari piutang & semua laporan.
-- dry_run = true hanya mengembalikan ringkasan untuk dialog konfirmasi.
-- Ditolak bila ada data di periode yang sudah Tutup Buku (dari guard jurnal)
-- atau komisi yang sudah masuk slip gaji.
-- ============================================================================
create or replace function public.project_delete(p_project_id uuid, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_summary jsonb;
  v_payment_ids uuid[];
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin') then
    raise exception 'Hanya Owner/Admin yang bisa menghapus proyek.';
  end if;

  select pr.*, c.company_name into p
  from public.acc_projects pr left join public.acc_clients c on c.id = pr.client_id
  where pr.id = p_project_id;
  if not found then raise exception 'Proyek tidak ditemukan.'; end if;
  if p.status <> 'cancelled' then
    raise exception 'Ubah status proyek menjadi Batal dulu sebelum menghapus.';
  end if;

  select array_agg(y.id) into v_payment_ids
  from public.acc_payments y join public.acc_invoices i on i.id = y.invoice_id
  where i.project_id = p_project_id;

  v_summary := jsonb_build_object(
    'project', coalesce(p.website_name, '-'),
    'client', coalesce(p.company_name, '-'),
    'invoices', (select count(*) from public.acc_invoices where project_id = p_project_id),
    'invoice_total', (select coalesce(sum(total_amount), 0) from public.acc_invoices where project_id = p_project_id),
    'payments', coalesce(array_length(v_payment_ids, 1), 0),
    'payment_total', (select coalesce(sum(amount_paid), 0) from public.acc_payments where id = any(coalesce(v_payment_ids, '{}'))),
    'expenses', (select count(*) from public.acc_expenses where project_id = p_project_id),
    'expense_total', (select coalesce(sum(amount), 0) from public.acc_expenses where project_id = p_project_id),
    'commissions', (select count(*) from public.acc_commissions where project_id = p_project_id),
    'commissions_paid', (select count(*) from public.acc_commissions where project_id = p_project_id and status = 'paid'),
    'assets', (select count(*) from public.acc_digital_assets where project_id = p_project_id),
    'contracts', (select count(*) from public.acc_contracts where project_id = p_project_id),
    'subscriptions', (select count(*) from public.acc_subscriptions where project_id = p_project_id),
    'tasks', (select count(*) from public.acc_project_tasks where project_id = p_project_id));

  if exists (select 1 from public.acc_commissions where project_id = p_project_id and payslip_id is not null) then
    raise exception 'Komisi proyek ini sudah masuk slip gaji, jadi proyek tidak bisa dihapus.';
  end if;

  if p_dry_run then return v_summary; end if;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, old_values, actor_name)
  values (auth.uid(), 'DELETE', 'acc_projects', p_project_id, v_summary || jsonb_build_object('deal_price', p.deal_price, 'project_date', p.project_date),
          (select name from public.profiles where id = auth.uid()));

  update public.acc_bank_mutations set matched_payment_id = null, is_matched = false
  where matched_payment_id = any(coalesce(v_payment_ids, '{}'));
  delete from public.acc_subscriptions where project_id = p_project_id;
  delete from public.acc_contracts where project_id = p_project_id;
  delete from public.acc_expenses where project_id = p_project_id;
  delete from public.acc_invoices where project_id = p_project_id; -- pembayaran & riwayat ikut (cascade)
  delete from public.acc_projects where id = p_project_id;           -- komisi, aset, tugas, jam kerja ikut (cascade)

  return v_summary;
end;
$$;
revoke execute on function public.project_delete(uuid, boolean) from public, anon;
grant execute on function public.project_delete(uuid, boolean) to authenticated;
