import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { useSupabaseTable } from './useSupabaseTable'

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer', client: 'Klien (Portal)' }
const ROLE_COLOR = {
  owner: 'bg-gold/20 text-gold-soft border-gold/40',
  admin: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
  staff: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  viewer: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  client: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30',
}
const INVITABLE_ROLES = ['admin', 'staff', 'viewer']

const FUNCTION_URL = isSupabaseConfigured ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff` : null

export default function UserManagement() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ email: '', name: '', role: 'staff' })
  const [inviting, setInviting] = useState(false)
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
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Gagal mengundang pengguna.')
      setNotice(`Undangan berhasil dikirim ke ${form.email}. Mereka akan menerima email untuk mengatur password.`)
      setForm({ email: '', name: '', role: 'staff' })
      load()
    } catch (e) {
      setError(e.message)
    }
    setInviting(false)
  }

  const updateRole = async (id, role) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)))
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (err) setError(err.message)
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
        Undang akun Admin/Staff/Viewer baru. Owner adalah role tertinggi dan hanya bisa diberikan lewat Supabase Dashboard secara manual (bukan lewat undangan di sini) demi keamanan.
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
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="button" disabled={inviting || !form.email} onClick={invite} className="btn-primary !py-2.5 text-xs disabled:opacity-60">
          <UserPlus size={14} /> {inviting ? 'Mengundang...' : 'Undang'}
        </button>
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-gold-soft">Daftar Pengguna</h3>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Terhubung ke Data Staf</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Memuat...
                </td>
              </tr>
            )}
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-white/5 text-slate-300">
                <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                <td className="px-4 py-3">
                  {p.role === 'owner' ? (
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${ROLE_COLOR.owner}`}>Owner</span>
                  ) : (
                    <select
                      value={p.role}
                      onChange={(e) => updateRole(p.id, e.target.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${ROLE_COLOR[p.role] || ROLE_COLOR.viewer}`}
                    >
                      {['admin', 'staff', 'viewer', 'client'].map((r) => (
                        <option key={r} value={r} className="bg-navy-950 text-white">
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        "Terhubung ke Data Staf" menentukan rekap komisi mana yang bisa dilihat akun Staff tersebut -- tanpa ini, akun Staff tidak akan melihat komisi pribadinya sama sekali.
      </p>
    </div>
  )
}
