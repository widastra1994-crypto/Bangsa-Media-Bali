-- =====================================================================
-- PENGGAJIAN (Payroll) + slip gaji. Tersambung ke Buku Besar.
--
-- Alur: Pengaturan gaji per staf -> Buat draf periode (otomatis: gaji pokok,
-- tunjangan, komisi siap dibayar, lembur dari Jam Kerja, cicilan kasbon,
-- BPJS, PPh 21) -> admin sesuaikan -> Owner setujui (slip terkunci & tampil
-- di "Slip Gaji Saya" staf; jurnal beban gaji dibuat) -> Bayar (pilih
-- rekening; komisi jadi "dibayar", jurnal pembayaran dibuat).
--
-- Persentase BPJS bisa diatur di acc_payroll_settings. PPh 21 memakai tarif
-- per staf (mis. tarif efektif/TER dari konsultan pajak) x penghasilan bruto,
-- dan tetap bisa diubah manual per slip.
-- =====================================================================

-- Jurnal kasbon karyawan juga masuk Buku Besar.
alter table public.acc_journal_entries drop constraint if exists acc_journal_entries_source_type_check;
alter table public.acc_journal_entries add constraint acc_journal_entries_source_type_check check (source_type in (
  'invoice', 'payment', 'expense', 'vendor_bill', 'vendor_payment',
  'commission_accrual', 'commission_payment', 'digital_asset',
  'manual', 'opening', 'reversal', 'closing_tax', 'payroll', 'payroll_payment', 'employee_loan'
));

create table if not exists public.acc_payroll_settings (
  id integer primary key default 1 check (id = 1),
  normal_hours_per_month numeric(8, 2) not null default 0,
  overtime_rate_per_hour numeric(15, 2) not null default 0,
  bpjs_kes_employee_pct numeric(5, 2) not null default 1,
  bpjs_kes_company_pct numeric(5, 2) not null default 4,
  bpjs_kes_salary_cap numeric(15, 2) not null default 12000000,
  bpjs_tk_employee_pct numeric(5, 2) not null default 3,
  bpjs_tk_company_pct numeric(5, 2) not null default 6.24,
  pay_day integer not null default 25 check (pay_day between 1 and 28),
  updated_at timestamptz not null default now()
);
comment on table public.acc_payroll_settings is 'normal_hours_per_month = 0 berarti lembur tidak dihitung otomatis. Persentase BPJS default perlu dicek ke aturan terbaru/konsultan.';
insert into public.acc_payroll_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.acc_staff_payroll_profiles (
  staff_id uuid primary key references public.acc_staff_members(id) on delete cascade,
  employment_type text not null default 'tetap' check (employment_type in ('tetap', 'kontrak', 'freelance')),
  base_salary numeric(15, 2) not null default 0 check (base_salary >= 0),
  allowances jsonb not null default '[]'::jsonb,
  bpjs_kes_enrolled boolean not null default false,
  bpjs_tk_enrolled boolean not null default false,
  pph21_percent numeric(5, 2) not null default 0 check (pph21_percent >= 0 and pph21_percent <= 50),
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.acc_employee_loans (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.acc_staff_members(id) on delete restrict,
  loan_date date not null default current_date,
  amount numeric(15, 2) not null check (amount > 0),
  installment_amount numeric(15, 2) not null check (installment_amount > 0),
  bank_account_id uuid references public.acc_bank_accounts(id) on delete set null,
  notes text,
  status text not null default 'active' check (status in ('active', 'paid')),
  created_at timestamptz not null default now()
);

create table if not exists public.acc_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period date not null unique check (extract(day from period) = 1),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  pay_date date,
  bank_account_id uuid references public.acc_bank_accounts(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz
);

create table if not exists public.acc_payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.acc_payroll_runs(id) on delete cascade,
  staff_id uuid not null references public.acc_staff_members(id) on delete restrict,
  slip_no text unique,
  period date not null,
  staff_name text not null,
  role_type text,
  employment_type text,
  base_salary numeric(15, 2) not null default 0,
  allowances jsonb not null default '[]'::jsonb,
  allowance_total numeric(15, 2) not null default 0,
  commission_total numeric(15, 2) not null default 0,
  commission_details jsonb not null default '[]'::jsonb,
  overtime_hours numeric(8, 2) not null default 0,
  overtime_rate numeric(15, 2) not null default 0,
  overtime_amount numeric(15, 2) not null default 0,
  bonus numeric(15, 2) not null default 0,
  bonus_note text,
  gross_pay numeric(15, 2) not null default 0,
  loan_deduction numeric(15, 2) not null default 0,
  absence_deduction numeric(15, 2) not null default 0,
  bpjs_kes_employee numeric(15, 2) not null default 0,
  bpjs_tk_employee numeric(15, 2) not null default 0,
  bpjs_company numeric(15, 2) not null default 0,
  pph21_percent numeric(5, 2) not null default 0,
  pph21 numeric(15, 2) not null default 0,
  other_deduction numeric(15, 2) not null default 0,
  other_deduction_note text,
  total_deductions numeric(15, 2) not null default 0,
  net_pay numeric(15, 2) not null default 0,
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  notes text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, staff_id),
  check (bonus >= 0 and absence_deduction >= 0 and other_deduction >= 0 and pph21 >= 0 and overtime_hours >= 0)
);
create index if not exists acc_payslips_staff_idx on public.acc_payslips (staff_id);

