import React from 'react'
import { TODAY, abonStatus, fmtDate, getActiveAbon, visitedTodayAny, getMemberDebt, daysDiff } from '../utils'

function daysDiffSafe(a, b) {
  if (!a || !b) return 0
  return daysDiff(a, b)
}

export default function HomePage({ members, abons, payments, role, uname, onNavigate }) {
  const isAdmin = role === 'owner' || role === 'admin'

  // Stats
  const active   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'active' }).length
  const frozen   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'frozen' }).length
  const ending   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && ['ending','expired'].includes(abonStatus(a)) }).length
  const checked  = members.filter(m => visitedTodayAny(m.id, abons)).length
  const todayAll = payments.filter(p => p.date === TODAY)
  const todayCash = todayAll.filter(p => p.method !== 'card').reduce((s,p) => s + (p.amount||0), 0)
  const todayCard = todayAll.filter(p => p.method === 'card').reduce((s,p) => s + (p.amount||0), 0)

  // Alerts: expired/ending/frozen — як в оригіналі, з пріоритетом і видимі всім ролям
  const alerts = []
  members.forEach(m => {
    const a = getActiveAbon(m.id, abons)
    if (!a) return
    const st = abonStatus(a)
    if (st === 'frozen') {
      const d = daysDiffSafe(a.freezeStart, TODAY)
      alerts.push({ p: 2, id: m.id, name: m.name, tag: 'tag-ice', tagTxt: '❄️ Заморожено', sub: `Заморожено ${d} дн. тому`, dot: '#88aaff' })
    } else if (st === 'expired') {
      alerts.push({ p: 0, id: m.id, name: m.name, tag: 'tag-red', tagTxt: 'Закінчився', sub: a.type === 'month' ? 'Закінчився ' + fmtDate(a.endDate) : 'Разовий використано', dot: '#ff5588' })
    } else if (st === 'ending') {
      const d = daysDiffSafe(TODAY, a.endDate)
      alerts.push({ p: 1, id: m.id, name: m.name, tag: 'tag-ylw', tagTxt: '⚠️ ' + (d === 0 ? 'Сьогодні' : d + ' дн.'), sub: 'Закінчується ' + fmtDate(a.endDate), dot: '#f5a623' })
    }
  })
  alerts.sort((a, b) => a.p - b.p)

  // Debts summary (абон. + ручні рахуються лише через manualDebts на сторінці Фінанси,
  // тут показуємо тільки борги по абонементах для швидкого огляду)
  const debtCount = members.filter(m => getMemberDebt(m.id, abons, payments) > 0).length
  const totalDebt = members.reduce((s, m) => s + getMemberDebt(m.id, abons, payments), 0)

  return (
    <div className="pg">

      {/* Stats */}
      <div className="stats2">
        <div className="sc clickable" onClick={() => onNavigate('members', 'active')}>
          <div className="sv">{active}</div>
          <div className="sl">Активних абон.</div>
        </div>
        <div className="sc clickable" onClick={() => onNavigate('checkin')}>
          <div className="sv" style={{ color: 'var(--grn)' }}>{checked}</div>
          <div className="sl">Відмічено сьогодні</div>
        </div>
        {isAdmin && <>
          <div className="sc clickable" onClick={() => onNavigate('members', 'ending')}>
            <div className="sv" style={{ color: 'var(--ylw)' }}>{ending}</div>
            <div className="sl">Закінчується скоро</div>
          </div>
          <div className="sc clickable" onClick={() => onNavigate('members', 'frozen')}>
            <div className="sv" style={{ color: '#88aaff' }}>{frozen}</div>
            <div className="sl">Заморожених</div>
          </div>
        </>}
      </div>

      {isAdmin && (todayCash > 0 || todayCard > 0) && (
        <div className="stats3" style={{ marginBottom: 12 }}>
          <div className="sc">
            <div className="sv" style={{ color: 'var(--grn)' }}>{todayCash}</div>
            <div className="sl">💵 Готівка</div>
          </div>
          <div className="sc">
            <div className="sv" style={{ color: 'var(--acc)' }}>{todayCard}</div>
            <div className="sl">💳 Картка</div>
          </div>
          <div className="sc">
            <div className="sv">{todayCash + todayCard}</div>
            <div className="sl">💰 Разом сьогодні</div>
          </div>
        </div>
      )}

      {/* Debts summary */}
      {isAdmin && debtCount > 0 && (
        <div className="card">
          <div className="ct">Борги</div>
          <div className="irow"><span className="ikey">Всього боржників</span><span className="ival" style={{ color: 'var(--red)' }}>{debtCount}</span></div>
          <div className="irow"><span className="ikey">Загальна сума</span><span className="ival" style={{ color: 'var(--ylw)' }}>{totalDebt} грн</span></div>
        </div>
      )}

      {/* Alerts — видимі всім ролям, з порожнім станом "Все добре" */}
      {alerts.length === 0 ? (
        <div className="card"><div className="empty">✅ Все добре! Немає важливих сповіщень.</div></div>
      ) : (
        <div className="card">
          <div className="ct">Потребує уваги ({alerts.length})</div>
          {alerts.map(a => (
            <div key={a.id} className="alert-item" onClick={() => onNavigate('member', a.id)}>
              <div className="ai-dot" style={{ background: a.dot }} />
              <div className="ai-info">
                <div className="ai-name">{a.name}</div>
                <div className="ai-sub">{a.sub}</div>
              </div>
              <span className={`ai-tag ${a.tag}`}>{a.tagTxt}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}