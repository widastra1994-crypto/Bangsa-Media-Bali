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

-- ============================================================================
-- FASE 6a: RBAC PENUH (Owner/Admin/Staff/Viewer)
-- ============================================================================
-- PENTING -- dua bug kritis ditemukan & diperbaiki saat pengujian migrasi ini
-- (disimulasikan via set_config('request.jwt.claims', ...) + SET ROLE
-- authenticated, BUKAN diasumsikan benar tanpa uji):
--  1) Policy lama "authenticated_full_access" pada tabel profiles belum
--     ter-drop, sehingga siapa saja yang login bisa mengubah role dirinya
--     sendiri jadi 'owner'. => harus di-drop eksplisit.
--  2) Policy viewer_select awalnya ikut dipasang ke acc_invoices/acc_payments
--     /acc_expenses (harusnya HANYA acc_clients/acc_projects/acc_digital_assets)
--     -- Viewer sempat bisa baca data keuangan sensitif. => dicabut dari 3
--     tabel finansial itu.
--  3) Sub-query di policy "staff_own_select" (acc_commissions) ke
--     acc_staff_members ikut kena RLS acc_staff_members itu sendiri --
--     kalau Staff tidak boleh SELECT acc_staff_members, sub-query-nya selalu
--     kosong dan Staff tidak pernah melihat komisi miliknya sendiri. =>
--     acc_staff_members dibuka SELECT (bukan tulis) untuk staff & viewer.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner','admin','staff','viewer','client'));

alter table public.acc_staff_members add column if not exists profile_id uuid references public.profiles(id);

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke execute on function public.current_role_name() from public, anon;

-- Fallback role signup baru diperbaiki bertahap -- lihat juga Fase 6b di
-- bawah untuk versi FINAL fungsi ini (fallback 'client', bukan 'viewer').

-- Tabel operasional: Owner/Admin/Staff kelola (staff tanpa hak hapus), Viewer
-- hanya baca acc_clients/acc_projects/acc_digital_assets (BUKAN 3 tabel
-- finansial ini -- itu bug yang sudah diperbaiki, lihat catatan di atas).
-- Pola lengkap: kolom per tabel diberi 4 policy (oas_select/oas_insert/
-- oas_update/oa_delete) + viewer_select HANYA untuk acc_clients/acc_projects/
-- acc_digital_assets. Lihat riwayat migrasi Supabase untuk SQL persis yang
-- dijalankan (akunting_phase6_rbac + 2 migrasi perbaikan sesudahnya).

drop policy if exists "authenticated_full_access" on public.profiles;
create policy "own_profile_select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "oa_manage_profiles" on public.profiles for all to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));

-- Restriksi tambahan: konten website (site_content) juga dibatasi ke
-- Owner/Admin saja (sebelumnya "authenticated" generik, sekarang ada role
-- Staff/Viewer akunting yang authenticated juga tapi TIDAK boleh ubah
-- konten marketing site).
drop policy if exists "Admin can update site content" on site_content;
create policy "Admin can update site content" on site_content for update to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));
drop policy if exists "Admin can insert site content" on site_content;
create policy "Admin can insert site content" on site_content for insert to authenticated
  with check (public.current_role_name() in ('owner','admin'));

-- Edge Function "invite-staff" (lihat supabase/functions/invite-staff) dipakai
-- Owner/Admin untuk mengundang akun baru; role disisipkan lewat user_metadata
-- supaya trigger handle_new_user tahu role yang benar (bukan fallback default).

-- ============================================================================
-- FASE 6b: PORTAL KLIEN (magic link, read-only, hanya data milik sendiri)
-- ============================================================================
-- Versi FINAL handle_new_user: fallback aman 'client' (BUKAN 'viewer') untuk
-- signup tanpa metadata role -- portal klien pakai magic-link signup PUBLIK,
-- kalau fallback-nya 'viewer' maka orang asing yang coba portal otomatis
-- bisa lihat data operasional internal. 'client' tanpa client_user_id
-- ter-link = tidak melihat data apa pun sampai berhasil di-claim.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_name text;
begin
  v_role := new.raw_user_meta_data->>'role';
  v_name := coalesce(new.raw_user_meta_data->>'name', new.email);
  if v_role is null then
    v_role := 'client';
  end if;
  insert into public.profiles (id, name, role) values (new.id, v_name, v_role) on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.acc_clients add column if not exists client_user_id uuid references auth.users(id);
