import React, { useState, useMemo } from 'react'
import { TODAY, fmtDate, uid, nowTime, getActiveAbon, getMemberDebt } from '../utils'
import { MethodPill, Tabs, Empty, Ava } from '../components/UI'
import { api } from '../api'

const FTABS = [
  { key: 'payments', label: '💰 Каса' },
  { key: 'debts', label: '📋 Борги' },
  { key: 'export', label: '📊 Експорт' },
]

export default function FinancePage({ members, abons, payments, manualDebts, role, uname, deletePayment, saveManualDebt, payManualDebt, deleteManualDebt, pushAbons, pushPayment }) {
  const [tab, setTab] = useState('payments')

  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>💰 Фінанси</div>
      <Tabs tabs={FTABS} active={tab} onChange={setTab} />
      {tab === 'payments' && <PaymentsTab payments={payments} members={members} abons={abons} role={role} uname={uname} deletePayment={deletePayment} />}
      {tab === 'debts' && <DebtsTab manualDebts={manualDebts} members={members} abons={abons} payments={payments} role={role} saveManualDebt={saveManualDebt} payManualDebt={payManualDebt} deleteManualDebt={deleteManualDebt} pushAbons={pushAbons} pushPayment={pushPayment} />}
      {tab === 'export' && <ExportTab payments={payments} abons={abons} />}
    </div>
  )
}

function sumBy(arr, method) {
  return arr.reduce((s, p) => {
    // для занять каса залу прив'язана до hallMethod (тренер→зал), а не method (клієнт→тренер)
    const payMethod = p.kind === 'session' ? (p.hallMethod || p.method) : p.method
    const matches = method === 'cash' ? payMethod !== 'card' : payMethod === 'card'
    if (!matches) return s
    const amt = p.kind === 'session' ? (p.hallEarning || 0) : (p.amount || 0)
    return s + amt
  }, 0)
}

