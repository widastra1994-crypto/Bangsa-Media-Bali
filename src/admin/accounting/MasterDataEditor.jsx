import { useState } from 'react'
import SimpleCrudTable from './SimpleCrudTable'
import { useSupabaseTable } from './useSupabaseTable'

const SUB_TABS = [
  { id: 'klien', label: 'Klien' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'layanan', label: 'Kategori Layanan' },
  { id: 'kas', label: 'Kas & Bank' },
  { id: 'staf', label: 'Staf & Komisi' },
]

const CLIENT_TYPE_OPTIONS = [
  { value: 'perorangan', label: 'Perorangan' },
  { value: 'badan_usaha', label: 'Badan Usaha' },
]
const VENDOR_TYPE_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'server', label: 'Server/Hosting' },
  { value: 'lainnya', label: 'Lainnya' },
]
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'kas_tunai', label: 'Kas Tunai' },
  { value: 'bank', label: 'Bank' },
]
const STAFF_ROLE_OPTIONS = [
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Desainer' },
  { value: 'sales', label: 'Sales' },
  { value: 'lainnya', label: 'Lainnya' },
]

function ClientsPanel() {
  const data = useSupabaseTable('acc_clients', { orderBy: 'created_at' })
  return (
    <SimpleCrudTable
      title="Master Klien"
      description="Data klien yang dipakai di form transaksi & invoice. Email wajib diisi untuk pengiriman invoice/kuitansi."
      data={data}
      fields={[
        { key: 'client_type', label: 'Tipe Klien', type: 'select', options: CLIENT_TYPE_OPTIONS, default: 'perorangan' },
        { key: 'company_name', label: 'Nama Entitas/Klien', type: 'text' },
        { key: 'pic_name', label: 'Nama PIC', type: 'text' },
        { key: 'email', label: 'Email Aktif', type: 'email' },
        { key: 'phone_primary', label: 'Telepon Utama', type: 'text' },
        { key: 'phone_secondary', label: 'Telepon Darurat', type: 'text' },
        { key: 'business_type', label: 'Tipe Usaha', type: 'text', placeholder: 'Travel, Hotel/Villa, F&B, Retail, dsb.' },
        { key: 'referral_code', label: 'Kode Referral (opsional)', type: 'text' },
        { key: 'address', label: 'Alamat', type: 'textarea', span2: true },
      ]}
      columns={[
        { key: 'company_name', label: 'Nama Klien' },
        { key: 'pic_name', label: 'PIC' },
        { key: 'email', label: 'Email' },
        { key: 'phone_primary', label: 'Telepon' },
        { key: 'business_type', label: 'Tipe Usaha' },
      ]}
    />
  )
}

function VendorsPanel() {
  const data = useSupabaseTable('acc_vendors', { orderBy: 'created_at' })
  return (
    <SimpleCrudTable
      title="Master Vendor"
      description="Vendor domain, hosting/server, atau vendor lainnya."
      data={data}
      fields={[
        { key: 'vendor_name', label: 'Nama Vendor', type: 'text', placeholder: 'Cekotech, Niagahoster, dsb.' },
        { key: 'vendor_type', label: 'Jenis Vendor', type: 'select', options: VENDOR_TYPE_OPTIONS, default: 'domain' },
        { key: 'contact_person', label: 'PIC Vendor', type: 'text' },
        { key: 'login_url', label: 'URL Login Vendor', type: 'text' },
      ]}
      columns={[
        { key: 'vendor_name', label: 'Nama Vendor' },
        { key: 'vendor_type', label: 'Jenis' },
        { key: 'contact_person', label: 'PIC' },
      ]}
    />
  )
}

function ServiceCategoriesPanel() {
  const data = useSupabaseTable('acc_service_categories', { orderBy: 'name', ascending: true })
  return (
    <SimpleCrudTable
      title="Master Kategori Layanan"
      description="Jenis layanan yang dijual, dipakai sebagai pilihan di form transaksi."
      data={data}
      fields={[{ key: 'name', label: 'Nama Kategori', type: 'text', placeholder: 'Pembuatan Website, Iklan Meta/Google, dsb.' }]}
      columns={[{ key: 'name', label: 'Nama Kategori' }]}
    />
  )
}

function BankAccountsPanel() {
  const data = useSupabaseTable('acc_bank_accounts', { orderBy: 'created_at' })
  return (
    <SimpleCrudTable
      title="Master Kas & Bank"
      description="Akun penampung internal (kas tunai atau rekening bank) untuk mencatat pemasukan & pengeluaran."
      data={data}
      fields={[
        { key: 'account_name', label: 'Nama Akun', type: 'text', placeholder: 'Kas Tunai, BCA Operasional, dsb.' },
        { key: 'account_type', label: 'Jenis', type: 'select', options: ACCOUNT_TYPE_OPTIONS, default: 'bank' },
        { key: 'bank_name', label: 'Nama Bank (jika bank)', type: 'text' },
        { key: 'account_number', label: 'Nomor Rekening (jika bank)', type: 'text' },
      ]}
      columns={[
        { key: 'account_name', label: 'Nama Akun' },
        { key: 'account_type', label: 'Jenis' },
        { key: 'bank_name', label: 'Bank' },
        { key: 'account_number', label: 'No. Rekening' },
      ]}
    />
  )
}

function StaffPanel() {
  const data = useSupabaseTable('acc_staff_members', { orderBy: 'created_at' })
  return (
    <SimpleCrudTable
      title="Master Staf & Skema Komisi"
      description="Daftar staf (developer/desainer/sales) beserta parameter bagi hasil default. Belum terhubung ke akun login (menyusul di fase RBAC)."
      data={data}
      fields={[
        { key: 'name', label: 'Nama Staf', type: 'text' },
        { key: 'role_type', label: 'Peran', type: 'select', options: STAFF_ROLE_OPTIONS, default: 'developer' },
        { key: 'default_commission_percent', label: 'Komisi Default (%)', type: 'number' },
        { key: 'default_commission_flat', label: 'Komisi Default (Rp tetap)', type: 'number' },
        { key: 'is_active', label: 'Aktif', type: 'checkbox', default: true },
      ]}
      columns={[
        { key: 'name', label: 'Nama' },
        { key: 'role_type', label: 'Peran' },
        { key: 'default_commission_percent', label: 'Komisi %', render: (r) => (r.default_commission_percent != null ? `${r.default_commission_percent}%` : '-') },
        { key: 'is_active', label: 'Status', render: (r) => (r.is_active ? 'Aktif' : 'Non-aktif') },
      ]}
    />
  )
}

const PANELS = {
  klien: ClientsPanel,
  vendor: VendorsPanel,
  layanan: ServiceCategoriesPanel,
  kas: BankAccountsPanel,
  staf: StaffPanel,
}

export default function MasterDataEditor() {
  const [activeSub, setActiveSub] = useState('klien')
  const Panel = PANELS[activeSub]

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Master Data Akunting</h2>
      <p className="mt-1 text-sm text-slate-400">Kelola data induk yang dipakai di seluruh transaksi akunting.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSub(tab.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeSub === tab.id ? 'border-gold bg-gold/15 text-gold-soft' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <Panel />
      </div>
    </div>
  )
}