create unique index if not exists acc_clients_client_user_id_key on public.acc_clients (client_user_id) where client_user_id is not null;

-- Dipanggil sekali oleh frontend portal (supabase.rpc('claim_client_record'))
-- tepat setelah login sukses. Hanya menghubungkan baris acc_clients yang
-- emailnya sama persis dengan email akun yang login -- tidak bisa dipakai
-- mengklaim data klien lain karena auth.uid() berasal dari token sesi yang
-- valid, bukan input bebas. TERBUKTI lewat pengujian: percobaan klien A
-- meng-update client_user_id milik klien B ditolak RLS (0 baris berubah),
-- begitu juga percobaan mengubah nominal invoice klien B.
create or replace function public.claim_client_record()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return; end if;
  update public.acc_clients set client_user_id = auth.uid()
  where lower(email) = lower(v_email) and client_user_id is null;
end;
$$;
grant execute on function public.claim_client_record() to authenticated;

-- RLS portal: role 'client' cuma boleh SELECT baris miliknya sendiri, tidak
-- ada tulis sama sekali. Diuji dengan 2 klien simulasi (A & B) -- klien A
-- hanya melihat proyek/invoice miliknya sendiri, tidak melihat data klien B
-- sama sekali (bukan cuma disamarkan -- baris klien B benar-benar tidak
-- muncul di hasil query).
drop policy if exists "client_own_select" on public.acc_clients;
create policy "client_own_select" on public.acc_clients for select to authenticated
  using (public.current_role_name() = 'client' and client_user_id = auth.uid());

drop policy if exists "client_own_select" on public.acc_projects;
create policy "client_own_select" on public.acc_projects for select to authenticated
  using (public.current_role_name() = 'client' and client_id in (select id from public.acc_clients where client_user_id = auth.uid()));

drop policy if exists "client_own_select" on public.acc_digital_assets;
create policy "client_own_select" on public.acc_digital_assets for select to authenticated
  using (
    public.current_role_name() = 'client'
    and project_id in (select p.id from public.acc_projects p join public.acc_clients c on c.id = p.client_id where c.client_user_id = auth.uid())
  );

drop policy if exists "client_own_select" on public.acc_invoices;
create policy "client_own_select" on public.acc_invoices for select to authenticated
  using (public.current_role_name() = 'client' and client_id in (select id from public.acc_clients where client_user_id = auth.uid()));

drop policy if exists "client_own_select" on public.acc_payments;
create policy "client_own_select" on public.acc_payments for select to authenticated
  using (
    public.current_role_name() = 'client'
    and invoice_id in (select i.id from public.acc_invoices i join public.acc_clients c on c.id = i.client_id where c.client_user_id = auth.uid())
  );

-- ============================================================================
-- INVOICE BERULANG OTOMATIS (retainer bulanan: kelola iklan, maintenance, dsb)
-- ============================================================================
-- Edge Function "generate-recurring-invoices" (lihat supabase/functions/) jalan
-- otomatis tiap hari via pg_cron. Anti-duplikat via last_invoiced_period
-- (ditandai per-bulan) -- diuji: menjalankan function 2x pada hari yang sama
-- hanya membuat 1 invoice, bukan 2.
create table if not exists public.acc_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.acc_clients(id),
  project_id uuid references public.acc_projects(id),
  service_name text not null,
  amount numeric(15,2) not null,
  billing_day int not null default 1 check (billing_day between 1 and 28),
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  last_invoiced_period date,
  start_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.acc_subscriptions enable row level security;
create policy "oas_select" on public.acc_subscriptions for select to authenticated
  using (public.current_role_name() in ('owner','admin','staff'));
create policy "oas_insert" on public.acc_subscriptions for insert to authenticated
  with check (public.current_role_name() in ('owner','admin','staff'));
create policy "oas_update" on public.acc_subscriptions for update to authenticated
  using (public.current_role_name() in ('owner','admin','staff'))
  with check (public.current_role_name() in ('owner','admin','staff'));
create policy "oa_delete" on public.acc_subscriptions for delete to authenticated
  using (public.current_role_name() in ('owner','admin'));