function PaymentsTab({ payments, members, abons, role, uname, deletePayment }) {
  const thisMonth = TODAY.slice(0,7)
  const monthPays = payments.filter(p => p.date?.slice(0,7) === thisMonth)

  if (role === 'trainer') {
    const myName = uname || 'Тренер'
    const mine = payments.filter(p => p.kind === 'session' && p.trainer === myName)
    const mMine = monthPays.filter(p => p.kind === 'session' && p.trainer === myName)
    const mEarn = mMine.reduce((s,p) => s + (p.trainerEarning||0), 0)
    const aEarn = mine.reduce((s,p) => s + (p.trainerEarning||0), 0)
    const mCash = mMine.filter(p=>p.method!=='card').reduce((s,p) => s+(p.trainerEarning||0), 0)
    const mCard = mMine.filter(p=>p.method==='card').reduce((s,p) => s+(p.trainerEarning||0), 0)
    const recent = [...mine].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,30)

    return <>
      <div className="stats3">
        <div className="sc"><div className="sv" style={{color:'var(--grn)'}}>{mEarn}</div><div className="sl">💵 Твоя каса (міс)</div></div>
        <div className="sc"><div className="sv" style={{color:'var(--grn)'}}>{mCash}</div><div className="sl">Готівка</div></div>
        <div className="sc"><div className="sv" style={{color:'var(--acc)'}}>{mCard}</div><div className="sl">Картка</div></div>
      </div>
      <div className="card">
        <div className="ct">💰 За весь час</div>
        <div className="irow"><span className="ikey">Твоя каса</span><span className="ival" style={{color:'var(--grn)',fontWeight:700}}>{aEarn} грн</span></div>
      </div>
      {recent.length > 0 && (
        <div className="card">
          <div className="ct">Останні заняття</div>
          {recent.map(p => (
            <div key={p.id} className="payment-item">
              <div style={{minWidth:0}}>
                <div style={{fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.sessionType==='split'?'👥 ':'👤 '}{p.memberName||'?'}</div>
                <div style={{color:'var(--txt2)'}}>{fmtDate(p.date)}{p.time?' '+p.time:''}{p.sessionType==='split'?` · спліт ${p.splitCount} ос.`:''}{p.note?' · '+p.note:''}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                <MethodPill method={p.method} />
                <span style={{color:'var(--grn)',fontWeight:600}}>+{p.trainerEarning||0} грн</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  }

  // Admin view
  const mCash = sumBy(monthPays, 'cash'), mCard = sumBy(monthPays, 'card')
  const aCash = sumBy(payments, 'cash'), aCard = sumBy(payments, 'card')
  const mHall = monthPays.filter(p=>p.kind==='session').reduce((s,p)=>s+(p.hallEarning||p.amount||0),0) +
                monthPays.filter(p=>p.kind!=='session').reduce((s,p)=>s+p.amount,0)
  const aHall = payments.filter(p=>p.kind==='session').reduce((s,p)=>s+(p.hallEarning||p.amount||0),0) +
                payments.filter(p=>p.kind!=='session').reduce((s,p)=>s+p.amount,0)
  const trainerMap = {}
  monthPays.filter(p=>p.kind==='session').forEach(p => {
    const t = p.trainer||'Невідомий'; trainerMap[t] = (trainerMap[t]||0) + (p.hallEarning||0)
  })
  const months = {}
  abons?.forEach(ab => { if (!ab?.price) return; const m=(ab.startDate||TODAY).slice(0,7); months[m]=(months[m]||0)+ab.price })
  const sortedMonths = Object.entries(months).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6)
  const recent = [...payments].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,30)

  return <>
    <div className="stats3">
      <div className="sc"><div className="sv" style={{color:'var(--grn)'}}>{mCash}</div><div className="sl">💵 Готівка (міс)</div></div>
      <div className="sc"><div className="sv" style={{color:'var(--acc)'}}>{mCard}</div><div className="sl">💳 Картка (міс)</div></div>
      <div className="sc"><div className="sv">{mCash+mCard}</div><div className="sl">Всього за місяць</div></div>
    </div>
    <div className="card">
      <div className="ct">🏦 Каса залу за місяць</div>
      <div className="irow"><span className="ikey">Каса залу</span><span className="ival" style={{color:'var(--acc)',fontWeight:700}}>{mHall} грн</span></div>
      {Object.entries(trainerMap).map(([t,e]) => (
        <div key={t} className="irow" style={{paddingLeft:16}}><span className="ikey" style={{color:'var(--txt2)'}}>· {t}</span><span className="ival" style={{color:'var(--acc)'}}>{e} грн</span></div>
      ))}
    </div>
    <div className="card">
      <div className="ct">За весь час</div>
      <div className="irow"><span className="ikey">🏦 Каса залу</span><span className="ival" style={{color:'var(--acc)'}}>{aHall} грн</span></div>
      <div className="irow"><span className="ikey">💵 Готівка</span><span className="ival" style={{color:'var(--grn)'}}>{aCash} грн</span></div>
      <div className="irow"><span className="ikey">💳 Картка</span><span className="ival" style={{color:'var(--acc)'}}>{aCard} грн</span></div>
      <div className="irow"><span className="ikey">Загальна сума</span><span className="ival" style={{fontWeight:700}}>{aCash+aCard} грн</span></div>
    </div>
    {sortedMonths.length > 0 && (
      <div className="card">
        <div className="ct">Нарахування по місяцях (абонементи)</div>
        {sortedMonths.map(([m,total]) => {
          const [y,mo] = m.split('-')
          const mn = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'][parseInt(mo)-1]
          return <div key={m} className="payment-item"><span>{mn} {y}</span><span style={{fontWeight:600}}>{total} грн</span></div>
        })}
      </div>
    )}
    {recent.length > 0 && (
      <div className="card">
        <div className="ct">Останні платежі</div>
        {recent.map(p => {
          const hallAmt = p.kind === 'session' ? (p.hallEarning||p.amount||0) : p.amount
          const hallMethodDisplay = p.kind === 'session' ? (p.hallMethod || p.method) : p.method
          const who = p.kind === 'session' ? (p.memberName||'?') : (members.find(m=>m.id===p.memberId)||{name:'?'}).name
          return (
            <div key={p.id} className="payment-item">
              <div style={{minWidth:0}}>
                <div style={{fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{who}{p.kind==='session'&&<span style={{color:'var(--txt2)',fontSize:11}}> (заняття)</span>}</div>
                <div style={{color:'var(--txt2)'}}>{fmtDate(p.date)}{p.note?' · '+p.note:''}{p.trainer?' · '+p.trainer:''}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                <MethodPill method={hallMethodDisplay} />
                <span style={{color:'var(--grn)',fontWeight:600}}>+{hallAmt}</span>
                <button className="alert-dismiss" onClick={() => { if(confirm('Видалити платіж?')) deletePayment(p.id) }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </>
}

function DebtsTab({ manualDebts, members, abons, payments, role, saveManualDebt, payManualDebt, deleteManualDebt, pushAbons, pushPayment }) {
  const isAdmin = role === 'owner' || role === 'admin'
  const [modal, setModal] = useState(null) // null | {type:'add'|'pay'|'edit'|'pay-abon', debtId|memberId}

  // Борги по абонементах (автоматичні, рахуються від ціни абону і прив'язаних платежів)
  const abonDebtors = useMemo(() => {
    return members
      .map(m => ({ m, debt: getMemberDebt(m.id, abons, payments), ab: getActiveAbon(m.id, abons) }))
      .filter(d => d.debt > 0)
      .sort((a, b) => b.debt - a.debt)
  }, [members, abons, payments])

  const active = manualDebts.filter(d => (d.remaining||0) > 0)
  const paid = manualDebts.filter(d => (d.remaining||0) <= 0)

  const totalAbonDebt = abonDebtors.reduce((s, d) => s + d.debt, 0)
  const totalManualDebt = active.reduce((s, d) => s + (d.remaining||0), 0)
  const totalCount = abonDebtors.length + active.length

  async function payAbonDebt(memberId, abonId, amount, method, note) {
    const mem = members.find(m => m.id === memberId)
    const ab = abons.find(a => a.id === abonId)
    const p = {
      id: uid(), kind: 'abon', memberId, memberName: mem ? mem.name : '',
      date: TODAY, time: nowTime(), amount, method, note, abonId
    }
    await pushPayment(p)
    if (ab) await pushAbons([{ ...ab, paid: (ab.paid||0) + amount }])
    setModal(null)
  }

  return (
    <>
      <div className="stats2">
        <div className="sc"><div className="sv" style={{ color: 'var(--red)' }}>{totalCount}</div><div className="sl">Клієнтів з боргом</div></div>
        <div className="sc"><div className="sv" style={{ color: 'var(--ylw)' }}>{totalAbonDebt + totalManualDebt}</div><div className="sl">Грн загалом</div></div>
      </div>

      {isAdmin && (
        <button className="btn btn-acc" style={{ marginBottom: 12 }} onClick={() => setModal({ type: 'add' })}>
          + Додати боржника
        </button>
      )}

      {/* Борги по абонементах */}
      {abonDebtors.length > 0 && (
        <div className="card">
          <div className="ct">Борги по абонементах</div>
          {abonDebtors.map(d => {
            const paidAmt = (d.ab.price||0) - d.debt
            const pct = d.ab.price ? Math.round(paidAmt / d.ab.price * 100) : 0
            return (
              <div key={d.m.id} className="debt-item">
                <Ava name={d.m.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 2 }}>
                    Оплачено {paidAmt} з {d.ab.price} грн · Борг: <span style={{ color: 'var(--ylw)', fontWeight: 600 }}>{d.debt} грн</span>
                  </div>
                  <div className="pbar" style={{ marginTop: 4 }}><div className="pfill" style={{ width: pct + '%', background: 'var(--ylw)' }} /></div>
                </div>
                {isAdmin && (
                  <button className="btn-sm btn-grn btn" style={{ width: 'auto', flexShrink: 0 }} onClick={() => setModal({ type: 'pay-abon', memberId: d.m.id, abonId: d.ab.id, debt: d.debt })}>💰 Оплата</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ручні борги */}
      {active.length > 0 ? active.map(d => (
        <DebtCard key={d.id} debt={d} members={members} role={role}
          onPay={() => setModal({ type: 'pay', debtId: d.id })}
          onEdit={() => setModal({ type: 'edit', debtId: d.id })}
          onDelete={() => { if(confirm('Видалити?')) deleteManualDebt(d.id) }}
        />
      )) : (abonDebtors.length === 0 && <Empty text="Активних боргів немає" />)}

      {paid.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ct">✅ Погашені</div>
          {paid.map(d => (
            <div key={d.id} className="irow">
              <span>{d.name}</span>
              <span className="ai-tag tag-grn">Погашено</span>
            </div>
          ))}
        </div>
      )}

      {modal?.type === 'add' && (
        <DebtModal members={members} onSave={async d => { await saveManualDebt(d); setModal(null) }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <DebtModal members={members} existing={manualDebts.find(d=>d.id===modal.debtId)} onSave={async d => { await saveManualDebt(d); setModal(null) }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'pay' && (
        <PayDebtModal debt={manualDebts.find(d=>d.id===modal.debtId)} onSave={async (id,amt,method,note) => { await payManualDebt(id,amt,method,note); setModal(null) }} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'pay-abon' && (
        <PayAbonDebtModal
          debt={modal.debt}
          memberName={(members.find(m=>m.id===modal.memberId)||{}).name}
          onSave={(amt, method, note) => payAbonDebt(modal.memberId, modal.abonId, amt, method, note)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

function PayAbonDebtModal({ debt, memberName, onSave, onClose }) {
  const [amount, setAmount] = useState(String(debt||''))
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto' }}>
      <div className="mhdr"><button className="back" onClick={onClose}>← Назад</button><span style={{ fontWeight: 600 }}>Оплата абонементу</span></div>
      <div style={{ padding: 14 }}>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>{memberName}</div>
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>Борг: {debt} грн</div>
        </div>
        <div className="frow"><div className="flabel">Сума (грн)</div><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <MethodToggle value={method} onChange={setMethod} />
        <div className="frow"><div className="flabel">Примітка</div><input type="text" value={note} onChange={e => setNote(e.target.value)} /></div>
        <button className="btn btn-grn" onClick={() => { const a=parseFloat(amount)||0; if(!a){alert('Вкажіть суму');return}; onSave(a,method,note) }}>💰 Записати оплату</button>
      </div>
    </div>
  )
}

function DebtCard({ debt, members, role, onPay, onEdit, onDelete }) {
  const isAdmin = role === 'owner' || role === 'admin'
  const total = debt.totalAmount || 0
  const remaining = debt.remaining || 0
  const paid = total - remaining
  const pct = total > 0 ? Math.min(100, (paid/total)*100) : 0
  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{debt.name}</div>
          {debt.description && <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>{debt.description}</div>}
        </div>
        <span className="ai-tag tag-red">{remaining} грн</span>
      </div>
      {total > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--txt2)', marginTop: 8 }}>
            <span>Оплачено: {paid} грн</span><span>Всього: {total} грн</span>
          </div>
          <div className="pbar" style={{ marginTop: 4 }}><div className="pfill" style={{ width: pct+'%', background: 'var(--grn)' }} /></div>
        </>
      )}
      {(debt.payments||[]).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {debt.payments.slice(-3).map((p,i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--txt2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{fmtDate(p.date)}</span><span style={{ color: 'var(--grn)' }}>+{p.amount} грн</span>
            </div>
          ))}
        </div>
      )}
      {isAdmin && (
        <div className="grid2" style={{ marginTop: 10, marginBottom: 0 }}>
          <button className="btn btn-grn btn-sm" onClick={onPay}>💰 Оплата</button>
          <button className="btn btn-gray btn-sm" onClick={onEdit}>✏️ Редагувати</button>
          <button className="btn btn-red btn-sm" onClick={onDelete}>🗑 Видалити</button>
        </div>
      )}
    </div>
  )
}

function DebtModal({ members, existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || '')
  const [desc, setDesc] = useState(existing?.description || '')
  const [total, setTotal] = useState(String(existing?.totalAmount || ''))
  const [remaining, setRemaining] = useState(String(existing?.remaining || ''))
  const [memberId, setMemberId] = useState(existing?.memberId || '')
  const [search, setSearch] = useState(existing?.name || '')
  const results = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q || memberId) return []
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0,6)
  }, [members, search, memberId])

  function save() {
    if (!name.trim()) { alert('Введіть ім\'я'); return }
    const t = parseFloat(total)||0, r = parseFloat(remaining)||t
    onSave({ id: existing?.id || uid(), name: name.trim(), description: desc, totalAmount: t, remaining: r, memberId: memberId||null, payments: existing?.payments||[] })
  }

  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto', paddingBottom: 40 }}>
      <div className="mhdr">
        <button className="back" onClick={onClose}>← Назад</button>
        <span style={{ fontWeight: 600 }}>{existing ? 'Редагувати боржника' : 'Новий боржник'}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="frow"><div className="flabel">Ім'я</div><input type="text" value={name} onChange={e => { setName(e.target.value); if(!memberId) setSearch(e.target.value) }} /></div>
        <div className="frow"><div className="flabel">Клієнт з бази (необов'язково)</div>
          <input type="search" value={search} onChange={e => { setSearch(e.target.value); if(memberId){ setMemberId(''); setName('') } }} />
          {results.length > 0 && (
            <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginTop: 4 }}>
              {results.map(m => (
                <div key={m.id} className="mi" onClick={() => { setMemberId(m.id); setName(m.name); setSearch(m.name) }}>
                  <div className="mi-info"><div className="mi-name" style={{ fontSize: 14 }}>{m.name}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="frow"><div className="flabel">Опис</div><input type="text" value={desc} onChange={e => setDesc(e.target.value)} /></div>
        <div className="frow"><div className="flabel">Загальна сума</div><input type="number" value={total} onChange={e => setTotal(e.target.value)} /></div>
        <div className="frow"><div className="flabel">Залишок боргу</div><input type="number" value={remaining} onChange={e => setRemaining(e.target.value)} /></div>
        <button className="btn btn-grn" onClick={save}>💾 Зберегти</button>
      </div>
    </div>
  )
}

function PayDebtModal({ debt, onSave, onClose }) {
  const [amount, setAmount] = useState(String(debt?.remaining||''))
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto' }}>
      <div className="mhdr"><button className="back" onClick={onClose}>← Назад</button><span style={{ fontWeight: 600 }}>Записати оплату</span></div>
      <div style={{ padding: 14 }}>
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>{debt?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>Залишок: {debt?.remaining} грн</div>
        </div>
        <div className="frow"><div className="flabel">Сума (грн)</div><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <MethodToggle value={method} onChange={setMethod} />
        <div className="frow"><div className="flabel">Примітка</div><input type="text" value={note} onChange={e => setNote(e.target.value)} /></div>
        <button className="btn btn-grn" onClick={() => { const a=parseFloat(amount)||0; if(!a){alert('Вкажіть суму');return}; onSave(debt.id,a,method,note) }}>✅ Записати оплату</button>
      </div>
    </div>
  )
}

function MethodToggle({ value, onChange }) {
  return (
    <div className="method-toggle" style={{ marginBottom: 14 }}>
      <button className={`method-btn ${value==='cash'?'on-cash':''}`} onClick={() => onChange('cash')}>💵 Готівка</button>
      <button className={`method-btn ${value==='card'?'on-card':''}`} onClick={() => onChange('card')}>💳 Картка</button>
    </div>
  )
}

function ExportTab({ payments, abons }) {
  const [month, setMonth] = useState(TODAY.slice(0,7))
  const [loading, setLoading] = useState(false)

  const months = useMemo(() => {
    const s = new Set()
    abons.forEach(ab => (ab.visits||[]).forEach(v => s.add(v.date?.slice(0,7))))
    payments.forEach(p => s.add(p.date?.slice(0,7)))
    return [...s].filter(Boolean).sort((a,b) => b.localeCompare(a))
  }, [payments, abons])

  async function doExport() {
    setLoading(true)
    try {
      const [y, m] = month.split('-')
      const token = localStorage.getItem('gym_token') || ''
      const res = await fetch(`/api/export/${y}/${parseInt(m)}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      if (!res.ok) throw new Error('Помилка')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `export_${month}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('❌ ' + e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="ct">Експорт за місяць</div>
      <div className="frow">
        <div className="flabel">Виберіть місяць</div>
        <select value={month} onChange={e => setMonth(e.target.value)}>
          {months.map(m => {
            const [y,mo] = m.split('-')
            const mn = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'][parseInt(mo)-1]
            return <option key={m} value={m}>{mn} {y}</option>
          })}
        </select>
      </div>
      <button className="btn btn-acc" onClick={doExport} disabled={loading}>
        {loading ? '⏳ Генерується...' : '📥 Завантажити Excel'}
      </button>
    </div>
  )
}