-- ============================================================================
-- PENAWARAN (QUOTATION) -> KONTRAK -> PROYEK + INVOICE
--  Admin membuat penawaran (paket pilihan, timeline, termin, garansi) lalu
--  membagikan link /penawaran/:token. Klien (tanpa login) membuka, memilih
--  paket & menyetujui -> kontrak dibuat otomatis dari isi penawaran -> klien
--  tanda tangan -> proyek + invoice proyek dibuat otomatis.
--  Fungsi publik berbasis token acak per penawaran (seperti link invoice).
-- ============================================================================
create sequence if not exists public.acc_quotation_seq;

create table if not exists public.acc_quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique,
  client_id uuid not null references public.acc_clients(id) on delete cascade,
  service_type text not null default 'website' check (service_type in ('website', 'system', 'design', 'marketing', 'other')),
  title text not null check (length(trim(title)) > 0),
  needs text,
  solution text,
  packages jsonb not null default '[]'::jsonb,       -- [{name, price, recommended, features: [text]}]
  timeline jsonb not null default '[]'::jsonb,       -- [text]
  payment_terms jsonb not null default '[]'::jsonb,  -- [{label, percent}]
  guarantee text,
  revisions int,
  terms text,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'revision_requested', 'accepted', 'signed', 'rejected', 'cancelled')),
  public_token uuid not null default gen_random_uuid() unique,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_package int,
  revision_note text,
  contract_id uuid references public.acc_contracts(id) on delete set null,
  project_id uuid references public.acc_projects(id) on delete set null,
  invoice_id uuid references public.acc_invoices(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists acc_quotations_client_idx on public.acc_quotations(client_id);

create or replace function public.quotation_set_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.quote_number is null then
    new.quote_number := 'PNW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.acc_quotation_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_quotation_number on public.acc_quotations;
create trigger trg_quotation_number before insert or update on public.acc_quotations
  for each row execute function public.quotation_set_number();

alter table public.acc_quotations enable row level security;
drop policy if exists q_select on public.acc_quotations;
create policy q_select on public.acc_quotations for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
drop policy if exists q_insert on public.acc_quotations;
create policy q_insert on public.acc_quotations for insert to authenticated
  with check (public.current_role_name() in ('owner', 'admin', 'staff'));
drop policy if exists q_update on public.acc_quotations;
create policy q_update on public.acc_quotations for update to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff')) with check (public.current_role_name() in ('owner', 'admin', 'staff'));
drop policy if exists q_delete on public.acc_quotations;
create policy q_delete on public.acc_quotations for delete to authenticated
  using (public.current_role_name() in ('owner', 'admin'));

-- ---------- helper ----------
create or replace function public.rupiah(p numeric)
returns text language sql immutable set search_path = public as $$
  select 'Rp' || replace(to_char(round(coalesce(p, 0)), 'FM999,999,999,999'), ',', '.');
$$;

create or replace function public.quotation_notify(q public.acc_quotations, p_stage text, p_title text, p_body text, p_severity text default 'medium')
returns void language sql security definer set search_path = public as $$
  insert into public.acc_admin_notifications (kind, severity, title, body, client_id, stage, cycle_date, tab)
  values ('quotation', p_severity, p_title, p_body, q.client_id, p_stage || ':' || q.id, current_date, 'acc-quotations');
$$;

-- Isi kontrak dari penawaran + paket yang dipilih.
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
    || 'Berdasarkan penawaran ' || q.quote_number || E'\n\n';

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
  v := v || E'\n';

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

  if jsonb_array_length(q.timeline) > 0 then
    n := n + 1;
    v := v || n || '. JADWAL PENGERJAAN' || E'\n';
    for t in select jsonb_array_elements_text(q.timeline) loop
      v := v || '- ' || t || E'\n';
    end loop;
    v := v || E'\n';
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

-- ---------- fungsi publik (link penawaran, tanpa login) ----------
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

create or replace function public.quotation_public_request_revision(p_token uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare q public.acc_quotations%rowtype;
begin
  select * into q from public.acc_quotations where public_token = p_token for update;
  if not found or q.status not in ('sent', 'viewed', 'revision_requested') then
    raise exception 'Penawaran ini tidak bisa diubah lagi.';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'Tulis catatan revisi.'; end if;
  update public.acc_quotations set status = 'revision_requested', revision_note = left(trim(p_note), 2000) where id = q.id returning * into q;
  perform public.quotation_notify(q, 'revision', 'Klien minta revisi penawaran ' || q.quote_number, left(trim(p_note), 140), 'high');
end;
$$;

create or replace function public.quotation_public_accept(p_token uuid, p_package int)
returns void language plpgsql security definer set search_path = public as $$
declare
  q public.acc_quotations%rowtype;
  v_contract uuid;
begin
  select * into q from public.acc_quotations where public_token = p_token for update;
  if not found or q.status not in ('sent', 'viewed', 'revision_requested') then
    raise exception 'Penawaran ini sudah tidak bisa disetujui.';
  end if;
  if q.valid_until is not null and q.valid_until < public.gl_local_date(now()) then
    raise exception 'Masa berlaku penawaran sudah habis. Hubungi kami untuk penawaran baru.';
  end if;
  if p_package is null or p_package < 0 or p_package >= jsonb_array_length(q.packages) then
    raise exception 'Pilih paket terlebih dahulu.';
  end if;

  insert into public.acc_contracts (client_id, title, content, status)
  values (q.client_id, 'Perjanjian Kerja Sama - ' || q.title, public.quotation_contract_text(q, p_package), 'sent')
  returning id into v_contract;

  update public.acc_quotations
  set status = 'accepted', accepted_at = now(), accepted_package = p_package, contract_id = v_contract
  where id = q.id returning * into q;

  perform public.quotation_notify(q, 'accepted', 'Penawaran ' || q.quote_number || ' disetujui',
    (select company_name from public.acc_clients where id = q.client_id) || ' · paket ' || (q.packages -> p_package ->> 'name')
      || ' · ' || public.rupiah((q.packages -> p_package ->> 'price')::numeric), 'high');
end;
$$;

create or replace function public.quotation_public_sign(p_token uuid, p_name text, p_signature text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q public.acc_quotations%rowtype;
  pk jsonb;
  v_price numeric;
  v_project uuid;
  v_invoice uuid;
  v_inv_token uuid;
begin
  select * into q from public.acc_quotations where public_token = p_token for update;
  if not found or q.status <> 'accepted' or q.contract_id is null then
    raise exception 'Kontrak ini tidak menunggu tanda tangan.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Isi nama lengkap penanda tangan.'; end if;
  if coalesce(p_signature, '') not like 'data:image/png;base64,%' or length(p_signature) > 400000 then
    raise exception 'Tanda tangan tidak valid, silakan ulangi.';
  end if;

  pk := q.packages -> q.accepted_package;
  v_price := coalesce((pk->>'price')::numeric, 0);

  update public.acc_contracts
  set status = 'signed', signed_by_name = left(trim(p_name), 120), signature_data = p_signature, signed_at = now()
  where id = q.contract_id;

  insert into public.acc_projects (client_id, website_name, deal_price, project_date, status, notes)
  values (q.client_id, q.title, v_price, public.gl_local_date(now()), 'planning',
          'Dari penawaran ' || q.quote_number || ', paket ' || coalesce(pk->>'name', '-'))
  returning id into v_project;
  update public.acc_contracts set project_id = v_project where id = q.contract_id;

  if v_price > 0 then
    insert into public.acc_invoices (client_id, project_id, invoice_type, subtotal, tax_type, tax_amount, total_amount, due_date, status)
    values (q.client_id, v_project, 'project_deposit', v_price, 'none', 0, v_price, public.gl_local_date(now()), 'sent')
    returning id, public_token into v_invoice, v_inv_token;
    insert into public.acc_invoice_items (invoice_id, description, amount, kind, sort)
    values (v_invoice, q.title || ' - Paket ' || coalesce(pk->>'name', '-'), v_price, 'project', 0);
  end if;

  update public.acc_quotations set status = 'signed', project_id = v_project, invoice_id = v_invoice where id = q.id returning * into q;

  perform public.quotation_notify(q, 'signed', 'Kontrak ' || q.quote_number || ' ditandatangani',
    (select company_name from public.acc_clients where id = q.client_id) || ' · proyek & invoice ' || public.rupiah(v_price) || ' dibuat otomatis', 'high');
  return v_inv_token;
end;
$$;

revoke execute on function public.quotation_public_open(uuid) from public;
revoke execute on function public.quotation_public_request_revision(uuid, text) from public;
revoke execute on function public.quotation_public_accept(uuid, int) from public;
revoke execute on function public.quotation_public_sign(uuid, text, text) from public;
grant execute on function public.quotation_public_open(uuid) to anon, authenticated;
grant execute on function public.quotation_public_request_revision(uuid, text) to anon, authenticated;
grant execute on function public.quotation_public_accept(uuid, int) to anon, authenticated;
grant execute on function public.quotation_public_sign(uuid, text, text) to anon, authenticated;
revoke execute on function public.quotation_notify(public.acc_quotations, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.quotation_contract_text(public.acc_quotations, int) from public, anon, authenticated;
