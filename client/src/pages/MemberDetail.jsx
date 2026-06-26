import React, { useState } from 'react'
import {
  TODAY, fmtDate, uid, addCalMonths, abonStatus, getActiveAbon,
  HALL_FEE, STATUS_LABEL, STATUS_TAG, nowTime
} from '../utils'
import { Modal, FRow, MethodToggle, MethodPill, Ava, ProgressBar, IconBtn } from '../components/UI'
import { api } from '../api'

export default function MemberDetail({
  memberId, members, abons, payments, role, uname,
  onBack, onSaveMember, onDeleteMember, pushAbons, pushPayment, deletePayment, loading
}) {
  const mem = members.find(m => m.id === memberId)
  const [modal, setModal] = useState(null) // 'edit'|'abon'|'pay'|'extend'

  if (!mem) return null

  const allAbons = abons.filter(a => a.memberId === memberId).sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''))
  const activeAbon = getActiveAbon(memberId, abons)
  const st = activeAbon ? abonStatus(activeAbon) : null

  const memberPays = payments
    .filter(p => p.memberId === memberId || (p.kind === 'session' && (p.splitClients||[]).includes(mem.name)))
    .sort((a,b) => (b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      {/* Header */}
      <div className="mhdr">
        <button className="back" onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{mem.name}</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{mem.phone || ''}</div>
        </div>
        {role === 'admin' && (
          <button className="btn-sm btn-gray" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt2)', borderRadius: 8 }} onClick={() => setModal('edit')}>
            ✏️ Редагувати
          </button>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {/* Active abon card */}
        {activeAbon ? (
          <ActiveAbonCard
            abon={activeAbon} status={st} role={role}
            onPay={() => setModal('pay')}
            onExtend={() => setModal('extend')}
            onFreeze={() => {
              const updated = { ...activeAbon, frozen: !activeAbon.frozen }
              pushAbons([updated])
            }}
          />
        ) : (
          role === 'admin' && (
            <button className="btn btn-acc" style={{ marginBottom: 12 }} onClick={() => setModal('abon')}>
              + Додати абонемент
            </button>
          )
        )}

        {role === 'admin' && activeAbon && (
          <button className="btn btn-gray" style={{ marginBottom: 12 }} onClick={() => setModal('abon')}>
            + Новий абонемент
          </button>
        )}

        {/* Abon history */}
        {allAbons.length > 0 && (
          <div className="card">
            <div className="ct">Абонементи</div>
            {allAbons.map(ab => <AbonRow key={ab.id} abon={ab} />)}
          </div>
        )}

        {/* Payments */}
        {memberPays.length > 0 && (
          <div className="card">
            <div className="ct">Платежі</div>
            {memberPays.map(p => (
              <div key={p.id} className="payment-item">
                <div>
                  <div>{fmtDate(p.date)}{p.time ? ' ' + p.time : ''}</div>
                  <div style={{ color: 'var(--txt2)', fontSize: 11 }}>{p.note || (p.kind === 'session' ? 'Заняття' : 'Абонемент')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MethodPill method={p.method} />
                  <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.amount} грн</span>
                  {role === 'admin' && (
                    <IconBtn onClick={() => { if (confirm('Видалити платіж?')) deletePayment(p.id) }} title="Видалити">✕</IconBtn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Danger zone */}
        {role === 'admin' && (
          <button className="btn btn-red" onClick={() => {
            if (confirm(`Видалити клієнта ${mem.name}?\n\nВсі абонементи будуть видалені.`)) {
              onDeleteMember(memberId)
              onBack()
            }
          }}>🗑 Видалити клієнта</button>
        )}
      </div>

      {/* Modals */}
      {modal === 'edit' && (
        <EditMemberModal
          member={mem}
          onSave={data => { onSaveMember(memberId, data); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'abon' && (
        <AddAbonModal
          memberId={memberId}
          activeAbon={activeAbon}
          onSave={async (ab, payment) => {
            await pushAbons([ab])
            if (payment) await pushPayment(payment)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'pay' && activeAbon && (
        <PayAbonModal
          abon={activeAbon}
          memberId={memberId}
          memberName={mem.name}
          onSave={async (p, updatedAbon) => {
            await pushPayment(p)
            if (updatedAbon) await pushAbons([updatedAbon])
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'extend' && activeAbon && (
        <ExtendAbonModal
          abon={activeAbon}
          memberId={memberId}
          memberName={mem.name}
          onSave={async (updatedAbon, payment) => {
            await pushAbons([updatedAbon])
            if (payment) await pushPayment(payment)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ActiveAbonCard({ abon, status, role, onPay, onExtend, onFreeze }) {
  const st = status
  const tagClass = STATUS_TAG[st] || 'tag-gray'
  const isMonth = abon.type === 'month'
  const isVisit = abon.type === 'visit'
  const isTrainer = abon.type === 'trainer'

  const visits = abon.visits || []
  const todayVisit = visits.find(v => v.date === TODAY)

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {isMonth ? '📅 Місячний' : isVisit ? '🎟 Разовий' : isTrainer ? '🎫 Тренер' : 'Абонемент'}
        </div>
        <span className={`ai-tag ${tagClass}`}>{STATUS_LABEL[st] || st}</span>
      </div>

      {isMonth && abon.endDate && (
        <div className="irow" style={{ paddingTop: 4 }}>
          <span className="ikey">До</span>
          <span className="ival">{fmtDate(abon.endDate)}</span>
        </div>
      )}
      {isTrainer && (
        <div className="irow">
          <span className="ikey">Залишилось</span>
          <span className="ival" style={{ color: 'var(--acc)' }}>{abon.sessionsLeft} / {abon.totalSessions} занять</span>
        </div>
      )}
      {abon.price > 0 && (
        <div className="irow">
          <span className="ikey">Вартість</span>
          <span className="ival">{abon.price} грн</span>
        </div>
      )}
      {abon.paid > 0 && (
        <div className="irow">
          <span className="ikey">Оплачено</span>
          <span className="ival" style={{ color: 'var(--grn)' }}>{abon.paid} грн</span>
        </div>
      )}
      {abon.price > 0 && abon.paid < abon.price && (
        <>
          <div className="irow">
            <span className="ikey">Борг</span>
            <span className="ival" style={{ color: 'var(--red)' }}>{abon.price - (abon.paid||0)} грн</span>
          </div>
          <ProgressBar value={abon.paid||0} max={abon.price} color="var(--grn)" />
        </>
      )}
      {todayVisit && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--grn)' }}>✅ Відмічено сьогодні о {todayVisit.time}</div>
      )}

      {role === 'admin' && (
        <div className="grid2" style={{ marginTop: 10, marginBottom: 0 }}>
          {abon.price > 0 && abon.paid < abon.price && (
            <button className="btn btn-grn btn-sm" onClick={onPay}>💰 Оплата</button>
          )}
          {isMonth && <button className="btn btn-acc btn-sm" onClick={onExtend}>🔄 Продовжити</button>}
          <button className={`btn btn-sm ${abon.frozen ? 'btn-ylw' : 'btn-ice'}`} onClick={onFreeze}>
            {abon.frozen ? '▶️ Розморозити' : '❄️ Заморозити'}
          </button>
        </div>
      )}
    </div>
  )
}

function AbonRow({ abon }) {
  const st = abonStatus(abon)
  return (
    <div className="irow">
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {abon.type === 'month' ? '📅 ' : abon.type === 'trainer' ? '🎫 ' : '🎟 '}
          {fmtDate(abon.startDate)}{abon.endDate ? ' → ' + fmtDate(abon.endDate) : ''}
        </div>
        {abon.type === 'trainer' && (
          <div style={{ fontSize: 11, color: 'var(--txt2)' }}>{abon.sessionsLeft}/{abon.totalSessions} занять</div>
        )}
      </div>
      <span className={`ai-tag ${STATUS_TAG[st] || 'tag-gray'}`}>{STATUS_LABEL[st] || '—'}</span>
    </div>
  )
}

function EditMemberModal({ member, onSave, onClose }) {
  const [name, setName] = useState(member.name || '')
  const [phone, setPhone] = useState(member.phone || '')
  return (
    <Modal title="Редагувати клієнта" onClose={onClose}>
      <FRow label="ПІБ"><input type="text" value={name} onChange={e => setName(e.target.value)} /></FRow>
      <FRow label="Телефон"><input type="text" value={phone} onChange={e => setPhone(e.target.value)} /></FRow>
      <button className="btn btn-grn" onClick={() => { if (!name.trim()) return alert('Введіть ПІБ'); onSave({ name: name.trim(), phone: phone.trim() }) }}>
        💾 Зберегти
      </button>
    </Modal>
  )
}

function AddAbonModal({ memberId, activeAbon, onSave, onClose }) {
  const [type, setType] = useState('month')
  const [dur, setDur] = useState(1)
  const [price, setPrice] = useState('')
  const [paid, setPaid] = useState('')
  const [startDate, setStartDate] = useState(TODAY)
  const [method, setMethod] = useState('cash')
  const [toCash, setToCash] = useState(true)
  const [cashDate, setCashDate] = useState('today')
  const [sessions, setSessions] = useState(8)

  const endDate = type === 'month' ? addCalMonths(startDate || TODAY, dur) : null

  async function save() {
    const p = parseFloat(price) || 0
    const pa = parseFloat(paid) || 0
    const ab = {
      id: uid(), memberId,
      type, startDate: startDate || TODAY,
      endDate, price: p, paid: pa,
      active: true,
      ...(type === 'trainer' ? { totalSessions: sessions, sessionsLeft: sessions } : {}),
      ...(activeAbon ? { prevAbonId: activeAbon.id } : {})
    }
    let payment = null
    if (pa > 0 && toCash) {
      payment = {
        id: uid(), kind: 'abon', memberId,
        memberName: '', // filled by caller if needed
        date: cashDate === 'today' ? TODAY : startDate,
        time: nowTime(), amount: pa, method
      }
    }
    await onSave(ab, payment)
  }

  return (
    <Modal title="Новий абонемент" onClose={onClose}>
      <FRow label="Тип">
        <div className="method-toggle">
          {[['month','📅 Місячний'],['visit','🎟 Разовий'],['trainer','🎫 Тренер']].map(([v,l]) => (
            <button key={v} className={`method-btn ${type===v?'on-card':''}`} onClick={() => setType(v)}>{l}</button>
          ))}
        </div>
      </FRow>
      {type === 'month' && (
        <FRow label="Тривалість (міс)">
          <select value={dur} onChange={e => setDur(+e.target.value)}>
            {[1,2,3,6,12].map(n => <option key={n} value={n}>{n} міс</option>)}
          </select>
        </FRow>
      )}
      {type === 'trainer' && (
        <FRow label="Кількість занять">
          <input type="number" value={sessions} onChange={e => setSessions(+e.target.value)} min={1} />
        </FRow>
      )}
      <FRow label="Дата початку">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </FRow>
      {type === 'month' && endDate && (
        <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 14 }}>
          Кінець: <b style={{ color: 'var(--txt)' }}>{fmtDate(endDate)}</b>
        </div>
      )}
      <FRow label="Вартість (грн)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /></FRow>
      <FRow label="Оплачено (грн)"><input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" /></FRow>
      {parseFloat(paid) > 0 && (
        <>
          <FRow label="Записати в касу">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={toCash} onChange={e => setToCash(e.target.checked)} />
              Так, записати платіж
            </label>
          </FRow>
          {toCash && (
            <>
              <MethodToggle value={method} onChange={setMethod} />
              <FRow label="Дата платежу">
                <div className="method-toggle">
                  <button className={`method-btn ${cashDate==='today'?'on-cash':''}`} onClick={() => setCashDate('today')}>Сьогодні</button>
                  <button className={`method-btn ${cashDate==='start'?'on-cash':''}`} onClick={() => setCashDate('start')}>Дата початку</button>
                </div>
              </FRow>
            </>
          )}
        </>
      )}
      <button className="btn btn-grn" onClick={save}>💾 Зберегти абонемент</button>
    </Modal>
  )
}

function PayAbonModal({ abon, memberId, memberName, onSave, onClose }) {
  const [amount, setAmount] = useState(String(abon.price - (abon.paid||0)))
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')

  function save() {
    const a = parseFloat(amount) || 0
    if (!a) { alert('Вкажіть суму'); return }
    const p = {
      id: uid(), kind: 'abon', memberId, memberName,
      date: TODAY, time: nowTime(), amount: a, method, note,
      abonId: abon.id
    }
    // update abon paid
    const updated = { ...abon, paid: (abon.paid||0) + a }
    onSave(p, updated)
  }

  return (
    <Modal title="Оплата абонементу" onClose={onClose}>
      <FRow label="Сума (грн)"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></FRow>
      <MethodToggle value={method} onChange={setMethod} />
      <FRow label="Примітка"><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="необов'язково" /></FRow>
      <button className="btn btn-grn" onClick={save}>💰 Записати оплату</button>
    </Modal>
  )
}

function ExtendAbonModal({ abon, memberId, memberName, onSave, onClose }) {
  const [dur, setDur] = useState(1)
  const [price, setPrice] = useState('')
  const [method, setMethod] = useState('cash')

  const curEnd = abon.endDate && abon.endDate >= TODAY ? abon.endDate : TODAY
  const newEnd = addCalMonths(curEnd, dur)

  function save() {
    const p = parseFloat(price) || 0
    const updated = { ...abon, endDate: newEnd, price: (abon.price||0) + p, paid: (abon.paid||0) + p }
    let payment = null
    if (p > 0) {
      payment = { id: uid(), kind: 'abon', memberId, memberName, date: TODAY, time: nowTime(), amount: p, method, note: 'Продовження' }
    }
    onSave(updated, payment)
  }

  return (
    <Modal title="Продовжити абонемент" onClose={onClose}>
      <FRow label="Продовжити на (міс)">
        <select value={dur} onChange={e => setDur(+e.target.value)}>
          {[1,2,3,6,12].map(n => <option key={n} value={n}>{n} міс</option>)}
        </select>
      </FRow>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 14 }}>
        Новий кінець: <b style={{ color: 'var(--txt)' }}>{fmtDate(newEnd)}</b>
      </div>
      <FRow label="Оплата (грн)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" /></FRow>
      <MethodToggle value={method} onChange={setMethod} />
      <button className="btn btn-grn" onClick={save}>🔄 Продовжити</button>
    </Modal>
  )
}