create table if not exists public.acc_loan_deductions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.acc_employee_loans(id) on delete cascade,
  payslip_id uuid not null references public.acc_payslips(id) on delete cascade,
  amount numeric(15, 2) not null check (amount > 0),
  unique (loan_id, payslip_id)
);

alter table public.acc_commissions add column if not exists payslip_id uuid references public.acc_payslips(id) on delete set null;

-- ---------- Nomor slip & hitung ulang otomatis ----------
create or replace function public.payroll_slip_compute()
returns trigger language plpgsql set search_path = public as $$
declare
  v_status text;
  v_seq integer;
begin
  select status into v_status from public.acc_payroll_runs where id = new.run_id;
  if tg_op = 'UPDATE' and v_status <> 'draft'
     and (to_jsonb(new) - 'is_published') is distinct from (to_jsonb(old) - 'is_published') then
    raise exception 'Slip gaji yang sudah disetujui tidak bisa diubah. Buka kembali penggajiannya (Owner) dulu.';
  end if;

  if tg_op = 'INSERT' and new.slip_no is null then
    select count(*) + 1 into v_seq from public.acc_payslips where period = new.period;
    new.slip_no := 'SG-' || to_char(new.period, 'YYYYMM') || '-' || lpad(v_seq::text, 3, '0');
    while exists (select 1 from public.acc_payslips where slip_no = new.slip_no) loop
      v_seq := v_seq + 1;
      new.slip_no := 'SG-' || to_char(new.period, 'YYYYMM') || '-' || lpad(v_seq::text, 3, '0');
    end loop;
  end if;

  select coalesce(sum((x->>'amount')::numeric), 0) into new.allowance_total
  from jsonb_array_elements(coalesce(new.allowances, '[]'::jsonb)) x;
  new.overtime_amount := round(coalesce(new.overtime_hours, 0) * coalesce(new.overtime_rate, 0), 0);
  new.gross_pay := new.base_salary + new.allowance_total + new.commission_total + new.overtime_amount + new.bonus;

  -- PPh 21 dihitung ulang dari tarif, kecuali admin mengubah nominalnya manual.
  if new.pph21_percent > 0 and (tg_op = 'INSERT' or new.pph21_percent is distinct from old.pph21_percent or new.pph21 is not distinct from old.pph21) then
    new.pph21 := round(new.gross_pay * new.pph21_percent / 100, 0);
  end if;

  new.total_deductions := new.loan_deduction + new.absence_deduction + new.bpjs_kes_employee + new.bpjs_tk_employee + new.pph21 + new.other_deduction;
  new.net_pay := new.gross_pay - new.total_deductions;
  return new;
end;
$$;

drop trigger if exists trg_payroll_slip_compute on public.acc_payslips;
create trigger trg_payroll_slip_compute before insert or update on public.acc_payslips
  for each row execute function public.payroll_slip_compute();

