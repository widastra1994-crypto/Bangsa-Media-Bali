-- ============================================================================
-- MODUL AKUNTING - FASE 1 (Fondasi)
-- Jalankan file ini di Supabase Dashboard > SQL Editor > New query > Run,
-- SETELAH schema.sql (modul akunting terpisah dari konten website).
--
-- Referensi: "MANAGEMENT AKUNTING BANGSA MEDIA BALI.xlsx" (FRD v2.1).
-- Fase 1 mencakup: Master Data, Form Transaksi Terpadu, Invoice & Piutang
-- dasar. Fase lanjutan (Aset Digital lengkap dgn monitoring uptime/SSL,
-- notifikasi email berjenjang H-60..H+7, rekonsiliasi bank otomatis, pajak,
-- portal klien, RBAC Staff/Viewer penuh) menyusul di fase berikutnya.
--
-- Adaptasi dari FRD:
-- - Tabel `users` custom (dgn password_hash) DIGANTI dengan `profiles` yang
--   terhubung ke Supabase Auth (auth.users) -- password sudah ditangani aman
--   oleh Supabase Auth, tidak perlu disimpan manual.
-- - Ditambahkan `acc_service_categories`, `acc_bank_accounts`,
--   `acc_staff_members` sebagai master data yang direferensikan tabel lain
--   di FRD namun belum ada definisi tabelnya sendiri.
-- - Semua tabel akunting diberi prefix `acc_` agar terpisah jelas dari data
--   konten website (site_content, consultation_leads) dan tidak bentrok nama.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'owner' check (role in ('owner','admin','staff','viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.email, 'owner')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, name, role)
select id, email, 'owner' from auth.users
on conflict (id) do nothing;

create table if not exists public.acc_service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_vendors (
  id uuid primary key default gen_random_uuid(),
  vendor_name text not null,
  vendor_type text not null check (vendor_type in ('domain','server','lainnya')),
  contact_person text,
  login_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_type text not null check (account_type in ('kas_tunai','bank')),
  bank_name text,
  account_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_type text not null check (role_type in ('developer','designer','sales','lainnya')),
  default_commission_percent numeric(5,2),
  default_commission_flat numeric(15,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_clients (
  id uuid primary key default gen_random_uuid(),
  client_type text not null check (client_type in ('perorangan','badan_usaha')),
  company_name text not null,
  pic_name text,
  email text not null,
  phone_primary text,
  phone_secondary text,
  address text,
  business_type text,
  referral_code text unique,
  referred_by uuid references public.acc_clients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acc_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.acc_clients(id),
  service_category_id uuid references public.acc_service_categories(id),
  website_name text,
  deal_price numeric(15,2) not null default 0,
  budget_limit numeric(15,2),
  developer_id uuid references public.acc_staff_members(id),
  designer_id uuid references public.acc_staff_members(id),
  sales_id uuid references public.acc_staff_members(id),
  project_date date not null default current_date,
  status text not null default 'planning' check (status in ('planning','in_progress','completed','cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acc_digital_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.acc_projects(id) on delete cascade,
  domain_vendor_id uuid references public.acc_vendors(id),
  server_vendor_id uuid references public.acc_vendors(id),
  domain_name text,
  registration_date date,
  expiry_date date,
  domain_cost numeric(15,2) not null default 0,
  server_cost numeric(15,2) not null default 0,
  status text not null default 'active' check (status in ('active','pending_renewal','grace_period','expired','terminated')),
  uptime_status text check (uptime_status in ('up','down','degraded')),
  ssl_expiry_date date,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence if not exists public.acc_invoice_seq;
create sequence if not exists public.acc_receipt_seq;

create table if not exists public.acc_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  project_id uuid references public.acc_projects(id),
  client_id uuid not null references public.acc_clients(id),
  invoice_type text not null check (invoice_type in ('project_deposit','project_settlement','domain_renewal','server_renewal','recurring_retainer')),
  subtotal numeric(15,2) not null default 0,
  tax_type text not null default 'none' check (tax_type in ('none','pph_final','pph_23','ppn')),
  tax_amount numeric(15,2) not null default 0,
  total_amount numeric(15,2) not null default 0,
  paid_amount numeric(15,2) not null default 0,
  due_date date,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','overdue','cancelled')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_invoice_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.acc_invoice_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_number on public.acc_invoices;
create trigger trg_invoice_number
  before insert on public.acc_invoices
  for each row execute function public.set_invoice_number();

create table if not exists public.acc_payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique,
  invoice_id uuid not null references public.acc_invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount_paid numeric(15,2) not null,
  payment_method text not null check (payment_method in ('bank_transfer','direct_mutasi','cash','qris')),
  bank_account_id uuid references public.acc_bank_accounts(id),
  proof_of_payment_url text,
  is_verified boolean not null default true,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_receipt_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.receipt_number is null then
    new.receipt_number := 'KWT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.acc_receipt_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_receipt_number on public.acc_payments;
create trigger trg_receipt_number
  before insert on public.acc_payments
  for each row execute function public.set_receipt_number();

-- Setiap pembayaran baru: update paid_amount & status invoice terkait, dan
-- begitu invoice Lunas: alihkan komisi proyek dari pending -> payable, dan
-- (Fase 2) jika invoice bertipe domain_renewal/server_renewal, perpanjang
-- expiry_date aset digital terkait +1 tahun & set status kembali 'active'.
create or replace function public.apply_payment_to_invoice()
returns trigger language plpgsql set search_path = public as $$
declare
  v_total numeric(15,2);
  v_paid numeric(15,2);
  v_project_id uuid;
  v_invoice_type text;
  v_new_status text;
begin
  select total_amount, coalesce(sum(p.amount_paid), 0), project_id, invoice_type
    into v_total, v_paid, v_project_id, v_invoice_type
  from public.acc_invoices i
  left join public.acc_payments p on p.invoice_id = i.id
  where i.id = new.invoice_id
  group by i.total_amount, i.project_id, i.invoice_type;

  v_new_status := case when v_paid >= v_total and v_total > 0 then 'paid'
                       when v_paid > 0 then 'partial'
                       else null end;

  update public.acc_invoices
  set paid_amount = v_paid,
      status = coalesce(v_new_status, status),
      updated_at = now()
  where id = new.invoice_id;

  if v_new_status = 'paid' and v_project_id is not null then
    update public.acc_commissions
    set status = 'payable'
    where project_id = v_project_id and status = 'pending';

    if v_invoice_type in ('domain_renewal', 'server_renewal') then
      update public.acc_digital_assets
      set expiry_date = (coalesce(expiry_date, current_date) + interval '1 year')::date,
          status = 'active',
          last_checked_at = now()
      where project_id = v_project_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_payment on public.acc_payments;
create trigger trg_apply_payment
  after insert on public.acc_payments
  for each row execute function public.apply_payment_to_invoice();

create table if not exists public.acc_commissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.acc_projects(id) on delete cascade,
  staff_id uuid not null references public.acc_staff_members(id),
  role_in_project text not null check (role_in_project in ('developer','designer','sales')),
  commission_amount numeric(15,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','payable','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.acc_projects(id),
  category text not null check (category in ('domain_cost','server_cost','project_tools','office_operational','salary','marketing')),
  amount numeric(15,2) not null,
  vendor_id uuid references public.acc_vendors(id),
  bank_account_id uuid references public.acc_bank_accounts(id),
  expense_date date not null default current_date,
  notes text,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.acc_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity_name text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- RLS: seluruh tabel akunting HANYA bisa diakses user yang sudah login
-- (authenticated). Tidak ada akses anon sama sekali -- berbeda dengan
-- site_content yang sengaja public-read untuk keperluan website.
-- Fase 1 belum membedakan Owner/Admin/Staff/Viewer (semua yang login =
-- akses penuh); pembatasan per-role menyusul di fase RBAC.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','acc_service_categories','acc_vendors','acc_bank_accounts',
      'acc_staff_members','acc_clients','acc_projects','acc_digital_assets',
      'acc_invoices','acc_payments','acc_commissions','acc_expenses','acc_audit_logs'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated_full_access" on public.%I', t);
    execute format(
      'create policy "authenticated_full_access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

revoke execute on function public.set_invoice_number() from public, anon, authenticated;
revoke execute on function public.set_receipt_number() from public, anon, authenticated;
revoke execute on function public.apply_payment_to_invoice() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- EMAIL INVOICE/KUITANSI (Resend)
-- ============================================================================
-- Edge Function "send-finance-email" (lihat supabase/functions/send-finance-email)
-- sudah di-deploy dan dipanggil dari CMS admin (butuh login) tiap kali invoice
-- diterbitkan atau pembayaran dicatat. Aktivasi: set secret RESEND_API_KEY
-- (dari resend.com) & FROM_EMAIL di Dashboard Supabase > Edge Functions >
-- send-finance-email > Secrets. Selama RESEND_API_KEY belum diisi, transaksi
-- tetap tersimpan normal, hanya email yang tidak terkirim (pesan error jelas
-- ditampilkan di CMS, tidak mengganggu penyimpanan data).

-- ============================================================================
-- FASE 3: NOTIFIKASI EMAIL BERJENJANG (H-60 s/d H+7)
-- ============================================================================
-- Log supaya pengingat yang sama tidak terkirim berulang. Untuk aset,
-- expiry_date ikut jadi bagian unique key -> siklus perpanjangan berikutnya
-- (expiry_date baru) otomatis dapat jatah pengingat baru lagi.
create table if not exists public.acc_asset_reminder_log (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.acc_digital_assets(id) on delete cascade,
  stage text not null check (stage in ('h60','h30','h14','h7','h1','h0')),
  expiry_date date not null,
  sent_at timestamptz not null default now(),
  unique (asset_id, stage, expiry_date)
);

create table if not exists public.acc_invoice_reminder_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.acc_invoices(id) on delete cascade,
  stage text not null check (stage in ('h-3','h0','h+3','h+7')),
  sent_at timestamptz not null default now(),
  unique (invoice_id, stage)
);

alter table public.acc_asset_reminder_log enable row level security;
alter table public.acc_invoice_reminder_log enable row level security;

drop policy if exists "authenticated_full_access" on public.acc_asset_reminder_log;
create policy "authenticated_full_access" on public.acc_asset_reminder_log for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.acc_invoice_reminder_log;
create policy "authenticated_full_access" on public.acc_invoice_reminder_log for all to authenticated using (true) with check (true);

-- Edge Function "daily-reminders" (lihat supabase/functions/daily-reminders)
-- dijalankan otomatis tiap hari jam 01:00 UTC (~09:00 WITA) via pg_cron di
-- bawah ini. Fungsi ini memakai SERVICE_ROLE_KEY internal (bypass RLS) karena
-- ini job sistem terjadwal, bukan request user yang login. Aktivasi email:
-- sama seperti send-finance-email, isi RESEND_API_KEY & FROM_EMAIL di
-- Supabase Dashboard > Edge Functions > daily-reminders > Secrets.
--
-- Skema A (Aset Digital): H-60 estimasi biaya, H-30 terbitkan invoice
-- perpanjangan otomatis + kirim tagihan, H-14 follow-up status bayar,
-- H-7 peringatan krusial, H-1 peringatan darurat, Hari H masuk grace period.
-- Skema B (Piutang): H-3 pengingat, Hari H jatuh tempo, H+3 & H+7 overdue
-- (invoice otomatis ditandai status 'overdue' begitu lewat jatuh tempo).
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'daily-reminders-job',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://ekzkxgpksqoyopzvaxsx.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Zl9V7bkJkh9Tb-Bmt65wPw_fnYvmbYQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- FASE 4a: REKONSILIASI MUTASI BANK (via impor CSV, BUKAN scraper kredensial)
-- ============================================================================
-- Adaptasi keamanan dari FRD: "Direct Bank Scraper" yang menyimpan password
-- internet banking TIDAK dibuat (risiko keamanan tinggi -- menyimpan
-- kredensial perbankan pihak ketiga bukan praktik yang aman). Sebagai
-- gantinya: admin ekspor mutasi dari internet banking ke CSV, lalu impor di
-- CMS (tab Rekonsiliasi Bank). Pencocokan otomatis tetap berjalan sesuai
-- spesifikasi (mencocokkan nominal unik ke invoice yang belum lunas).
create table if not exists public.acc_bank_mutations (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.acc_bank_accounts(id),
  mutation_date date not null,
  description text,
  amount numeric(15,2) not null,
  direction text not null check (direction in ('in','out')),
  matched_payment_id uuid references public.acc_payments(id),
  is_matched boolean not null default false,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.profiles(id)
);

alter table public.acc_bank_mutations enable row level security;
drop policy if exists "authenticated_full_access" on public.acc_bank_mutations;
create policy "authenticated_full_access" on public.acc_bank_mutations for all to authenticated using (true) with check (true);

-- ============================================================================
-- FASE 4b: MONITORING UPTIME WEBSITE
-- ============================================================================
-- Catatan: pengecekan masa berlaku sertifikat SSL TIDAK diimplementasikan --
-- inspeksi detail sertifikat TLS di runtime Deno Edge Function tidak cukup
-- andal untuk fitur produksi. Uptime check (status HTTP) berjalan penuh,
-- dijadwalkan tiap 30 menit via pg_cron + Edge Function "uptime-check".
alter table public.acc_digital_assets add column if not exists website_url text;

select cron.schedule(
  'uptime-check-job',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://ekzkxgpksqoyopzvaxsx.supabase.co/functions/v1/uptime-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Zl9V7bkJkh9Tb-Bmt65wPw_fnYvmbYQ'
    ),
    body := '{}'::jsonb
  );
  $$
);
-- Aktivasi email alert website down: set RESEND_API_KEY, FROM_EMAIL, dan
-- INTERNAL_ALERT_EMAIL (email tim teknis internal) di Supabase Dashboard >
-- Edge Functions > uptime-check > Secrets.

-- ============================================================================
-- FASE 5a: PROFIL & PELACAKAN PAJAK (estimasi internal, BUKAN sistem e-Filing
-- resmi -- selalu verifikasi dengan konsultan pajak sebelum lapor SPT)
-- ============================================================================
create table if not exists public.acc_tax_profile (
  id int primary key default 1,
  npwp text,
  is_pkp boolean not null default false,
  business_name text,
  pph_final_rate numeric(5,2) not null default 0.5,
  pph23_rate numeric(5,2) not null default 2,
  ppn_rate numeric(5,2) not null default 11,
  updated_at timestamptz not null default now(),
  constraint acc_tax_profile_single_row check (id = 1)
);

alter table public.acc_tax_profile enable row level security;
drop policy if exists "authenticated_full_access" on public.acc_tax_profile;
create policy "authenticated_full_access" on public.acc_tax_profile for all to authenticated using (true) with check (true);

alter table public.acc_invoices add column if not exists is_pph23_withheld boolean not null default false;
alter table public.acc_invoices add column if not exists pph23_bukti_potong text;
alter table public.acc_invoices add column if not exists is_ppn_applicable boolean not null default false;

-- FASE 5b: Audit Trail memakai tabel acc_audit_logs yang sudah ada sejak
-- Fase 1 -- kini benar-benar dipakai dari frontend (lihat src/admin/accounting/auditLog.js).
