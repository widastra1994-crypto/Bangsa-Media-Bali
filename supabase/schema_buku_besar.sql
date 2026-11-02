-- =====================================================================
-- BUKU BESAR (General Ledger) -- double entry, terisi OTOMATIS dari
-- transaksi yang sudah ada (invoice, pembayaran, pengeluaran, vendor,
-- komisi, aset digital). Staf tidak pernah menulis jurnal sendiri;
-- jurnal manual (modal, prive, transfer, koreksi) hanya Owner/Admin lewat RPC.
--
-- Prinsip:
-- * Setiap transaksi sumber punya tepat satu jurnal (source_type, source_id).
--   Saat sumber berubah, jurnalnya dibuat ulang (repost); saat dihapus, ikut hilang.
-- * Jurnal wajib seimbang (debit = kredit), dicek di akhir transaksi DB.
-- * Periode yang sudah "Tutup Buku" terkunci: jurnal di dalamnya tidak bisa
--   dibuat/diubah/dihapus, sehingga transaksi sumbernya pun tidak bisa diedit.
-- * Transaksi tanpa rekening kas/bank masuk ke akun "Kas/Bank Belum Ditentukan"
--   supaya tetap tercatat dan mudah dibereskan lewat Jurnal Umum.
-- =====================================================================

-- ---------- Bagan Akun ----------
create table if not exists public.acc_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  system_key text unique,
  bank_account_id uuid unique references public.acc_bank_accounts(id) on delete set null,
  is_cash boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
comment on column public.acc_accounts.system_key is 'Kunci akun yang dipakai jurnal otomatis. Jangan diubah; kode & nama boleh diganti.';

insert into public.acc_accounts (code, name, account_type, system_key, is_cash) values
  ('1199', 'Kas/Bank Belum Ditentukan', 'asset', 'cash_unassigned', true),
  ('1200', 'Piutang Usaha', 'asset', 'receivable', false),
  ('1310', 'PPh 23 Dibayar di Muka', 'asset', 'pph23_prepaid', false),
  ('1320', 'PPN Masukan', 'asset', 'ppn_in', false),
  ('1400', 'Kasbon / Piutang Karyawan', 'asset', 'employee_advance', false),
  ('1500', 'Peralatan Kantor', 'asset', 'equipment', false),
  ('2100', 'Utang Vendor', 'liability', 'payable_vendor', false),
  ('2200', 'Utang Komisi', 'liability', 'payable_commission', false),
  ('2210', 'Utang Gaji', 'liability', 'payable_salary', false),
  ('2310', 'PPN Keluaran', 'liability', 'ppn_out', false),
  ('2320', 'Utang PPh Final', 'liability', 'pph_final_payable', false),
  ('2330', 'Utang PPh 21', 'liability', 'pph21_payable', false),
  ('2340', 'Utang BPJS', 'liability', 'bpjs_payable', false),
  ('3100', 'Modal Pemilik', 'equity', 'owner_capital', false),
  ('3200', 'Prive Pemilik', 'equity', 'owner_drawing', false),
  ('3300', 'Laba Ditahan', 'equity', 'retained_earnings', false),
  ('4100', 'Pendapatan Jasa Proyek', 'revenue', 'rev_project', false),
  ('4200', 'Pendapatan Perpanjangan Domain & Server', 'revenue', 'rev_renewal', false),
  ('4300', 'Pendapatan Retainer Bulanan', 'revenue', 'rev_retainer', false),
  ('4900', 'Pendapatan Lain-lain', 'revenue', 'rev_other', false),
  ('5110', 'Beban Domain & Server', 'expense', 'exp_hosting', false),
  ('5120', 'Beban Tools & Proyek Lainnya', 'expense', 'exp_project_tools', false),
  ('5130', 'Beban Vendor Pihak Ketiga', 'expense', 'exp_vendor', false),
  ('6100', 'Beban Gaji & Tunjangan', 'expense', 'exp_salary', false),
  ('6110', 'Beban BPJS Perusahaan', 'expense', 'exp_bpjs', false),
  ('6200', 'Beban Komisi', 'expense', 'exp_commission', false),
  ('6300', 'Beban Operasional Kantor', 'expense', 'exp_office', false),
  ('6400', 'Beban Marketing', 'expense', 'exp_marketing', false),
  ('6500', 'Beban Pajak (PPh Final)', 'expense', 'exp_tax', false),
  ('6900', 'Beban Lain-lain', 'expense', 'exp_other', false)
on conflict (code) do nothing;

-- Setiap rekening kas/bank otomatis punya akun sendiri (kode 1101-1189).
create or replace function public.gl_sync_bank_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if tg_op = 'INSERT' then
    select n::text into v_code
    from generate_series(1101, 1189) n
    where not exists (select 1 from public.acc_accounts a where a.code = n::text)
    order by n limit 1;
    if v_code is null then
      raise exception 'Kode akun kas/bank (1101-1189) sudah penuh.';
    end if;
    insert into public.acc_accounts (code, name, account_type, bank_account_id, is_cash)
    values (v_code, new.account_name, 'asset', new.id, true)
    on conflict (bank_account_id) do nothing;
  elsif tg_op = 'UPDATE' and new.account_name is distinct from old.account_name then
    update public.acc_accounts set name = new.account_name where bank_account_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gl_sync_bank_account on public.acc_bank_accounts;
