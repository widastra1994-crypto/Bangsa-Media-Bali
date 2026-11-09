-- ============================================================================
-- KATEGORI PENGELUARAN CUSTOM
-- Kategori disimpan di acc_expense_categories; setiap kategori dipetakan ke
-- akun beban Buku Besar (account_key = system_key acc_accounts) sehingga
-- kategori baru otomatis masuk Laba Rugi & Rekap Bulanan di kelompok yang
-- benar. Kategori bisa ditambah langsung dari form Pengeluaran.
-- ============================================================================
create table if not exists public.acc_expense_categories (
  code text primary key,
  name text not null check (length(trim(name)) > 0),
  account_key text not null default 'exp_other'
    check (account_key in ('exp_office', 'exp_marketing', 'exp_salary', 'exp_hosting', 'exp_project_tools', 'exp_vendor', 'exp_other')),
  is_system boolean not null default false,
  is_hidden boolean not null default false,
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists acc_expense_categories_name_uq on public.acc_expense_categories(lower(trim(name)));

insert into public.acc_expense_categories (code, name, account_key, is_system, is_hidden, sort) values
  ('office_operational', 'Operasional Kantor', 'exp_office', true, false, 10),
  ('marketing', 'Marketing', 'exp_marketing', true, false, 20),
  ('salary', 'Gaji', 'exp_salary', true, false, 30),
  ('domain_cost', 'Beban Domain', 'exp_hosting', true, false, 40),
  ('server_cost', 'Beban Server', 'exp_hosting', true, false, 50),
  ('project_tools', 'Alat/Tools Proyek', 'exp_project_tools', true, false, 60),
  ('vendor_bill', 'Tagihan Vendor', 'exp_vendor', true, true, 900)
on conflict (code) do nothing;

alter table public.acc_expense_categories enable row level security;
drop policy if exists ec_select on public.acc_expense_categories;
create policy ec_select on public.acc_expense_categories for select to authenticated
  using (public.current_role_name() in ('owner', 'admin', 'staff', 'viewer'));
drop policy if exists ec_update on public.acc_expense_categories;
create policy ec_update on public.acc_expense_categories for update to authenticated
  using (public.current_role_name() in ('owner', 'admin')) with check (public.current_role_name() in ('owner', 'admin'));

-- Kategori pengeluaran wajib terdaftar (ganti daftar tetap lama).
do $$ declare c text; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.acc_expenses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%category%' loop
    execute format('alter table public.acc_expenses drop constraint %I', c);
  end loop;
end $$;
alter table public.acc_expenses drop constraint if exists acc_expenses_category_fkey;
alter table public.acc_expenses add constraint acc_expenses_category_fkey
  foreign key (category) references public.acc_expense_categories(code) on update cascade;

-- Tambah kategori dari form (Owner/Admin/Staff). Nama yang sudah ada dipakai ulang.
create or replace function public.expense_category_add(p_name text, p_account_key text default 'exp_other')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses.';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Isi nama kategori.';
  end if;
  select code into v_code from public.acc_expense_categories where lower(trim(name)) = lower(trim(p_name));
  if found then
    update public.acc_expense_categories set is_hidden = false where code = v_code and not is_system;
    return v_code;
  end if;
  v_code := 'c_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.acc_expense_categories (code, name, account_key)
  values (v_code, trim(p_name), coalesce(nullif(p_account_key, ''), 'exp_other'));
  return v_code;
end;
$$;
revoke execute on function public.expense_category_add(text, text) from public, anon;
grant execute on function public.expense_category_add(text, text) to authenticated;

-- Jurnal pengeluaran: akun & label dari tabel kategori.
create or replace function public.gl_post_expense(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_key text;
  v_label text;
begin
  select e.*, c.account_key, c.name as category_name into r
  from public.acc_expenses e left join public.acc_expense_categories c on c.code = e.category
  where e.id = p_id;

  if not found or r.category = 'vendor_bill' or coalesce(r.amount, 0) <= 0 then
    perform public.gl_replace_entry('expense', p_id, null, null, '[]'::jsonb);
    return;
  end if;

  v_key := coalesce(r.account_key, 'exp_other');
  v_label := coalesce(r.category_name, 'Pengeluaran');

  perform public.gl_replace_entry('expense', p_id, r.expense_date,
    v_label || coalesce(': ' || nullif(r.notes, ''), ''),
    jsonb_build_array(
      public.gl_line(public.gl_acc(v_key), r.amount, 0, null, r.project_id),
      public.gl_line(public.gl_cash_acc(r.bank_account_id), 0, r.amount,
        case when r.bank_account_id is null then 'Rekening belum dipilih' end, r.project_id)
    ));
end;
$$;
