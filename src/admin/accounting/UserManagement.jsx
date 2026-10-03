import { Fragment, useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Link2, MessageCircle, SlidersHorizontal, UserPlus, X } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { useSupabaseTable } from './useSupabaseTable'
import { CONFIGURABLE_ROLES } from '../menuConfig'
import { useUserRole } from '../useUserRole'
import MenuAccessEditor, { menuAccessSummary } from './MenuAccessEditor'

const SUMMARY_TONE = {
  all: 'text-slate-400',
  custom: 'text-gold-soft',
  none: 'text-red-400',
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer', client: 'Klien (Portal)' }
const ROLE_COLOR = {
  owner: 'bg-gold/20 text-gold-soft border-gold/40',
  admin: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  staff: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  viewer: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  client: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30',
}
// Selaras dengan trigger protect_owner_role: role Admin hanya diberikan Owner.
const rolesManageableBy = (callerRole) => (callerRole === 'owner' ? ['admin', 'staff', 'viewer'] : ['staff', 'viewer'])

const FUNCTION_URL = isSupabaseConfigured ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff` : null

// Link undangan dibuat langsung oleh sistem (bukan email bawaan Supabase yang
// dibatasi ~2 email/jam), jadi Owner bisa menyalin atau mengirimnya via WhatsApp.
function InviteLinkCard({ result, onClose }) {
  const [copied, setCopied] = useState(false)
  const roleLabel = ROLE_LABEL[result.role] || result.role
  const isReset = result.kind === 'reset'
  const isLocalLink = /^(localhost|127\.0\.0\.1)$/i.test(new URL(result.url).hostname)
  const waText = isReset
    ? `Halo ${result.name}, berikut link untuk mengatur password akun CMS Admin Bangsa Media Bali Anda (hanya bisa dipakai sekali):\n${result.url}`
    : `Halo ${result.name}, Anda diundang ke CMS Admin Bangsa Media Bali sebagai ${roleLabel}. Buat password akun Anda lewat link berikut (hanya bisa dipakai sekali):\n${result.url}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Link2 size={15} className="text-emerald-400" /> {isReset ? 'Link atur password' : 'Link undangan'} untuk {result.name}
          </p>
          {isReset && (
            <p className="mt-1 text-xs text-slate-300">
              Akun {result.email} sudah ada ({roleLabel}), jadi yang dibuat adalah link atur ulang password. Role tidak diubah.
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            {result.emailSent
              ? `Link juga sudah dikirim ke email ${result.email}.`
              : `Kirim link ini ke ${result.email} lewat WhatsApp atau chat lain. Link hanya bisa dipakai sekali.`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Tutup">
          <X size={16} />
        </button>
      </div>
      <input
        readOnly
        value={result.url}
        onFocus={(e) => e.target.select()}
        className="input-field mt-3 !py-2 font-mono text-[11px] text-slate-300"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn-secondary !px-3 !py-2 text-xs">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Tersalin' : 'Salin Link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary !px-3 !py-2 text-xs"
        >
          <MessageCircle size={13} /> Kirim via WhatsApp
        </a>
      </div>
      {isLocalLink && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-red-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Link ini mengarah ke localhost karena Anda membuka CMS dari server lokal -- tidak akan bisa dibuka di perangkat lain. Buat undangan dari
          bangsamediabali.com untuk staf sungguhan.
        </p>
      )}
      <p className="mt-3 text-[11px] text-amber-300/80">
        Jika link ini dibuka dan password disimpan di browser yang sedang Anda pakai sebagai Owner, sesi Anda akan berganti ke akun tersebut.
      </p>
    </div>
  )
}

export default function UserManagement() {
  const { role: callerRole } = useUserRole()
  const manageableRoles = rolesManageableBy(callerRole)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ email: '', name: '', role: 'staff' })
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [accessEditingId, setAccessEditingId] = useState(null)
  const staffMembers = useSupabaseTable('acc_staff_members', { orderBy: 'name', ascending: true })

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setProfiles(data || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const invite = async () => {
    if (!form.email) return
    setInviting(true)
    setError('')
    setNotice('')
    setInviteResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, redirectTo: `${window.location.origin}/admin/set-password` }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal mengundang pengguna.')
      setInviteResult({
        kind: json.kind,
        email: form.email.trim(),
        name: form.name.trim() || form.email.trim(),
        role: json.role || form.role,
        url: json.inviteUrl,
        emailSent: Boolean(json.emailSent),
      })
      setForm({ email: '', name: '', role: 'staff' })
      load()
    } catch (e) {
      setError(e.message)
    }
    setInviting(false)
  }

  const updateRole = async (id, role) => {
    setError('')
    const previous = profiles
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)))
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (err) {
      setError(err.message)
      setProfiles(previous)
    }
  }

  const linkStaffMember = async (profileId, staffMemberId) => {
    const { error: err } = await supabase.from('acc_staff_members').update({ profile_id: profileId || null }).eq('id', staffMemberId)
    if (err) setError(err.message)
    else staffMembers.refresh()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Kelola Pengguna & Role</h2>
      <p className="mt-1 text-sm text-slate-400">
        {callerRole === 'owner' ? 'Undang akun Admin/Staff/Viewer baru.' : 'Undang akun Staff/Viewer baru. Akun Admin hanya bisa dikelola Owner.'} Owner adalah
        role tertinggi dan hanya bisa diberikan lewat Supabase Dashboard secara manual demi keamanan. Undang ulang email yang sudah terdaftar untuk
        membuat link atur ulang password.
      </p>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 size={13} /> {notice}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-4">
        <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input-field" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {manageableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="button" disabled={inviting || !form.email} onClick={invite} className="btn-primary !py-2.5 text-xs disabled:opacity-60">
          <UserPlus size={14} /> {inviting ? 'Mengundang...' : 'Undang'}
        </button>
      </div>

      {inviteResult?.url && <InviteLinkCard result={inviteResult} onClose={() => setInviteResult(null)} />}

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gold-soft">Daftar Pengguna</h3>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Terhubung ke Data Staf</th>
              <th className="px-4 py-3">Akses Menu</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {profiles.map((p) => {
              const configurable = CONFIGURABLE_ROLES.includes(p.role)
              const summary = configurable ? menuAccessSummary(p) : null
              const editing = accessEditingId === p.id
              return (
              <Fragment key={p.id}>
              <tr className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                <td className="px-4 py-3">
                  {/* Owner & Klien tidak bisa diubah dari sini; Admin hanya oleh Owner (trigger protect_owner_role). */}
                  {manageableRoles.includes(p.role) ? (
                    <select
                      value={p.role}
                      onChange={(e) => updateRole(p.id, e.target.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${ROLE_COLOR[p.role] || ROLE_COLOR.viewer}`}
                    >
                      {manageableRoles.map((r) => (
                        <option key={r} value={r} className="bg-navy-950 text-white">
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${ROLE_COLOR[p.role] || ROLE_COLOR.viewer}`}>
                      {ROLE_LABEL[p.role] || p.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.role === 'staff' ? (
                    <select
                      defaultValue={staffMembers.rows.find((s) => s.profile_id === p.id)?.id || ''}
                      onChange={(e) => linkStaffMember(p.id, e.target.value)}
                      className="input-field !py-1 text-[11px]"
                    >
                      <option value="">Belum terhubung...</option>
                      {staffMembers.rows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {configurable ? (
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-semibold ${SUMMARY_TONE[summary.tone]}`}>{summary.text}</span>
                      <button
                        type="button"
                        onClick={() => setAccessEditingId(editing ? null : p.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-cyan-royal hover:text-cyan-300"
                      >
                        <SlidersHorizontal size={12} /> {editing ? 'Tutup' : 'Atur'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-600">{p.role === 'client' ? 'Portal Klien' : 'Akses penuh'}</span>
                  )}
                </td>
              </tr>
              {editing && configurable && (
                <tr className="border-t border-white/5">
                  <td colSpan={4} className="px-4 py-4">
                    <MenuAccessEditor
                      key={p.role}
                      profile={p}
                      onClose={() => setAccessEditingId(null)}
                      onSaved={(value) => {
                        setProfiles((prev) => prev.map((row) => (row.id === p.id ? { ...row, menu_access: value } : row)))
                        setAccessEditingId(null)
                        setNotice(`Akses menu untuk ${p.name} disimpan. Berlaku begitu pengguna itu membuka kembali tab CMS-nya.`)
                      }}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        "Terhubung ke Data Staf" menentukan rekap komisi mana yang bisa dilihat akun Staff tersebut -- tanpa ini, akun Staff tidak akan melihat komisi pribadinya sama sekali.
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        "Akses Menu" mengatur menu CMS yang tampil untuk akun Staff/Viewer. Owner dan Admin selalu melihat semua menu.
      </p>
    </div>
  )
}
