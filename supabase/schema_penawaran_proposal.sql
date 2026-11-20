-- ============================================================================
-- PENAWARAN FORMAT PROPOSAL
-- Penawaran kini berupa dokumen proposal bersection (Pendahuluan, Tujuan,
-- Ruang Lingkup, Tahapan, Ketentuan, Penutup, ...). sections = [{title,
-- content}] dengan penanda {"type":"pricing"} = posisi blok Estimasi Waktu,
-- Investasi (paket) & Maintenance. Isi section memakai format sederhana:
-- "## sub judul", "- poin", "1. poin bernomor", "**tebal**".
-- ============================================================================
alter table public.acc_quotations
  add column if not exists doc_title text,
  add column if not exists addressed_to text,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists estimated_duration text,
  add column if not exists maintenance_fee numeric(15,2),
  add column if not exists maintenance_period text not null default 'tahun' check (maintenance_period in ('bulan', 'tahun')),
  add column if not exists maintenance_note text;

create or replace function public.quotation_public_open(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q public.acc_quotations%rowtype;
  c record;
  k public.acc_contracts%rowtype;
  v_inv_token uuid;
begin
  select * into q from public.acc_quotations where public_token = p_token and status not in ('draft', 'cancelled');
  if not found then return null; end if;

  if q.status = 'sent' then
    update public.acc_quotations set status = 'viewed', viewed_at = now() where id = q.id returning * into q;
    perform public.quotation_notify(q, 'viewed', 'Penawaran ' || q.quote_number || ' dibuka klien',
      (select company_name from public.acc_clients where id = q.client_id) || ' · ' || q.title, 'low');
  end if;

  select company_name, pic_name into c from public.acc_clients where id = q.client_id;
  if q.contract_id is not null then select * into k from public.acc_contracts where id = q.contract_id; end if;
  if q.invoice_id is not null then select public_token into v_inv_token from public.acc_invoices where id = q.invoice_id; end if;

  return jsonb_build_object(
    'quote', jsonb_build_object(
      'quote_number', q.quote_number, 'service_type', q.service_type, 'title', q.title, 'needs', q.needs, 'solution', q.solution,
      'doc_title', q.doc_title, 'addressed_to', q.addressed_to, 'sections', q.sections, 'estimated_duration', q.estimated_duration,
      'maintenance_fee', q.maintenance_fee, 'maintenance_period', q.maintenance_period, 'maintenance_note', q.maintenance_note,
      'packages', q.packages, 'timeline', q.timeline, 'payment_terms', q.payment_terms, 'guarantee', q.guarantee,
      'revisions', q.revisions, 'terms', q.terms, 'valid_until', q.valid_until, 'status', q.status,
      'accepted_package', q.accepted_package, 'created_at', q.created_at,
      'expired', q.valid_until is not null and q.valid_until < public.gl_local_date(now()) and q.status in ('sent', 'viewed', 'revision_requested')),
    'client', jsonb_build_object('company_name', c.company_name, 'pic_name', c.pic_name),
    'contract', case when k.id is null then null else jsonb_build_object(
      'title', k.title, 'content', k.content, 'status', k.status, 'signed_by_name', k.signed_by_name,
      'signed_at', k.signed_at, 'signature_data', k.signature_data, 'created_at', k.created_at) end,
    'invoice_token', v_inv_token);
end;
$$;

-- Kontrak: tambahkan estimasi waktu & biaya maintenance bila diisi.
create or replace function public.quotation_contract_text(q public.acc_quotations, p_package int)
returns text language plpgsql stable set search_path = public as $$
declare
  c record;
  pk jsonb := q.packages -> p_package;
  v_price numeric := coalesce((pk->>'price')::numeric, 0);
  v text;
  n int := 0;
  e jsonb;
  t text;
begin
  select company_name, pic_name, address into c from public.acc_clients where id = q.client_id;
  v := 'PERJANJIAN KERJA SAMA' || E'\n' || 'Nomor: KTR-' || substr(q.quote_number, 5) || E'\n'
    || 'Berdasarkan penawaran ' || q.quote_number || coalesce(' - ' || nullif(q.doc_title, ''), '') || E'\n\n';

  n := n + 1;
  v := v || n || '. PARA PIHAK' || E'\n'
    || 'Pihak Pertama: Bangsa Media Bali, selaku penyedia jasa.' || E'\n'
    || 'Pihak Kedua: ' || coalesce(c.company_name, '-') || coalesce(' (PIC: ' || nullif(c.pic_name, '') || ')', '')
    || coalesce(', ' || nullif(c.address, ''), '') || ', selaku klien.' || E'\n\n';

  n := n + 1;
  v := v || n || '. LINGKUP PEKERJAAN' || E'\n' || q.title || ' - Paket ' || coalesce(pk->>'name', '-') || ':' || E'\n';
  for t in select jsonb_array_elements_text(coalesce(pk->'features', '[]'::jsonb)) loop
    v := v || '- ' || t || E'\n';
  end loop;
  v := v || 'Rincian ruang lingkup mengikuti proposal penawaran ' || q.quote_number || ' yang menjadi bagian tidak terpisahkan dari perjanjian ini.' || E'\n\n';

  n := n + 1;
  v := v || n || '. NILAI KONTRAK' || E'\n' || public.rupiah(v_price) || ' (belum termasuk pajak bila ada).' || E'\n\n';

  if jsonb_array_length(q.payment_terms) > 0 then
    n := n + 1;
    v := v || n || '. TERMIN PEMBAYARAN' || E'\n';
    for e in select * from jsonb_array_elements(q.payment_terms) loop
      v := v || '- ' || coalesce(e->>'label', 'Termin') || ' ' || coalesce(e->>'percent', '0') || '%: '
        || public.rupiah(v_price * coalesce((e->>'percent')::numeric, 0) / 100) || E'\n';
    end loop;
    v := v || 'Pekerjaan dimulai setelah pembayaran termin pertama diterima.' || E'\n\n';
  end if;

  if nullif(q.estimated_duration, '') is not null or jsonb_array_length(q.timeline) > 0 then
    n := n + 1;
    v := v || n || '. JADWAL PENGERJAAN' || E'\n';
    if nullif(q.estimated_duration, '') is not null then
      v := v || 'Estimasi pengerjaan: ' || q.estimated_duration || '.' || E'\n';
    end if;
    for t in select jsonb_array_elements_text(q.timeline) loop
      v := v || '- ' || t || E'\n';
    end loop;
    v := v || E'\n';
  end if;

  if coalesce(q.maintenance_fee, 0) > 0 then
    n := n + 1;
    v := v || n || '. MAINTENANCE & PENGELOLAAN SISTEM' || E'\n'
      || 'Setelah serah terima, layanan maintenance sebesar ' || public.rupiah(q.maintenance_fee) || ' per ' || q.maintenance_period
      || ', ditagihkan terpisah sesuai periode berjalan.' || E'\n\n';
  end if;

  n := n + 1;
  v := v || n || '. REVISI DAN GARANSI' || E'\n'
    || 'Revisi: ' || coalesce(q.revisions::text || ' kali', 'sesuai kesepakatan') || '.' || E'\n'
    || 'Garansi: ' || coalesce(nullif(q.guarantee, ''), 'perbaikan kesalahan teknis sesuai kesepakatan') || '.' || E'\n\n';

  n := n + 1;
  v := v || n || '. HAK MILIK' || E'\n'
    || 'Hasil pekerjaan menjadi milik Pihak Kedua setelah seluruh pembayaran lunas. Pihak Pertama boleh menampilkan hasil pekerjaan sebagai portofolio kecuali disepakati lain.' || E'\n\n';

  n := n + 1;
  v := v || n || '. PEMBATALAN' || E'\n'
    || 'Bila Pihak Kedua membatalkan setelah pekerjaan dimulai, pembayaran yang sudah diterima tidak dapat dikembalikan. Bila Pihak Pertama tidak dapat menyelesaikan pekerjaan, pembayaran untuk bagian yang belum dikerjakan dikembalikan.' || E'\n\n';

  if nullif(trim(q.terms), '') is not null then
    n := n + 1;
    v := v || n || '. KETENTUAN TAMBAHAN' || E'\n' || trim(q.terms) || E'\n\n';
  end if;

  v := v || 'Dengan menandatangani secara elektronik, Pihak Kedua menyatakan telah membaca dan menyetujui seluruh isi perjanjian ini.';
  return v;
end;
$$;
revoke execute on function public.quotation_contract_text(public.acc_quotations, int) from public, anon, authenticated;
