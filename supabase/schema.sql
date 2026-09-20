-- Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor > New query > Run.
--
-- Modul Akunting (Fase 1: Master Data, Transaksi Terpadu, Invoice/Piutang)
-- ada di file terpisah: supabase/schema_akunting.sql -- dipisah karena data
-- akunting sensitif dan tidak berbagi tabel apa pun dengan konten website.

create table if not exists consultation_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text,
  business_name text,
  business_type text,
  address text,
  services text[],
  scale text,
  estimated_total numeric,
  consult_date date,
  consult_time text,
  status text not null default 'baru'
);

alter table consultation_leads enable row level security;

-- Publik (pengunjung website) hanya boleh menambah data, tidak boleh membaca data lead lain.
drop policy if exists "Public can submit leads" on consultation_leads;
create policy "Public can submit leads"
  on consultation_leads for insert
  to anon
  with check (true);

-- View tanpa data pribadi (tanpa nama/telepon/email), hanya tanggal+jam,
-- dipakai kalkulator untuk menandai slot yang sudah penuh. Aman dibaca publik.
-- security_invoker=true supaya view menghormati RLS pemanggil, bukan RLS pembuat view.
drop view if exists booked_slots;
create view booked_slots
  with (security_invoker = true)
  as
  select consult_date, consult_time
  from consultation_leads
  where consult_date is not null and consult_time is not null;

grant select on booked_slots to anon;

-- Admin (login lewat Supabase Auth) boleh membaca & mengubah status leads,
-- dipakai oleh Dashboard Analitik di /admin. Selain lewat dashboard bawaan
-- Supabase (Table Editor), sekarang bisa juga langsung dari CMS admin.
drop policy if exists "Admin can read leads" on consultation_leads;
create policy "Admin can read leads"
  on consultation_leads for select
  to authenticated
  using (true);

drop policy if exists "Admin can update leads" on consultation_leads;
create policy "Admin can update leads"
  on consultation_leads for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- NOTIFIKASI LEAD BARU KE TELEGRAM (opsional)
-- ============================================================================
-- Setiap ada lead baru, trigger ini otomatis memanggil Edge Function
-- "notify-lead" (lihat supabase/functions/notify-lead/index.ts) yang meneruskan
-- notifikasi ke Telegram tim. Anon key di bawah ini PUBLIK (sama dengan yang
-- dipakai frontend di .env), bukan rahasia -- keamanan sesungguhnya ada di
-- RLS di atas dan di secret TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID yang disimpan
-- terpisah sebagai Edge Function secret (BUKAN di database ini).
--
-- Aktivasi: buat bot via @BotFather di Telegram (dapat TELEGRAM_BOT_TOKEN),
-- lalu isi TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID di Dashboard Supabase >
-- Edge Functions > notify-lead > Secrets. Selama secret belum diisi, function
-- ini diam saja (tidak error, tidak mengganggu penyimpanan lead).
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://ekzkxgpksqoyopzvaxsx.supabase.co/functions/v1/notify-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Zl9V7bkJkh9Tb-Bmt65wPw_fnYvmbYQ'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

-- Trigger tetap otomatis jalan tanpa perlu grant EXECUTE eksplisit; baris di
-- bawah ini hanya menutup celah supaya fungsinya tidak bisa dipanggil manual
-- lewat endpoint RPC publik (/rest/v1/rpc/notify_new_lead).
revoke execute on function public.notify_new_lead() from public, anon, authenticated;

drop trigger if exists on_lead_insert_notify on consultation_leads;
create trigger on_lead_insert_notify
  after insert on consultation_leads
  for each row execute function public.notify_new_lead();

-- Untuk melihat & mengelola daftar leads (nama, telepon, dll), selain lewat
-- Dashboard Analitik di /admin, Anda juga bisa pakai Table Editor di Supabase
-- Dashboard (menu kiri > Table Editor > consultation_leads).

-- ============================================================================
-- KONTEN WEBSITE (menggantikan localStorage supaya SEMUA pengunjung melihat
-- versi konten yang sama, bukan hanya browser admin yang mengedit).
-- ============================================================================
create table if not exists site_content (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 1)
);

alter table site_content enable row level security;

-- Semua orang (pengunjung website) boleh membaca konten -> supaya website tampil.
drop policy if exists "Public can read site content" on site_content;
create policy "Public can read site content"
  on site_content for select
  to anon, authenticated
  using (true);

-- Hanya admin yang sudah login (Supabase Auth) yang boleh mengubah konten.
drop policy if exists "Admin can update site content" on site_content;
create policy "Admin can update site content"
  on site_content for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admin can insert site content" on site_content;
create policy "Admin can insert site content"
  on site_content for insert
  to authenticated
  with check (true);

-- ============================================================================
-- AKUN ADMIN
-- ============================================================================
-- Buat akun login admin di: Dashboard Supabase > Authentication > Users > Add user.
-- Isi email & password Anda sendiri, lalu centang "Auto Confirm User".
-- Email & password itulah yang dipakai untuk login di halaman /admin website.
-- Tidak perlu SQL tambahan untuk langkah ini.
