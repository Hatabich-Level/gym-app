import React, { useState, useMemo } from 'react'
import {
  fmtDate, getActiveAbon, abonStatus, isTrainerAbonExpired, STATUS_LABEL, STATUS_TAG
} from '../utils'
import { Ava, Empty, Modal, Tabs } from '../components/UI'

const NONE = '__none__'

// Стан тренерського абонемента (пакета занять) клієнта
function trainerAbonInfo(memberId, abons) {
  const list = abons
    .filter(a => a.memberId === memberId && a.type === 'trainer' && !a.deleted)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
  if (!list.length) return { kind: 'none' }
  const active = list.find(a => a.sessionsLeft > 0 && !a.frozen && !isTrainerAbonExpired(a))
  if (active) return { kind: 'active', left: active.sessionsLeft, total: active.totalSessions }
  const frozen = list.find(a => a.sessionsLeft > 0 && a.frozen)
  if (frozen) return { kind: 'frozen', left: frozen.sessionsLeft }
  const expired = list.find(a => a.sessionsLeft > 0 && isTrainerAbonExpired(a))
  if (expired) return { kind: 'expired', left: expired.sessionsLeft }
  return { kind: 'used' }
}

// Стан клубного абонемента (місячний / разовий)
function clubInfo(memberId, abons) {
  const ab = getActiveAbon(memberId, abons)
  if (!ab) return { st: null, text: 'немає' }
  const st = abonStatus(ab)
  const extra = ab.type === 'month' ? ' · до ' + fmtDate(ab.endDate) : ' · разовий'
  return { st, text: STATUS_LABEL[st] + extra }
}

function ClubChip({ info }) {
  return (
    <span className={`ai-tag ${info.st ? STATUS_TAG[info.st] : 'tag-gray'}`}>
      🏋️ Клуб: {info.text}
    </span>
  )
}

function TrainerChip({ info }) {
  if (info.kind === 'active') return <span className="ai-tag tag-blue">🎫 Тренер: {info.left} з {info.total} занять</span>
  if (info.kind === 'frozen') return <span className="ai-tag tag-ice">❄️ Тренер: заморожено ({info.left} зан.)</span>
  if (info.kind === 'expired') return <span className="ai-tag tag-red">🎫 Тренер: прострочено ({info.left} зан. згоріло)</span>
  if (info.kind === 'used') return <span className="ai-tag tag-gray">🎫 Тренер: заняття використано</span>
  return <span className="ai-tag tag-gray">🎫 Тренер: немає</span>
}