create or replace function public.payroll_guard_slip_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.acc_payroll_runs where id = old.run_id and status <> 'draft') then
    raise exception 'Slip gaji yang sudah disetujui tidak bisa dihapus.';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_payroll_guard_slip_delete on public.acc_payslips;
create trigger trg_payroll_guard_slip_delete before delete on public.acc_payslips
  for each row execute function public.payroll_guard_slip_delete();

create or replace function public.payroll_guard_run()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Penggajian yang sudah disetujui tidak bisa dihapus.';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_payroll_guard_run on public.acc_payroll_runs;
create trigger trg_payroll_guard_run before delete on public.acc_payroll_runs
  for each row execute function public.payroll_guard_run();

-- ---------- Jurnal Buku Besar ----------
-- Komisi yang dibayar lewat slip gaji tidak dijurnal sebagai pembayaran
-- komisi tersendiri (sudah lewat jurnal pembayaran gaji).
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

  if r.status = 'paid' and r.payslip_id is null then
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

drop trigger if exists trg_gl_commission_upd on public.acc_commissions;
create trigger trg_gl_commission_upd after update on public.acc_commissions for each row
  when (old.status is distinct from new.status or old.commission_amount is distinct from new.commission_amount
     or old.paid_at is distinct from new.paid_at or old.payable_at is distinct from new.payable_at
     or old.staff_id is distinct from new.staff_id or old.project_id is distinct from new.project_id
     or old.payslip_id is distinct from new.payslip_id)
  execute function public.gl_trg_commission();

-- Baris jurnal yang nilainya bisa negatif: pindahkan ke sisi seberang.
create or replace function public.gl_line_signed(p_account uuid, p_amount numeric, p_debit_side boolean, p_memo text default null)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when (p_amount >= 0) = p_debit_side then public.gl_line(p_account, abs(p_amount), 0, p_memo)
    else public.gl_line(p_account, 0, abs(p_amount), p_memo) end;
$$;

