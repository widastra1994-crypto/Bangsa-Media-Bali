import { useState } from 'react'
import { Check, Lock, RotateCcw, Save, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { MENU_GROUPS, eligibleGroupsForRole, eligibleTabIds } from '../menuConfig'
import { logAudit } from './auditLog'

const ROLE_LABEL = { staff: 'Staff', viewer: 'Viewer' }

export function menuAccessSummary(profile) {
  const eligible = eligibleTabIds(profile.role)
  const total = eligible.length
  if (!Array.isArray(profile.menu_access)) return { text: `Semua menu (${total})`, tone: 'all' }
  const count = profile.menu_access.filter((id) => eligible.includes(id)).length
  if (count === 0) return { text: 'Tidak ada akses', tone: 'none' }
  if (count === total) return { text: `Semua menu (${total})`, tone: 'all' }
  return { text: `${count} dari ${total} menu`, tone: 'custom' }
}

export default function MenuAccessEditor({ profile, onSaved, onClose }) {
  const groups = eligibleGroupsForRole(profile.role)
  const allIds = groups.flatMap((g) => g.tabs.map((t) => t.id))
  const lockedGroups = MENU_GROUPS.filter((g) => !groups.some((eg) => eg.group === g.group)).map((g) => g.group)
  // Untuk Viewer: menu yang sebenarnya bisa dibuka cukup dengan role Staff,
  // supaya Owner tidak terdorong menaikkan ke Admin tanpa perlu.
  const staffOnlyLabels =
    profile.role === 'viewer'
      ? eligibleGroupsForRole('staff')
          .flatMap((g) => g.tabs)
          .filter((t) => !allIds.includes(t.id))
          .map((t) => t.label)
      : []

  const [selected, setSelected] = useState(
    () => new Set(Array.isArray(profile.menu_access) ? profile.menu_access.filter((id) => allIds.includes(id)) : allIds),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleGroup = (group) => {
    const ids = group.tabs.map((t) => t.id)
    const allOn = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)))
      return next
    })
  }

  const persist = async (value) => {
    setSaving(true)
    setError('')
    // .select() supaya ketahuan bila RLS menyaring update tanpa error (0 baris).
    const { data, error: err } = await supabase.from('profiles').update({ menu_access: value }).eq('id', profile.id).select('id')
    setSaving(false)
    if (err || !data?.length) {
      setError(err?.message || 'Perubahan tidak tersimpan -- periksa hak akses akun Anda.')
      return
    }
    logAudit('menu_access_changed', 'profiles', profile.id, {
      oldValues: { menu_access: profile.menu_access ?? null },
      newValues: { menu_access: value },
    })
    onSaved(value)
  }

  // Semua dicentang disimpan sebagai NULL (= default), supaya menu baru yang
  // nanti ditambahkan untuk role ini otomatis ikut terbuka.
  const save = () => persist(selected.size === allIds.length ? null : allIds.filter((id) => selected.has(id)))

  return (
    <div className="rounded-2xl border border-gold/20 bg-navy-950/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Akses Menu — {profile.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Centang menu CMS yang boleh dibuka akun {ROLE_LABEL[profile.role] || profile.role} ini.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" aria-label="Tutup">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((group) => {
          const GroupIcon = group.icon
          const ids = group.tabs.map((t) => t.id)
          const onCount = ids.filter((id) => selected.has(id)).length
          const allOn = onCount === ids.length
          return (
            <div key={group.group}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <GroupIcon size={13} /> {group.group}
                  <span className="font-semibold normal-case tracking-normal text-slate-600">
                    ({onCount}/{ids.length})
                  </span>
                </p>
                <button type="button" onClick={() => toggleGroup(group)} className="text-[11px] font-semibold text-cyan-royal hover:text-cyan-300">
                  {allOn ? 'Kosongkan' : 'Pilih semua'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.tabs.map((tab) => {
                  const TabIcon = tab.icon
                  const on = selected.has(tab.id)
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(tab.id)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        on ? 'border-gold/50 bg-gold/10 text-white' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? 'border-gold bg-gold text-navy-950' : 'border-slate-500/60'
                        }`}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <TabIcon size={14} className={on ? 'text-gold-soft' : 'text-slate-500'} />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {(lockedGroups.length > 0 || staffOnlyLabels.length > 0) && (
        <div className="mt-4 space-y-1.5 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-slate-500">
          {staffOnlyLabels.length > 0 && (
            <p className="flex items-start gap-2">
              <Lock size={12} className="mt-0.5 shrink-0" />
              Menu {staffOnlyLabels.join(', ')} tersedia jika role akun ini diubah ke Staff.
            </p>
          )}
          {lockedGroups.length > 0 && (
            <p className="flex items-start gap-2">
              <Lock size={12} className="mt-0.5 shrink-0" />
              Menu {lockedGroups.join(', ')} dan menu keuangan sensitif lainnya khusus Owner/Admin.
            </p>
          )}
        </div>
      )}

      {selected.size === 0 && <p className="mt-3 text-[11px] text-amber-400">Tanpa menu yang dicentang, akun ini tidak bisa membuka halaman apa pun di CMS.</p>}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => persist(null)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-60"
        >
          <RotateCcw size={13} /> Kembalikan ke default (semua menu)
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-3 !py-2 text-xs">
            Batal
          </button>
          <button type="button" disabled={saving} onClick={save} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-60">
            <Save size={13} /> {saving ? 'Menyimpan...' : 'Simpan Akses'}
          </button>
        </div>
      </div>
    </div>
  )
}
