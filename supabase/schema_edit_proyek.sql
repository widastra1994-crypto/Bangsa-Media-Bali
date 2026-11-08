-- ============================================================================
-- EDIT PROYEK (semua perubahan ikut otomatis)
-- project_update(id, patch) mengubah proyek lalu menyesuaikan data terkait:
--  * Harga jual  -> invoice proyek utama (deposit/pelunasan pertama yang tidak
--                   batal): baris "project" atau total invoice ikut berubah;
--                   komisi yang belum dibayar & belum masuk slip gaji ikut
--                   diskalakan sebanding. Buku Besar & status Lunas dihitung
--                   ulang oleh trigger yang sudah ada.
--  * Klien       -> invoice, aset digital, kontrak & langganan proyek pindah
--                   ke klien baru.
--  * Tim         -> komisi belum dibayar untuk peran itu pindah ke staf baru.
-- Ditolak bila total invoice baru lebih kecil dari yang sudah dibayar, atau
-- data ada di periode Tutup Buku (guard jurnal).
-- ============================================================================
create or replace function public.project_update(p_project_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.acc_projects%rowtype;
  n public.acc_projects%rowtype;
  inv public.acc_invoices%rowtype;
  v_total numeric(15,2);
  v_notes text[] := '{}';
  r record;
begin
  if coalesce(public.current_role_name(), '') not in ('owner', 'admin', 'staff') then
    raise exception 'Anda tidak punya akses untuk mengubah proyek.';
  end if;
  select * into p from public.acc_projects where id = p_project_id for update;
  if not found then raise exception 'Proyek tidak ditemukan.'; end if;
  if (p_patch ? 'deal_price') and coalesce((p_patch->>'deal_price')::numeric, 0) < 0 then
    raise exception 'Harga jual tidak boleh minus.';
  end if;
  if (p_patch ? 'client_id') and nullif(p_patch->>'client_id', '') is null then
    raise exception 'Klien wajib diisi.';
  end if;

  update public.acc_projects set
    client_id = case when p_patch ? 'client_id' then (p_patch->>'client_id')::uuid else client_id end,
    website_name = case when p_patch ? 'website_name' then nullif(trim(p_patch->>'website_name'), '') else website_name end,
    service_category_id = case when p_patch ? 'service_category_id' then nullif(p_patch->>'service_category_id', '')::uuid else service_category_id end,
    deal_price = case when p_patch ? 'deal_price' then coalesce((p_patch->>'deal_price')::numeric, 0) else deal_price end,
    budget_limit = case when p_patch ? 'budget_limit' then nullif(p_patch->>'budget_limit', '')::numeric else budget_limit end,
    project_date = case when p_patch ? 'project_date' then coalesce(nullif(p_patch->>'project_date', '')::date, project_date) else project_date end,
    developer_id = case when p_patch ? 'developer_id' then nullif(p_patch->>'developer_id', '')::uuid else developer_id end,
    designer_id = case when p_patch ? 'designer_id' then nullif(p_patch->>'designer_id', '')::uuid else designer_id end,
    sales_id = case when p_patch ? 'sales_id' then nullif(p_patch->>'sales_id', '')::uuid else sales_id end,
    notes = case when p_patch ? 'notes' then nullif(trim(p_patch->>'notes'), '') else notes end,
    updated_at = now()
  where id = p_project_id
  returning * into n;

  -- Klien berganti: semua data proyek ikut pindah.
  if n.client_id is distinct from p.client_id then
    update public.acc_invoices set client_id = n.client_id, updated_at = now() where project_id = p_project_id;
    update public.acc_digital_assets set client_id = n.client_id where project_id = p_project_id;
    update public.acc_contracts set client_id = n.client_id where project_id = p_project_id;
    update public.acc_subscriptions set client_id = n.client_id where project_id = p_project_id;
    v_notes := array_append(v_notes, 'invoice, aset, kontrak & langganan dipindah ke klien baru');
  end if;

  -- Harga berubah: invoice proyek utama & komisi belum dibayar ikut.
  if n.deal_price is distinct from p.deal_price then
    select * into inv from public.acc_invoices
    where project_id = p_project_id and invoice_type in ('project_deposit', 'project_settlement') and status <> 'cancelled'
    order by created_at limit 1
    for update;
    if found then
      if coalesce(inv.tax_amount, 0) > 0 then
        v_notes := array_append(v_notes, format('invoice %s memakai pajak, nominalnya tidak diubah otomatis', inv.invoice_number));
      else
        if exists (select 1 from public.acc_invoice_items where invoice_id = inv.id and kind = 'project') then
          update public.acc_invoice_items set amount = n.deal_price
          where id = (select id from public.acc_invoice_items where invoice_id = inv.id and kind = 'project' order by sort limit 1);
          select sum(amount) into v_total from public.acc_invoice_items where invoice_id = inv.id;
        else
          v_total := coalesce(inv.total_amount, 0) - coalesce(p.deal_price, 0) + n.deal_price;
        end if;
        if v_total < coalesce(inv.paid_amount, 0) then
          raise exception 'Total invoice % menjadi % padahal sudah dibayar %. Turunkan harga tidak bisa di bawah yang sudah dibayar.',
            inv.invoice_number, v_total, inv.paid_amount;
        end if;
        update public.acc_invoices set subtotal = v_total, total_amount = v_total, updated_at = now() where id = inv.id;
        v_notes := array_append(v_notes, format('invoice %s menjadi %s', inv.invoice_number, to_char(v_total, 'FM999G999G999G999')));
      end if;
    end if;

    if coalesce(p.deal_price, 0) > 0 then
      update public.acc_commissions
      set commission_amount = round(commission_amount * n.deal_price / p.deal_price)
      where project_id = p_project_id and status <> 'paid' and payslip_id is null;
      if found then v_notes := array_append(v_notes, 'komisi yang belum dibayar disesuaikan'); end if;
    end if;
  end if;

  -- Tim berganti: komisi belum dibayar untuk peran itu pindah ke staf baru.
  for r in select * from (values
      ('developer', p.developer_id, n.developer_id),
      ('designer', p.designer_id, n.designer_id),
      ('sales', p.sales_id, n.sales_id)) as t(role, old_id, new_id)
    where t.old_id is distinct from t.new_id loop
    if r.new_id is null then
      delete from public.acc_commissions
      where project_id = p_project_id and role_in_project = r.role and staff_id = r.old_id and status <> 'paid' and payslip_id is null;
    else
      update public.acc_commissions set staff_id = r.new_id
      where project_id = p_project_id and role_in_project = r.role and staff_id is not distinct from r.old_id and status <> 'paid' and payslip_id is null;
    end if;
    if found then v_notes := array_append(v_notes, format('komisi %s dipindah', r.role)); end if;
  end loop;

  insert into public.acc_audit_logs (user_id, action, entity_name, entity_id, old_values, new_values, actor_name)
  values (auth.uid(), 'UPDATE', 'acc_projects', p_project_id, to_jsonb(p), to_jsonb(n) || jsonb_build_object('ikut_berubah', v_notes),
          (select name from public.profiles where id = auth.uid()));

  return jsonb_build_object('notes', to_jsonb(v_notes));
end;
$$;
revoke execute on function public.project_update(uuid, jsonb) from public, anon;
grant execute on function public.project_update(uuid, jsonb) to authenticated;