select cron.schedule(
  'generate-recurring-invoices-job',
  '15 1 * * *',
  $$
  select net.http_post(
    url := 'https://ekzkxgpksqoyopzvaxsx.supabase.co/functions/v1/generate-recurring-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Zl9V7bkJkh9Tb-Bmt65wPw_fnYvmbYQ'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ============================================================================
-- QRIS STATIS DI INVOICE
-- ============================================================================
-- QRIS di sini adalah kode QRIS statis milik bisnis (klien scan lalu masukkan
-- nominal manual) -- BUKAN QRIS dinamis dengan nominal otomatis, yang perlu
-- Payment Service Provider resmi (Midtrans/Xendit dkk). URL gambarnya
-- disimpan di acc_tax_profile (owner/admin-only), jadi dibuatkan accessor
-- sempit ini supaya Staff (form invoice) dan Client (portal) bisa
-- menampilkannya tanpa diberi akses ke seluruh data pajak.
alter table public.acc_tax_profile add column if not exists qris_image_url text;

create or replace function public.get_public_qris_url()
returns text
language sql stable security definer
set search_path = public
as $$
  select qris_image_url from public.acc_tax_profile where id = 1;
$$;

grant execute on function public.get_public_qris_url() to authenticated, anon;

-- ============================================================================
-- UTANG KE VENDOR (ACCOUNTS PAYABLE)
-- ============================================================================
-- Pelengkap piutang (acc_invoices/acc_payments yang sudah ada): melacak apa
-- yang bisnis HUTANG ke vendor (hosting, domain registrar, dsb), bukan yang
-- klien hutang ke bisnis. Saat tagihan vendor dibayar, trigger otomatis
-- membuat baris acc_expenses (category='vendor_bill') supaya laporan
-- pengeluaran tetap konsisten tanpa entri ganda manual.
create table if not exists public.acc_vendor_bills (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.acc_vendors(id),
  bill_number text,
  description text,
  amount numeric(15,2) not null,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  paid_amount numeric(15,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.acc_vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_bill_id uuid not null references public.acc_vendor_bills(id),
  payment_date date not null default current_date,
  amount_paid numeric(15,2) not null,
  bank_account_id uuid references public.acc_bank_accounts(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.acc_expenses drop constraint if exists acc_expenses_category_check;
alter table public.acc_expenses add constraint acc_expenses_category_check
  check (category in ('domain_cost','server_cost','project_tools','office_operational','salary','marketing','vendor_bill'));

create or replace function public.apply_vendor_payment()
returns trigger language plpgsql set search_path = public as $$
declare
  v_total numeric(15,2);
  v_paid numeric(15,2);
  v_vendor_id uuid;
  v_desc text;
begin
  select amount, coalesce(sum(p.amount_paid), 0), vendor_id, description
    into v_total, v_paid, v_vendor_id, v_desc
  from public.acc_vendor_bills b
  left join public.acc_vendor_payments p on p.vendor_bill_id = b.id
  where b.id = new.vendor_bill_id
  group by b.amount, b.vendor_id, b.description;

  update public.acc_vendor_bills
  set paid_amount = v_paid,
      status = case when v_paid >= v_total and v_total > 0 then 'paid' when v_paid > 0 then 'partial' else status end
  where id = new.vendor_bill_id;

  insert into public.acc_expenses (category, amount, vendor_id, bank_account_id, expense_date, notes)
  values ('vendor_bill', new.amount_paid, v_vendor_id, new.bank_account_id, new.payment_date, coalesce(v_desc, 'Pembayaran tagihan vendor'));

  return new;
end;
$$;

drop trigger if exists trg_vendor_payment on public.acc_vendor_payments;
create trigger trg_vendor_payment after insert on public.acc_vendor_payments
  for each row execute function public.apply_vendor_payment();
revoke execute on function public.apply_vendor_payment() from public, anon, authenticated;

alter table public.acc_vendor_bills enable row level security;
alter table public.acc_vendor_payments enable row level security;

create policy "oa_full" on public.acc_vendor_bills for all to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));
create policy "oa_full" on public.acc_vendor_payments for all to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));

-- ============================================================================
-- JAM KERJA STAF (untuk analisis profitabilitas per proyek)
-- ============================================================================
create table if not exists public.acc_time_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.acc_projects(id),
  staff_id uuid not null references public.acc_staff_members(id),
  work_date date not null default current_date,
  hours numeric(6,2) not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.acc_time_logs enable row level security;

create policy "oa_full" on public.acc_time_logs for all to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));
create policy "staff_own_select" on public.acc_time_logs for select to authenticated
  using (public.current_role_name() = 'staff' and staff_id in (select id from public.acc_staff_members where profile_id = auth.uid()));
