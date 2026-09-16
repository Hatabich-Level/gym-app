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
  if (ab.type === 'trainer') return (ab.sessionsLeft > 0) ? 'active' : 'expired'
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
  const list = abons.filter(a => a.memberId === memberId && a.active && !a.deleted && a.type !== 'trainer')
  if (!list.length) return null
  // Якщо випадково є кілька "активних" записів (застарілі дублікати) — беремо найновіший за датою початку
  return list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0]
}

export const TRAINER_ABON_EXPIRY_DAYS = 30

export function isTrainerAbonExpired(a) {
  if (!a || !a.startDate) return false
  if (a.frozen) return false // поки заморожено — відлік 30 днів не йде
  const deadline = addDays(a.startDate, TRAINER_ABON_EXPIRY_DAYS + (a.extraDays || 0))
  return TODAY > deadline
}

export function getActiveTrainerAbon(memberId, abons) {
  return abons.find(a =>
    a.memberId === memberId && a.type === 'trainer' && !a.deleted && !a.frozen &&
    a.sessionsLeft > 0 && !isTrainerAbonExpired(a)
  ) || null
}

export function visitedToday(ab) {
  return !!(ab && ab.visits && ab.visits.some(v => v.date === TODAY))
}

export function visitedTodayAny(memberId, abons) {
  return abons.some(a => a.memberId === memberId && !a.deleted && a.visits && a.visits.some(v => v.date === TODAY))
}

// ── Member debt (борг по абонементу) ─────────────────────────────────────────
export function getMemberDebt(memberId, abons, payments) {
  const ab = getActiveAbon(memberId, abons)
  if (!ab || !ab.price) return 0
  // Рахуємо оплачену суму двома способами і беремо максимум:
  // 1) через payments з abonId (нові записи)
  // 2) через поле ab.paid (пряме оновлення абонементу)
  const paidViaPayments = payments
    .filter(p => p.memberId === memberId && p.abonId === ab.id)
    .reduce((s, p) => s + (p.amount || 0), 0)
  const paidViaPaid = ab.paid || 0
  const totalPaid = Math.max(paidViaPayments, paidViaPaid)
  return Math.max(0, ab.price - totalPaid)
}

// ── Finance ───────────────────────────────────────────────────────────────────
export const HALL_FEE = 150
export const SPLIT_HALL_FEE = 20
export const TRAINER_PCT = 0.60

// Кожен тренер може мати власні умови (відсоток і суму за зал), які
// задаються в Налаштування → Акаунти. Якщо не задано — беруться загальні.
export function trainerTerms(user) {
  const pct = (user && typeof user.trainerPct === 'number' && user.trainerPct > 0 && user.trainerPct < 1)
    ? user.trainerPct : TRAINER_PCT
  const fee = (user && typeof user.hallFee === 'number' && user.hallFee >= 0)
    ? user.hallFee : HALL_FEE
  const splitFee = (user && typeof user.splitHallFee === 'number' && user.splitHallFee >= 0)
    ? user.splitHallFee : SPLIT_HALL_FEE
  return { pct, fee, splitFee }
}

export function findTrainerUser(users, role, uname) {
  if (!users || !users.length) return null
  const key = uname || ''
  return users.find(u => u.role === role && (u.name || u.login) === key) || null
}

export function calcTrainerEarning(trainerPrice, terms) {
  const { pct, fee } = terms || { pct: TRAINER_PCT, fee: HALL_FEE }
  return Math.round((trainerPrice + fee) * pct)
}
export function calcHallEarning(trainerPrice, terms) {
  const { pct, fee } = terms || { pct: TRAINER_PCT, fee: HALL_FEE }
  return Math.round((trainerPrice + fee) * (1 - pct) - fee)
}

export function sumByMethod(payments, method) {
  return payments.filter(p => method === 'cash' ? p.method !== 'card' : p.method === 'card')
    .reduce((s, p) => s + (p.amount || 0), 0)
}

export function nowTime() {
  return new Date().toTimeString().slice(0, 5)
}