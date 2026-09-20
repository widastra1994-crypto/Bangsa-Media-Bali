-- Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor > New query > Run.

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

-- Untuk melihat & mengelola daftar leads (nama, telepon, dll), gunakan
-- Table Editor di Supabase Dashboard (menu kiri > Table Editor > consultation_leads).
-- Di sana Anda bisa lihat, cari, filter, urutkan, dan ubah kolom `status`
-- (mis. "baru" -> "dihubungi" -> "selesai") tanpa perlu kode tambahan.

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