-- Slip disetujui: Beban Gaji D, Beban BPJS Perusahaan D, Utang Komisi D /
-- Utang Gaji K (gaji bersih), Utang PPh 21 K, Utang BPJS K, Kasbon K.
-- Slip dibayar: Utang Gaji D / Kas-Bank K.
create or replace function public.gl_post_payslip(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_period_end date;
  v_date date;
  v_salary numeric;
begin
  select ps.*, r.status as run_status, r.approved_at, r.pay_date, r.bank_account_id as run_bank
    into s
  from public.acc_payslips ps join public.acc_payroll_runs r on r.id = ps.run_id
  where ps.id = p_id;

  if not found or s.run_status not in ('approved', 'paid') then
    perform public.gl_replace_entry('payroll', p_id, null, null, '[]'::jsonb);
    perform public.gl_replace_entry('payroll_payment', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  v_period_end := (s.period + interval '1 month - 1 day')::date;
  v_date := case when public.gl_is_closed(v_period_end) then public.gl_local_date(coalesce(s.approved_at, now())) else v_period_end end;
  v_salary := s.base_salary + s.allowance_total + s.overtime_amount + s.bonus - s.absence_deduction - s.other_deduction;

  perform public.gl_replace_entry('payroll', p_id, v_date,
    'Gaji ' || s.staff_name || ' ' || to_char(s.period, 'MM/YYYY') || ' (' || s.slip_no || ')',
    jsonb_build_array(
      public.gl_line_signed(public.gl_acc('exp_salary'), v_salary, true),
      public.gl_line(public.gl_acc('exp_bpjs'), s.bpjs_company, 0),
      public.gl_line(public.gl_acc('payable_commission'), s.commission_total, 0, 'Komisi dibayar lewat gaji'),
      public.gl_line_signed(public.gl_acc('payable_salary'), s.net_pay, false, 'Gaji bersih'),
      public.gl_line(public.gl_acc('pph21_payable'), 0, s.pph21),
      public.gl_line(public.gl_acc('bpjs_payable'), 0, s.bpjs_kes_employee + s.bpjs_tk_employee + s.bpjs_company),
      public.gl_line(public.gl_acc('employee_advance'), 0, s.loan_deduction, 'Potongan kasbon')
    ));

  if s.run_status = 'paid' and s.net_pay > 0 then
    perform public.gl_replace_entry('payroll_payment', p_id, coalesce(s.pay_date, public.gl_local_date(now())),
      'Bayar gaji ' || s.staff_name || ' ' || to_char(s.period, 'MM/YYYY'),
      jsonb_build_array(
        public.gl_line(public.gl_acc('payable_salary'), s.net_pay, 0),
        public.gl_line(public.gl_cash_acc(s.run_bank), 0, s.net_pay, case when s.run_bank is null then 'Rekening belum dipilih' end)
      ));
  else
    perform public.gl_replace_entry('payroll_payment', p_id, null, null, '[]'::jsonb);
  end if;
end;
$$;

-- Kasbon diberikan: Kasbon Karyawan D / Kas-Bank K.
create or replace function public.gl_post_employee_loan(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select l.*, s.name as staff_name into r
  from public.acc_employee_loans l left join public.acc_staff_members s on s.id = l.staff_id
  where l.id = p_id;
  if not found then
    perform public.gl_replace_entry('employee_loan', p_id, null, null, '[]'::jsonb);
    return;
  end if;
  perform public.gl_replace_entry('employee_loan', p_id, r.loan_date, 'Kasbon ' || coalesce(r.staff_name, '') || coalesce(' - ' || nullif(r.notes, ''), ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc('employee_advance'), r.amount, 0),
      public.gl_line(public.gl_cash_acc(r.bank_account_id), 0, r.amount, case when r.bank_account_id is null then 'Rekening belum dipilih' end)
    ));
end;
$$;

create or replace function public.gl_trg_employee_loan() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.gl_post_employee_loan(coalesce(new.id, old.id)); return null; end; $$;
drop trigger if exists trg_gl_employee_loan on public.acc_employee_loans;
create trigger trg_gl_employee_loan after insert or delete or update of amount, loan_date, bank_account_id, staff_id, notes on public.acc_employee_loans
  for each row execute function public.gl_trg_employee_loan();

create or replace function public.payroll_guard_loan()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.acc_loan_deductions where loan_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'Kasbon yang sudah pernah dipotong gaji tidak bisa dihapus.';
    elsif new.amount is distinct from old.amount or new.staff_id is distinct from old.staff_id then
      raise exception 'Nominal/staf kasbon yang sudah pernah dipotong gaji tidak bisa diubah.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_payroll_guard_loan on public.acc_employee_loans;
create trigger trg_payroll_guard_loan before update or delete on public.acc_employee_loans
  for each row execute function public.payroll_guard_loan();

-- Sisa kasbon per pinjaman.
create or replace view public.acc_employee_loans_view with (security_invoker = true) as
select l.*, s.name as staff_name,
  coalesce((select sum(d.amount) from public.acc_loan_deductions d where d.loan_id = l.id), 0) as deducted,
  l.amount - coalesce((select sum(d.amount) from public.acc_loan_deductions d where d.loan_id = l.id), 0) as remaining
from public.acc_employee_loans l
left join public.acc_staff_members s on s.id = l.staff_id;

-- ---------- RPC alur penggajian ----------
create or replace function public.payroll_generate(p_period date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_run record;
  v_run_id uuid;
  cfg record;
  st record;
  v_comm numeric;
  v_comm_details jsonb;
  v_comm_ids uuid[];
  v_hours numeric;
  v_ot numeric;
  v_basis numeric;
  v_allow numeric;
  v_slip uuid;
  l record;
  v_remaining numeric;
  v_cut numeric;
  v_loan_total numeric;
begin
  perform public.gl_require_finance_admin();
  select * into v_run from public.acc_payroll_runs where period = v_period;
  if found then
    if v_run.status <> 'draft' then
      raise exception 'Penggajian % sudah disetujui. Buka kembali dulu (Owner) untuk menghitung ulang.', to_char(v_period, 'MM/YYYY');
    end if;
    v_run_id := v_run.id;
    delete from public.acc_payslips where run_id = v_run_id;
  else
    insert into public.acc_payroll_runs (period, created_by) values (v_period, auth.uid()) returning id into v_run_id;
  end if;

  select * into cfg from public.acc_payroll_settings where id = 1;

  for st in
    select m.id, m.name, m.role_type, p.employment_type, coalesce(p.base_salary, 0) as base_salary,
           coalesce(p.allowances, '[]'::jsonb) as allowances, coalesce(p.bpjs_kes_enrolled, false) as bpjs_kes_enrolled,
           coalesce(p.bpjs_tk_enrolled, false) as bpjs_tk_enrolled, coalesce(p.pph21_percent, 0) as pph21_percent,
           p.bank_name, p.bank_account_number, p.bank_account_holder
    from public.acc_staff_members m
    left join public.acc_staff_payroll_profiles p on p.staff_id = m.id
    where m.is_active
      and ((p.staff_id is not null and p.is_active)
           or exists (select 1 from public.acc_commissions c where c.staff_id = m.id and c.status = 'payable' and c.payslip_id is null))
    order by m.name
  loop
    select coalesce(sum(c.commission_amount), 0),
           coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'project', coalesce(pr.website_name, '-'), 'role', c.role_in_project, 'amount', c.commission_amount)) filter (where c.id is not null), '[]'::jsonb),
           array_agg(c.id) filter (where c.id is not null)
      into v_comm, v_comm_details, v_comm_ids
    from public.acc_commissions c left join public.acc_projects pr on pr.id = c.project_id
    where c.staff_id = st.id and c.status = 'payable' and c.payslip_id is null;

    select coalesce(sum(hours), 0) into v_hours from public.acc_time_logs
    where staff_id = st.id and work_date between v_period and v_end;
    v_ot := case when coalesce(cfg.normal_hours_per_month, 0) > 0 then greatest(0, v_hours - cfg.normal_hours_per_month) else 0 end;

    select coalesce(sum((x->>'amount')::numeric), 0) into v_allow from jsonb_array_elements(st.allowances) x;
    v_basis := st.base_salary + v_allow;

    insert into public.acc_payslips (
      run_id, staff_id, period, staff_name, role_type, employment_type, base_salary, allowances,
      commission_total, commission_details, overtime_hours, overtime_rate,
      bpjs_kes_employee, bpjs_tk_employee, bpjs_company, pph21_percent,
      bank_name, bank_account_number, bank_account_holder
    ) values (
      v_run_id, st.id, v_period, st.name, st.role_type, coalesce(st.employment_type, 'freelance'), st.base_salary, st.allowances,
      v_comm, v_comm_details, v_ot, coalesce(cfg.overtime_rate_per_hour, 0),
      case when st.bpjs_kes_enrolled then round(least(v_basis, cfg.bpjs_kes_salary_cap) * cfg.bpjs_kes_employee_pct / 100, 0) else 0 end,
      case when st.bpjs_tk_enrolled then round(v_basis * cfg.bpjs_tk_employee_pct / 100, 0) else 0 end,
      case when st.bpjs_kes_enrolled then round(least(v_basis, cfg.bpjs_kes_salary_cap) * cfg.bpjs_kes_company_pct / 100, 0) else 0 end
        + case when st.bpjs_tk_enrolled then round(v_basis * cfg.bpjs_tk_company_pct / 100, 0) else 0 end,
      st.pph21_percent, st.bank_name, st.bank_account_number, st.bank_account_holder
    ) returning id into v_slip;

    if v_comm_ids is not null then
      update public.acc_commissions set payslip_id = v_slip where id = any (v_comm_ids);
    end if;

    v_loan_total := 0;
    for l in select * from public.acc_employee_loans where staff_id = st.id and status = 'active' order by loan_date, created_at loop
      select l.amount - coalesce(sum(amount), 0) into v_remaining from public.acc_loan_deductions where loan_id = l.id;
      if v_remaining > 0 then
        v_cut := least(l.installment_amount, v_remaining);
        insert into public.acc_loan_deductions (loan_id, payslip_id, amount) values (l.id, v_slip, v_cut);
        v_loan_total := v_loan_total + v_cut;
      end if;
    end loop;
    if v_loan_total > 0 then
      update public.acc_payslips set loan_deduction = v_loan_total where id = v_slip;
    end if;
  end loop;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'payroll_generated', 'acc_payroll_runs', v_run_id, jsonb_build_object('period', v_period));
  return v_run_id;