export default function TrainerClients({ members, abons, trainers, role, uid, assignTrainer, onOpen }) {
  const isTrainerRole = role === 'trainer'
  const [selTrainer, setSelTrainer] = useState(null)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const trainerId = isTrainerRole ? uid : (selTrainer || (trainers[0] && trainers[0].id) || NONE)

  const counts = useMemo(() => {
    const c = { [NONE]: 0 }
    trainers.forEach(t => { c[t.id] = 0 })
    members.forEach(m => {
      if (m.trainerId && c[m.trainerId] !== undefined) c[m.trainerId]++
      else if (!m.trainerId) c[NONE]++
    })
    return c
  }, [members, trainers])

  const clients = useMemo(() => {
    const q = query.toLowerCase().trim()
    return members
      .filter(m => trainerId === NONE ? !m.trainerId : m.trainerId === trainerId)
      .filter(m => !q || (m.name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'))
  }, [members, trainerId, query])

  const rows = useMemo(() => clients.map(m => ({
    m, club: clubInfo(m.id, abons), tr: trainerAbonInfo(m.id, abons)
  })), [clients, abons])

  const noClub = rows.filter(r => !r.club.st || r.club.st === 'expired').length
  const noTrainer = rows.filter(r => r.tr.kind !== 'active' && r.tr.kind !== 'frozen').length

  async function unassign(m) {
    if (!confirm(`Прибрати ${m.name} зі списку цього тренера?`)) return
    await assignTrainer([m.id], null)
  }

  const tabs = [
    ...trainers.map(t => ({ key: t.id, label: `${t.name} (${counts[t.id] || 0})` })),
    { key: NONE, label: `Без тренера (${counts[NONE] || 0})` }
  ]

  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        {isTrainerRole ? '👥 Мої клієнти' : '👔 Клієнти по тренерах'}
      </div>

      {!isTrainerRole && (
        trainers.length === 0
          ? <div className="card"><Empty text="Немає акаунтів тренерів" /></div>
          : <Tabs tabs={tabs} active={trainerId} onChange={setSelTrainer} />
      )}

      <div className="sr" style={{ marginTop: 10 }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input type="search" placeholder="Пошук клієнта..." value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {rows.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--txt2)', margin: '4px 0 12px', lineHeight: 1.6 }}>
          Усього: <b style={{ color: 'var(--txt)' }}>{rows.length}</b>
          {' · '}клубний закінчився/немає: <b style={{ color: noClub ? 'var(--red)' : 'var(--txt)' }}>{noClub}</b>
          {' · '}тренерського немає/закінчився: <b style={{ color: noTrainer ? 'var(--ylw)' : 'var(--txt)' }}>{noTrainer}</b>
        </div>
      )}

      {!isTrainerRole && trainerId !== NONE && (
        <button className="btn btn-acc" style={{ marginBottom: 12 }} onClick={() => setShowAdd(true)}>
          + Додати клієнтів цьому тренеру
        </button>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <Empty text={isTrainerRole ? 'За тобою ще не закріплено клієнтів' : 'Тут поки немає клієнтів'} />
        </div>
      ) : (
        <div className="card" style={{ padding: '0 12px' }}>
          {rows.map(({ m, club, tr }) => (
            <div key={m.id} className="mi" style={{ alignItems: 'flex-start', padding: '12px 0' }} onClick={() => onOpen && onOpen(m.id)}>
              <Ava name={m.name} />
              <div className="mi-info">
                <div className="mi-name">{m.name}</div>
                <div className="mi-sub" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <ClubChip info={club} />
                  <TrainerChip info={tr} />
                </div>
              </div>
              {!isTrainerRole && trainerId !== NONE && (
                <button
                  title="Прибрати зі списку тренера"
                  onClick={e => { e.stopPropagation(); unassign(m) }}
                  style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer', fontSize: 16, padding: 6 }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AssignModal
          members={members}
          trainers={trainers}
          trainerId={trainerId}
          onSave={async ids => { await assignTrainer(ids, trainerId); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

// Вибір клієнтів, яких закріпити за тренером
function AssignModal({ members, trainers, trainerId, onSave, onClose }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState([])
  const [saving, setSaving] = useState(false)

  const trainerName = id => (trainers.find(t => t.id === id) || {}).name || '—'

  const list = useMemo(() => {
    const s = q.toLowerCase().trim()
    return members
      .filter(m => m.trainerId !== trainerId)
      .filter(m => !s || (m.name || '').toLowerCase().includes(s))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'))
      .slice(0, 60)
  }, [members, trainerId, q])

  function toggle(id) {
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  async function save() {
    if (!picked.length) return
    setSaving(true)
    try { await onSave(picked) } finally { setSaving(false) }
  }

  return (
    <Modal title={`Додати клієнтів: ${trainerName(trainerId)}`} onClose={onClose}>
      <div className="sr">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input type="search" placeholder="Пошук клієнта..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 8 }}>
        Обрано: {picked.length}. Якщо клієнт уже закріплений за іншим тренером — він перейде до цього.
      </div>
      <div style={{ background: 'var(--s1)', borderRadius: 'var(--r)', border: '1px solid var(--brd)', padding: '0 12px', marginBottom: 14 }}>
        {list.length === 0 && <Empty text="Нікого не знайдено" />}
        {list.map(m => (
          <label key={m.id} className="mi" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} style={{ width: 17, height: 17, flexShrink: 0 }} />
            <Ava name={m.name} size={30} />
            <div className="mi-info">
              <div className="mi-name" style={{ fontSize: 14 }}>{m.name}</div>
              {m.trainerId && <div className="mi-sub">зараз у: {trainerName(m.trainerId)}</div>}
            </div>
          </label>
        ))}
      </div>
      <button className="btn btn-grn" onClick={save} disabled={saving || !picked.length}>
        {saving ? 'Збереження...' : `💾 Закріпити (${picked.length})`}
      </button>
    </Modal>
  )
}