import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Hook CRUD generik untuk tabel akunting (Supabase). Dipakai di semua layar
// Master Data & transaksi supaya tidak menduplikasi boilerplate fetch/insert/
// update/delete di setiap komponen.
export function useSupabaseTable(table, { select = '*', orderBy = 'created_at', ascending = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    setLoading(true)
    setError('')
    return supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data || [])
        setLoading(false)
      })
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
