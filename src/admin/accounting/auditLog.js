import { supabase } from '../../lib/supabaseClient'

// Catat aksi penting ke acc_audit_logs (Owner bisa tinjau di tab Audit Trail).
// Dipanggil "fire-and-forget" -- kegagalan logging tidak boleh menggagalkan
// aksi utama yang sedang dilakukan pengguna.
export async function logAudit(action, entityName, entityId, { oldValues, newValues } = {}) {
  try {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('acc_audit_logs').insert({
      user_id: userData?.user?.id || null,
      action,
      entity_name: entityName,
      entity_id: entityId || null,
      old_values: oldValues || null,
      new_values: newValues || null,
    })
  } catch {
    // Diam-diam abaikan -- audit log tidak boleh mengganggu alur utama.
  }
}