end;
$$;

create or replace function public.payroll_approve(p_run_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_slip uuid;
begin
  if coalesce(public.current_role_name(), '') <> 'owner' then
    raise exception 'Hanya Owner yang boleh menyetujui penggajian.';
  end if;
  select * into r from public.acc_payroll_runs where id = p_run_id;
  if not found or r.status <> 'draft' then
    raise exception 'Hanya penggajian berstatus draf yang bisa disetujui.';
  end if;
  if not exists (select 1 from public.acc_payslips where run_id = p_run_id) then
    raise exception 'Belum ada slip gaji di periode ini.';
  end if;
  if exists (select 1 from public.acc_payslips where run_id = p_run_id and net_pay < 0) then
    raise exception 'Ada slip dengan gaji bersih minus. Periksa potongannya dulu.';
  end if;

  update public.acc_payroll_runs set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_run_id;
  update public.acc_payslips set is_published = true where run_id = p_run_id;
  for v_slip in select id from public.acc_payslips where run_id = p_run_id loop
    perform public.gl_post_payslip(v_slip);
  end loop;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'payroll_approved', 'acc_payroll_runs', p_run_id,
    jsonb_build_object('period', r.period, 'total_net', (select sum(net_pay) from public.acc_payslips where run_id = p_run_id)));
