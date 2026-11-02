-- ============================================================================
-- PERBAIKAN: Status invoice dengan PPh 23 dipotong klien.
-- Klien yang memotong PPh 23 hanya mentransfer total - PPh 23, sehingga
-- invoice dianggap Lunas bila pembayaran >= total - PPh 23. Nilai potongan
-- disimpan di kolom pph23_amount (dihitung dengan tarif di acc_tax_profile,
-- sama dengan jurnal Buku Besar). Status juga dihitung ulang saat pembayaran
-- diubah/dihapus dan saat centang PPh 23 diubah.
-- ============================================================================
alter table public.acc_invoices add column if not exists pph23_amount numeric(15,2) not null default 0;

create or replace function public.invoice_set_pph23_amount()
returns trigger language plpgsql set search_path = public as $$
begin
  new.pph23_amount := case when new.is_pph23_withheld
    then round(coalesce(new.subtotal, 0) * coalesce((select pph23_rate from public.acc_tax_profile where id = 1), 2) / 100, 2)
    else 0 end;
  return new;
end;
$$;

drop trigger if exists trg_invoice_pph23_amount on public.acc_invoices;
create trigger trg_invoice_pph23_amount
  before insert or update of is_pph23_withheld, subtotal on public.acc_invoices
  for each row execute function public.invoice_set_pph23_amount();

create or replace function public.invoice_refresh_status(p_invoice_id uuid)
returns void language plpgsql set search_path = public as $$
declare
  inv public.acc_invoices%rowtype;
  v_paid numeric(15,2);
  v_due numeric(15,2);
  v_status text;
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
  if v_status = 'paid' and inv.status is distinct from 'paid' and inv.project_id is not null then
    update public.acc_commissions set status = 'payable'
    where project_id = inv.project_id and status = 'pending';

    if inv.invoice_type in ('domain_renewal', 'server_renewal') then
      update public.acc_digital_assets
      set expiry_date = (coalesce(expiry_date, current_date) + interval '1 year')::date,
          status = 'active',
          last_checked_at = now()
      where project_id = inv.project_id;
    end if;
  end if;
end;
$$;

create or replace function public.apply_payment_to_invoice()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.invoice_id is not null then
    perform public.invoice_refresh_status(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.invoice_id is not null
     and (tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id or new.amount_paid is distinct from old.amount_paid) then
    perform public.invoice_refresh_status(new.invoice_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_apply_payment on public.acc_payments;
create trigger trg_apply_payment
  after insert or update of amount_paid, invoice_id or delete on public.acc_payments
  for each row execute function public.apply_payment_to_invoice();

create or replace function public.invoice_trg_refresh_status()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.invoice_refresh_status(new.id);
  return null;
end;
$$;

drop trigger if exists trg_invoice_refresh_status on public.acc_invoices;
create trigger trg_invoice_refresh_status
  after update of is_pph23_withheld, subtotal, total_amount on public.acc_invoices
  for each row
  when (old.pph23_amount is distinct from new.pph23_amount or old.total_amount is distinct from new.total_amount)
  execute function public.invoice_trg_refresh_status();

revoke execute on function public.invoice_refresh_status(uuid) from anon;
revoke execute on function public.invoice_trg_refresh_status() from anon, authenticated;
revoke execute on function public.invoice_set_pph23_amount() from anon, authenticated;

-- Isi nilai untuk invoice lama.
update public.acc_invoices set is_pph23_withheld = is_pph23_withheld where is_pph23_withheld;
