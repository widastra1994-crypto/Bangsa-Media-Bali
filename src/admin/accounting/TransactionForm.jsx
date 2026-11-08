import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { sendFinanceEmail } from '../../lib/financeEmail'
import { useSupabaseTable } from './useSupabaseTable'
import { logAudit } from './auditLog'
import { ExtraChargeRows, emptyExtra, extrasError, extrasTotal, filledExtras } from './ExtraCharges'

const idr = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Transfer Bank' },
  { value: 'direct_mutasi', label: 'Mutasi Langsung' },
  { value: 'cash', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
]

const STAFF_ROLE_KEYS = [
  { key: 'developer_id', role: 'developer', label: 'Developer' },
  { key: 'designer_id', role: 'designer', label: 'Desainer' },
  { key: 'sales_id', role: 'sales', label: 'Sales' },
]

function addOneYear(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const emptyForm = {
  clientMode: 'existing',
  clientId: '',
  newClient: { client_type: 'perorangan', company_name: '', pic_name: '', email: '', phone_primary: '', address: '', business_type: '' },
  serviceCategoryId: '',
  websiteName: '',
  domainName: '',
  domainVendorId: '',
  serverVendorId: '',
  websiteUrl: '',
  projectDate: new Date().toISOString().slice(0, 10),
  registrationDate: new Date().toISOString().slice(0, 10),
  dealPrice: '',
  budgetLimit: '',
  domainCost: '',
  serverCost: '',
  otherCost: '',
  costBankAccountId: '',
  staff: { developer_id: '', designer_id: '', sales_id: '' },
  commission: { developer_id: '', designer_id: '', sales_id: '' },
  extras: [emptyExtra()],
  depositAmount: '',
  depositMethod: 'bank_transfer',
  depositBankAccountId: '',
  budgetOverrideAck: false,
}

export default function TransactionForm() {
  const clients = useSupabaseTable('acc_clients', { orderBy: 'company_name', ascending: true })
  const categories = useSupabaseTable('acc_service_categories', { orderBy: 'name', ascending: true })
  const vendors = useSupabaseTable('acc_vendors', { orderBy: 'vendor_name', ascending: true })
  const bankAccounts = useSupabaseTable('acc_bank_accounts', { orderBy: 'account_name', ascending: true })
  const staff = useSupabaseTable('acc_staff_members', { orderBy: 'name', ascending: true })

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const domainVendors = vendors.rows.filter((v) => v.vendor_type === 'domain')
  const serverVendors = vendors.rows.filter((v) => v.vendor_type === 'server')
  const activeStaff = staff.rows.filter((s) => s.is_active !== false)

  const totalBeban = (Number(form.domainCost) || 0) + (Number(form.serverCost) || 0) + (Number(form.otherCost) || 0)
  const extraTotal = extrasTotal(form.extras)
  const invoiceTotal = (Number(form.dealPrice) || 0) + extraTotal
  const extraError = extrasError(form.extras)
  const margin = invoiceTotal - totalBeban
  const sisaPiutang = invoiceTotal - (Number(form.depositAmount) || 0)
  const overBudget = Number(form.budgetLimit) > 0 && totalBeban > Number(form.budgetLimit)

  const totalCommission = useMemo(
    () => STAFF_ROLE_KEYS.reduce((sum, r) => sum + (Number(form.commission[r.key]) || 0), 0),
    [form.commission],
  )

  const applyDefaultCommission = (roleKey, staffId) => {
    const person = staff.rows.find((s) => s.id === staffId)
    let amount = ''
    if (person?.default_commission_percent) amount = Math.round(((Number(form.dealPrice) || 0) * Number(person.default_commission_percent)) / 100)
    else if (person?.default_commission_flat) amount = person.default_commission_flat
    set({ staff: { ...form.staff, [roleKey]: staffId }, commission: { ...form.commission, [roleKey]: amount } })
  }

  const canSubmit =
    (form.clientMode === 'existing' ? form.clientId : form.newClient.company_name && form.newClient.email) &&
    form.serviceCategoryId &&
    Number(form.dealPrice) > 0 &&
    (!overBudget || form.budgetOverrideAck) &&
    !extraError &&
    !submitting

  const resetForm = () => setForm(emptyForm)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    setResult(null)
    try {
      // 1. Klien (pakai yang sudah ada, atau buat baru)
      let clientId = form.clientId
      let clientRecord = clients.rows.find((c) => c.id === clientId)
      if (form.clientMode === 'new') {
        const created = await clients.insert(form.newClient)
        clientId = created.id
        clientRecord = created
      }
      if (!clientRecord) throw new Error('Klien tidak ditemukan.')

      // 2. Proyek
      const { data: projectRows, error: projectErr } = await supabase
        .from('acc_projects')
        .insert({
          client_id: clientId,
          service_category_id: form.serviceCategoryId || null,
          website_name: form.websiteName || null,
          deal_price: Number(form.dealPrice) || 0,
          budget_limit: form.budgetLimit ? Number(form.budgetLimit) : null,
          developer_id: form.staff.developer_id || null,
          designer_id: form.staff.designer_id || null,
          sales_id: form.staff.sales_id || null,
          project_date: form.projectDate,
          status: 'planning',
          notes: overBudget ? 'Beban melebihi batas anggaran, disetujui via centang konfirmasi admin.' : null,
        })
        .select()
      if (projectErr) throw new Error(projectErr.message)
      const project = projectRows[0]

      // 3. Aset Digital: domain & server dicatat sebagai aset terpisah karena
      // masa aktif & perpanjangannya bisa berbeda. Harga jual awal = modal,
      // ubah di menu Rekap Aset Digital.
      const assetBase = {
        project_id: project.id,
        client_id: clientId,
        domain_name: form.domainName || form.websiteName || null,
        registration_date: form.registrationDate || null,
        expiry_date: form.registrationDate ? addOneYear(form.registrationDate) : null,
        cycle_months: 12,
        record_cost: true,
        status: 'active',
      }
      const newAssets = []
      if (form.domainName || form.domainVendorId || Number(form.domainCost)) {
        newAssets.push({
          ...assetBase,
          asset_type: 'domain',
          vendor_id: form.domainVendorId || null,
          domain_vendor_id: form.domainVendorId || null,
          website_url: form.websiteUrl || null,
          cost_price: Number(form.domainCost) || 0,
          sell_price: Number(form.domainCost) || 0,
        })
      }
      if (form.serverVendorId || Number(form.serverCost)) {
        newAssets.push({
          ...assetBase,
          asset_type: 'server',
          vendor_id: form.serverVendorId || null,
          server_vendor_id: form.serverVendorId || null,
          website_url: newAssets.length ? null : form.websiteUrl || null,
          cost_price: Number(form.serverCost) || 0,
          sell_price: Number(form.serverCost) || 0,
        })
      }
      if (newAssets.length === 0 && form.websiteUrl) {
        newAssets.push({ ...assetBase, asset_type: 'domain', website_url: form.websiteUrl, record_cost: false })
      }
      if (newAssets.length) {
        const { error: assetErr } = await supabase.from('acc_digital_assets').insert(newAssets)
        if (assetErr) throw new Error(assetErr.message)
      }

      // 4. Beban lainnya -> dicatat sebagai expense proyek
      if (Number(form.otherCost) > 0) {
        const { error: expErr } = await supabase.from('acc_expenses').insert({
          project_id: project.id,
          category: 'project_tools',
          amount: Number(form.otherCost),
          bank_account_id: form.costBankAccountId || null,
          expense_date: form.projectDate,
          notes: 'Beban lainnya (input awal proyek dari form transaksi terpadu).',
        })
        if (expErr) throw new Error(expErr.message)
      }

      // 5. Invoice: harga proyek + pembayaran tambahan (bila ada) dalam satu
      // invoice, dengan rincian per baris.
      const dealPrice = Number(form.dealPrice) || 0
      const deposit = Number(form.depositAmount) || 0
      const extras = filledExtras(form.extras)
      const invoiceAmount = dealPrice + extras.reduce((sum, x) => sum + x.amount, 0)
      const invoiceType = deposit >= invoiceAmount ? 'project_settlement' : 'project_deposit'
      const categoryName = categories.rows.find((c) => c.id === form.serviceCategoryId)?.name || 'Proyek'
      const projectLabel = [categoryName, form.websiteName].filter(Boolean).join(' - ')
      let invoice
      if (extras.length > 0) {
        const { data: invoiceId, error: invoiceErr } = await supabase.rpc('invoice_create_with_items', {
          p_client_id: clientId,
          p_project_id: project.id,
          p_invoice_type: invoiceType,
          p_due: form.projectDate,
          p_items: [{ description: projectLabel, amount: dealPrice, kind: 'project' }, ...extras.map((x) => ({ ...x, kind: 'extra' }))],
        })
        if (invoiceErr) throw new Error(invoiceErr.message)
        const { data: invRow, error: invReadErr } = await supabase.from('acc_invoices').select('*').eq('id', invoiceId).single()
        if (invReadErr) throw new Error(invReadErr.message)
        invoice = invRow
      } else {
        const { data: invoiceRows, error: invoiceErr } = await supabase
          .from('acc_invoices')
          .insert({
            project_id: project.id,
            client_id: clientId,
            invoice_type: invoiceType,
            subtotal: dealPrice,
            tax_type: 'none',
            tax_amount: 0,
            total_amount: dealPrice,
            due_date: form.projectDate,
            status: 'sent',
          })
          .select()
        if (invoiceErr) throw new Error(invoiceErr.message)
        invoice = invoiceRows[0]
      }

      // 6. Deposit / pembayaran awal (memicu trigger update status invoice & komisi)
      if (deposit > 0) {
        const { error: payErr } = await supabase.from('acc_payments').insert({
          invoice_id: invoice.id,
          payment_date: form.projectDate,
          amount_paid: deposit,
          payment_method: form.depositMethod,
          bank_account_id: form.depositBankAccountId || null,
        })
        if (payErr) throw new Error(payErr.message)
      }

      // 7. Komisi tim (status pending, otomatis payable oleh trigger jika lunas)
      for (const r of STAFF_ROLE_KEYS) {
        const staffId = form.staff[r.key]
        const amount = Number(form.commission[r.key]) || 0
        if (staffId && amount > 0) {
          const { error: commErr } = await supabase.from('acc_commissions').insert({
            project_id: project.id,
            staff_id: staffId,
            role_in_project: r.role,
            commission_amount: amount,
          })
          if (commErr) throw new Error(commErr.message)
        }
      }

      // 8. Kirim email invoice (+ kuitansi bila ada deposit)
      let emailInfo = ''
      if (clientRecord.email) {
        const invoiceRes = await sendFinanceEmail({
          type: 'invoice',
          to: clientRecord.email,
          clientName: clientRecord.company_name,
          docNumber: invoice.invoice_number,
          amount: invoiceAmount,
          dueDate: form.projectDate,
          items: [{ label: projectLabel, amount: dealPrice }, ...extras.map((x) => ({ label: x.description, amount: x.amount }))],
        })
        emailInfo = invoiceRes.ok ? 'Email invoice terkirim. ' : `Email invoice belum terkirim (${invoiceRes.error || 'lihat konfigurasi Resend'}). `

        if (deposit > 0) {
          const receiptRes = await sendFinanceEmail({
            type: 'receipt',
            to: clientRecord.email,
            clientName: clientRecord.company_name,
            docNumber: `Pembayaran awal - ${invoice.invoice_number}`,
            amount: deposit,
          })
          emailInfo += receiptRes.ok ? 'Email kuitansi deposit terkirim.' : `Email kuitansi belum terkirim (${receiptRes.error || 'lihat konfigurasi Resend'}).`
        }
      }

      logAudit('create', 'acc_projects', project.id, {
        newValues: { client: clientRecord.company_name, website: form.websiteName, deal_price: dealPrice, extras, invoice_number: invoice.invoice_number, deposit },
      })

      setResult({ invoiceNumber: invoice.invoice_number, emailInfo })
      resetForm()
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Transaksi Baru (Form Terpadu)</h2>
      <p className="mt-1 text-sm text-slate-400">
        Satu kali simpan otomatis membuat: Proyek, Aset Digital, Invoice, Pembayaran (bila ada deposit), dan Komisi Tim.
      </p>

      {result && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <div>
            Transaksi tersimpan. Invoice <strong>{result.invoiceNumber}</strong> diterbitkan. {result.emailInfo}
          </div>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* KLIEN */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">1. Klien</h3>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => set({ clientMode: 'existing' })}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${form.clientMode === 'existing' ? 'border-gold bg-gold/15 text-gold-soft' : 'border-white/15 text-slate-400'}`}
          >
            Pilih Klien Ada
          </button>
          <button
            type="button"
            onClick={() => set({ clientMode: 'new' })}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${form.clientMode === 'new' ? 'border-gold bg-gold/15 text-gold-soft' : 'border-white/15 text-slate-400'}`}
          >
            Klien Baru
          </button>
        </div>

        {form.clientMode === 'existing' ? (
          <select className="input-field" value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
            <option value="">Pilih klien...</option>
            {clients.rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} ({c.email})
              </option>
            ))}
          </select>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="input-field" placeholder="Nama Klien/Bisnis" value={form.newClient.company_name} onChange={(e) => set({ newClient: { ...form.newClient, company_name: e.target.value } })} />
            <input className="input-field" placeholder="Nama PIC" value={form.newClient.pic_name} onChange={(e) => set({ newClient: { ...form.newClient, pic_name: e.target.value } })} />
            <input className="input-field" type="email" placeholder="Email Aktif" value={form.newClient.email} onChange={(e) => set({ newClient: { ...form.newClient, email: e.target.value } })} />
            <input className="input-field" placeholder="Telepon" value={form.newClient.phone_primary} onChange={(e) => set({ newClient: { ...form.newClient, phone_primary: e.target.value } })} />
            <input className="input-field" placeholder="Tipe Usaha" value={form.newClient.business_type} onChange={(e) => set({ newClient: { ...form.newClient, business_type: e.target.value } })} />
            <select className="input-field" value={form.newClient.client_type} onChange={(e) => set({ newClient: { ...form.newClient, client_type: e.target.value } })}>
              <option value="perorangan">Perorangan</option>
              <option value="badan_usaha">Badan Usaha</option>
            </select>
          </div>
        )}
      </div>

      {/* PROYEK */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">2. Detail Proyek</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className="input-field" value={form.serviceCategoryId} onChange={(e) => set({ serviceCategoryId: e.target.value })}>
            <option value="">Kategori Layanan...</option>
            {categories.rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input-field" placeholder="Nama Website/Proyek" value={form.websiteName} onChange={(e) => set({ websiteName: e.target.value })} />
          <div>
            <label className="label-field">Tanggal Proyek</label>
            <input type="date" className="input-field" value={form.projectDate} onChange={(e) => set({ projectDate: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Harga Jual (Rp)</label>
            <input type="number" className="input-field" value={form.dealPrice} onChange={(e) => set({ dealPrice: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Batas Anggaran Beban (opsional)</label>
            <input type="number" className="input-field" value={form.budgetLimit} onChange={(e) => set({ budgetLimit: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ASET DIGITAL */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">3. Aset Digital & Beban (opsional)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className="input-field" placeholder="Nama Domain (mis. kliena.com)" value={form.domainName} onChange={(e) => set({ domainName: e.target.value })} />
          <input className="input-field" placeholder="URL Website (untuk monitoring uptime, mis. https://kliena.com)" value={form.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} />
          <div>
            <label className="label-field">Tanggal Registrasi</label>
            <input type="date" className="input-field" value={form.registrationDate} onChange={(e) => set({ registrationDate: e.target.value })} />
          </div>
          <select className="input-field" value={form.domainVendorId} onChange={(e) => set({ domainVendorId: e.target.value })}>
            <option value="">Vendor Domain...</option>
            {domainVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendor_name}
              </option>
            ))}
          </select>
          <select className="input-field" value={form.serverVendorId} onChange={(e) => set({ serverVendorId: e.target.value })}>
            <option value="">Vendor Server...</option>
            {serverVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vendor_name}
              </option>
            ))}
          </select>
          <div>
            <label className="label-field">Beban Domain (Rp)</label>
            <input type="number" className="input-field" value={form.domainCost} onChange={(e) => set({ domainCost: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Beban Server (Rp)</label>
            <input type="number" className="input-field" value={form.serverCost} onChange={(e) => set({ serverCost: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Beban Lainnya (Rp)</label>
            <input type="number" className="input-field" value={form.otherCost} onChange={(e) => set({ otherCost: e.target.value })} />
          </div>
          <select className="input-field" value={form.costBankAccountId} onChange={(e) => set({ costBankAccountId: e.target.value })}>
            <option value="">Sumber Kas untuk Beban...</option>
            {bankAccounts.rows.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </div>

        {overBudget && (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle size={14} /> Total beban ({idr(totalBeban)}) melebihi batas anggaran ({idr(Number(form.budgetLimit))}).
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={form.budgetOverrideAck} onChange={(e) => set({ budgetOverrideAck: e.target.checked })} className="h-4 w-4 accent-gold" />
              Saya (Owner) menyetujui pengeluaran melebihi anggaran ini.
            </label>
          </div>
        )}
      </div>

      {/* TIM & KOMISI */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">4. Tim & Komisi (opsional)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STAFF_ROLE_KEYS.map((r) => (
            <div key={r.key}>
              <label className="label-field">{r.label}</label>
              <select className="input-field" value={form.staff[r.key]} onChange={(e) => applyDefaultCommission(r.key, e.target.value)}>
                <option value="">Tidak ditugaskan</option>
                {activeStaff
                  .filter((s) => s.role_type === r.role || s.role_type === 'lainnya')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              {form.staff[r.key] && (
                <input
                  type="number"
                  className="input-field mt-2"
                  placeholder="Nominal komisi (Rp)"
                  value={form.commission[r.key]}
                  onChange={(e) => set({ commission: { ...form.commission, [r.key]: e.target.value } })}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* PEMBAYARAN TAMBAHAN */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gold-soft">5. Pembayaran Tambahan (opsional)</h3>
        <p className="mb-3 text-xs text-slate-400">
          Tagihan di luar harga proyek, misalnya iklan, foto produk, atau fitur tambahan. Keterangannya bebas dan tampil sebagai baris tersendiri di invoice klien.
        </p>
        <ExtraChargeRows rows={form.extras} onChange={(extras) => set({ extras })} />
        {extraError && <p className="mt-2 text-xs text-amber-300">{extraError}</p>}
        {extraTotal > 0 && (
          <p className="mt-2 text-xs text-slate-300">
            Total invoice: {idr(Number(form.dealPrice) || 0)} (proyek) + {idr(extraTotal)} (tambahan) = <b className="text-white">{idr(invoiceTotal)}</b>
          </p>
        )}
      </div>

      {/* DEPOSIT */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-soft">6. Deposit / Pembayaran Awal (opsional)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label-field">Nominal Deposit (Rp)</label>
            <input type="number" className="input-field" value={form.depositAmount} onChange={(e) => set({ depositAmount: e.target.value })} />
          </div>
          <select className="input-field" value={form.depositMethod} onChange={(e) => set({ depositMethod: e.target.value })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="input-field" value={form.depositBankAccountId} onChange={(e) => set({ depositBankAccountId: e.target.value })}>
            <option value="">Masuk ke Akun Kas...</option>
            {bankAccounts.rows.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RINGKASAN */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-gold/30 bg-gold/5 p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">Total Beban Proyek</p>
          <p className="text-lg font-bold text-white">{idr(totalBeban)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Estimasi Margin</p>
          <p className={`text-lg font-bold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{idr(margin)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Sisa Piutang Klien</p>
          <p className="text-lg font-bold text-gold-soft">{idr(sisaPiutang)}</p>
        </div>
        {totalCommission > 0 && (
          <div className="sm:col-span-3">
            <p className="text-xs text-slate-400">Total Komisi Dialokasikan</p>
            <p className="text-sm font-semibold text-cyan-royal">{idr(totalCommission)}</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 border-t border-white/10 bg-navy-950/90 py-4 backdrop-blur-xl">
        <button type="button" disabled={!canSubmit} onClick={handleSubmit} className="btn-primary !py-2.5 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </div>
    </div>
  )
}