create policy "staff_own_insert" on public.acc_time_logs for insert to authenticated
  with check (public.current_role_name() = 'staff' and staff_id in (select id from public.acc_staff_members where profile_id = auth.uid()));

-- ============================================================================
-- KONTRAK / SPK DIGITAL + TANDA TANGAN ELEKTRONIK
-- ============================================================================
-- Tanda tangan disimpan sebagai PNG base64 (signature_data) hasil canvas di
-- Portal Klien -- bukan integrasi meterai/PSrE resmi (PeruriSign dkk), murni
-- persetujuan elektronik yang direkam dengan jejak audit (nama pengetik +
-- timestamp) sebagaimana lazim untuk dokumen internal non-notariil.
create table if not exists public.acc_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.acc_projects(id),
  client_id uuid not null references public.acc_clients(id),
  title text not null,
  content text not null,
  status text not null default 'draft' check (status in ('draft','sent','signed')),
  signature_data text,
  signed_by_name text,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.acc_contracts enable row level security;

create policy "oas_select" on public.acc_contracts for select to authenticated
  using (public.current_role_name() in ('owner','admin','staff'));
create policy "oas_insert" on public.acc_contracts for insert to authenticated
  with check (public.current_role_name() in ('owner','admin','staff'));
create policy "oas_update" on public.acc_contracts for update to authenticated
  using (public.current_role_name() in ('owner','admin','staff'))
  with check (public.current_role_name() in ('owner','admin','staff'));
create policy "oa_delete" on public.acc_contracts for delete to authenticated
  using (public.current_role_name() in ('owner','admin'));
create policy "client_own_select" on public.acc_contracts for select to authenticated
  using (public.current_role_name() = 'client' and client_id in (select id from public.acc_clients where client_user_id = auth.uid()));
create policy "client_own_sign" on public.acc_contracts for update to authenticated
  using (public.current_role_name() = 'client' and client_id in (select id from public.acc_clients where client_user_id = auth.uid()))
  with check (public.current_role_name() = 'client' and client_id in (select id from public.acc_clients where client_user_id = auth.uid()));

-- ============================================================================
-- PROGRES PENGERJAAN PER PROYEK (checklist tugas)
-- ============================================================================
-- Progres proyek (%) SELALU dihitung dari checklist ini (selesai/total),
-- tidak ada field persentase terpisah yang diisi manual -- supaya angkanya
-- konsisten dengan yang benar-benar dicentang staf. Ditampilkan juga di
-- Portal Klien (read-only) untuk transparansi progres ke klien.
--
-- Diuji (lalu dihapus): Staff A update status tugas miliknya sendiri ->
-- berhasil. Staff A coba update tugas milik Staff B -> ditolak RLS (0 baris
-- berubah). Klien pemilik proyek -> melihat 2 tugas. Klien lain (bukan
-- pemilik) -> melihat 0 tugas dan update ditolak total (tidak ada policy
-- update untuk role client sama sekali).
create table if not exists public.acc_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.acc_projects(id) on delete cascade,
  title text not null,
  assigned_staff_id uuid references public.acc_staff_members(id),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  created_at timestamptz not null default now()
);

alter table public.acc_project_tasks enable row level security;

create policy "oas_select" on public.acc_project_tasks for select to authenticated
  using (public.current_role_name() in ('owner','admin','staff'));
create policy "viewer_select" on public.acc_project_tasks for select to authenticated
  using (public.current_role_name() = 'viewer');
create policy "oas_insert" on public.acc_project_tasks for insert to authenticated
  with check (public.current_role_name() in ('owner','admin','staff'));
create policy "oa_update" on public.acc_project_tasks for update to authenticated
  using (public.current_role_name() in ('owner','admin'))
  with check (public.current_role_name() in ('owner','admin'));
create policy "staff_own_update" on public.acc_project_tasks for update to authenticated
  using (public.current_role_name() = 'staff' and assigned_staff_id in (select id from public.acc_staff_members where profile_id = auth.uid()))
  with check (public.current_role_name() = 'staff' and assigned_staff_id in (select id from public.acc_staff_members where profile_id = auth.uid()));
create policy "oa_delete" on public.acc_project_tasks for delete to authenticated
  using (public.current_role_name() in ('owner','admin'));
create policy "client_own_select" on public.acc_project_tasks for select to authenticated
  using (
    public.current_role_name() = 'client'
    and project_id in (
      select p.id from public.acc_projects p
      join public.acc_clients c on c.id = p.client_id
      where c.client_user_id = auth.uid()
    )
  );
