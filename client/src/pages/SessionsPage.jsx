import React, { useState, useMemo } from 'react'
import {
  TODAY, fmtDate, uid, nowTime, getActiveTrainerAbon, getActiveAbon,
  HALL_FEE, SPLIT_HALL_FEE, calcTrainerEarning, calcHallEarning
} from '../utils'
import { FRow, Ava, MethodPill } from '../components/UI'

function MethodToggle({ value, onChange }) {
  return (
    <div className="method-toggle" style={{ marginBottom: 14 }}>
      <button className={`method-btn ${value === 'cash' ? 'on-cash' : ''}`} onClick={() => onChange('cash')}>💵 Готівка</button>
      <button className={`method-btn ${value === 'card' ? 'on-card' : ''}`} onClick={() => onChange('card')}>💳 Картка</button>
    </div>
  )
}

export default function SessionsPage({ members, abons, payments, role, uname, pushAbons, pushPayment }) {
  const [sType, setSType] = useState('solo')

  // Solo state
  const [clientId, setClientId] = useState(null)
  const [clientName, setClientName] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [amount, setAmount] = useState('')
  const [useAbon, setUseAbon] = useState(false)
  const [method, setMethod] = useState('cash')
  const [hallMethod, setHallMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [dateMode, setDateMode] = useState('today')
  const [customDate, setCustomDate] = useState('')

  // Split state
  const [splitClients, setSplitClients] = useState([])
  const [splitSearch, setSplitSearch] = useState('')
  const [splitAmount, setSplitAmount] = useState('')
  const [splitMethod, setSplitMethod] = useState('cash')
  const [splitHallMethod, setSplitHallMethod] = useState('cash')

  // Trainer abon modal
  const [showAbonModal, setShowAbonModal] = useState(false)

  const sessionDate = dateMode === 'today' ? TODAY : (customDate || TODAY)
  const trainerAbon = clientId ? getActiveTrainerAbon(clientId, abons) : null

  // ── Solo search ───────────────────────────────────────────────────────────────
  const soloResults = useMemo(() => {
    const q = searchQ.toLowerCase().trim()
    if (!q || clientId) return []
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [members, searchQ, clientId])

  function selectClient(m) {
    setClientId(m.id); setClientName(m.name); setSearchQ(m.name)
    const ta = getActiveTrainerAbon(m.id, abons)
    setUseAbon(!!ta)
    if (ta) setAmount('')
  }

  function clearClient() {
    setClientId(null); setClientName(''); setSearchQ(''); setUseAbon(false)
  }

  // ── Split search ──────────────────────────────────────────────────────────────
  const splitResults = useMemo(() => {
    const q = splitSearch.toLowerCase().trim()
    if (!q) return []
    const ids = splitClients.map(c => c.id)
    return members.filter(m => m.name.toLowerCase().includes(q) && !ids.includes(m.id)).slice(0, 6)
  }, [members, splitSearch, splitClients])

  function addSplitClient(m) {
    if (m.isTrainer) {
      setSplitClients(prev => [...prev, { id: m.id, name: m.name, isTrainer: true, useAbon: false }])
      setSplitSearch('')
      return
    }
    const ta = getActiveTrainerAbon(m.id, abons)
    setSplitClients(prev => [...prev, { id: m.id, name: m.name, useAbon: !!ta }])
    setSplitSearch('')
  }

  function removeSplitClient(i) {
    setSplitClients(prev => prev.filter((_, idx) => idx !== i))
  }

  function toggleSplitAbon(i, val) {
    setSplitClients(prev => prev.map((c, idx) => idx === i ? { ...c, useAbon: val } : c))
  }

  // ── Split preview ─────────────────────────────────────────────────────────────
  const splitPreview = useMemo(() => {
    const per = parseFloat(splitAmount) || 0
    const count = splitClients.length
    const payingCount = splitClients.filter(c => !c.useAbon && !c.isTrainer).length
    const hallPayingCount = splitClients.filter(c => !c.isTrainer).length
    const trainerTotal = payingCount * per
    const hallTotal = hallPayingCount * SPLIT_HALL_FEE
    return { per, count, payingCount, hallPayingCount, trainerTotal, hallTotal }
  }, [splitClients, splitAmount])

  // ── Save solo ─────────────────────────────────────────────────────────────────
  async function saveSolo() {
    const name = clientName || searchQ.trim()
    if (!name) { alert('Виберіть клієнта або введіть ім\'я'); return }
    const trainerPrice = parseFloat(amount) || 0
    if (!trainerPrice && !useAbon) { alert('Вкажіть ціну разового'); return }

    const abonsChanged = []
    let trainerAbonId = null

    if (useAbon && trainerAbon) {
      const updated = {
        ...trainerAbon,
        sessionsLeft: trainerAbon.sessionsLeft - 1,
        visits: [...(trainerAbon.visits || []), { date: sessionDate, time: nowTime() }]
      }
      abonsChanged.push(updated)
      trainerAbonId = trainerAbon.id
    }

    const totalAmount = useAbon ? 0 : trainerPrice + HALL_FEE
    const trainerEarning = useAbon ? 0 : calcTrainerEarning(trainerPrice)
    const hallEarning = useAbon ? 0 : calcHallEarning(trainerPrice)

    const p = {
      id: uid(), kind: 'session', sessionType: 'solo',
      memberId: clientId || null, memberName: name,
      trainer: uname || (role === 'trainer' ? 'Тренер' : 'Адмін'),
      date: sessionDate, time: nowTime(),
      amount: totalAmount, trainerPrice, trainerEarning, hallEarning,
      method, hallMethod: role === 'trainer' ? null : hallMethod, note, trainerAbonId
    }

    if (abonsChanged.length) await pushAbons(abonsChanged)
    await pushPayment(p)

    alert(`✅ Записано! ${useAbon ? 'Списано з абонементу' : `Клієнт: ${totalAmount} грн · Каса тренера: ${trainerEarning} грн`}`)
    clearClient(); setAmount(''); setNote('')
    setMethod('cash'); setHallMethod('cash')
    setDateMode('today'); setCustomDate('')
  }

  // ── Save split ────────────────────────────────────────────────────────────────
  async function saveSplit() {
    if (splitClients.length < 2) { alert('Додайте мінімум 2 клієнти для спліту'); return }
    const perPerson = parseFloat(splitAmount) || 0
    if (!perPerson) { alert('Вкажіть твою суму з кожного'); return }

    const abonsChanged = []
    const clientDetails = splitClients.map(c => {
      if (c.isTrainer) {
        return { name: c.name, paid: false, isTrainer: true, trainerAbonId: null }
      }
      if (c.useAbon && c.id) {
        const ta = getActiveTrainerAbon(c.id, abons)
        if (ta) {
          const updated = {
            ...ta,
            sessionsLeft: ta.sessionsLeft - 1,
            visits: [...(ta.visits || []), { date: sessionDate, time: nowTime() }]
          }
          abonsChanged.push(updated)
          return { name: c.name, paid: false, trainerAbonId: ta.id }
        }
      }
      return { name: c.name, paid: true, trainerAbonId: null }
    })

    const payingCount = clientDetails.filter(c => c.paid).length
    const hallPayingCount = splitClients.filter(c => !c.isTrainer).length
    const count = splitClients.length
    const trainerTotal = payingCount * perPerson
    const hallTotal = hallPayingCount * SPLIT_HALL_FEE

    const p = {
      id: uid(), kind: 'session', sessionType: 'split',
      splitClients: splitClients.map(c => c.name),
      splitDetails: clientDetails,
      memberName: splitClients.map(c => c.name).join(', '),
      trainer: uname || (role === 'trainer' ? 'Тренер' : 'Адмін'),
      date: sessionDate, time: nowTime(),
      amount: hallTotal, trainerEarning: trainerTotal,
      splitCount: count, payingCount, perPerson,
      hallPerPerson: SPLIT_HALL_FEE,
      note, method: splitMethod, hallMethod: role === 'trainer' ? null : splitHallMethod
    }

    if (abonsChanged.length) await pushAbons(abonsChanged)
    await pushPayment(p)

    const abonNote = (count - payingCount) > 0 ? ` (${count - payingCount} з абонементу)` : ''
    alert(`✅ Записано! Спліт ${count} ос. · Твоя каса: ${trainerTotal} грн · Залу: ${hallTotal} грн${abonNote}`)

    setSplitClients([]); setSplitSearch(''); setSplitAmount('')
    setSplitMethod('cash'); setSplitHallMethod('cash')
    setNote(''); setDateMode('today'); setCustomDate('')
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>📋 Заняття</div>

      <div className="card">
        <div className="ct">Нове заняття</div>

        {/* Тип */}
        <FRow label="Тип заняття">
          <div className="method-toggle">
            <button className={`method-btn ${sType === 'solo' ? 'on-cash' : ''}`} onClick={() => setSType('solo')}>👤 Один</button>
            <button className={`method-btn ${sType === 'split' ? 'on-card' : ''}`} onClick={() => setSType('split')}>👥 Спліт</button>
          </div>
        </FRow>

        {/* SOLO */}
        {sType === 'solo' && (
          <>
            <FRow label="Клієнт">
              <input type="search" placeholder="Пошук або ім'я..."
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); if (clientId) clearClient() }}
              />
            </FRow>
            {soloResults.length > 0 && (
              <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 12 }}>
                {soloResults.map(m => {
                  const ta = getActiveTrainerAbon(m.id, abons)
                  return (
                    <div key={m.id} className="mi" onClick={() => selectClient(m)}>
                      <Ava name={m.name} size={30} />
                      <div className="mi-info"><div className="mi-name" style={{ fontSize: 14 }}>{m.name}</div></div>
                      {ta && <span className="ai-tag tag-blue">🎫 {ta.sessionsLeft} зан.</span>}
                    </div>
                  )
                })}
              </div>
            )}
            {clientId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 12px', background: 'var(--s2)', borderRadius: 'var(--r2)', border: '1px solid var(--brd)' }}>
                <Ava name={clientName} size={28} />
                <span style={{ flex: 1 }}>{clientName}</span>
                {trainerAbon && <span className="ai-tag tag-blue">🎫 {trainerAbon.sessionsLeft} занять</span>}
                <button style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 16 }} onClick={clearClient}>✕</button>
              </div>
            )}

            {/* Trainer abon info */}
            {trainerAbon && (
              <div style={{ background: 'rgba(39,201,122,.08)', border: '1px solid rgba(39,201,122,.25)', borderRadius: 'var(--r2)', padding: '10px 12px', marginBottom: 14, fontSize: 13, color: 'var(--grn)' }}>
                🎫 Є абонемент: залишилось {trainerAbon.sessionsLeft} з {trainerAbon.totalSessions} занять — сума не потрібна
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--txt2)', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={useAbon && !!trainerAbon} onChange={e => trainerAbon && setUseAbon(e.target.checked)} style={{ width: 17, height: 17 }} />
              🎫 Списати заняття з абонементу тренера
            </label>

            {!useAbon && (
              <FRow label="Ціна разового (грн)">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="350" min={0} />
              </FRow>
            )}
            {amount && !useAbon && (() => {
              const tp = parseFloat(amount) || 0
              return (
                <div style={{ background: 'rgba(39,201,122,.08)', border: '1px solid rgba(39,201,122,.25)', borderRadius: 'var(--r2)', padding: '10px 12px', marginBottom: 14, fontSize: 13, lineHeight: 1.8 }}>
                  💰 Клієнт платить: <b>{tp + HALL_FEE} грн</b> (тренер {tp} + зал {HALL_FEE})<br />
                  🏦 Каса залу: <b>{calcHallEarning(tp)} грн</b><br />
                  💵 <span style={{ color: 'var(--grn)' }}>Каса тренера: <b>{calcTrainerEarning(tp)} грн</b></span>
                </div>
              )
            })()}
          </>
        )}

        {/* SPLIT */}
        {sType === 'split' && (
          <>
            <FRow label="Клієнти спліту">
              <input type="search" placeholder="Додати клієнта..."
                value={splitSearch} onChange={e => setSplitSearch(e.target.value)}
              />
            </FRow>
            {splitResults.length > 0 && (
              <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 12 }}>
                {splitResults.map(m => (
                  <div key={m.id} className="mi" onClick={() => addSplitClient(m)}>
                    <Ava name={m.name} size={30} />
                    <div className="mi-info">
                      <div className="mi-name" style={{ fontSize: 14 }}>
                        {m.name}
                        {m.isTrainer && <span className="ai-tag tag-blue" style={{ marginLeft: 6, fontSize: 11 }}>👔</span>}
                      </div>
                    </div>
                    <span style={{ color: 'var(--acc)', fontSize: 12 }}>+ Додати</span>
                  </div>
                ))}
              </div>
            )}
            {splitClients.length > 0 && (
              <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 12 }}>
                {splitClients.map((c, i) => {
                  const ta = (c.id && !c.isTrainer) ? getActiveTrainerAbon(c.id, abons) : null
                  return (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--brd)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Ava name={c.name} size={28} />
                        <span style={{ flex: 1, fontSize: 14 }}>{c.name}</span>
                        {c.isTrainer && <span className="ai-tag tag-blue" style={{ fontSize: 11 }}>👔 Тренер — безкоштовно</span>}
                        <button className="alert-dismiss" onClick={() => removeSplitClient(i)}>✕</button>
                      </div>
                      {ta && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--grn)', marginTop: 6, marginLeft: 36, cursor: 'pointer' }}>
                          <input type="checkbox" checked={c.useAbon} onChange={e => toggleSplitAbon(i, e.target.checked)} style={{ width: 15, height: 15 }} />
                          🎫 Списати заняття (залишилось {ta.sessionsLeft} з {ta.totalSessions})
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <FRow label="Твоя сума з кожного (грн)">
              <input type="number" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} placeholder="напр: 150" min={0} />
            </FRow>
            {splitPreview.per > 0 && splitClients.length > 0 && (
              <div style={{ fontSize: 14, color: 'var(--grn)', fontWeight: 600, marginBottom: 14 }}>
                💵 Твоя каса: <b>{splitPreview.trainerTotal} грн</b> ({splitPreview.payingCount} × {splitPreview.per} грн)<br />
                🏦 Залу: <b>{splitPreview.hallTotal} грн</b> ({splitPreview.hallPayingCount} × {SPLIT_HALL_FEE} грн)
              </div>
            )}
          </>
        )}

        {/* Оплата — solo */}
        {sType === 'solo' && (
          <div className="frow">
            <div className="flabel">Оплата</div>
            <div className="chip-row">
              <div className="chip-group">
                <span className="chip-label">Клієнт→тренер</span>
                <button className={`chip ${method === 'cash' ? 'on-cash' : ''}`} onClick={() => setMethod('cash')}>💵</button>
                <button className={`chip ${method === 'card' ? 'on-card' : ''}`} onClick={() => setMethod('card')}>💳</button>
              </div>
              {role !== 'trainer' ? (
                <div className="chip-group">
                  <span className="chip-label">Тренер→зал</span>
                  <button className={`chip ${hallMethod === 'cash' ? 'on-cash' : ''}`} onClick={() => setHallMethod('cash')}>💵</button>
                  <button className={`chip ${hallMethod === 'card' ? 'on-card' : ''}`} onClick={() => setHallMethod('card')}>💳</button>
                </div>
              ) : (
                <div className="chip-group">
                  <span className="chip-label">Тренер→зал</span>
                  <span style={{ fontSize: 12, color: 'var(--txt2)' }}>🕓 підтвердить адмін</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Оплата — split */}
        {sType === 'split' && (
          <div className="frow">
            <div className="flabel">Оплата</div>
            <div className="chip-row">
              <div className="chip-group">
                <span className="chip-label">Клієнт→тренер</span>
                <button className={`chip ${splitMethod === 'cash' ? 'on-cash' : ''}`} onClick={() => setSplitMethod('cash')}>💵</button>
                <button className={`chip ${splitMethod === 'card' ? 'on-card' : ''}`} onClick={() => setSplitMethod('card')}>💳</button>
              </div>
              {role !== 'trainer' ? (
                <div className="chip-group">
                  <span className="chip-label">Тренер→зал</span>
                  <button className={`chip ${splitHallMethod === 'cash' ? 'on-cash' : ''}`} onClick={() => setSplitHallMethod('cash')}>💵</button>
                  <button className={`chip ${splitHallMethod === 'card' ? 'on-card' : ''}`} onClick={() => setSplitHallMethod('card')}>💳</button>
                </div>
              ) : (
                <div className="chip-group">
                  <span className="chip-label">Тренер→зал</span>
                  <span style={{ fontSize: 12, color: 'var(--txt2)' }}>🕓 підтвердить адмін</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="frow-pair">
          {/* Дата */}
          <div className="frow">
            <div className="flabel">Дата заняття</div>
            <div className="method-toggle">
              <button className={`method-btn ${dateMode === 'today' ? 'on-cash' : ''}`} onClick={() => setDateMode('today')}>📅 Сьогодні</button>
              <button className={`method-btn ${dateMode === 'past' ? 'on-cash' : ''}`} onClick={() => setDateMode('past')}>🕓 Задня дата</button>
            </div>
            {dateMode === 'past' && (
              <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} max={TODAY} style={{ marginTop: 8 }} />
            )}
          </div>

          <FRow label="Примітка (необов'язково)">
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="напр: персональне тренування" />
          </FRow>
        </div>

        <button className="btn btn-grn" onClick={sType === 'solo' ? saveSolo : saveSplit}>
          💾 Записати заняття
        </button>
      </div>

      {/* Trainer abon sale card */}
      <div className="card">
        <div className="ct">🎫 Абонемент від тренера</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
          Продаж пакету занять клієнту. Заняття списуються автоматично при відмітці "Один" з включеним списанням.
        </div>
        <button className="btn btn-acc btn-sm" onClick={() => setShowAbonModal(true)}>+ Продати абонемент на заняття</button>
      </div>

      {/* Today sessions (stats + list) */}
      <TodaySessionsBlock payments={payments} uname={uname} role={role} />

      {/* Trainer abon modal */}
      {showAbonModal && (
        <TrainerAbonModal
          members={members}
          abons={abons}
          uname={uname}
          role={role}
          pushAbons={pushAbons}
          pushPayment={pushPayment}
          onClose={() => setShowAbonModal(false)}
        />
      )}
    </div>
  )
}

// ── Today sessions (statistics + list), matches original renderSessionsToday ──
function TodaySessionsBlock({ payments, uname, role }) {
  const myName = uname || (role === 'trainer' ? 'Тренер' : '')
  const today = useMemo(() =>
    payments.filter(p => (p.kind === 'session' || p.kind === 'trainer_abon') && p.date === TODAY)
      .sort((a, b) => (b.time || '').localeCompare(a.time || '')),
    [payments])
  // Адмін бачить ВСІ заняття, тренер — тільки свої
  const mine = (role === 'trainer' && myName) ? today.filter(p => p.trainer === myName) : today

  const isTrainerView = role === 'trainer'

  // Тренер бачить скільки отримав від клієнтів (готівкою/карткою) і свою чисту касу
  const cash = mine.filter(p => p.kind === 'session' && p.method !== 'card').reduce((s, p) => s + (p.amount || 0), 0)
  const card = mine.filter(p => p.kind === 'session' && p.method === 'card').reduce((s, p) => s + (p.amount || 0), 0)
  const trainerCash = mine.reduce((s, p) => s + (p.trainerEarning || 0), 0)

  // Адмін бачить скільки має прийти в касу залу (за hallMethod для занять і method для абонементів тренера)
  const hallMethodOf = p => p.kind === 'session' ? p.hallMethod : p.method
  const hallCash = today.filter(p => hallMethodOf(p) === 'cash').reduce((s, p) => s + (p.hallEarning || 0), 0)
  const hallCard = today.filter(p => hallMethodOf(p) === 'card').reduce((s, p) => s + (p.hallEarning || 0), 0)
  const hallPending = today.filter(p => hallMethodOf(p) == null).reduce((s, p) => s + (p.hallEarning || 0), 0)

  return (
    <>
      {isTrainerView ? (
        <div className="stats3">
          <div className="sc"><div className="sv" style={{ color: 'var(--grn)' }}>{cash}</div><div className="sl">💵 Готівка</div></div>
          <div className="sc"><div className="sv" style={{ color: 'var(--acc)' }}>{card}</div><div className="sl">💳 Картка</div></div>
          <div className="sc"><div className="sv" style={{ color: 'var(--grn)', fontWeight: 700 }}>{trainerCash}</div><div className="sl">💵 Каса тренера</div></div>
        </div>
      ) : (
        <div className="stats3">
          <div className="sc"><div className="sv" style={{ color: 'var(--grn)' }}>{hallCash}</div><div className="sl">💵 Готівка (зал)</div></div>
          <div className="sc"><div className="sv" style={{ color: 'var(--acc)' }}>{hallCard}</div><div className="sl">💳 Картка (зал)</div></div>
          {hallPending > 0 ? (
            <div className="sc"><div className="sv" style={{ color: 'var(--ylw)', fontWeight: 700 }}>{hallPending}</div><div className="sl">⚠️ Непідтверджено</div></div>
          ) : (
            <div className="sc"><div className="sv">{hallCash + hallCard}</div><div className="sl">Всього зала сьогодні</div></div>
          )}
        </div>
      )}

      {today.length === 0 ? (
        <div className="card"><div className="empty">Сьогодні занять ще не було</div></div>
      ) : (
        <div className="card">
          <div className="ct">Заняття сьогодні ({today.length})</div>
          {today.map(p => {
            const isAbonSale = p.kind === 'trainer_abon'
            const isSplit = p.sessionType === 'split'
            const isDeducted = p.sessionType === 'solo' && p.trainerAbonId
            const icon = isAbonSale ? '🎫' : isSplit ? '👥' : '👤'
            const names = isSplit && p.splitClients ? p.splitClients.join(', ') : (p.memberName || '?')
            return (
              <div key={p.id} className="payment-item">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{icon} {names}</div>
                  <div style={{ color: 'var(--txt2)' }}>
                    {p.time || ''}{p.trainer ? ' · ' + p.trainer : ''}{p.note ? ' · ' + p.note : ''}
                    {isSplit ? ` · спліт ${p.splitCount} ос.${p.payingCount !== undefined && p.payingCount < p.splitCount ? ` (${p.splitCount - p.payingCount} з абон.)` : ''}` : ''}
                    {isDeducted ? ' · списано з абонементу' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isAbonSale ? (
                    role === 'trainer' ? (
                      <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.trainerEarning}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--txt2)' }}>зал:</span>
                        <MethodPill method={p.method} />
                        <span style={{ color: 'var(--acc)', fontWeight: 600 }}>+{p.hallEarning}</span>
                      </>
                    )
                  ) : p.trainerEarning ? (
                    role === 'trainer' ? (
                      <>
                        <MethodPill method={p.method} />
                        <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.trainerEarning}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--txt2)' }}>клієнт:</span>
                        <MethodPill method={p.method} />
                        <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.trainerEarning}</span>
                        <span style={{ fontSize: 11, color: 'var(--txt2)', marginLeft: 4 }}>зал:</span>
                        <MethodPill method={p.hallMethod} />
                        <span style={{ color: 'var(--acc)', fontWeight: 600 }}>+{p.hallEarning}</span>
                      </>
                    )
                  ) : (
                    <>
                      <MethodPill method={p.method} />
                      <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.amount}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Trainer abon modal ────────────────────────────────────────────────────────
function TrainerAbonModal({ members, abons, uname, role, pushAbons, pushPayment, onClose }) {
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState(null)
  const [clientName, setClientName] = useState('')
  const [sessions, setSessions] = useState(8)
  const [price, setPrice] = useState('')
  const [method, setMethod] = useState('cash')
  const [hallMethod, setHallMethod] = useState('cash')
  const [toCash, setToCash] = useState(true)

  const results = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q || clientId) return []
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [members, search, clientId])

  // Фіксована ціна місячного абонементу — з бази більше не береться
  const DEFAULT_ABON_PRICE = 1100
  const abonPrice = DEFAULT_ABON_PRICE

  // Формула: ((trainerPrice + abonPrice) * 0.6) - abonPrice = наша частка
  const trainerPrice = parseFloat(price) || 0
  const total = trainerPrice + abonPrice
  const trainerEarning = Math.round(total * 0.6)
  const hallEarning = Math.round(total * 0.4) - abonPrice

  async function save() {
    if (!clientId && !search.trim()) { alert('Виберіть клієнта'); return }
    if (!trainerPrice) { alert('Вкажіть суму від клієнта'); return }
    const name = clientName || search.trim()
    const ab = {
      id: uid(), memberId: clientId, memberName: name,
      type: 'trainer', startDate: TODAY,
      totalSessions: sessions, sessionsLeft: sessions,
      price: trainerPrice, paid: trainerPrice, active: true,
      trainer: uname || 'Тренер',
      abonPrice, trainerEarning, hallEarning
    }
    let payment = null
    if (toCash) {
      payment = {
        id: uid(), kind: 'trainer_abon',
        memberId: clientId, memberName: name,
        date: TODAY, time: nowTime(),
        amount: hallEarning, trainerEarning, hallEarning,
        method: role === 'trainer' ? null : hallMethod,
        note: `Абонемент тренера ${sessions} занять (клієнт: ${trainerPrice} грн)`
      }
    }
    await pushAbons([ab])
    if (payment) await pushPayment(payment)
    alert(`✅ Абонемент на ${sessions} занять продано!\nКаса тренера: ${trainerEarning} грн · Залу: ${hallEarning} грн`)
    onClose()
  }

  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto', paddingBottom: 40 }}>
      <div className="mhdr">
        <button className="back" onClick={onClose}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Назад
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Продати абонемент на заняття</span>
      </div>
      <div style={{ padding: 14 }}>
        <FRow label="Клієнт">
          <input type="search" placeholder="Пошук або ім'я..." value={search}
            onChange={e => { setSearch(e.target.value); if (clientId) { setClientId(null); setClientName('') } }} />
        </FRow>
        {results.length > 0 && (
          <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 12 }}>
            {results.map(m => {
              const ab = getActiveAbon(m.id, abons)
              return (
                <div key={m.id} className="mi" onClick={() => { setClientId(m.id); setClientName(m.name); setSearch(m.name) }}>
                  <Ava name={m.name} size={30} />
                  <div className="mi-info"><div className="mi-name" style={{ fontSize: 14 }}>{m.name}</div></div>
                  {ab?.price ? <span className="ai-tag tag-grn">абон: {ab.price} грн</span> : <span className="ai-tag tag-gray">без абону</span>}
                </div>
              )
            })}
          </div>
        )}

        {clientId && (
          <div style={{ background: 'rgba(91,141,246,.08)', border: '1px solid rgba(91,141,246,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13 }}>
            🎫 Використовується фіксована ціна абонементу: {abonPrice} грн
          </div>
        )}

        <FRow label="Кількість занять">
          <select value={sessions} onChange={e => setSessions(+e.target.value)}>
            {[4, 6, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} занять</option>)}
          </select>
        </FRow>

        <FRow label="Сума від клієнта за заняття (грн)">
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="напр: 2200" min={0} />
        </FRow>

        {trainerPrice > 0 && (
          <div style={{ background: 'rgba(39,201,122,.08)', border: '1px solid rgba(39,201,122,.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, lineHeight: 1.9 }}>
            💰 Разом з абоном: <b>{total} грн</b> ({trainerPrice} + {abonPrice})<br />
            💵 <span style={{ color: 'var(--grn)' }}>Каса тренера (60%): <b>{trainerEarning} грн</b></span><br />
            🏦 Залу: <b>{hallEarning} грн</b>
          </div>
        )}

        {trainerPrice > 0 && role !== 'trainer' && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 14 }}>
              <input type="checkbox" checked={toCash} onChange={e => setToCash(e.target.checked)} />
              Записати в касу ({hallEarning} грн)
            </label>
            {toCash && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 6 }}>Клієнт→тренер</div>
                  <div className="method-toggle" style={{ marginBottom: 0 }}>
                    <button className={`method-btn ${method === 'cash' ? 'on-cash' : ''}`} onClick={() => setMethod('cash')}>💵</button>
                    <button className={`method-btn ${method === 'card' ? 'on-card' : ''}`} onClick={() => setMethod('card')}>💳</button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 6 }}>Тренер→зал</div>
                  <div className="method-toggle" style={{ marginBottom: 0 }}>
                    <button className={`method-btn ${hallMethod === 'cash' ? 'on-cash' : ''}`} onClick={() => setHallMethod('cash')}>💵</button>
                    <button className={`method-btn ${hallMethod === 'card' ? 'on-card' : ''}`} onClick={() => setHallMethod('card')}>💳</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {trainerPrice > 0 && role === 'trainer' && (
          <div style={{ background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: 'var(--ylw)' }}>
            ℹ️ Оплату залу підтвердить адміністратор
          </div>
        )}

        <button className="btn btn-grn" onClick={save}>💾 Зберегти абонемент</button>
      </div>
    </div>
  )
}