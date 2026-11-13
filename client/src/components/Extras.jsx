import React, { useState, useMemo } from 'react'
import { Modal } from './UI'
import { TODAY, fmtDate, abonStatus, getActiveAbon, getMemberDebt, daysDiff } from '../utils'

// ── Телефон → формат 380XXXXXXXXX (або '' якщо не схоже на номер) ───────────────
export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('380') && d.length === 12) return d
  if (d.startsWith('80') && d.length === 11) return '3' + d
  if (d.startsWith('0') && d.length === 10) return '38' + d
  if (d.length === 9) return '380' + d
  return d.length >= 10 ? d : ''
}

export function reminderText(member, abons, payments) {
  const name = (member.name || '').split(' ').slice(1).join(' ') || member.name || ''
  const ab = getActiveAbon(member.id, abons)
  const st = ab ? abonStatus(ab) : null
  const debt = getMemberDebt(member.id, abons, payments || [])
  let body
  if (st === 'expired') {
    body = ab.type === 'month'
      ? `Ваш абонемент закінчився ${fmtDate(ab.endDate)}.`
      : 'Ваш разовий абонемент використано.'
  } else if (st === 'ending') {
    const d = daysDiff(TODAY, ab.endDate)
    body = `Ваш абонемент закінчується ${fmtDate(ab.endDate)} (${d === 0 ? 'сьогодні' : 'через ' + d + ' дн.'}).`
  } else if (st === 'frozen') {
    body = 'Ваш абонемент зараз заморожений.'
  } else if (!ab) {
    body = 'Давно не бачили вас у залі.'
  } else {
    body = `Ваш абонемент діє до ${fmtDate(ab.endDate)}.`
  }
  if (debt > 0) body += ` Також є несплачений залишок ${debt} грн.`
  return `Доброго дня${name ? ', ' + name : ''}! ${body} Чекаємо вас у Sport City 💪`
}

// ── Нагадування клієнту: SMS / Viber / Telegram / копіювати ────────────────────
export function ReminderModal({ member, abons, payments, onClose }) {
  const [text, setText] = useState(() => reminderText(member, abons, payments))
  const [copied, setCopied] = useState(false)
  const num = normPhone(member.phone)
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)

  async function copy() {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  const sms = `sms:+${num}${isIos ? '&' : '?'}body=${encodeURIComponent(text)}`
  const viber = `viber://chat?number=%2B${num}`
  const tg = `https://t.me/+${num}`

  return (
    <Modal title={`💬 Нагадати: ${member.name}`} onClose={onClose}>
      <div className="card keep-ro">
        {!num && <div style={{ color: 'var(--ylw)', fontSize: 13, marginBottom: 10 }}>⚠️ У клієнта немає коректного номера телефону — можна лише скопіювати текст.</div>}
        <div className="flabel" style={{ marginBottom: 6 }}>Текст повідомлення</div>
        <textarea className="rem-text" value={text} onChange={e => setText(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <a className="chip-btn" href={num ? sms : undefined} style={!num ? { opacity: .4, pointerEvents: 'none' } : undefined}>💬 SMS</a>
          <a className="chip-btn" href={num ? viber : undefined} onClick={copy} style={!num ? { opacity: .4, pointerEvents: 'none' } : undefined}>🟣 Viber</a>
          <a className="chip-btn" href={num ? tg : undefined} target="_blank" rel="noreferrer" onClick={copy} style={!num ? { opacity: .4, pointerEvents: 'none' } : undefined}>✈️ Telegram</a>
          <button className="chip-btn" onClick={copy}>{copied ? '✅ Скопійовано' : '📋 Копіювати'}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 10, lineHeight: 1.5 }}>
          Для Viber і Telegram текст копіюється автоматично — просто встав його в чат.
        </div>
      </div>
    </Modal>
  )
}

// ── Календар відвідувань клієнта ──────────────────────────────────────────────
const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']

export function VisitCalendar({ memberId, abons }) {
  const [ym, setYm] = useState(TODAY.slice(0, 7))

  const { visitMap, firstYm } = useMemo(() => {
    const map = {}
    let first = TODAY.slice(0, 7)
    ;(abons || []).filter(a => a.memberId === memberId && !a.deleted).forEach(a => {
      ;(a.visits || []).forEach(v => {
        if (!v.date) return
        const e = map[v.date] || (map[v.date] = { n: 0, trainer: false })
        e.n++
        if (a.type === 'trainer') e.trainer = true
        if (v.date.slice(0, 7) < first) first = v.date.slice(0, 7)
      })
    })
    return { visitMap: map, firstYm: first }
  }, [memberId, abons])

  const [y, m] = ym.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // понеділок = 0
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym}-${String(d).padStart(2, '0')}`)

  const monthVisits = cells.filter(Boolean).filter(d => visitMap[d]).length
  const total = Object.keys(visitMap).length

  function shift(delta) {
    const dt = new Date(y, m - 1 + delta, 1)
    setYm(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="card">
      <div className="ct">📅 Історія відвідувань</div>
      <div className="vcal-head">
        <button onClick={() => shift(-1)} disabled={ym <= firstYm} aria-label="Попередній місяць">‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600 }}>{MONTHS[m - 1]} {y}</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{monthVisits} відвід. за місяць · {total} усього</div>
        </div>
        <button onClick={() => shift(1)} disabled={ym >= TODAY.slice(0, 7)} aria-label="Наступний місяць">›</button>
      </div>
      <div className="vcal-grid">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d => <div key={d} className="vcal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={'e' + i} />
          const v = visitMap[d]
          const cls = ['vcal-day', v ? (v.trainer ? 'trainer' : 'visit') : '', d === TODAY ? 'today' : '', v && v.n > 1 ? 'n2' : ''].join(' ')
          return <div key={d} className={cls}>{+d.slice(8)}</div>
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--txt2)', marginTop: 10 }}>
        <span><span className="tdot" style={{ background: 'var(--grn)' }} />зал</span>
        <span><span className="tdot" style={{ background: 'var(--acc)' }} />заняття з тренером</span>
      </div>
    </div>
  )
}

export function TDot({ color }) {
  if (!color) return null
  return <span className="tdot" style={{ background: color }} />
}
