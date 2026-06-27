import React, { useState, useMemo } from 'react'
import { abonStatus, getActiveAbon, visitedTodayAny, STATUS_LABEL, STATUS_TAG } from '../utils'
import { Ava, Tabs, Empty } from '../components/UI'

const TABS = [
  { key: 'all', label: 'Всі' },
  { key: 'active', label: 'Активні' },
  { key: 'frozen', label: 'Заморожені' },
  { key: 'ending', label: 'Закінчується' },
  { key: 'checked', label: 'Сьогодні' },
]

export default function MembersPage({ members, abons, role, onOpen, onAdd, onDeleteMany, onDeleteMember, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [sortVal, setSortVal] = useState('name')
  const [sortOpen, setSortOpen] = useState(false)

  const shown = useMemo(() => {
    let list = [...members]
    const q = query.toLowerCase().trim()
    if (q) list = list.filter(m => m.name.toLowerCase().includes(q))
    if (tab === 'active')  list = list.filter(m => { const a = getActiveAbon(m.id, abons); return a && abonStatus(a) === 'active' })
    if (tab === 'frozen')  list = list.filter(m => { const a = getActiveAbon(m.id, abons); return a && a.frozen })
    if (tab === 'ending')  list = list.filter(m => { const a = getActiveAbon(m.id, abons); return a && ['ending','expired'].includes(abonStatus(a)) })
    if (tab === 'checked') list = list.filter(m => visitedTodayAny(m.id, abons))

    if (sortVal === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    } else if (sortVal === 'end-asc' || sortVal === 'end-desc') {
      list.sort((a, b) => {
        const aa = getActiveAbon(a.id, abons), bb = getActiveAbon(b.id, abons)
        const da = (aa && aa.endDate) ? aa.endDate : (sortVal === 'end-asc' ? '9999' : '0000')
        const db = (bb && bb.endDate) ? bb.endDate : (sortVal === 'end-asc' ? '9999' : '0000')
        return sortVal === 'end-asc' ? da.localeCompare(db) : db.localeCompare(da)
      })
    }
    return list
  }, [members, abons, tab, query, sortVal])

  // Duplicate groups
  const dupGroups = useMemo(() => {
    const groups = {}
    members.forEach(m => {
      const key = m.name.trim().toLowerCase()
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return Object.values(groups).filter(g => g.length > 1)
  }, [members])

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === shown.length) setSelected(new Set())
    else setSelected(new Set(shown.map(m => m.id)))
  }

  async function deleteSelected() {
    if (!selected.size) return
    const names = [...selected].map(id => members.find(m => m.id === id)?.name || id)
    if (!confirm(`Видалити ${selected.size} клієнт(ів)?\n${names.join(', ')}\n\nЦю дію неможливо скасувати!`)) return
    await onDeleteMany([...selected])
    setSelected(new Set())
  }

  return (
    <div className="pg" style={{ paddingTop: 0 }}>
      {/* Search */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, paddingTop: 14, paddingBottom: 4 }}>
        <div className="sr">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="search" placeholder="Пошук клієнта..."
            value={query} onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-acc" style={{ flex: 1, padding: 12, fontSize: 15 }} onClick={onAdd}>
            + Новий клієнт
          </button>
          <button
            onClick={() => setShowDuplicates(true)}
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: 'var(--r2)', background: 'var(--s1)', border: '1px solid var(--brd)', color: dupGroups.length ? 'var(--ylw)' : 'var(--txt2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', position: 'relative' }}
          >
            👥 Дублі{dupGroups.length > 0 && <span style={{ marginLeft: 4, background: 'var(--ylw)', color: '#000', borderRadius: 8, padding: '1px 5px', fontSize: 11 }}>{dupGroups.length}</span>}
          </button>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setSortOpen(o => !o)}
              style={{ padding: '0 14px', height: '100%', borderRadius: 'var(--r2)', background: 'var(--s1)', border: '1px solid var(--brd)', color: 'var(--txt)', fontSize: 18, cursor: 'pointer' }}
            >⇅</button>
            {sortOpen && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--s2)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: 6, zIndex: 200, minWidth: 230, boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                <div style={{ fontSize: 11, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.6px', padding: '6px 8px 4px' }}>Сортування</div>
                {[
                  ['name', "А → Я (ім'я)"],
                  ['end-asc', 'Закінчується — спочатку раніше'],
                  ['end-desc', 'Закінчується — спочатку пізніше'],
                ].map(([v, l]) => (
                  <div
                    key={v}
                    className="sort-opt"
                    onClick={() => { setSortVal(v); setSortOpen(false) }}
                    style={{
                      padding: '10px 12px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                      color: sortVal === v ? 'var(--acc)' : 'var(--txt)',
                      background: sortVal === v ? 'rgba(91,141,246,.15)' : 'transparent'
                    }}
                  >{l}{sortVal === v ? ' ✓' : ''}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setSelected(new Set()) }} />
      </div>

      {/* Bulk bar */}
      {role === 'admin' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          padding: '8px 0', borderBottom: '1px solid var(--brd)'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--txt2)', cursor: 'pointer' }}>
            <input type="checkbox"
              checked={selected.size > 0 && selected.size === shown.length}
              onChange={selectAll}
              style={{ width: 16, height: 16 }}
            />
            Вибрати всіх ({shown.length})
          </label>
          {selected.size > 0 && (
            <button className="btn-sm btn-red btn" style={{ marginLeft: 'auto', width: 'auto' }} onClick={deleteSelected}>
              🗑 Видалити ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div key={tab} style={{ animation: 'fadeIn .2s ease both' }}>
        {shown.length === 0 ? (
          <Empty />
        ) : (
          shown.map(m => {
            const ab = getActiveAbon(m.id, abons)
            const st = ab ? abonStatus(ab) : null
            return (
              <div key={m.id} className="mi" onClick={() => onOpen(m.id)}>
                {role === 'admin' && (
                  <input type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={e => toggleSelect(m.id, e)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 17, height: 17, flexShrink: 0 }}
                  />
                )}
                <Ava name={m.name} />
                <div className="mi-info">
                  <div className="mi-name">{m.name}</div>
                  <div className="mi-sub">{m.phone || (st ? STATUS_LABEL[st] : 'Без абонементу')}</div>
                </div>
                <span className={`ai-tag ${st ? STATUS_TAG[st] : 'tag-gray'}`}>
                  {st ? STATUS_LABEL[st] : '—'}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Duplicates modal */}
      {showDuplicates && (
        <DuplicatesModal
          dupGroups={dupGroups}
          abons={abons}
          onDelete={async (id) => { await onDeleteMember(id) }}
          onClose={() => setShowDuplicates(false)}
        />
      )}
    </div>
  )
}

// ── Duplicates modal ──────────────────────────────────────────────────────────
function DuplicatesModal({ dupGroups, abons, onDelete, onClose }) {
  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto', paddingBottom: 40 }}>
      <div className="mhdr">
        <button className="back" onClick={onClose}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>👥 Дублікати</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
            {dupGroups.length > 0 ? `${dupGroups.length} груп з дублікатами` : 'дублікатів не знайдено'}
          </div>
        </div>
      </div>
      <div style={{ padding: 14 }}>
        {dupGroups.length === 0 ? (
          <div className="empty">✅ Всі клієнти унікальні</div>
        ) : (
          dupGroups.map((group, gi) => (
            <div key={gi} className="card" style={{ marginBottom: 12 }}>
              <div className="ct">{group[0].name} — {group.length} записи</div>
              {group.map(m => {
                const ab = getActiveAbon(m.id, abons)
                const st = ab ? abonStatus(ab) : null
                const stColor = st === 'active' ? 'var(--grn)' : st === 'ending' ? 'var(--ylw)' : 'var(--txt2)'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--brd)' }}>
                    <Ava name={m.name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: stColor }}>
                        {st ? STATUS_LABEL[st] : 'Без абонементу'}{m.phone ? ' · ' + m.phone : ''}
                        {ab && ` · ${ab.type === 'trainer' ? ab.sessionsLeft + ' занять' : ab.endDate}`}
                      </div>
                    </div>
                    <button
                      className="icon-btn del"
                      title="Видалити"
                      onClick={async () => {
                        const hasAbon = !!ab
                        const warn = hasAbon ? '\n⚠️ Є активний абонемент!' : ''
                        if (!confirm(`Видалити «${m.name}»?${warn}\nЦю дію не можна скасувати.`)) return
                        await onDelete(m.id)
                      }}
                    >🗑️</button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}