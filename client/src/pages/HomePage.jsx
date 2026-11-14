import React from 'react'
import { CountUp } from '../components/UI'
import { TODAY, abonStatus, fmtDate, getActiveAbon, visitedTodayAny, getMemberDebt, daysDiff } from '../utils'

function daysDiffSafe(a, b) {
  if (!a || !b) return 0
  return daysDiff(a, b)
}

export default function HomePage({ members, abons, payments, role, uname, onNavigate, onAddMember, onRemind }) {
  const isAdmin = role === 'owner' || role === 'admin'

  // Stats
  const active   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'active' }).length
  const frozen   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'frozen' }).length
  const ending   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && ['ending','expired'].includes(abonStatus(a)) }).length
  const attendable = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && ['active','ending'].includes(abonStatus(a)) }).length
  const checked  = members.filter(m => visitedTodayAny(m.id, abons)).length
  const ringShare = attendable > 0 ? Math.min(1, checked / attendable) : 0
  const todayAll = payments.filter(p => p.date === TODAY)
  function hallSum(method) {
    return todayAll.reduce((s, p) => {
      if (p.kind === 'session' || p.kind === 'trainer_abon') {
        const m = p.kind === 'session' ? p.hallMethod : p.method
        if (m == null) return s
        const matches = method === 'cash' ? m !== 'card' : m === 'card'
        if (!matches) return s
        const amt = p.kind === 'session' ? (p.hallEarning || 0) : (p.amount || 0)
        return s + amt
      }
      // абонементи (kind === 'abon') та інше — повна сума за методом
      if (!p.method) return s
      const matches = method === 'cash' ? p.method !== 'card' : p.method === 'card'
      if (!matches) return s
      return s + (p.amount || 0)
    }, 0)
  }
  const todayCash = hallSum('cash')
  const todayCard = hallSum('card')

  // Alerts: expired/ending/frozen — як в оригіналі, з пріоритетом і видимі всім ролям
  const alerts = []
  members.forEach(m => {
    const a = getActiveAbon(m.id, abons)
    if (!a) return
    const st = abonStatus(a)
    if (st === 'frozen') {
      const d = daysDiffSafe(a.freezeStart, TODAY)
      alerts.push({ p: 2, id: m.id, phone: m.phone, name: m.name, tag: 'tag-ice', tagTxt: '❄️ Заморожено', sub: `Заморожено ${d} дн. тому`, dot: 'var(--ice)' })
    } else if (st === 'expired') {
      alerts.push({ p: 0, id: m.id, phone: m.phone, name: m.name, tag: 'tag-red', tagTxt: 'Закінчився', sub: a.type === 'month' ? 'Закінчився ' + fmtDate(a.endDate) : 'Разовий використано', dot: 'var(--red)' })
    } else if (st === 'ending') {
      const d = daysDiffSafe(TODAY, a.endDate)
      alerts.push({ p: 1, id: m.id, phone: m.phone, name: m.name, tag: 'tag-ylw', tagTxt: '⚠️ ' + (d === 0 ? 'Сьогодні' : d + ' дн.'), sub: 'Закінчується ' + fmtDate(a.endDate), dot: 'var(--ylw)' })
    }
  })
  alerts.sort((a, b) => a.p - b.p)

  // Debts summary (абон. + ручні рахуються лише через manualDebts на сторінці Фінанси,
  // тут показуємо тільки борги по абонементах для швидкого огляду)
  const debtCount = members.filter(m => getMemberDebt(m.id, abons, payments) > 0).length
  const totalDebt = members.reduce((s, m) => s + getMemberDebt(m.id, abons, payments), 0)

  return (
    <div className="pg">

      {/* Швидкі дії */}
      <div className="quick">
        <button onClick={() => onNavigate('checkin')}><span className="qi" style={{ color: 'var(--grn)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>Відмітити</button>
        {isAdmin
          ? <button onClick={onAddMember}><span className="qi" style={{ color: 'var(--acc)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg></span>Клієнт</button>
          : <button onClick={() => onNavigate('trainers')}><span className="qi" style={{ color: 'var(--acc)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>Клієнти</button>}
        <button onClick={() => onNavigate('sessions')}><span className="qi" style={{ color: 'var(--ylw)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg></span>Заняття</button>
      </div>

      {/* Hero: скільки клієнтів сьогодні відмічено */}
      <div className="hero">
        <div className="hero-ring">
          <svg viewBox="0 0 112 112" width="104" height="104" aria-hidden="true">
            <circle className="ring-bg" cx="56" cy="56" r="50" fill="none" strokeWidth="9" />
            <circle className="ring-fg" cx="56" cy="56" r="50" fill="none" strokeWidth="9" strokeLinecap="round" style={{ '--off': 314 * (1 - ringShare) }} />
          </svg>
          <div className="hero-n"><b><CountUp value={checked} /></b><span>з {attendable}</span></div>
        </div>
        <div className="hero-t">
          <div className="hero-live"><i />Сьогодні в залі</div>
          <div className="hero-p">{attendable > 0 ? `${Math.round(ringShare * 100)}% клієнтів з діючим абонементом уже відмічено` : 'Ще немає клієнтів з діючим абонементом'}</div>
          <div className="hero-d">{new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      {isAdmin && (
        <div className="card cash3">
          <div><div className="k"><i style={{ background: 'var(--grn)' }} />Готівка</div><div className="v"><CountUp value={todayCash} spaced /></div></div>
          <div><div className="k"><i style={{ background: 'var(--acc)' }} />Картка</div><div className="v"><CountUp value={todayCard} spaced /></div></div>
          <div><div className="k">Разом сьогодні</div><div className="v" style={{ color: 'var(--acc)' }}><CountUp value={todayCash + todayCard} spaced /> <span style={{ fontSize: 11, fontWeight: 500 }}>грн</span></div></div>
        </div>
      )}

      {/* Stats */}
      <div className="stats2">
        <div className={`sc ${isAdmin ? 'clickable' : ''}`} onClick={isAdmin ? () => onNavigate('members', 'active') : undefined}>
          <div className="sv"><CountUp value={active} /></div>
          <div className="sl">Активних абон.</div>
        </div>
        <div className="sc clickable" onClick={() => onNavigate('checkin')}>
          <div className="sv" style={{ color: 'var(--grn)' }}><CountUp value={checked} /></div>
          <div className="sl">Відмічено сьогодні</div>
        </div>
        {isAdmin && <>
          <div className="sc clickable" onClick={() => onNavigate('members', 'ending')}>
            <div className="sv" style={{ color: 'var(--ylw)' }}><CountUp value={ending} /></div>
            <div className="sl">Закінчується скоро</div>
          </div>
          <div className="sc clickable" onClick={() => onNavigate('members', 'frozen')}>
            <div className="sv" style={{ color: 'var(--ice)' }}><CountUp value={frozen} /></div>
            <div className="sl">Заморожених</div>
          </div>
        </>}
      </div>

      <div className="dgrid2">
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
                {isAdmin && onRemind && a.phone && (
                  <button title="Нагадати клієнту" aria-label="Нагадати клієнту"
                    onClick={e => { e.stopPropagation(); onRemind(a.id) }}
                    style={{ marginLeft: 6, background: 'var(--s2)', border: '1px solid var(--brd)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14 }}>💬</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}