create trigger trg_gl_sync_bank_account after insert or update on public.acc_bank_accounts
  for each row execute function public.gl_sync_bank_account();

insert into public.acc_accounts (code, name, account_type, bank_account_id, is_cash)
select (1100 + row_number() over (order by b.created_at))::text, b.account_name, 'asset', b.id, true
from public.acc_bank_accounts b
where not exists (select 1 from public.acc_accounts a where a.bank_account_id = b.id);

-- ---------- Jurnal ----------
create table if not exists public.acc_journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no bigint generated always as identity unique,
  entry_date date not null,
  description text not null,
  source_type text not null check (source_type in (
    'invoice', 'payment', 'expense', 'vendor_bill', 'vendor_payment',
    'commission_accrual', 'commission_payment', 'digital_asset',
    'manual', 'opening', 'reversal', 'closing_tax', 'payroll', 'payroll_payment'
  )),
  source_id uuid,
  reversal_of uuid references public.acc_journal_entries(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists acc_journal_entries_source_uq
  on public.acc_journal_entries (source_type, source_id) where source_id is not null;
create index if not exists acc_journal_entries_date_idx on public.acc_journal_entries (entry_date);

create table if not exists public.acc_journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.acc_journal_entries(id) on delete cascade,
  line_no integer not null default 1,
  account_id uuid not null references public.acc_accounts(id) on delete restrict,
  debit numeric(15, 2) not null default 0 check (debit >= 0),
  credit numeric(15, 2) not null default 0 check (credit >= 0),
  memo text,
  project_id uuid references public.acc_projects(id) on delete set null,
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);
create index if not exists acc_journal_lines_entry_idx on public.acc_journal_lines (entry_id);
create index if not exists acc_journal_lines_account_idx on public.acc_journal_lines (account_id);

-- Debit harus sama dengan kredit -- dicek di akhir transaksi (deferred).
create or replace function public.gl_check_entry_balanced()
returns trigger language plpgsql set search_path = public as $$
declare
  v_id uuid := coalesce(new.entry_id, old.entry_id);
  v_debit numeric;
  v_credit numeric;
begin
  if not exists (select 1 from public.acc_journal_entries where id = v_id) then
    return null;
  end if;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into v_debit, v_credit
  from public.acc_journal_lines where entry_id = v_id;
  if v_debit <> v_credit then
    raise exception 'Jurnal tidak seimbang: debit % vs kredit %.', v_debit, v_credit;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_gl_balanced on public.acc_journal_lines;
create constraint trigger trg_gl_balanced after insert or update or delete on public.acc_journal_lines
  deferrable initially deferred for each row execute function public.gl_check_entry_balanced();

-- ---------- Tutup Buku (kunci periode) ----------
create table if not exists public.acc_period_closings (
  period date primary key check (extract(day from period) = 1),
  closed_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id) on delete set null,
  notes text
);

create or replace function public.gl_is_closed(p_date date)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.acc_period_closings where period = date_trunc('month', p_date)::date);
$$;

create or replace function public.gl_guard_closed_period()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op in ('UPDATE', 'DELETE') and public.gl_is_closed(old.entry_date))
     or (tg_op in ('INSERT', 'UPDATE') and public.gl_is_closed(new.entry_date)) then
    raise exception 'Periode % sudah Tutup Buku, transaksinya tidak bisa diubah. Buka kembali periodenya (Owner) atau catat koreksi di periode berjalan.',
      to_char(coalesce(new.entry_date, old.entry_date), 'MM/YYYY');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_gl_guard_closed on public.acc_journal_entries;
create trigger trg_gl_guard_closed before insert or update or delete on public.acc_journal_entries
  for each row execute function public.gl_guard_closed_period();

-- ---------- Helper posting ----------
create or replace function public.gl_acc(p_key text)
returns uuid language plpgsql stable set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.acc_accounts where system_key = p_key;
  if v_id is null then
    raise exception 'Akun sistem "%" tidak ditemukan di Bagan Akun.', p_key;
  end if;
  return v_id;
end;
$$;

create or replace function public.gl_cash_acc(p_bank_account_id uuid)
returns uuid language sql stable set search_path = public as $$
  select coalesce(
    (select id from public.acc_accounts where bank_account_id = p_bank_account_id),
    public.gl_acc('cash_unassigned')
  );
$$;

create or replace function public.gl_local_date(p_ts timestamptz)
returns date language sql immutable as $$
  select (p_ts at time zone 'Asia/Makassar')::date;
$$;

