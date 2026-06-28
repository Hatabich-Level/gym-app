import { useState, useCallback } from 'react'
import { api } from '../api'

export function useStore() {
  const [members, setMembers] = useState([])
  const [abons, setAbons] = useState([])
  const [payments, setPayments] = useState([])
  const [manualDebts, setManualDebts] = useState([])
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const st = await api('/state')
      setMembers(st.members || [])
      setAbons(st.abons || [])
      setPayments(st.payments || [])
      setManualDebts(st.manualDebts || [])
      setUsers(st.users || [])
      setAuditLog(st.auditLog || [])
      return st
    } finally {
      setLoading(false)
    }
  }, [])

  const pushMembers = useCallback(async (items) => {
    setLoading(true)
    try {
      await api('/members/bulk', 'POST', { items })
      setMembers(prev => {
        const map = new Map(prev.map(m => [m.id, m]))
        items.forEach(m => map.set(m.id, m))
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const deleteMembers = useCallback(async (ids) => {
    setLoading(true)
    try {
      await api('/members/delete-many', 'DELETE', { ids })
      setMembers(prev => prev.filter(m => !ids.includes(m.id)))
      setAbons(prev => prev.filter(a => !ids.includes(a.memberId)))
    } finally { setLoading(false) }
  }, [])

  const deleteMember = useCallback(async (id) => {
    setLoading(true)
    try {
      await api('/members/' + id, 'DELETE')
      setMembers(prev => prev.filter(m => m.id !== id))
      setAbons(prev => prev.filter(a => a.memberId !== id))
    } finally { setLoading(false) }
  }, [])

  const pushAbons = useCallback(async (items) => {
    setLoading(true)
    try {
      await api('/abons/bulk', 'POST', { items })
      setAbons(prev => {
        const map = new Map(prev.map(a => [a.id, a]))
        items.forEach(a => map.set(a.id, a))
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const pushPayment = useCallback(async (p) => {
    setLoading(true)
    try {
      await api('/payments', 'POST', p)
      setPayments(prev => {
        const map = new Map(prev.map(x => [x.id, x]))
        map.set(p.id, p)
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const deletePayment = useCallback(async (id) => {
    setLoading(true)
    try {
      await api('/payments/' + id, 'DELETE')
      setPayments(prev => prev.filter(p => p.id !== id))
    } finally { setLoading(false) }
  }, [])

  const saveManualDebt = useCallback(async (d) => {
    setLoading(true)
    try {
      await api('/manual-debts', 'POST', d)
      setManualDebts(prev => {
        const map = new Map(prev.map(x => [x.id, x]))
        map.set(d.id, d)
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const payManualDebt = useCallback(async (id, amount, method, note) => {
    setLoading(true)
    try {
      const result = await api('/manual-debts/' + id + '/pay', 'POST', { amount, method, note })
      // reload to get fresh state
      const st = await api('/state')
      setManualDebts(st.manualDebts || [])
      setPayments(st.payments || [])
      return result
    } finally { setLoading(false) }
  }, [])

  const deleteManualDebt = useCallback(async (id) => {
    setLoading(true)
    try {
      await api('/manual-debts/' + id, 'DELETE')
      setManualDebts(prev => prev.filter(d => d.id !== id))
    } finally { setLoading(false) }
  }, [])

  // ── User management (тільки головний адмін) ──────────────────────────────────
  const createUser = useCallback(async (data) => {
    setLoading(true)
    try {
      const user = await api('/users', 'POST', data)
      setUsers(prev => [...prev, user])
      return user
    } finally { setLoading(false) }
  }, [])

  const deleteUser = useCallback(async (id) => {
    setLoading(true)
    try {
      await api('/users/' + id, 'DELETE')
      setUsers(prev => prev.filter(u => u.id !== id))
    } finally { setLoading(false) }
  }, [])

  const changeUserPassword = useCallback(async (id, password) => {
    setLoading(true)
    try {
      await api('/users/' + id + '/password', 'POST', { password })
    } finally { setLoading(false) }
  }, [])

  return {
    members, abons, payments, manualDebts, users, auditLog, loading,
    load, pushMembers, deleteMembers, deleteMember,
    pushAbons, pushPayment, deletePayment,
    saveManualDebt, payManualDebt, deleteManualDebt,
    createUser, deleteUser, changeUserPassword,
    setAbons, setMembers
  }
}