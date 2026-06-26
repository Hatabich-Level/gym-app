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

// ── Abon status ───────────────────────────────────────────────────────────────
export function abonStatus(ab) {
  if (!ab) return null
  if (ab.frozen) return 'frozen'
  if (ab.type === 'visit') return ab.active ? 'active' : 'expired'
  if (!ab.endDate) return 'active'
  const diff = Math.ceil((new Date(ab.endDate) - new Date(TODAY)) / 86400000)
  if (diff < 0) return 'expired'
  if (diff <= 5) return 'ending'
  return 'active'
}

export const STATUS_LABEL = {
  active: 'Активний', ending: 'Закінчується', expired: 'Закінчився',
  frozen: '❄️ Заморожено'
}
export const STATUS_TAG = {
  active: 'tag-grn', ending: 'tag-ylw', expired: 'tag-red', frozen: 'tag-ice'
}

export function getActiveAbon(memberId, abons) {
  return abons.find(a => a.memberId === memberId && a.active !== false &&
    (a.type === 'visit' ? a.active : (!a.endDate || a.endDate >= TODAY))) || null
}

export function getActiveTrainerAbon(memberId, abons) {
  return abons.find(a => a.memberId === memberId && a.type === 'trainer' && a.sessionsLeft > 0) || null
}

export function visitedTodayAny(memberId, abons) {
  return abons.some(a => a.memberId === memberId && a.visits && a.visits.some(v => v.date === TODAY))
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