end;
$$;

create or replace function public.payroll_pay(p_run_id uuid, p_bank_account_id uuid, p_pay_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_slip uuid;
begin
  perform public.gl_require_finance_admin();
  select * into r from public.acc_payroll_runs where id = p_run_id;
  if not found or r.status <> 'approved' then
    raise exception 'Penggajian harus disetujui Owner sebelum dibayar.';
  end if;
  if p_bank_account_id is null or p_pay_date is null then
    raise exception 'Pilih rekening sumber dan tanggal pembayaran.';
  end if;

  update public.acc_payroll_runs set status = 'paid', bank_account_id = p_bank_account_id, pay_date = p_pay_date,
    paid_by = auth.uid(), paid_at = now() where id = p_run_id;

  update public.acc_commissions set status = 'paid', paid_at = p_pay_date::timestamp at time zone 'Asia/Makassar'
  where payslip_id in (select id from public.acc_payslips where run_id = p_run_id) and status <> 'paid';

  update public.acc_employee_loans l set status = 'paid'
  where l.status = 'active'
    and l.id in (select d.loan_id from public.acc_loan_deductions d join public.acc_payslips ps on ps.id = d.payslip_id where ps.run_id = p_run_id)
    and l.amount <= (select coalesce(sum(d2.amount), 0) from public.acc_loan_deductions d2
                     join public.acc_payslips ps2 on ps2.id = d2.payslip_id
                     join public.acc_payroll_runs r2 on r2.id = ps2.run_id
                     where d2.loan_id = l.id and r2.status = 'paid');

  for v_slip in select id from public.acc_payslips where run_id = p_run_id loop
    perform public.gl_post_payslip(v_slip);
  end loop;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'payroll_paid', 'acc_payroll_runs', p_run_id, jsonb_build_object('period', r.period, 'pay_date', p_pay_date));
end;
$$;

create or replace function public.payroll_reopen(p_run_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_slip uuid;
begin
  if coalesce(public.current_role_name(), '') <> 'owner' then
    raise exception 'Hanya Owner yang boleh membuka kembali penggajian.';
  end if;
  select * into r from public.acc_payroll_runs where id = p_run_id;
  if not found or r.status <> 'approved' then
    raise exception 'Hanya penggajian yang disetujui tapi belum dibayar yang bisa dibuka kembali.';
  end if;
  update public.acc_payroll_runs set status = 'draft', approved_by = null, approved_at = null where id = p_run_id;
  update public.acc_payslips set is_published = false where run_id = p_run_id;
  for v_slip in select id from public.acc_payslips where run_id = p_run_id loop
    perform public.gl_post_payslip(v_slip);
  end loop;
  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, new_values)
  values (auth.uid(), 'payroll_reopened', 'acc_payroll_runs', p_run_id, jsonb_build_object('period', r.period));
end;
$$;

