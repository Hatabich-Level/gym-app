import React, { useState, useMemo } from 'react'
import { TODAY, fmtDate, nowTime, abonStatus, getActiveAbon, getActiveTrainerAbon, visitedTodayAny, STATUS_LABEL, STATUS_TAG } from '../utils'
import { Ava, StatusTag } from '../components/UI'

export default function CheckinPage({ members, abons, payments, role, uname, pushAbons, pushPayment }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const checkedToday = useMemo(() =>
    members.filter(m => visitedTodayAny(m.id, abons))
      .sort((a,b) => {
        const lastVisit = (mb) => {
          const visits = abons.filter(a => a.memberId === mb.id && !a.deleted).flatMap(a => a.visits||[]).filter(v => v.date === TODAY)
          return visits.length ? visits[visits.length-1].time : ''
        }
        return lastVisit(b).localeCompare(lastVisit(a))
      }), [members, abons])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 10)
  }, [members, query])

  const selectedMember = members.find(m => m.id === selectedId)
  const selectedAbon = selectedId ? getActiveAbon(selectedId, abons) : null
  const selectedTrainerAb = selectedId && !selectedAbon ? getActiveTrainerAbon(selectedId, abons) : null
  const selectedSt = selectedAbon ? abonStatus(selectedAbon) : null

  function canCheckin() {
    if (!selectedAbon) return false
    if (selectedAbon.frozen) return false
    if (selectedSt === 'expired') return false
    const todayVisit = (selectedAbon.visits||[]).find(v => v.date === TODAY)
    return !todayVisit
  }

  async function doCheckin() {
    if (!selectedAbon || !canCheckin()) return
    const by = role + (uname ? ':' + uname : '')
    const updated = {
      ...selectedAbon,
      visits: [...(selectedAbon.visits||[]), { date: TODAY, time: nowTime(), by }]
    }
    // Разовий абонемент закривається одразу після одного відвідування —
    // саме так в оригіналі: жодного платежу тут не створюється, бо оплата
    // вже відбулась при продажу абонементу.
    if (updated.type === 'visit') updated.active = false

    // Заодно прибираємо застарілі дублікати "активних" абонементів цього ж
    // клієнта (якщо лишились з минулого) — щоб клієнт не показувався
    // "Активним" через старий забутий запис.
    const staleDup = abons.filter(a =>
      a.memberId === selectedId && a.id !== selectedAbon.id && a.active && !a.deleted && a.type !== 'trainer'
    )
    const toSave = staleDup.length
      ? [updated, ...staleDup.map(a => ({ ...a, active: false }))]
      : [updated]

    await pushAbons(toSave)

    alert(`✅ ${selectedMember?.name} відмічено!`)
    setSelectedId(null)
    setQuery('')
  }

  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>📍 Відмітити</div>

      {/* Search */}
      <div className="sr">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="search" placeholder="Пошук клієнта..."
          value={query} onChange={e => { setQuery(e.target.value); setSelectedId(null) }}
        />
      </div>

      {/* Search results */}
      {filtered.length > 0 && !selectedId && (
        <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 12 }}>
          {filtered.map(m => {
            const ab = getActiveAbon(m.id, abons)
            const st = ab ? abonStatus(ab) : null
            return (
              <div key={m.id} className="mi" onClick={() => { setSelectedId(m.id); setQuery(m.name) }}>
                <Ava name={m.name} size={32} />
                <div className="mi-info">
                  <div className="mi-name">{m.name}</div>
                </div>
                <StatusTag status={st} />
              </div>
            )
          })}
        </div>
      )}

      <div className="dgrid2">
        {/* Selected client */}
        {selectedMember && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ava name={selectedMember.name} />
                <div>
                  <div style={{ fontWeight: 600 }}>{selectedMember.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                    {selectedAbon ? (selectedAbon.type === 'month' ? 'до ' + fmtDate(selectedAbon.endDate) : 'Разовий') : selectedTrainerAb ? 'Абонемент тренера (заняття — на сторінці "Заняття")' : 'Без абонементу'}
                  </div>
                </div>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 16 }}
                onClick={() => { setSelectedId(null); setQuery('') }}
              >✕</button>
            </div>

            <button
              className={`checkin-btn ${!canCheckin() ? 'disabled' : ''}`}
              onClick={canCheckin() ? doCheckin : undefined}
            >
              {!selectedAbon ? (selectedTrainerAb ? 'ℹ️ Лише абон. тренера — відмітка на сторінці "Заняття"' : '❌ Немає абонементу') :
               selectedAbon.frozen ? '❄️ Абонемент заморожено' :
               selectedSt === 'expired' ? '❌ Абонемент прострочено' :
               (selectedAbon.visits||[]).find(v => v.date === TODAY) ? '✅ Вже відмічено сьогодні' :
               '✅ Відмітити відвідування'}
            </button>
          </div>
        )}

        {/* Checked today */}
        {checkedToday.length > 0 && (
          <div className="card">
            <div className="ct">✅ Відмічені сьогодні — {checkedToday.length}</div>
            {checkedToday.map(m => {
              const ab = getActiveAbon(m.id, abons)
              const trainerAb = !ab ? getActiveTrainerAbon(m.id, abons) : null
              const lastVisit = abons.filter(a => a.memberId === m.id && !a.deleted).flatMap(a => a.visits||[]).filter(v => v.date === TODAY).pop()
              const sub = ab ? (ab.type === 'month' ? 'до ' + fmtDate(ab.endDate) : 'Разовий') : trainerAb ? 'Абонемент тренера' : 'Без абонементу'
              return (
                <div key={m.id} className="mi" style={{ cursor: 'default' }}>
                  <Ava name={m.name} />
                  <div className="mi-info">
                    <div className="mi-name">{m.name}</div>
                    <div className="mi-sub">{sub}{lastVisit ? ' · ' + lastVisit.time : ''}</div>
                  </div>
                  <span className="ai-tag tag-grn">✓</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}