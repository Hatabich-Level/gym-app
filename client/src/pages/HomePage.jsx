import React from 'react'
import { TODAY, abonStatus, fmtDate, getActiveAbon, visitedTodayAny } from '../utils'

export default function HomePage({ members, abons, payments, role, uname, onNavigate }) {

  // Stats
  const active   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'active' }).length
  const ending   = members.filter(m => { const a = getActiveAbon(m.id, abons); return a && ['ending','expired'].includes(abonStatus(a)) }).length
  const checked  = members.filter(m => visitedTodayAny(m.id, abons)).length
  const todayAll = payments.filter(p => p.date === TODAY)
  const todayCash = todayAll.filter(p => p.method !== 'card').reduce((s,p) => s + (p.amount||0), 0)
  const todayCard = todayAll.filter(p => p.method === 'card').reduce((s,p) => s + (p.amount||0), 0)

  // Today sessions
  const todaySessions = payments
    .filter(p => p.kind === 'session' && p.date === TODAY)
    .sort((a,b) => (b.time||'').localeCompare(a.time||''))

  // Ending abons alert
  const endingList = members.filter(m => {
    const a = getActiveAbon(m.id, abons)
    return a && ['ending','expired'].includes(abonStatus(a))
  })

  return (
    <div className="pg">

      {/* Stats */}
      <div className="stats2">
        <div className="sc clickable" onClick={() => onNavigate('members', 'active')}>
          <div className="sv">{active}</div>
          <div className="sl">✅ Активних</div>
        </div>
        <div className="sc clickable" onClick={() => onNavigate('checkin')}>
          <div className="sv" style={{ color: 'var(--grn)' }}>{checked}</div>
          <div className="sl">📍 Сьогодні</div>
        </div>
        {role === 'admin' && <>
          <div className="sc clickable" onClick={() => onNavigate('members', 'ending')}>
            <div className="sv" style={{ color: ending > 0 ? 'var(--ylw)' : 'var(--txt2)' }}>{ending}</div>
            <div className="sl">⚠️ Закінчуються</div>
          </div>
        </>}
      </div>

      {role === 'admin' && (
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

      {/* Ending alert */}
      {role === 'admin' && endingList.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(245,166,35,.3)', background: 'rgba(245,166,35,.05)' }}>
          <div className="ct" style={{ color: 'var(--ylw)' }}>⚠️ Увага — абонементи</div>
          {endingList.slice(0, 5).map(m => {
            const a = getActiveAbon(m.id, abons)
            const st = abonStatus(a)
            return (
              <div key={m.id} className="alert-item" onClick={() => onNavigate('member', m.id)}>
                <div className={`ai-dot ${st === 'expired' ? 'tag-red' : 'tag-ylw'}`} style={{ background: st === 'expired' ? 'var(--red)' : 'var(--ylw)' }} />
                <div className="ai-info">
                  <div className="ai-name">{m.name}</div>
                  <div className="ai-sub">{st === 'expired' ? 'Закінчився' : 'до ' + fmtDate(a?.endDate)}</div>
                </div>
                <span className={`ai-tag ${st === 'expired' ? 'tag-red' : 'tag-ylw'}`}>
                  {st === 'expired' ? 'Прострочено' : 'Скоро'}
                </span>
              </div>
            )
          })}
          {endingList.length > 5 && (
            <div style={{ fontSize: 12, color: 'var(--txt2)', padding: '6px 0' }}>
              + ще {endingList.length - 5} клієнт(ів)
            </div>
          )}
        </div>
      )}

      {/* Today sessions */}
      {todaySessions.length > 0 && (
        <div className="card">
          <div className="ct">📋 Заняття сьогодні</div>
          {todaySessions.map(p => {
            const isSplit = p.sessionType === 'split'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--brd)' }}>
                <span>{isSplit ? '👥' : '👤'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.memberName || '?'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                    {p.time} · {p.trainer}
                    {isSplit ? ` · спліт ${p.splitCount} ос.` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--grn)', fontWeight: 600 }}>
                  {p.amount} грн
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}