-- ---------- RLS ----------
alter table public.acc_payroll_settings enable row level security;
alter table public.acc_staff_payroll_profiles enable row level security;
alter table public.acc_employee_loans enable row level security;
alter table public.acc_payroll_runs enable row level security;
alter table public.acc_payslips enable row level security;
alter table public.acc_loan_deductions enable row level security;

create or replace function public.my_staff_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.acc_staff_members where profile_id = auth.uid();
$$;

drop policy if exists oa_all on public.acc_payroll_settings;
create policy oa_all on public.acc_payroll_settings for all to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (public.current_role_name() in ('owner', 'admin'));

drop policy if exists oa_all on public.acc_staff_payroll_profiles;
create policy oa_all on public.acc_staff_payroll_profiles for all to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (public.current_role_name() in ('owner', 'admin'));
drop policy if exists own_select on public.acc_staff_payroll_profiles;
create policy own_select on public.acc_staff_payroll_profiles for select to authenticated
  using (staff_id in (select public.my_staff_ids()));

drop policy if exists oa_all on public.acc_employee_loans;
create policy oa_all on public.acc_employee_loans for all to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (public.current_role_name() in ('owner', 'admin'));
drop policy if exists own_select on public.acc_employee_loans;
create policy own_select on public.acc_employee_loans for select to authenticated
  using (staff_id in (select public.my_staff_ids()));

drop policy if exists oa_select on public.acc_loan_deductions;
create policy oa_select on public.acc_loan_deductions for select to authenticated
  using (public.current_role_name() in ('owner', 'admin'));
drop policy if exists own_select on public.acc_loan_deductions;
create policy own_select on public.acc_loan_deductions for select to authenticated
  using (loan_id in (select id from public.acc_employee_loans where staff_id in (select public.my_staff_ids())));

drop policy if exists oa_select on public.acc_payroll_runs;
create policy oa_select on public.acc_payroll_runs for select to authenticated
  using (public.current_role_name() in ('owner', 'admin'));
drop policy if exists oa_update on public.acc_payroll_runs;
create policy oa_update on public.acc_payroll_runs for update to authenticated
  using (public.current_role_name() in ('owner', 'admin') and status = 'draft')
  with check (public.current_role_name() in ('owner', 'admin') and status = 'draft');
drop policy if exists oa_delete on public.acc_payroll_runs;
create policy oa_delete on public.acc_payroll_runs for delete to authenticated
  using (public.current_role_name() in ('owner', 'admin') and status = 'draft');

drop policy if exists oa_select on public.acc_payslips;
create policy oa_select on public.acc_payslips for select to authenticated
  using (public.current_role_name() in ('owner', 'admin'));
drop policy if exists oa_update on public.acc_payslips;
create policy oa_update on public.acc_payslips for update to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (public.current_role_name() in ('owner', 'admin'));
drop policy if exists own_select on public.acc_payslips;
create policy own_select on public.acc_payslips for select to authenticated
  using (is_published and staff_id in (select public.my_staff_ids()));

-- Kolom yang diatur sistem tidak boleh diubah langsung dari aplikasi.
revoke update on public.acc_payslips from authenticated;
grant update (overtime_hours, bonus, bonus_note, absence_deduction, pph21, other_deduction, other_deduction_note, notes, allowances, base_salary)
  on public.acc_payslips to authenticated;
revoke update on public.acc_payroll_runs from authenticated;
grant update (notes) on public.acc_payroll_runs to authenticated;

revoke execute on function public.gl_post_payslip(uuid), public.gl_post_employee_loan(uuid) from public, anon, authenticated;
revoke execute on function public.payroll_generate(date), public.payroll_approve(uuid), public.payroll_pay(uuid, uuid, date),
  public.payroll_reopen(uuid) from public, anon;
revoke execute on function public.my_staff_ids() from public, anon;

-- Fungsi trigger tidak perlu bisa dipanggil lewat RPC; trigger tetap jalan
-- karena hak EXECUTE hanya dicek saat CREATE TRIGGER.
revoke execute on function public.gl_trg_invoice(), public.gl_trg_payment(), public.gl_trg_expense(),
  public.gl_trg_vendor_bill(), public.gl_trg_vendor_payment(), public.gl_trg_commission(),
  public.gl_trg_digital_asset(), public.gl_trg_employee_loan()
  from public, anon, authenticated;
