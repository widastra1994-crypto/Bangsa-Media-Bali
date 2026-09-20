import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Access token bisa kedaluwarsa kalau tab dibiarkan lama tidak aktif (browser
// menjeda timer refresh-otomatis Supabase). Daripada langsung menampilkan
// error mentah "JWT expired" ke pengguna, coba refresh sesi sekali lalu ulangi
// query -- di kebanyakan kasus pengguna tidak akan sadar apa-apa terjadi.
async function isExpiredJwtError(err) {
  return /jwt expired/i.test(err?.message || '')
}

export function useSupabaseTable(table, { select = '*', orderBy = 'created_at', ascending = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    let { data, error: err } = await supabase.from(table).select(select).order(orderBy, { ascending })
    if (err && (await isExpiredJwtError(err))) {
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (!refreshErr) {
        ;({ data, error: err } = await supabase.from(table).select(select).order(orderBy, { ascending }))
      }
    }
    if (err) setError(err.message)
    else setRows(data || [])
    setLoading(false)
  }, [table, select, orderBy, ascending])

  useEffect(() => {
    refresh()
  }, [refresh])

  const insert = useCallback(
    async (values) => {
      const { data, error: err } = await supabase.from(table).insert(values).select()
      if (err) throw new Error(err.message)
      await refresh()
      return data?.[0]
    },
    [table, refresh],
  )

  const update = useCallback(
    async (id, values) => {
      const { error: err } = await supabase.from(table).update(values).eq('id', id)
      if (err) throw new Error(err.message)
      await refresh()
    },
    [table, refresh],
  )

  const remove = useCallback(
    async (id) => {
      const { error: err } = await supabase.from(table).delete().eq('id', id)
      if (err) throw new Error(err.message)
      await refresh()
    },
    [table, refresh],
  )

  return { rows, loading, error, refresh, insert, update, remove }
}