-- Ganti jurnal milik satu transaksi sumber. Tidak menyentuh apa pun kalau
-- hasilnya identik (penting supaya update kecil, mis. status email, tidak
-- gagal di periode yang sudah ditutup).
-- p_lines: [{account_id, debit, credit, memo, project_id}]
create or replace function public.gl_replace_entry(
  p_source_type text, p_source_id uuid, p_date date, p_description text, p_lines jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry_id uuid;
  v_old_sig text;
  v_new_sig text;
begin
  select e.entry_date::text || '#' || string_agg(l.account_id::text || ':' || l.debit::numeric(15, 2) || ':' || l.credit::numeric(15, 2), '|' order by l.account_id, l.debit, l.credit)
    into v_old_sig
  from public.acc_journal_entries e
  join public.acc_journal_lines l on l.entry_id = e.id
  where e.source_type = p_source_type and e.source_id = p_source_id
  group by e.entry_date;

  select p_date::text || '#' || string_agg(x.account_id::text || ':' || coalesce(x.debit, 0)::numeric(15, 2) || ':' || coalesce(x.credit, 0)::numeric(15, 2), '|' order by x.account_id, coalesce(x.debit, 0)::numeric(15, 2), coalesce(x.credit, 0)::numeric(15, 2))
    into v_new_sig
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as x(account_id uuid, debit numeric, credit numeric)
  where coalesce(x.debit, 0) > 0 or coalesce(x.credit, 0) > 0;

  if v_old_sig is not distinct from v_new_sig then
    update public.acc_journal_entries set description = p_description
    where source_type = p_source_type and source_id = p_source_id and description is distinct from p_description
      and not public.gl_is_closed(entry_date);
    return;
  end if;

  delete from public.acc_journal_entries where source_type = p_source_type and source_id = p_source_id;

  if v_new_sig is null then
    return;
  end if;

  insert into public.acc_journal_entries (entry_date, description, source_type, source_id)
  values (p_date, p_description, p_source_type, p_source_id)
  returning id into v_entry_id;

  insert into public.acc_journal_lines (entry_id, line_no, account_id, debit, credit, memo, project_id)
  select v_entry_id, row_number() over (), x.account_id, round(coalesce(x.debit, 0), 2), round(coalesce(x.credit, 0), 2), x.memo, x.project_id
  from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric, memo text, project_id uuid)
  where coalesce(x.debit, 0) > 0 or coalesce(x.credit, 0) > 0;
end;
$$;

