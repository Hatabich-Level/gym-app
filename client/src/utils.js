export const TODAY = new Date().toISOString().slice(0, 10)

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function fmtDate(s) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

export function addCalMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Date helpers ─────────────────────────────────────────────────────────────
export function addDays(s, n) {
  const d = new Date(s)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
export function daysDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

// ── Abon status ───────────────────────────────────────────────────────────────
// Повторює оригінальну логіку index.html: активний абонемент — це той, що
// має active === true, незалежно від endDate (статус "закінчився" — це
// окремий стан, а не відсутність абонементу).
export function abonStatus(ab) {
  if (!ab) return null
  if (ab.frozen) return 'frozen'
  if (ab.type === 'visit') return ab.active ? 'active' : 'expired'
  if (!ab.endDate) return 'expired'
  if (ab.endDate < TODAY) return 'expired'
  if (daysDiff(TODAY, ab.endDate) <= 3) return 'ending'
  return 'active'
}

export const STATUS_LABEL = {
  active: 'Активний', ending: 'Закінчується', expired: 'Закінчився',
  frozen: 'Заморожений'
}
export const STATUS_TAG = {
  active: 'tag-grn', ending: 'tag-ylw', expired: 'tag-red', frozen: 'tag-ice'
}

export function getActiveAbon(memberId, abons) {
  const active = abons.filter(a => a.memberId === memberId && a.active && a.type !== 'trainer')
  if (active.length === 0) return null
  if (active.length === 1) return active[0]
  // Захист від забруднених даних: якщо активних записів більше одного,
  // беремо найновіший за датою початку (а не довільний перший).
  return active.slice().sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0]
}

export function getActiveTrainerAbon(memberId, abons) {
  return abons.find(a => a.memberId === memberId && a.type === 'trainer' && a.sessionsLeft > 0) || null
}

export function visitedToday(ab) {
  return !!(ab && ab.visits && ab.visits.some(v => v.date === TODAY))
}

export function visitedTodayAny(memberId, abons) {
  return abons.some(a => a.memberId === memberId && a.visits && a.visits.some(v => v.date === TODAY))
}

// ── Member debt (борг по абонементу, рахується від платежів з abonId) ───────
export function getMemberDebt(memberId, abons, payments) {
  const ab = getActiveAbon(memberId, abons)
  if (!ab || !ab.price) return 0
  const paid = payments.filter(p => p.memberId === memberId && p.abonId === ab.id)
    .reduce((s, p) => s + (p.amount || 0), 0)
  return Math.max(0, ab.price - paid)
}

// ── Finance ───────────────────────────────────────────────────────────────────
export const HALL_FEE = 150
export const SPLIT_HALL_FEE = 20
export const TRAINER_PCT = 0.60

export function calcTrainerEarning(trainerPrice) {
  return Math.round((trainerPrice + HALL_FEE) * TRAINER_PCT)
}
export function calcHallEarning(trainerPrice) {
  return Math.round((trainerPrice + HALL_FEE) * (1 - TRAINER_PCT) - HALL_FEE)
}

export function sumByMethod(payments, method) {
  return payments.filter(p => method === 'cash' ? p.method !== 'card' : p.method === 'card')
    .reduce((s, p) => s + (p.amount || 0), 0)
}

export function nowTime() {
  return new Date().toTimeString().slice(0, 5)
}