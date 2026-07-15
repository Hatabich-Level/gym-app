import React, { useState } from 'react'
import {
  TODAY, fmtDate, uid, addCalMonths, addDays, daysDiff, abonStatus, getActiveAbon,
  getActiveTrainerAbon, getMemberDebt, STATUS_LABEL, STATUS_TAG, nowTime
} from '../utils'
import { Modal, FRow, MethodToggle, MethodPill, ProgressBar, IconBtn } from '../components/UI'

export default function MemberDetail({
  memberId, members, abons, payments, role, uname,
  onBack, onSaveMember, onDeleteMember, pushAbons, pushPayment, deletePayment, loading
}) {
  const mem = members.find(m => m.id === memberId)
  const [modal, setModal] = useState(null) // 'edit'|'abon'|'pay'|'extend'|'freeze'
  const isOwner = role === 'owner'
  const isAdmin = role === 'owner' || role === 'admin'

  if (!mem) return null

  const allAbons = abons.filter(a => a.memberId === memberId && a.type !== 'trainer')
    .sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''))
  const activeAbon = getActiveAbon(memberId, abons)
  // Для відображення в головній картці беремо активний абонемент, а якщо
  // такого немає (наприклад, разовий вже "закрився" одразу після
  // покупки/відвідування) — показуємо останній за датою запис, щоб деталі
  // (ціна, оплата, час відвідування) не зникали з очей одразу.
  const displayAbon = activeAbon || allAbons[0] || null
  const st = displayAbon ? abonStatus(displayAbon) : null
  const trainerAbon = getActiveTrainerAbon(memberId, abons)
  const debt = activeAbon ? getMemberDebt(memberId, abons, payments) : 0

  // Виявлення забруднених даних: кілька записів з active=true одночасно
  // (могло лишитись зі старих версій). Показуємо найновіший, а решту
  // пропонуємо деактивувати одним натисканням.
  const allActiveRaw = abons.filter(a => a.memberId === memberId && a.active && a.type !== 'trainer')
  const duplicateActiveAbons = allActiveRaw.filter(a => a.id !== (activeAbon && activeAbon.id))

  // Історія (все, крім запису, що показаний у головній картці)
  const history = allAbons.filter(a => a.id !== (displayAbon && displayAbon.id))

  const memberPays = payments
    .filter(p => p.memberId === memberId && p.kind !== 'session')
    .sort((a,b) => (b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))
    .slice(0, 10)

  async function fixDuplicateAbons() {
    if (!confirm(`Знайдено ${duplicateActiveAbons.length} застарілих "активних" запис(и/ів). Позначити їх неактивними? Поточний абонемент (${fmtDate(activeAbon?.startDate)}) залишиться без змін.`)) return
    await pushAbons(duplicateActiveAbons.map(a => ({ ...a, active: false })))
  }

  async function doFreeze(startDate) {
    const updated = { ...activeAbon, frozen: true, freezeStart: startDate }
    await pushAbons([updated])
    setModal(null)
  }

  async function doUnfreeze() {
    const frozenDays = daysDiff(activeAbon.freezeStart, TODAY)
    const freezeLog = [...(activeAbon.freezeLog || []), { from: activeAbon.freezeStart, to: TODAY, days: frozenDays }]
    const updated = {
      ...activeAbon,
      frozen: false,
      freezeStart: null,
      extraDays: (activeAbon.extraDays || 0) + frozenDays,
      freezeLog,
      endDate: activeAbon.type === 'month' && activeAbon.endDate ? addDays(activeAbon.endDate, frozenDays) : activeAbon.endDate
    }
    await pushAbons([updated])
  }

  async function deleteCurrentAbon() {
    if (!confirm(`Стерти поточний абонемент клієнта ${mem.name}? Цю дію не можна скасувати.`)) return
    const staleActive = abons.filter(a => a.memberId === memberId && a.active && a.type !== 'trainer')
    await pushAbons(staleActive.map(a => ({ ...a, active: false })))
  }

  return (
    <div className="fullscreen detail-view" style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      {/* Header */}
      <div className="mhdr">
        <button className="back" onClick={onBack}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mem.name}</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{mem.phone || ''}</div>
        </div>
        {isOwner && (
          <button className="btn-sm btn-gray" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt2)', borderRadius: 8 }} onClick={() => setModal('edit')}>
            ✏️ Редагувати
          </button>
        )}
      </div>

      <div style={{ padding: 14 }} className="detail-grid">
        <div className="detail-col-main">
          {/* Trainer abon (заняття) — показуємо окремо, якщо є */}
          {trainerAbon && (
            <div className="card">
              <div className="ct">🎫 Абонемент від тренера</div>
              <div className="irow">
                <span className="ikey">Залишилось занять</span>
                <span className="ival" style={{ color: 'var(--grn)', fontWeight: 700 }}>{trainerAbon.sessionsLeft} з {trainerAbon.totalSessions}</span>
              </div>
              {trainerAbon.price > 0 && (
                <div className="irow"><span className="ikey">Ціна</span><span className="ival">{trainerAbon.price} грн</span></div>
              )}
              <div className="irow"><span className="ikey">Початок</span><span className="ival">{fmtDate(trainerAbon.startDate)}</span></div>
              {trainerAbon.bonusLog && trainerAbon.bonusLog.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--brd)' }}>
                  {trainerAbon.bonusLog.map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 4 }}>
                      ➕ {b.date}: +{b.count} зан. — {b.reason}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-sm btn-acc" style={{ marginTop: 10, width: '100%' }} onClick={() => setModal('addTrainerSessions')}>
                + Додати заняття (поважна причина)
              </button>
            </div>
          )}

          {/* Freeze banner */}
          {activeAbon && activeAbon.frozen && (
            <div className="frozen-banner">
              ❄️ Заморожено {daysDiff(activeAbon.freezeStart, TODAY)} дн. тому (з {fmtDate(activeAbon.freezeStart)}). Дні будуть додані до абонементу після розморозки.
            </div>
          )}

          {/* Data-integrity warning: duplicate active abons */}
          {duplicateActiveAbons.length > 0 && isAdmin && (
            <div className="card" style={{ borderColor: 'rgba(255,51,102,.35)', background: 'rgba(255,51,102,.06)' }}>
              <div style={{ fontSize: 13, color: 'var(--txt)', marginBottom: 10, lineHeight: 1.5 }}>
                ⚠️ У клієнта знайдено {duplicateActiveAbons.length} застарілих запис(и/ів), позначених як "активні" одночасно з поточним абонементом. Показується найновіший, але радимо це полагодити.
              </div>
              <button className="btn btn-red btn-sm" onClick={fixDuplicateAbons}>🔧 Полагодити дублікати</button>
            </div>
          )}

          {/* Active abon card */}
          {displayAbon ? (
            <ActiveAbonCard
              abon={displayAbon} status={st} role={role} debt={debt}
              onPay={() => setModal('pay')}
              onExtend={() => setModal('extend')}
              onFreeze={() => setModal('freeze')}
              onUnfreeze={doUnfreeze}
              onDeleteAbon={deleteCurrentAbon}
            />
          ) : (
            isAdmin && (
              <div className="card" style={{ textAlign: 'center', padding: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎫</div>
                <div style={{ fontSize: 15, marginBottom: 16, color: 'var(--txt2)' }}>Немає активного абонементу</div>
                <button className="btn btn-acc" onClick={() => setModal('abon')}>+ Додати абонемент</button>
              </div>
            )
          )}

          {isAdmin && displayAbon && (
            <button className="btn btn-gray" style={{ marginBottom: 12 }} onClick={() => setModal('abon')}>
              + Новий абонемент
            </button>
          )}
        </div>

        <div className="detail-col-side">
          {/* Visit history */}
          {displayAbon && (displayAbon.visits || []).length > 0 && (
            <div className="card">
              <div className="ct">Відвідування</div>
              {[...displayAbon.visits].reverse().slice(0, 15).map((v, i) => (
                <div key={i} className="vitem">
                  <span>{fmtDate(v.date)}</span>
                  <span style={{ color: 'var(--txt2)' }}>{v.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payments tied to abon (history) */}
          {memberPays.length > 0 && (
            <div className="card">
              <div className="ct">Платежі</div>
              {memberPays.map(p => (
                <div key={p.id} className="payment-item">
                  <div>
                    <div>{fmtDate(p.date)}{p.time ? ' ' + p.time : ''}</div>
                    <div style={{ color: 'var(--txt2)', fontSize: 11 }}>{p.note || 'Абонемент'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MethodPill method={p.method} />
                    <span style={{ color: 'var(--grn)', fontWeight: 600 }}>+{p.amount} грн</span>
                    {isAdmin && (
                      <IconBtn onClick={() => { if (confirm('Видалити платіж?')) deletePayment(p.id) }} title="Видалити">✕</IconBtn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Abon history */}
          {history.length > 0 && (
            <div className="card">
              <div className="ct">Історія абонементів</div>
              {history.map(ab => <AbonRow key={ab.id} abon={ab} />)}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>
        {/* Danger zone */}
        {isOwner && (
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
          memberName={mem.name}
          onSave={async (ab, payment) => {
            const staleActive = abons.filter(a => a.memberId === memberId && a.active && a.type !== 'trainer')
            if (staleActive.length) await pushAbons([...staleActive.map(a => ({ ...a, active: false })), ab])
            else await pushAbons([ab])
            if (payment) await pushPayment(payment)
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'pay' && activeAbon && (
        <PayAbonModal
          abon={activeAbon}
          debt={debt}
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
      {modal === 'extend' && displayAbon && (
        <ExtendAbonModal
          abon={displayAbon}
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
      {modal === 'freeze' && activeAbon && (
        <FreezeModal
          abon={activeAbon}
          onSave={doFreeze}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addTrainerSessions' && trainerAbon && (
        <AddTrainerSessionsModal
          abon={trainerAbon}
          onSave={async (updatedAbon) => {
            await pushAbons([updatedAbon])
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Active abon card ──────────────────────────────────────────────────────────
function ActiveAbonCard({ abon, status, role, debt, onPay, onExtend, onFreeze, onUnfreeze, onDeleteAbon }) {
  const isAdmin = role === 'owner' || role === 'admin'
  const st = status
  const tagClass = STATUS_TAG[st] || 'tag-gray'
  const isMonth = abon.type === 'month'
  const isVisit = abon.type === 'visit'

  const visits = abon.visits || []
  const todayVisit = visits.find(v => v.date === TODAY)
  const monthVisits = visits.filter(v => v.date.slice(0,7) === TODAY.slice(0,7))

  const rem = isMonth && abon.endDate ? daysDiff(TODAY, abon.endDate) : null
  const totalSpan = isMonth && abon.startDate && abon.endDate ? Math.max(1, daysDiff(abon.startDate, abon.endDate)) : null
  const usedSpan = isMonth && abon.startDate ? Math.min(totalSpan || 1, Math.max(0, daysDiff(abon.startDate, TODAY))) : null
  const pct = totalSpan ? Math.round((usedSpan / totalSpan) * 100) : 0

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {isMonth ? '📅 Місячний безліміт' : isVisit ? '🎟 Разовий' : 'Абонемент'}
        </div>
        <span className={`ai-tag ${tagClass}`}>{STATUS_LABEL[st] || st}</span>
      </div>

      {isMonth && (
        <>
          <div className="irow"><span className="ikey">Початок</span><span className="ival">{fmtDate(abon.startDate)}</span></div>
          <div className="irow"><span className="ikey">Закінчення</span><span className="ival">{fmtDate(abon.endDate)}</span></div>
          {abon.extraDays > 0 && (
            <div className="irow"><span className="ikey">Додано (заморозка)</span><span className="ival" style={{ color: '#88aaff' }}>+{abon.extraDays} дн.</span></div>
          )}
          {(st === 'active' || st === 'ending') && rem !== null && (
            <>
              <div className="irow">
                <span className="ikey">Залишилось</span>
                <span className="ival" style={{ color: rem <= 3 ? 'var(--ylw)' : 'var(--grn)' }}>{rem} дн.</span>
              </div>
              <ProgressBar value={usedSpan} max={totalSpan} color={rem <= 3 ? 'var(--ylw)' : 'var(--acc)'} />
            </>
          )}
          <div className="irow" style={{ paddingTop: 10 }}>
            <span className="ikey">Відвідувань цього місяця</span>
            <span className="ival">{monthVisits.length}</span>
          </div>
        </>
      )}

      {abon.price > 0 && (
        <div className="irow">
          <span className="ikey">Вартість</span>
          <span className="ival">{abon.price} грн</span>
        </div>
      )}
      {debt > 0 ? (
        <div className="irow">
          <span className="ikey">Борг</span>
          <span className="ival" style={{ color: 'var(--ylw)' }}>{debt} грн</span>
        </div>
      ) : abon.price > 0 && (
        <div className="irow">
          <span className="ikey">Статус оплати</span>
          <span className="ival" style={{ color: 'var(--grn)' }}>✅ Оплачено повністю</span>
        </div>
      )}

      {todayVisit && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--grn)' }}>✅ Відмічено сьогодні о {todayVisit.time}</div>
      )}

      {isAdmin && (
        <div className="grid2" style={{ marginTop: 10, marginBottom: 0 }}>
          {debt > 0 && (
            <button className="btn btn-grn btn-sm" onClick={onPay}>💰 Оплата</button>
          )}
          <button className="btn btn-ylw btn-sm" onClick={onExtend}>🔄 Продовжити</button>
          {!abon.frozen && st !== 'expired' && (
            <button className="btn btn-ice btn-sm" onClick={onFreeze}>❄️ Заморозити</button>
          )}
          {abon.frozen && (
            <button className="btn btn-acc btn-sm" onClick={onUnfreeze}>▶️ Розморозити</button>
          )}
          <button className="btn btn-red btn-sm" onClick={onDeleteAbon}>🗑️ Стерти абон.</button>
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
          {abon.type === 'month' ? '📅 ' : '🎟 '}
          {fmtDate(abon.startDate)}{abon.endDate ? ' → ' + fmtDate(abon.endDate) : ''}
        </div>
      </div>
      <span className={`ai-tag ${STATUS_TAG[st] || 'tag-gray'}`}>{STATUS_LABEL[st] || '—'}</span>
    </div>
  )
}

// ── Edit member ───────────────────────────────────────────────────────────────
function EditMemberModal({ member, onSave, onClose }) {
  const [name, setName] = useState(member.name || '')
  const [phone, setPhone] = useState(member.phone || '')
  const [isTrainer, setIsTrainer] = useState(!!member.isTrainer)
  return (
    <Modal title="Редагувати клієнта" onClose={onClose}>
      <FRow label="ПІБ"><input type="text" value={name} onChange={e => setName(e.target.value)} /></FRow>
      <FRow label="Телефон"><input type="text" value={phone} onChange={e => setPhone(e.target.value)} /></FRow>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--txt2)', marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={isTrainer} onChange={e => setIsTrainer(e.target.checked)} style={{ width: 17, height: 17 }} />
        👔 Це тренер
      </label>
      <button className="btn btn-grn" onClick={() => { if (!name.trim()) return alert('Введіть ПІБ'); onSave({ name: name.trim(), phone: phone.trim(), isTrainer }) }}>
        💾 Зберегти
      </button>
    </Modal>
  )
}

// ── Add new abon ──────────────────────────────────────────────────────────────
function AddAbonModal({ memberId, memberName, activeAbon, onSave, onClose }) {
  const [type, setType] = useState('month')
  const [dur, setDur] = useState(1)
  const [price, setPrice] = useState('')
  const [paid, setPaid] = useState('')
  const [startDate, setStartDate] = useState(TODAY)
  const [method, setMethod] = useState('cash')
  const [toCash, setToCash] = useState(true)
  const [cashDate, setCashDate] = useState('today')

  const endDate = type === 'month' ? addCalMonths(startDate || TODAY, dur) : null

  async function save() {
    const p = parseFloat(price) || 0
    const pa = parseFloat(paid) || 0
    const abonId = uid()
    const ab = {
      id: abonId, memberId,
      type, startDate: startDate || TODAY,
      endDate, price: p, paid: pa,
      // Разовий вважається одразу використаним (клієнт прийшов і оплатив
      // "тут і зараз"), тож він одразу закривається — не лишається "активним"
      active: type === 'visit' ? false : true,
      frozen: false, freezeStart: null,
      extraDays: 0, freezeLog: [],
      visits: type === 'visit' ? [{ date: startDate || TODAY, time: nowTime() }] : [],
      ...(activeAbon ? { prevAbonId: activeAbon.id } : {})
    }
    let payment = null
    if (pa > 0 && toCash) {
      payment = {
        id: uid(), kind: 'abon', memberId, memberName,
        abonId,
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
          {[['month','📅 Місячний'],['visit','🎟 Разовий']].map(([v,l]) => (
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

// ── Pay (purchase) abon debt ──────────────────────────────────────────────────
function PayAbonModal({ abon, debt, memberId, memberName, onSave, onClose }) {
  const [amount, setAmount] = useState(String(debt || ''))
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

// ── Extend abon ───────────────────────────────────────────────────────────────
function ExtendAbonModal({ abon, memberId, memberName, onSave, onClose }) {
  const [dur, setDur] = useState(1)
  const [price, setPrice] = useState('')
  const [method, setMethod] = useState('cash')

  const curEnd = abon.endDate && abon.endDate >= TODAY ? abon.endDate : TODAY
  const newEnd = abon.type === 'month' ? addCalMonths(curEnd, dur) : null

  function save() {
    const p = parseFloat(price) || 0
    const updated = abon.type === 'month'
      ? { ...abon, endDate: newEnd, active: true }
      : abon
    let payment = null
    if (p > 0) {
      payment = { id: uid(), kind: 'abon', memberId, memberName, abonId: abon.id, date: TODAY, time: nowTime(), amount: p, method, note: `продовження ${dur} міс.` }
    }
    onSave(updated, payment)
  }

  return (
    <Modal title="Продовжити абонемент" onClose={onClose}>
      {abon.type === 'month' && (
        <>
          <FRow label="Поточний абонемент до">
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtDate(curEnd)}</div>
          </FRow>
          <FRow label="Продовжити на (міс)">
            <select value={dur} onChange={e => setDur(+e.target.value)}>
              {[1,2,3].map(n => <option key={n} value={n}>{n} міс</option>)}
            </select>
          </FRow>
          <div style={{ fontSize: 13, color: 'var(--grn)', marginBottom: 14 }}>
            📅 Новий кінець: <b>{fmtDate(newEnd)}</b>{price ? ' · ' + price + ' грн' : ''}
          </div>
        </>
      )}
      <FRow label="Сума (грн)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="500" /></FRow>
      <FRow label="Спосіб оплати"><MethodToggle value={method} onChange={setMethod} /></FRow>
      <button className="btn btn-grn" onClick={save}>🔄 Продовжити</button>
    </Modal>
  )
}

// ── Freeze ────────────────────────────────────────────────────────────────────
function FreezeModal({ abon, onSave, onClose }) {
  const [startDate, setStartDate] = useState(TODAY)
  const min = abon.startDate || undefined

  function save() {
    if (!startDate) { alert('Вкажіть дату початку заморозки'); return }
    if (startDate > TODAY) { alert('Дата не може бути в майбутньому'); return }
    onSave(startDate)
  }

  return (
    <Modal title="❄️ Заморозити абонемент" onClose={onClose}>
      <div className="card">
        <div style={{ fontSize: 14, color: 'var(--txt2)', marginBottom: 14, lineHeight: 1.6 }}>
          Кінець заморозки визначиться після розморозки. Всі дні додадуться до абонементу автоматично.
        </div>
        <FRow label="Початок заморозки">
          <input type="date" value={startDate} max={TODAY} min={min} onChange={e => setStartDate(e.target.value)} />
        </FRow>
        <button className="btn btn-ice" onClick={save}>❄️ Заморозити</button>
      </div>
    </Modal>
  )
}

// ── Add trainer sessions (поважна причина) ────────────────────────────────────
function AddTrainerSessionsModal({ abon, onSave, onClose }) {
  const [count, setCount] = useState(1)
  const [reason, setReason] = useState('')

  function save() {
    const n = parseInt(count) || 0
    if (n <= 0) { alert('Вкажіть кількість занять (більше 0)'); return }
    if (!reason.trim()) { alert('Вкажіть причину'); return }
    const bonusLog = [...(abon.bonusLog || []), { date: TODAY, count: n, reason: reason.trim() }]
    const updated = {
      ...abon,
      sessionsLeft: abon.sessionsLeft + n,
      totalSessions: abon.totalSessions + n,
      bonusLog
    }
    onSave(updated)
  }

  return (
    <Modal title="➕ Додати заняття тренера" onClose={onClose}>
      <div className="card">
        <div style={{ fontSize: 14, color: 'var(--txt2)', marginBottom: 14, lineHeight: 1.6 }}>
          Зараз залишилось <b>{abon.sessionsLeft}</b> з <b>{abon.totalSessions}</b> занять. Додай додаткові заняття клієнту за поважної причини (компенсація, вибачення тощо) — без оплати.
        </div>
        <FRow label="Кількість занять">
          <input type="number" value={count} onChange={e => setCount(e.target.value)} min={1} />
        </FRow>
        <FRow label="Причина">
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="напр: тренер запізнився / хвороба тренера" />
        </FRow>
        <button className="btn btn-acc" onClick={save}>💾 Додати заняття</button>
      </div>
    </Modal>
  )
}