create or replace function public.gl_line(p_account uuid, p_debit numeric, p_credit numeric, p_memo text default null, p_project uuid default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('account_id', p_account, 'debit', coalesce(p_debit, 0), 'credit', coalesce(p_credit, 0), 'memo', p_memo, 'project_id', p_project);
$$;

-- ---------- Posting per jenis transaksi ----------
-- Invoice (akrual): Piutang D / Pendapatan K (+ PPN Keluaran K); bila PPh 23
-- dipotong klien: PPh 23 Dibayar di Muka D / Piutang K.
create or replace function public.gl_post_invoice(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_ppn numeric := 0;
  v_pph23 numeric := 0;
  v_rev_key text;
  v_lines jsonb;
begin
  select i.*, c.company_name into r
  from public.acc_invoices i left join public.acc_clients c on c.id = i.client_id
  where i.id = p_id;

  if not found or r.status in ('draft', 'cancelled') or coalesce(r.total_amount, 0) <= 0 then
    perform public.gl_replace_entry('invoice', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  if r.tax_type = 'ppn' then
    v_ppn := least(coalesce(r.tax_amount, 0), r.total_amount);
  end if;
  if r.is_pph23_withheld then
    v_pph23 := round(coalesce(r.subtotal, 0) * coalesce((select pph23_rate from public.acc_tax_profile where id = 1), 2) / 100, 2);
  end if;
  v_rev_key := case r.invoice_type
    when 'domain_renewal' then 'rev_renewal'
    when 'server_renewal' then 'rev_renewal'
    when 'recurring_retainer' then 'rev_retainer'
    else 'rev_project' end;

  v_lines := jsonb_build_array(
    public.gl_line(public.gl_acc('receivable'), r.total_amount, 0, null, r.project_id),
    public.gl_line(public.gl_acc(v_rev_key), 0, r.total_amount - v_ppn, null, r.project_id),
    public.gl_line(public.gl_acc('ppn_out'), 0, v_ppn, null, r.project_id),
    public.gl_line(public.gl_acc('pph23_prepaid'), v_pph23, 0, 'PPh 23 dipotong klien', r.project_id),
    public.gl_line(public.gl_acc('receivable'), 0, v_pph23, 'PPh 23 dipotong klien', r.project_id)
  );

  perform public.gl_replace_entry('invoice', p_id, public.gl_local_date(r.created_at),
    'Invoice ' || coalesce(r.invoice_number, '') || coalesce(' - ' || r.company_name, ''), v_lines);
end;
$$;

-- Pembayaran klien: Kas/Bank D / Piutang K.
create or replace function public.gl_post_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select p.*, i.invoice_number, i.project_id, c.company_name into r
  from public.acc_payments p
  join public.acc_invoices i on i.id = p.invoice_id
  left join public.acc_clients c on c.id = i.client_id
  where p.id = p_id;

  if not found or coalesce(r.amount_paid, 0) <= 0 then
    perform public.gl_replace_entry('payment', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  perform public.gl_replace_entry('payment', p_id, r.payment_date,
    'Pembayaran ' || coalesce(r.invoice_number, '') || coalesce(' - ' || r.company_name, ''),
    jsonb_build_array(
      public.gl_line(public.gl_cash_acc(r.bank_account_id), r.amount_paid, 0,
        case when r.bank_account_id is null then 'Rekening belum dipilih' end, r.project_id),
      public.gl_line(public.gl_acc('receivable'), 0, r.amount_paid, null, r.project_id)
    ));
end;
$$;

-- Pengeluaran: Beban (sesuai kategori) D / Kas/Bank K. Kategori 'vendor_bill'
-- dilewati karena itu salinan otomatis dari pembayaran vendor (sudah dijurnal).
create or replace function public.gl_post_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_key text;
  v_label text;
begin
  select * into r from public.acc_expenses where id = p_id;

  if not found or r.category = 'vendor_bill' or coalesce(r.amount, 0) <= 0 then
    perform public.gl_replace_entry('expense', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  v_key := case r.category
    when 'domain_cost' then 'exp_hosting'
    when 'server_cost' then 'exp_hosting'
    when 'project_tools' then 'exp_project_tools'
    when 'office_operational' then 'exp_office'
    when 'salary' then 'exp_salary'
    when 'marketing' then 'exp_marketing'
    else 'exp_other' end;
  v_label := case r.category
    when 'domain_cost' then 'Beban domain'
    when 'server_cost' then 'Beban server'
    when 'project_tools' then 'Tools proyek'
    when 'office_operational' then 'Operasional kantor'
    when 'salary' then 'Gaji'
    when 'marketing' then 'Marketing'
    else 'Pengeluaran' end;

  perform public.gl_replace_entry('expense', p_id, r.expense_date,
    v_label || coalesce(': ' || nullif(r.notes, ''), ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc(v_key), r.amount, 0, null, r.project_id),
      public.gl_line(public.gl_cash_acc(r.bank_account_id), 0, r.amount,
        case when r.bank_account_id is null then 'Rekening belum dipilih' end, r.project_id)
    ));
end;
$$;

-- Tagihan vendor: Beban Vendor D / Utang Vendor K.
create or replace function public.gl_post_vendor_bill(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select b.*, v.vendor_name into r
  from public.acc_vendor_bills b left join public.acc_vendors v on v.id = b.vendor_id
  where b.id = p_id;

  if not found or coalesce(r.amount, 0) <= 0 then
    perform public.gl_replace_entry('vendor_bill', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  perform public.gl_replace_entry('vendor_bill', p_id, public.gl_local_date(r.created_at),
    'Tagihan vendor ' || coalesce(r.vendor_name, '') || coalesce(' ' || nullif(r.bill_number, ''), '') || coalesce(' - ' || nullif(r.description, ''), ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc('exp_vendor'), r.amount, 0),
      public.gl_line(public.gl_acc('payable_vendor'), 0, r.amount)
    ));
end;
$$;

-- Pembayaran vendor: Utang Vendor D / Kas/Bank K.
create or replace function public.gl_post_vendor_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select p.*, v.vendor_name, b.bill_number into r
  from public.acc_vendor_payments p
  join public.acc_vendor_bills b on b.id = p.vendor_bill_id
  left join public.acc_vendors v on v.id = b.vendor_id
  where p.id = p_id;

  if not found or coalesce(r.amount_paid, 0) <= 0 then
    perform public.gl_replace_entry('vendor_payment', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  perform public.gl_replace_entry('vendor_payment', p_id, r.payment_date,
    'Bayar vendor ' || coalesce(r.vendor_name, '') || coalesce(' ' || nullif(r.bill_number, ''), ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc('payable_vendor'), r.amount_paid, 0),
      public.gl_line(public.gl_cash_acc(r.bank_account_id), 0, r.amount_paid,
        case when r.bank_account_id is null then 'Rekening belum dipilih' end)
    ));
end;
$$;

-- Komisi diakui saat siap dibayar (payable): Beban Komisi D / Utang Komisi K.
-- Saat ditandai dibayar (di luar penggajian): Utang Komisi D / Kas K.
alter table public.acc_commissions add column if not exists payable_at timestamptz;
update public.acc_commissions set payable_at = coalesce(paid_at, created_at)
where status in ('payable', 'paid') and payable_at is null;

create or replace function public.set_commission_payable_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('payable', 'paid') and new.payable_at is null then
    new.payable_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_commission_payable_at on public.acc_commissions;
create trigger trg_commission_payable_at before insert or update on public.acc_commissions
  for each row execute function public.set_commission_payable_at();

create or replace function public.gl_post_commission(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_desc text;
begin
  select c.*, s.name as staff_name, p.website_name into r
  from public.acc_commissions c
  left join public.acc_staff_members s on s.id = c.staff_id
  left join public.acc_projects p on p.id = c.project_id
  where c.id = p_id;

  if not found or r.status not in ('payable', 'paid') or coalesce(r.commission_amount, 0) <= 0 then
    perform public.gl_replace_entry('commission_accrual', p_id, null, null, '[]'::jsonb);
    perform public.gl_replace_entry('commission_payment', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  v_desc := 'Komisi ' || coalesce(r.staff_name, '') || coalesce(' - ' || r.website_name, '');

  perform public.gl_replace_entry('commission_accrual', p_id, public.gl_local_date(coalesce(r.payable_at, r.created_at)), v_desc,
    jsonb_build_array(
      public.gl_line(public.gl_acc('exp_commission'), r.commission_amount, 0, null, r.project_id),
      public.gl_line(public.gl_acc('payable_commission'), 0, r.commission_amount, null, r.project_id)
    ));

  if r.status = 'paid' then
    perform public.gl_replace_entry('commission_payment', p_id, public.gl_local_date(coalesce(r.paid_at, now())), 'Bayar ' || lower(v_desc),
      jsonb_build_array(
        public.gl_line(public.gl_acc('payable_commission'), r.commission_amount, 0, null, r.project_id),
        public.gl_line(public.gl_acc('cash_unassigned'), 0, r.commission_amount, 'Rekening belum dipilih', r.project_id)
      ));
  else
    perform public.gl_replace_entry('commission_payment', p_id, null, null, '[]'::jsonb);
  end if;
end;
$$;

-- Biaya domain/server dari form transaksi proyek: Beban Domain & Server D /
-- Kas/Bank Belum Ditentukan K (form tidak menanyakan rekening sumbernya).
create or replace function public.gl_post_digital_asset(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_total numeric;
begin
  select a.*, p.website_name into r
  from public.acc_digital_assets a left join public.acc_projects p on p.id = a.project_id
  where a.id = p_id;

  v_total := coalesce(r.domain_cost, 0) + coalesce(r.server_cost, 0);
  if not found or v_total <= 0 then
    perform public.gl_replace_entry('digital_asset', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  perform public.gl_replace_entry('digital_asset', p_id, coalesce(r.registration_date, public.gl_local_date(r.created_at)),
    'Biaya domain & server ' || coalesce(r.domain_name, r.website_name, ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc('exp_hosting'), v_total, 0, null, r.project_id),
      public.gl_line(public.gl_acc('cash_unassigned'), 0, v_total, 'Rekening belum dipilih', r.project_id)
    ));
end;
$$;

-- ---------- Trigger di tabel sumber ----------
create or replace function public.gl_trg_invoice() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_invoice(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_payment() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_payment(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_expense() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_expense(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_vendor_bill() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_vendor_bill(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_vendor_payment() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_vendor_payment(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_commission() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_commission(coalesce(new.id, old.id)); return null; end; $$;
create or replace function public.gl_trg_digital_asset() returns trigger language plpgsql set search_path = public as $$
begin perform public.gl_post_digital_asset(coalesce(new.id, old.id)); return null; end; $$;

drop trigger if exists trg_gl_invoice_ins_del on public.acc_invoices;
create trigger trg_gl_invoice_ins_del after insert or delete on public.acc_invoices
  for each row execute function public.gl_trg_invoice();
drop trigger if exists trg_gl_invoice_upd on public.acc_invoices;
create trigger trg_gl_invoice_upd after update on public.acc_invoices for each row
  when (old.total_amount is distinct from new.total_amount or old.subtotal is distinct from new.subtotal
     or old.tax_type is distinct from new.tax_type or old.tax_amount is distinct from new.tax_amount
     or old.is_pph23_withheld is distinct from new.is_pph23_withheld or old.invoice_type is distinct from new.invoice_type
     or old.client_id is distinct from new.client_id or old.project_id is distinct from new.project_id
     or old.created_at is distinct from new.created_at
     or (old.status in ('draft', 'cancelled')) is distinct from (new.status in ('draft', 'cancelled')))
  execute function public.gl_trg_invoice();

drop trigger if exists trg_gl_payment_ins_del on public.acc_payments;
create trigger trg_gl_payment_ins_del after insert or delete on public.acc_payments
  for each row execute function public.gl_trg_payment();
drop trigger if exists trg_gl_payment_upd on public.acc_payments;
create trigger trg_gl_payment_upd after update on public.acc_payments for each row
  when (old.amount_paid is distinct from new.amount_paid or old.bank_account_id is distinct from new.bank_account_id
     or old.payment_date is distinct from new.payment_date or old.invoice_id is distinct from new.invoice_id)
  execute function public.gl_trg_payment();

drop trigger if exists trg_gl_expense_ins_del on public.acc_expenses;
create trigger trg_gl_expense_ins_del after insert or delete on public.acc_expenses
  for each row execute function public.gl_trg_expense();
drop trigger if exists trg_gl_expense_upd on public.acc_expenses;
create trigger trg_gl_expense_upd after update on public.acc_expenses for each row
  when (old.amount is distinct from new.amount or old.category is distinct from new.category
     or old.bank_account_id is distinct from new.bank_account_id or old.expense_date is distinct from new.expense_date
     or old.project_id is distinct from new.project_id or old.notes is distinct from new.notes)
  execute function public.gl_trg_expense();

drop trigger if exists trg_gl_vendor_bill_ins_del on public.acc_vendor_bills;
create trigger trg_gl_vendor_bill_ins_del after insert or delete on public.acc_vendor_bills
  for each row execute function public.gl_trg_vendor_bill();
drop trigger if exists trg_gl_vendor_bill_upd on public.acc_vendor_bills;
create trigger trg_gl_vendor_bill_upd after update on public.acc_vendor_bills for each row
  when (old.amount is distinct from new.amount or old.vendor_id is distinct from new.vendor_id
     or old.bill_number is distinct from new.bill_number or old.description is distinct from new.description)
  execute function public.gl_trg_vendor_bill();

drop trigger if exists trg_gl_vendor_payment on public.acc_vendor_payments;
create trigger trg_gl_vendor_payment after insert or update or delete on public.acc_vendor_payments
  for each row execute function public.gl_trg_vendor_payment();

drop trigger if exists trg_gl_commission_ins_del on public.acc_commissions;
create trigger trg_gl_commission_ins_del after insert or delete on public.acc_commissions
  for each row execute function public.gl_trg_commission();
drop trigger if exists trg_gl_commission_upd on public.acc_commissions;
create trigger trg_gl_commission_upd after update on public.acc_commissions for each row
  when (old.status is distinct from new.status or old.commission_amount is distinct from new.commission_amount
     or old.paid_at is distinct from new.paid_at or old.payable_at is distinct from new.payable_at
     or old.staff_id is distinct from new.staff_id or old.project_id is distinct from new.project_id)
  execute function public.gl_trg_commission();

drop trigger if exists trg_gl_digital_asset_ins_del on public.acc_digital_assets;
create trigger trg_gl_digital_asset_ins_del after insert or delete on public.acc_digital_assets
  for each row execute function public.gl_trg_digital_asset();
drop trigger if exists trg_gl_digital_asset_upd on public.acc_digital_assets;
create trigger trg_gl_digital_asset_upd after update on public.acc_digital_assets for each row
  when (old.domain_cost is distinct from new.domain_cost or old.server_cost is distinct from new.server_cost
     or old.registration_date is distinct from new.registration_date or old.project_id is distinct from new.project_id)
  execute function public.gl_trg_digital_asset();

-- ---------- Jurnal manual & tutup buku (RPC, hanya Owner/Admin) ----------
create or replace function public.gl_require_finance_admin()
returns void language plpgsql stable set search_path = public as $$
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin') then
    raise exception 'Hanya Owner/Admin yang boleh melakukan ini.';
  end if;
end;
$$;

-- p_lines: [{account_id, debit, credit, memo}]  p_kind: 'manual' | 'opening'
create or replace function public.gl_create_manual_journal(p_date date, p_description text, p_lines jsonb, p_kind text default 'manual')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_debit numeric;
  v_credit numeric;
  v_count integer;
begin
  perform public.gl_require_finance_admin();
  if p_kind not in ('manual', 'opening') then
    raise exception 'Jenis jurnal tidak dikenal.';
  end if;
  if p_date is null or coalesce(trim(p_description), '') = '' then
    raise exception 'Tanggal dan keterangan jurnal wajib diisi.';
  end if;

  select count(*), coalesce(sum(round(coalesce(x.debit, 0), 2)), 0), coalesce(sum(round(coalesce(x.credit, 0), 2)), 0)
    into v_count, v_debit, v_credit
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as x(account_id uuid, debit numeric, credit numeric)
  where coalesce(x.debit, 0) > 0 or coalesce(x.credit, 0) > 0;

  if v_count < 2 then
    raise exception 'Jurnal minimal punya 2 baris (debit dan kredit).';
  end if;
  if v_debit <> v_credit then
    raise exception 'Jurnal tidak seimbang: total debit % vs kredit %.', v_debit, v_credit;
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric)
    where (coalesce(x.debit, 0) > 0 or coalesce(x.credit, 0) > 0)
      and (x.account_id is null or not exists (select 1 from public.acc_accounts a where a.id = x.account_id and a.is_active)
           or (coalesce(x.debit, 0) > 0 and coalesce(x.credit, 0) > 0) or coalesce(x.debit, 0) < 0 or coalesce(x.credit, 0) < 0)
  ) then
    raise exception 'Ada baris jurnal yang akunnya kosong/nonaktif, atau berisi debit dan kredit sekaligus.';
  end if;

  insert into public.acc_journal_entries (entry_date, description, source_type, created_by)
  values (p_date, trim(p_description), p_kind, auth.uid())
  returning id into v_id;

  insert into public.acc_journal_lines (entry_id, line_no, account_id, debit, credit, memo)
  select v_id, row_number() over (), x.account_id, round(coalesce(x.debit, 0), 2), round(coalesce(x.credit, 0), 2), nullif(trim(x.memo), '')
  from jsonb_to_recordset(p_lines) as x(account_id uuid, debit numeric, credit numeric, memo text)
  where coalesce(x.debit, 0) > 0 or coalesce(x.credit, 0) > 0;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'journal_created', 'acc_journal_entries', v_id,
    jsonb_build_object('date', p_date, 'description', p_description, 'kind', p_kind, 'total', v_debit));
  return v_id;
end;
$$;

create or replace function public.gl_reverse_journal(p_entry_id uuid, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_id uuid;
begin
  perform public.gl_require_finance_admin();
  select * into r from public.acc_journal_entries where id = p_entry_id;
  if not found then
    raise exception 'Jurnal tidak ditemukan.';
  end if;
  if r.source_type not in ('manual', 'opening') then
    raise exception 'Jurnal otomatis tidak dibalik manual. Ubah atau hapus transaksi sumbernya.';
  end if;
  if exists (select 1 from public.acc_journal_entries where source_type = 'reversal' and source_id = p_entry_id) then
    raise exception 'Jurnal ini sudah pernah dibalik.';
  end if;

  insert into public.acc_journal_entries (entry_date, description, source_type, source_id, reversal_of, created_by)
  values (coalesce(p_date, public.gl_local_date(now())), 'Pembalik #' || r.entry_no || ': ' || r.description, 'reversal', p_entry_id, p_entry_id, auth.uid())
  returning id into v_id;

  insert into public.acc_journal_lines (entry_id, line_no, account_id, debit, credit, memo, project_id)
  select v_id, line_no, account_id, credit, debit, memo, project_id
  from public.acc_journal_lines where entry_id = p_entry_id;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'journal_reversed', 'acc_journal_entries', p_entry_id, jsonb_build_object('reversal_id', v_id));
  return v_id;
end;
$$;

create or replace function public.gl_delete_manual_journal(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  perform public.gl_require_finance_admin();
  select * into r from public.acc_journal_entries where id = p_entry_id;
  if not found then
    raise exception 'Jurnal tidak ditemukan.';
  end if;
  if r.source_type not in ('manual', 'opening', 'reversal') then
    raise exception 'Jurnal otomatis tidak bisa dihapus langsung. Hapus atau ubah transaksi sumbernya.';
  end if;
  if exists (select 1 from public.acc_journal_entries where reversal_of = p_entry_id) then
    raise exception 'Jurnal ini sudah dibalik. Hapus dulu jurnal pembaliknya.';
  end if;
  delete from public.acc_journal_entries where id = p_entry_id;
  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, old_values)
  values (auth.uid(), 'journal_deleted', 'acc_journal_entries', p_entry_id,
    jsonb_build_object('entry_no', r.entry_no, 'date', r.entry_date, 'description', r.description));
end;
$$;

-- Tutup Buku: opsional catat PPh Final (tarif x kas masuk dari klien bulan itu),
-- lalu kunci periode.
create or replace function public.gl_close_period(p_period date, p_post_pph_final boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_omzet numeric;
  v_rate numeric;
  v_tax numeric;
begin
  perform public.gl_require_finance_admin();
  if public.gl_is_closed(v_period) then
    raise exception 'Periode % sudah ditutup.', to_char(v_period, 'MM/YYYY');
  end if;
  if v_period >= date_trunc('month', public.gl_local_date(now()))::date then
    raise exception 'Hanya bulan yang sudah lewat yang bisa ditutup.';
  end if;

  if p_post_pph_final then
    select coalesce(sum(amount_paid), 0) into v_omzet
    from public.acc_payments where payment_date between v_period and v_end;
    select coalesce(pph_final_rate, 0.5) into v_rate from public.acc_tax_profile where id = 1;
    v_rate := coalesce(v_rate, 0.5);
    v_tax := round(v_omzet * v_rate / 100, 0);
    perform public.gl_replace_entry('closing_tax', md5('pph_final:' || v_period::text)::uuid, v_end,
      'PPh Final ' || v_rate || '% x omzet ' || to_char(v_period, 'MM/YYYY'),
      jsonb_build_array(
        public.gl_line(public.gl_acc('exp_tax'), v_tax, 0),
        public.gl_line(public.gl_acc('pph_final_payable'), 0, v_tax)
      ));
  end if;

  insert into public.acc_period_closings (period, closed_by) values (v_period, auth.uid());
  insert into public.acc_audit_logs (user_id, action, entity_name, new_values)
  values (auth.uid(), 'period_closed', 'acc_period_closings',
    jsonb_build_object('period', v_period, 'pph_final', coalesce(v_tax, 0)));
end;
$$;

create or replace function public.gl_reopen_period(p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_period date := date_trunc('month', p_period)::date;
begin
  if coalesce(public.current_role_name(), '') <> 'owner' then
    raise exception 'Hanya Owner yang boleh membuka kembali periode yang sudah ditutup.';
  end if;
  delete from public.acc_period_closings where period = v_period;
  insert into public.acc_audit_logs (user_id, action, entity_name, new_values)
  values (auth.uid(), 'period_reopened', 'acc_period_closings', jsonb_build_object('period', v_period));
end;
$$;

-- ---------- Laporan ----------
create or replace view public.acc_journal_view with (security_invoker = true) as
select l.id as line_id, l.entry_id, e.entry_no, e.entry_date, e.description, e.source_type, e.source_id,
       e.reversal_of, e.created_at, l.line_no, l.account_id, a.code as account_code, a.name as account_name,
       a.account_type, a.is_cash, l.debit, l.credit, l.memo, l.project_id
from public.acc_journal_lines l
join public.acc_journal_entries e on e.id = l.entry_id
join public.acc_accounts a on a.id = l.account_id;

-- Saldo per akun: opening = saldo (debit - kredit) sebelum p_from,
-- debit/kredit = mutasi p_from..p_to, closing = opening + debit - kredit.
create or replace function public.gl_account_balances(p_from date, p_to date)
returns table (account_id uuid, code text, name text, account_type text, system_key text, is_cash boolean, is_active boolean,
               opening numeric, debit numeric, credit numeric, closing numeric)
language sql stable set search_path = public as $$
  with m as (
    select l.account_id,
      coalesce(sum(l.debit - l.credit) filter (where p_from is not null and e.entry_date < p_from), 0) as opening,
      coalesce(sum(l.debit) filter (where (p_from is null or e.entry_date >= p_from) and e.entry_date <= p_to), 0) as debit,
      coalesce(sum(l.credit) filter (where (p_from is null or e.entry_date >= p_from) and e.entry_date <= p_to), 0) as credit
    from public.acc_journal_lines l
    join public.acc_journal_entries e on e.id = l.entry_id
    where e.entry_date <= p_to
    group by l.account_id
  )
  select a.id, a.code, a.name, a.account_type, a.system_key, a.is_cash, a.is_active,
         coalesce(m.opening, 0), coalesce(m.debit, 0), coalesce(m.credit, 0),
         coalesce(m.opening, 0) + coalesce(m.debit, 0) - coalesce(m.credit, 0)
  from public.acc_accounts a
  left join m on m.account_id = a.id
  order by a.code;
$$;

-- ---------- RLS ----------
alter table public.acc_accounts enable row level security;
alter table public.acc_journal_entries enable row level security;
alter table public.acc_journal_lines enable row level security;
alter table public.acc_period_closings enable row level security;

drop policy if exists oav_select on public.acc_accounts;
create policy oav_select on public.acc_accounts for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'viewer'));
drop policy if exists oa_insert on public.acc_accounts;
create policy oa_insert on public.acc_accounts for insert to authenticated
  with check (public.current_role_name() in ('owner', 'admin') and system_key is null and bank_account_id is null);
drop policy if exists oa_update on public.acc_accounts;
create policy oa_update on public.acc_accounts for update to authenticated
  using (public.current_role_name() in ('owner', 'admin'))
  with check (public.current_role_name() in ('owner', 'admin'));
drop policy if exists oa_delete on public.acc_accounts;
create policy oa_delete on public.acc_accounts for delete to authenticated
  using (public.current_role_name() in ('owner', 'admin') and system_key is null and bank_account_id is null);

-- system_key & tautan rekening tidak boleh diubah dari aplikasi.
create or replace function public.gl_protect_account_keys()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.system_key is distinct from old.system_key or new.bank_account_id is distinct from old.bank_account_id) then
    raise exception 'Kunci sistem dan tautan rekening akun tidak boleh diubah.';
  end if;
  if auth.uid() is not null and new.account_type is distinct from old.account_type
     and exists (select 1 from public.acc_journal_lines where account_id = old.id) then
    raise exception 'Jenis akun tidak bisa diubah karena sudah dipakai di jurnal.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gl_protect_account_keys on public.acc_accounts;
create trigger trg_gl_protect_account_keys before update on public.acc_accounts
  for each row execute function public.gl_protect_account_keys();

drop policy if exists oav_select on public.acc_journal_entries;
create policy oav_select on public.acc_journal_entries for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'viewer'));
drop policy if exists oav_select on public.acc_journal_lines;
create policy oav_select on public.acc_journal_lines for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'viewer'));
drop policy if exists oav_select on public.acc_period_closings;
create policy oav_select on public.acc_period_closings for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'viewer'));

-- Fungsi internal tidak boleh dipanggil langsung dari aplikasi.
revoke execute on function public.gl_replace_entry(text, uuid, date, text, jsonb) from public, anon, authenticated;
revoke execute on function public.gl_sync_bank_account() from public, anon, authenticated;
revoke execute on function public.gl_post_invoice(uuid), public.gl_post_payment(uuid), public.gl_post_expense(uuid),
  public.gl_post_vendor_bill(uuid), public.gl_post_vendor_payment(uuid), public.gl_post_commission(uuid),
  public.gl_post_digital_asset(uuid) from public, anon;
revoke execute on function public.gl_create_manual_journal(date, text, jsonb, text), public.gl_reverse_journal(uuid, date),
  public.gl_delete_manual_journal(uuid), public.gl_close_period(date, boolean), public.gl_reopen_period(date) from public, anon;

-- ---------- Isi jurnal dari data lama ----------
create or replace function public.gl_repost_all()
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid;
begin
  for v in select id from public.acc_invoices loop perform public.gl_post_invoice(v); end loop;
  for v in select id from public.acc_payments loop perform public.gl_post_payment(v); end loop;
  for v in select id from public.acc_expenses loop perform public.gl_post_expense(v); end loop;
  for v in select id from public.acc_vendor_bills loop perform public.gl_post_vendor_bill(v); end loop;
  for v in select id from public.acc_vendor_payments loop perform public.gl_post_vendor_payment(v); end loop;
  for v in select id from public.acc_commissions loop perform public.gl_post_commission(v); end loop;
  for v in select id from public.acc_digital_assets loop perform public.gl_post_digital_asset(v); end loop;
end;
$$;
revoke execute on function public.gl_repost_all() from public, anon, authenticated;

select public.gl_repost_all();

-- ---------- Pengamanan tambahan (migrasi buku_besar_harden_functions) ----------
alter function public.gl_local_date(timestamptz) set search_path = public;
alter function public.gl_line(uuid, numeric, numeric, text, uuid) set search_path = public;
-- Trigger function jadi SECURITY DEFINER supaya fungsi posting bisa ditutup
-- total dari RPC tanpa memutus trigger yang dijalankan staf.
alter function public.gl_trg_invoice() security definer;
alter function public.gl_trg_payment() security definer;
alter function public.gl_trg_expense() security definer;
alter function public.gl_trg_vendor_bill() security definer;
alter function public.gl_trg_vendor_payment() security definer;
alter function public.gl_trg_commission() security definer;
alter function public.gl_trg_digital_asset() security definer;
revoke execute on function public.gl_post_invoice(uuid), public.gl_post_payment(uuid), public.gl_post_expense(uuid),
  public.gl_post_vendor_bill(uuid), public.gl_post_vendor_payment(uuid), public.gl_post_commission(uuid),
  public.gl_post_digital_asset(uuid) from authenticated;
