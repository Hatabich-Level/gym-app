import { useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { setTrainerColors, setTrainerColor } from '../trainerColors'

export function useStore() {
  const [members, setMembers] = useState([])
  const [abons, setAbons] = useState([])
  const [payments, setPayments] = useState([])
  const [manualDebts, setManualDebts] = useState([])
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [shifts, setShifts] = useState([])
  const [myTerms, setMyTerms] = useState(null)
  const [trainers, setTrainers] = useState([])
  const [readOnly, setReadOnly] = useState(false)
  const [loading, setLoadingRaw] = useState(false)

  // pending — скільки операцій зараз виконується; seq змінюється на початку
  // і в кінці кожної. Фонове оновлення (refresh) за ними визначає, чи можна
  // безпечно застосувати отриманий знімок стану.
  const pending = useRef(0)
  const seq = useRef(0)
  const setLoading = useCallback((v) => {
    pending.current = Math.max(0, pending.current + (v ? 1 : -1))
    seq.current++
    setLoadingRaw(pending.current > 0)
  }, [])

  const applyState = useCallback((st) => {
    setMembers(st.members || [])
    setAbons(st.abons || [])
    setPayments(st.payments || [])
    setManualDebts(st.manualDebts || [])
    setUsers(st.users || [])
    setAuditLog(st.auditLog || [])
    setShifts(st.shifts || [])
    setMyTerms(st.myTerms || null)
    setTrainers(st.trainers || [])
    setReadOnly(!!st.readOnly)
    setTrainerColors([...(st.users || []), ...(st.trainers || [])])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const st = await api('/state')
      applyState(st)
      return st
    } finally {
      setLoading(false)
    }
  }, [])

  // Тихе фонове оновлення (без індикатора): підтягує зміни з інших пристроїв
  // (NFC-зчитувач, телефон тренера). Пропускається, якщо саме зараз щось
  // зберігається, і відкидається, якщо під час запиту почалась інша операція —
  // щоб старіший знімок не затер щойно збережене.
  const refresh = useCallback(async () => {
    if (pending.current > 0) return
    const started = seq.current
    try {
      const st = await api('/state')
      if (seq.current !== started) return
      applyState(st)
    } catch {}
  }, [])

  const pushMembers = useCallback(async (items) => {
    setLoading(true)
    try {
      const res = await api('/members/bulk', 'POST', { items })
      const saved = res.items || items // сервер повертає те, що реально збережено
      setMembers(prev => {
        const map = new Map(prev.map(m => [m.id, m]))
        saved.forEach(m => map.set(m.id, m))
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
      const res = await api('/abons/bulk', 'POST', { items })
      const saved = res.items || items // сервер повертає те, що реально збережено
      setAbons(prev => {
        const map = new Map(prev.map(a => [a.id, a]))
        saved.forEach(a => map.set(a.id, a))
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const pushPayment = useCallback(async (p) => {
    setLoading(true)
    try {
      const res = await api('/payments', 'POST', p)
      const saved = res.payment || p // сервер проставляє автора (by) і нормалізує методи
      setPayments(prev => {
        const map = new Map(prev.map(x => [x.id, x]))
        map.set(saved.id, saved)
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

  const updateUserColor = useCallback(async (id, color) => {
    setLoading(true)
    try {
      await api('/users/' + id + '/color', 'POST', { color })
      setUsers(prev => prev.map(u => { if (u.id === id) { setTrainerColor(id, u.name || u.login, color); return { ...u, color } } return u }))
      setTrainers(prev => prev.map(u => u.id === id ? { ...u, color } : u))
    } finally { setLoading(false) }
  }, [])

  const updateMyColor = useCallback(async (myId, color) => {
    setLoading(true)
    try {
      await api('/me/color', 'POST', { color })
      setUsers(prev => prev.map(u => { if (u.id === myId) { setTrainerColor(myId, u.name || u.login, color); return { ...u, color } } return u }))
      setTrainers(prev => prev.map(u => { if (u.id === myId) { setTrainerColor(myId, u.name, color); return { ...u, color } } return u }))
    } finally { setLoading(false) }
  }, [])

  const updateUserReadOnly = useCallback(async (id, ro) => {
    setLoading(true)
    try {
      await api('/users/' + id + '/readonly', 'POST', { readOnly: ro })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, readOnly: ro } : u))
    } finally { setLoading(false) }
  }, [])

  const unlinkCard = useCallback(async (memberId) => {
    setLoading(true)
    try {
      const res = await api('/members/' + memberId + '/unlink-card', 'POST')
      setMembers(prev => prev.map(m => m.id === memberId ? (res.member || m) : m))
    } finally { setLoading(false) }
  }, [])

  const assignTrainer = useCallback(async (memberIds, trainerId) => {
    setLoading(true)
    try {
      const res = await api('/members/assign-trainer', 'POST', { memberIds, trainerId })
      const map = new Map((res.members || []).map(m => [m.id, m]))
      setMembers(prev => prev.map(m => map.get(m.id) || m))
    } finally { setLoading(false) }
  }, [])

  const updateUserTerms = useCallback(async (id, terms) => {
    setLoading(true)
    try {
      const res = await api('/users/' + id + '/terms', 'POST', terms)
      setUsers(prev => prev.map(u => u.id === id ? (res.user || u) : u))
    } finally { setLoading(false) }
  }, [])

  const pushShifts = useCallback(async (items) => {
    setLoading(true)
    try {
      await api('/shifts/bulk', 'POST', { items })
      setShifts(prev => {
        const map = new Map(prev.map(s => [s.date, s]))
        items.forEach(s => map.set(s.date, s))
        return [...map.values()]
      })
    } finally { setLoading(false) }
  }, [])

  const changeUserPassword = useCallback(async (id, password) => {
    setLoading(true)
    try {
      await api('/users/' + id + '/password', 'POST', { password })
    } finally { setLoading(false) }
  }, [])

  return {
    members, abons, payments, manualDebts, users, auditLog, shifts, pushShifts, myTerms, trainers, readOnly, loading,
    load, refresh, pushMembers, deleteMembers, deleteMember,
    pushAbons, pushPayment, deletePayment,
    saveManualDebt, payManualDebt, deleteManualDebt,
    createUser, deleteUser, changeUserPassword, updateUserColor, updateUserTerms, updateUserReadOnly, updateMyColor, unlinkCard, assignTrainer,
    setAbons, setMembers
  }
}