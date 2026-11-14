import React, { useState, useEffect, useCallback } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MembersPage from './pages/MembersPage'
import MemberDetail from './pages/MemberDetail'
import CheckinPage from './pages/CheckinPage'
import SessionsPage from './pages/SessionsPage'
import FinancePage from './pages/FinancePage'
import TrainerClients from './pages/TrainerClients'
import { api } from './api'
import { LoadingOverlay, ReminderBanner, Tabs, Modal, FRow } from './components/UI'
import { useStore } from './hooks/useStore'
import DataTab from './components/DataTab'
import { ReminderModal } from './components/Extras'
import { getThemePref, setTheme, applyTheme, watchSystemTheme } from './theme'
import { uid, abonStatus, getActiveAbon, daysDiff, TODAY, refreshToday, isExtensionPayment } from './utils'

const PAGES = ['home', 'members', 'checkin', 'sessions', 'finance']

export default function App() {
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem('gym_token') || '',
    role: localStorage.getItem('gym_role') || '',
    name: localStorage.getItem('gym_uname') || '',
    uid: localStorage.getItem('gym_uid') || '',
  }))
  const [page, setPage] = useState('home')
  const [memberDetailId, setMemberDetailId] = useState(null)
  const [membersInitialTab, setMembersInitialTab] = useState('all')
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [, setDayTick] = useState(0)
  const [remindId, setRemindId] = useState(null)
  const [bellOpen, setBellOpen] = useState(false)

  const store = useStore()

  const isLoggedIn = !!auth.token && !!auth.role

  useEffect(() => watchSystemTheme(), [])

  useEffect(() => {
    document.body.classList.toggle('ro', !!store.readOnly)
    return () => document.body.classList.remove('ro')
  }, [store.readOnly])

  // Load data on login.
  // Прострочений токен (401) обробляє api.js — чистить сесію і перезавантажує.
  // Будь-яка інша помилка (немає мережі, сервер ще прокидається) — не привід
  // розлогінювати: показуємо повідомлення з кнопкою "Повторити".
  function loadData() {
    setLoadError('')
    return store.load().catch(e => setLoadError(e.message || 'Помилка мережі'))
  }
  useEffect(() => {
    if (isLoggedIn) loadData()
  }, [isLoggedIn])

  // Раз на хвилину і при поверненні в застосунок: оновлюємо "сьогодні"
  // (після півночі) і тихо підтягуємо зміни з інших пристроїв.
  useEffect(() => {
    if (!isLoggedIn) return
    function sync() {
      if (document.visibilityState !== 'visible') return
      if (refreshToday()) setDayTick(t => t + 1)
      store.refresh()
    }
    const interval = setInterval(sync, 60000)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [isLoggedIn, store.refresh])

  // Trainer goes to sessions by default
  useEffect(() => {
    if (auth.role === 'trainer' && page === 'home') setPage('sessions')
  }, [auth.role])

  // Автооновлення: якщо на сервері з'явився новий деплой (інша версія
  // білда) — застосунок сам перезавантажується. Перевіряємо періодично і
  // щоразу, коли повертаємось у застосунок (важливо для PWA на телефоні,
  // де вкладка може довго висіти "в фоні" зі старою версією).
  useEffect(() => {
    let baseVersion = null
    let cancelled = false

    async function checkVersion(canReload) {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const { version } = await res.json()
        if (baseVersion === null) {
          baseVersion = version
        } else if (version !== baseVersion && canReload) {
          window.location.reload()
        }
      } catch {}
    }

    checkVersion(false)
    // Періодично звіряємось у фоні (без перезавантаження, щоб не заважати
    // активній роботі), а реально оновлюємось лише тоді, коли людина
    // повертається у застосунок — відкриває вкладку/переключається назад.
    const interval = setInterval(() => checkVersion(false), 60000)
    function onVisible() { if (document.visibilityState === 'visible') checkVersion(true) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  // Гарячі клавіші (зручно на ПК): Ctrl/Cmd+K — пошук клієнтів, Esc — закрити вікно
  useEffect(() => {
    if (!isLoggedIn) return
    function onKeyDown(e) {
      const tag = (e.target && e.target.tagName) || ''
      if (e.key === 'Escape') {
        if (memberDetailId) { setMemberDetailId(null); return }
        if (page === 'settings') { setPage(auth.role === 'trainer' ? 'sessions' : 'home'); return }
        if (tag === 'INPUT' || tag === 'TEXTAREA') { e.target.blur() }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (auth.role === 'trainer') return // немає доступу до списку клієнтів
        navigate('members')
        setTimeout(() => {
          const el = document.querySelector('.pg input[type="search"]')
          if (el) { el.focus(); el.select() }
        }, 60)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLoggedIn, memberDetailId, page, auth.role])

  function handleLogin(data) {
    setAuth({ token: data.token || localStorage.getItem('gym_token'), role: data.role, name: data.name || '', uid: data.uid || '' })
  }

  function handleLogout() {
    localStorage.removeItem('gym_token')
    localStorage.removeItem('gym_role')
    localStorage.removeItem('gym_uname')
    localStorage.removeItem('gym_uid')
    setAuth({ token: '', role: '', name: '', uid: '' })
  }

  function navigate(to, extra) {
    if (to === 'member') {
      setMemberDetailId(extra)
      return
    }
    if (to === 'members' && extra) setMembersInitialTab(extra)
    setPage(to)
    setMemberDetailId(null)
  }

  // Member save
  async function onSaveMember(id, data) {
    const existing = store.members.find(m => m.id === id)
    if (existing) {
      const updated = { ...existing, ...data }
      await store.pushMembers([updated])
    } else {
      // Перевірка дублікатів при створенні нового клієнта
      const dup = store.members.find(m => m.name.trim().toLowerCase() === (data.name || '').trim().toLowerCase())
      if (dup) {
        const ok = window.confirm(`⚠️ Клієнт «${dup.name}» вже існує!\n\nСтворити ще одного з таким же іменем?`)
        if (!ok) return
      }
      const m = { id: uid(), ...data }
      await store.pushMembers([m])
    }
  }

  // Видалення платежу за абонемент має повертати борг: зменшуємо ab.paid на
  // суму платежу (платежі за продовження в paid не входять — їх не чіпаємо).
  async function deletePayment(id) {
    const p = store.payments.find(x => x.id === id)
    await store.deletePayment(id)
    if (p && p.kind === 'abon' && p.abonId && !isExtensionPayment(p)) {
      const ab = store.abons.find(a => a.id === p.abonId)
      if (ab && ab.paid) await store.pushAbons([{ ...ab, paid: Math.max(0, (ab.paid || 0) - (p.amount || 0)) }])
    }
  }

  async function onAddMember() {
    // open blank detail
    setMemberDetailId('__new__')
  }

  // Ending abons count
  const endingCount = store.members.filter(m => {
    const a = getActiveAbon(m.id, store.abons)
    return a && ['ending', 'expired'].includes(abonStatus(a))
  }).length

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin} />

  const role = auth.role
  const uname = auth.name
  const isOwner = role === 'owner'
  const isAdmin = role === 'owner' || role === 'admin' // будь-який тип адміністратора

  // Nav items
  const navItems = [
    {
      key: 'home', label: 'Головна',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    },
    ...(isAdmin ? [{
      key: 'members', label: 'Клієнти',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    }] : []),
    {
      key: 'checkin', label: 'Відмітити',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    },
    {
      key: 'sessions', label: 'Заняття',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    },
    {
      key: 'trainers', label: role === 'trainer' ? 'Клієнти' : 'Тренери',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
    },
    ...(isAdmin ? [{
      key: 'finance', label: 'Фінанси',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    }] : []),
  ]

  return (
    <>
      <LoadingOverlay show={store.loading} />

      {loadError && (
        <div style={{ background: 'rgba(255,51,102,.1)', border: '1px solid rgba(255,51,102,.35)', color: 'var(--red)', padding: '10px 14px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>⚠️ Не вдалося завантажити дані: {loadError}</span>
          <button className="btn-sm" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt)', borderRadius: 8, padding: '6px 10px', flexShrink: 0 }} onClick={loadData}>Повторити</button>
        </div>
      )}

      {store.readOnly && <div className="ro-banner">👁 Режим перегляду — змінювати дані не можна</div>}

      {/* Header */}
      {!memberDetailId && (
        <div className="hdr">
          <div style={{ minWidth: 0 }}>
            <p>{new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1>
              Привіт{uname ? ', ' + uname : ''}
              <svg className="hdr-wave" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11V6a2 2 0 114 0v5M11 11V4a2 2 0 114 0v7M15 11V6a2 2 0 114 0v8a7 7 0 01-7 7h-1a7 7 0 01-6-3.5L3 14a2 2 0 013.3-2.2L8 13"/></svg>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAdmin && (
              <button className="icon-sq bell-btn keep-ro" onClick={() => setBellOpen(true)} aria-label={`Сповіщення: ${endingCount}`} title="Сповіщення">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
                {endingCount > 0 && <span className="bell-badge">{endingCount > 9 ? '9+' : endingCount}</span>}
              </button>
            )}
            <button className="icon-sq keep-ro" onClick={loadData} title="Оновити" aria-label="Оновити">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            </button>
            <button className="icon-sq keep-ro" onClick={() => setPage('settings')} title="Налаштування" aria-label="Налаштування">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Member detail */}
      {memberDetailId && memberDetailId !== '__new__' && (
        <MemberDetail
          key={memberDetailId}
          memberId={memberDetailId}
          members={store.members}
          abons={store.abons}
          payments={store.payments}
          role={role}
          uname={uname}
          onBack={() => setMemberDetailId(null)}
          onSaveMember={onSaveMember}
          onDeleteMember={async (id) => { await store.deleteMember(id) }}
          pushAbons={store.pushAbons}
          pushPayment={store.pushPayment}
          deletePayment={deletePayment}
          unlinkCard={store.unlinkCard}
          loading={store.loading}
        />
      )}

      {/* New member */}
      {memberDetailId === '__new__' && (
        <NewMemberModal
          onSave={async (data) => {
            const m = { id: uid(), ...data }
            await store.pushMembers([m])
            setMemberDetailId(null)
          }}
          onClose={() => setMemberDetailId(null)}
        />
      )}

      {/* Pages */}
      {!memberDetailId && (
        <div>
          {page === 'home' && (
            <HomePage
              members={store.members}
              abons={store.abons}
              payments={store.payments}
              role={role}
              uname={uname}
              trainers={store.trainers}
              onNavigate={navigate}
              onAddMember={() => setMemberDetailId('__new__')}
              onRemind={(id) => setRemindId(id)}
            />
          )}
          {page === 'members' && isAdmin && (
            <MembersPage
              members={store.members}
              abons={store.abons}
              role={role}
              isOwner={isOwner}
              initialTab={membersInitialTab}
              trainers={store.trainers}
              onOpen={(id) => setMemberDetailId(id)}
              onAdd={() => setMemberDetailId('__new__')}
              onDeleteMany={store.deleteMembers}
              onDeleteMember={async (id) => { await store.deleteMember(id); }}
            />
          )}
          {page === 'checkin' && (
            <CheckinPage
              members={store.members}
              abons={store.abons}
              payments={store.payments}
              role={role}
              uname={uname}
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'sessions' && (
            <SessionsPage
              members={store.members}
              abons={store.abons}
              payments={store.payments}
              role={role}
              uname={uname}
              myTerms={store.myTerms}
              trainers={store.trainers}
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'trainers' && (
            <TrainerClients
              members={store.members}
              abons={store.abons}
              trainers={store.trainers}
              role={role}
              uid={auth.uid}
              assignTrainer={store.assignTrainer}
              onOpen={(id) => setMemberDetailId(id)}
            />
          )}
          {page === 'finance' && isAdmin && (
            <FinancePage
              members={store.members}
              abons={store.abons}
              payments={store.payments}
              manualDebts={store.manualDebts}
              role={role}
              uname={uname}
              users={store.users}
              shifts={store.shifts}
              pushShifts={store.pushShifts}
              deletePayment={deletePayment}
              saveManualDebt={store.saveManualDebt}
              payManualDebt={store.payManualDebt}
              deleteManualDebt={store.deleteManualDebt}
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              onReset={store.load} isOwner={isOwner}
              onLogout={handleLogout} uname={uname} role={role}
              members={store.members} pushMembers={store.pushMembers} updateUserReadOnly={store.updateUserReadOnly}
              myColor={((store.trainers || []).find(t => t.id === auth.uid) || (store.users || []).find(u => u.id === auth.uid) || {}).color || ''}
              saveMyColor={(c) => store.updateMyColor(auth.uid, c)}
              users={store.users} auditLog={store.auditLog}
              createUser={store.createUser} deleteUser={store.deleteUser} changeUserPassword={store.changeUserPassword} updateUserColor={store.updateUserColor} updateUserTerms={store.updateUserTerms}
              abons={store.abons} pushAbons={store.pushAbons}
              currentUid={auth.uid}
            />
          )}
        </div>
      )}

      {bellOpen && isAdmin && (
        <NotifSheet
          members={store.members} abons={store.abons}
          onClose={() => setBellOpen(false)}
          onOpenMember={(id) => { setBellOpen(false); setMemberDetailId(id) }}
          onRemind={(id) => { setBellOpen(false); setRemindId(id) }}
          onAll={() => { setBellOpen(false); navigate('members', 'ending') }}
        />
      )}

      {remindId && (() => {
        const m = store.members.find(x => x.id === remindId)
        return m ? <ReminderModal member={m} abons={store.abons} payments={store.payments} onClose={() => setRemindId(null)} /> : null
      })()}

      {/* Bottom nav */}
      {!memberDetailId && (
        <nav className="nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nb ${page === item.key ? 'on' : ''}`}
              onClick={() => { setPage(item.key); setMemberDetailId(null); if (item.key === 'members') setMembersInitialTab('all') }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </>
  )
}

// ── Сповіщення (дзвіночок): абонементи, що закінчуються / закінчились ──────────
function NotifSheet({ members, abons, onClose, onOpenMember, onRemind, onAll }) {
  const rows = members.map(m => {
    const a = getActiveAbon(m.id, abons)
    const st = a ? abonStatus(a) : null
    if (st !== 'expired' && st !== 'ending') return null
    const d = st === 'ending' ? daysDiff(TODAY, a.endDate) : 0
    return { m, a, st, d }
  }).filter(Boolean).sort((x, y) => (x.st === y.st ? (x.a.endDate || '').localeCompare(y.a.endDate || '') : x.st === 'expired' ? -1 : 1))

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Сповіщення">
        <div className="sheet-grip" />
        <div className="sheet-h">
          <span>Сповіщення</span>
          <button className="sheet-x" onClick={onClose} aria-label="Закрити">✕</button>
        </div>
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: '26px 0' }}>✅ Усе добре — нічого не закінчується</div>
        ) : (
          <div className="sheet-list">
            {rows.slice(0, 12).map(({ m, a, st, d }) => (
              <div key={m.id} className="sheet-row" onClick={() => onOpenMember(m.id)}>
                <span className="sheet-dot" style={{ background: st === 'expired' ? 'var(--red)' : 'var(--ylw)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                    {st === 'expired' ? (a.type === 'month' ? 'Закінчився ' + a.endDate.split('-').reverse().join('.') : 'Разовий використано') : `Закінчується ${a.endDate.split('-').reverse().join('.')} · ${d === 0 ? 'сьогодні' : 'через ' + d + ' дн.'}`}
                  </div>
                </div>
                {m.phone && <button className="sheet-btn" onClick={e => { e.stopPropagation(); onRemind(m.id) }} aria-label="Нагадати клієнту">💬</button>}
              </div>
            ))}
          </div>
        )}
        {rows.length > 0 && <button className="btn btn-acc" style={{ marginTop: 12 }} onClick={onAll}>Показати всіх ({rows.length}) →</button>}
      </div>
    </div>
  )
}

// ── New member modal ──────────────────────────────────────────────────────────
function NewMemberModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isTrainer, setIsTrainer] = useState(false)
  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto' }}>
      <div className="mhdr">
        <button className="back" onClick={onClose}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Новий клієнт</span>
      </div>
      <div style={{ padding: 14 }}>
        <div className="frow">
          <div className="flabel">ПІБ</div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Прізвище Ім'я" />
        </div>
        <div className="frow">
          <div className="flabel">Телефон</div>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..." />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--txt2)', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={isTrainer} onChange={e => setIsTrainer(e.target.checked)} style={{ width: 17, height: 17 }} />
          👔 Це тренер
        </label>
        <button className="btn btn-grn" onClick={() => { if (!name.trim()) { alert('Введіть ПІБ'); return } onSave({ name: name.trim(), phone: phone.trim(), isTrainer }) }}>
          💾 Зберегти
        </button>
      </div>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────
function SettingsPage({ myColor, saveMyColor, onReset, onLogout, uname, role, members, pushMembers, updateUserReadOnly, isOwner, users, auditLog, createUser, deleteUser, changeUserPassword, updateUserColor, updateUserTerms, abons, pushAbons, currentUid }) {
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('view')
  const [theme, setThemeState] = useState(getThemePref())
  function pickTheme(t) { setTheme(t); setThemeState(t) }

  async function resetAbons() {
    if (!confirm('Скинути всі абонементи? Платежі залишаться.')) return
    setLoading(true)
    try {
      await api('/abons/reset', 'POST') // кидає помилку, якщо сервер відмовив
      await onReset()
      alert('✅ Абонементи скинуто')
    } finally { setLoading(false) }
  }

  async function resetPayments() {
    if (!confirm('Скинути всі платежі?')) return
    setLoading(true)
    try {
      await api('/payments/reset', 'POST')
      await onReset()
      alert('✅ Касу скинуто')
    } finally { setLoading(false) }
  }

  async function resetAll() {
    if (!confirm('⚠️ Скинути ВСЕ? Клієнти, абонементи, платежі — все буде видалено!')) return
    if (!confirm('Ви впевнені? Це незворотно!')) return
    setLoading(true)
    try {
      await api('/reset/all', 'POST')
      await onReset()
      alert('✅ Все скинуто')
    } finally { setLoading(false) }
  }

  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>⚙️ Налаштування</div>

      {isOwner && (
        <Tabs
          tabs={[{ key: 'view', label: 'Вигляд' }, { key: 'accounts', label: 'Акаунти' }, { key: 'data', label: 'Дані' }, { key: 'log', label: 'Журнал дій' }, { key: 'danger', label: 'Небезпечна зона' }]}
          active={tab} onChange={setTab}
        />
      )}

      {(tab === 'view' || !isOwner) && (
        <>
          <div className="card keep-ro">
            <div className="ct">Тема</div>
            <div className="method-toggle">
              <button className={`method-btn ${theme === 'light' ? 'on-card' : ''}`} onClick={() => pickTheme('light')}>☀️ Світла</button>
              <button className={`method-btn ${theme === 'dark' ? 'on-card' : ''}`} onClick={() => pickTheme('dark')}>🌙 Темна</button>
              <button className={`method-btn ${theme === 'auto' ? 'on-card' : ''}`} onClick={() => pickTheme('auto')}>🔄 Авто</button>
            </div>
          </div>
          <div className="card keep-ro">
            <div className="ct">Мій колір</div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 10, lineHeight: 1.5 }}>
              Цим кольором позначається твоє ім'я на заняттях, у фінансах і в списках клієнтів.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {['#FFC000', '#5B9BD5', '#ED7D31', '#70AD47', '#FF3366', '#7C5DF5', '#A5A5A5'].map(c => (
                <button key={c} aria-label={'Колір ' + c} onClick={() => saveMyColor(c).catch(e => alert(e.message))}
                  style={{ width: 38, height: 38, borderRadius: '50%', background: c, cursor: 'pointer', border: (myColor || '').toLowerCase() === c.toLowerCase() ? '3px solid var(--txt)' : '2px solid var(--brd)', transition: 'transform .15s' }} />
              ))}
            </div>
          </div>
          <div className="card keep-ro">
            <div className="ct">Акаунт</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              {role === 'owner' ? '👑 Головний адмін' : role === 'admin' ? '🛠 Адмін' : '🏋️ Тренер'} <b>{uname}</b>
            </div>
            <button className="btn btn-red keep-ro" onClick={onLogout}>🚪 Вийти з акаунта</button>
          </div>
        </>
      )}

      {isOwner && tab === 'accounts' && (
        <AccountsTab updateUserReadOnly={updateUserReadOnly} users={users} createUser={createUser} deleteUser={deleteUser} changeUserPassword={changeUserPassword} updateUserColor={updateUserColor} updateUserTerms={updateUserTerms} abons={abons} pushAbons={pushAbons} currentUid={currentUid} />
      )}

      {isOwner && tab === 'data' && <DataTab members={members} abons={abons} pushMembers={pushMembers} onReload={onReset} />}

      {isOwner && tab === 'log' && <AuditLogTab auditLog={auditLog} />}

      {isOwner && tab === 'danger' && (
        <div className="card">
          <div className="ct">Небезпечна зона</div>
          <button className="btn btn-ylw" style={{ marginBottom: 8 }} onClick={resetAbons} disabled={loading}>🔄 Скинути абонементи</button>
          <button className="btn btn-ylw" style={{ marginBottom: 8 }} onClick={resetPayments} disabled={loading}>💸 Скинути касу</button>
          <button className="btn btn-red" onClick={resetAll} disabled={loading}>🗑 Скинути все</button>
        </div>
      )}

      {!isOwner && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--txt2)' }}>
          Керування акаунтами, резервні копії та журнал дій доступні лише головному адміну.
        </div>
      )}
    </div>
  )
}

// ── Accounts management (owner only) ───────────────────────────────────────────
function AccountsTab({ updateUserReadOnly, users, createUser, deleteUser, changeUserPassword, updateUserColor, updateUserTerms, abons, pushAbons, currentUid }) {
  const [showAdd, setShowAdd] = useState(false)
  const [pwdFor, setPwdFor] = useState(null) // user id, для зміни пароля
  const [colorFor, setColorFor] = useState(null) // user id, для зміни кольору
  const [busyId, setBusyId] = useState(null)
  const [termsFor, setTermsFor] = useState(null) // user id, для умов оплати

  const ROLE_LABEL = { owner: '👑 Головний адмін', admin: '🛠 Адмін', trainer: '🏋️ Тренер' }

  function trainerAbons(u) {
    const key = u.name || u.login
    return (abons || []).filter(a => a.type === 'trainer' && !a.deleted && a.sessionsLeft > 0 && a.trainer === key)
  }

  async function freezeAll(u) {
    const list = trainerAbons(u).filter(a => !a.frozen)
    if (!list.length) { alert('Немає активних абонементів для заморозки'); return }
    if (!confirm(`Заморозити ${list.length} абонемент(ів) тренера ${u.name || u.login}? Клієнти не зможуть списувати заняття, поки не розморозиш.`)) return
    setBusyId(u.id)
    try {
      await pushAbons(list.map(a => ({ ...a, frozen: true, freezeStart: TODAY })))
    } finally { setBusyId(null) }
  }

  async function unfreezeAll(u) {
    const list = trainerAbons(u).filter(a => a.frozen)
    if (!list.length) return
    setBusyId(u.id)
    try {
      await pushAbons(list.map(a => {
        const frozenDays = daysDiff(a.freezeStart || a.startDate, TODAY)
        return { ...a, frozen: false, freezeStart: null, extraDays: (a.extraDays || 0) + frozenDays }
      }))
    } finally { setBusyId(null) }
  }

  return (
    <div className="card">
      <div className="ct">Акаунти ({(users||[]).length})</div>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 12, lineHeight: 1.5 }}>
        🎨 Колір акаунта: у табелі та біля тренера на заняттях, у фінансах і в списках клієнтів. 👁 — режим «лише перегляд» (акаунт бачить усе, але нічого не змінює).
      </div>
      {(users||[]).map(u => {
        const list = trainerAbons(u)
        const frozenCount = list.filter(a => a.frozen).length
        const activeCount = list.length - frozenCount
        return (
          <div key={u.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--brd)' }}>
            <div className="irow" style={{ padding: 0, border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  title="Змінити колір"
                  onClick={() => setColorFor(u.id)}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: u.color || '#FFC000', border: '2px solid var(--brd)', cursor: updateUserColor ? 'pointer' : 'default', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{u.name || u.login} <span style={{ color: 'var(--txt2)', fontSize: 12 }}>@{u.login}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{ROLE_LABEL[u.role] || u.role}{u.readOnly ? ' · 👁 лише перегляд' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {u.role !== 'owner' && updateUserReadOnly && (
                  <button className="btn-sm keep-ro" title={u.readOnly ? 'Режим перегляду увімкнено — натисни, щоб дозволити зміни' : 'Дозволено змінювати — натисни, щоб лишити лише перегляд'}
                    style={{ background: u.readOnly ? 'rgba(91,141,246,.15)' : 'var(--s2)', border: '1px solid ' + (u.readOnly ? 'rgba(91,141,246,.5)' : 'var(--brd)'), color: u.readOnly ? 'var(--acc)' : 'var(--txt2)', borderRadius: 8, padding: '6px 10px' }}
                    disabled={busyId === u.id}
                    onClick={async () => { setBusyId(u.id); try { await updateUserReadOnly(u.id, !u.readOnly) } finally { setBusyId(null) } }}
                  >👁</button>
                )}
                {u.role === 'trainer' && updateUserTerms && (
                  <button className="btn-sm" title="Умови оплати" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt2)', borderRadius: 8, padding: '6px 10px' }} onClick={() => setTermsFor(u.id)}>💰</button>
                )}
                <button className="btn-sm" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt2)', borderRadius: 8, padding: '6px 10px' }} onClick={() => setPwdFor(u.id)}>🔑</button>
                {u.id !== currentUid && (
                  <button className="btn-sm" style={{ background: 'rgba(255,51,102,.1)', border: '1px solid rgba(255,51,102,.3)', color: 'var(--red)', borderRadius: 8, padding: '6px 10px' }}
                    onClick={() => { if (confirm(`Видалити акаунт «${u.login}»?`)) deleteUser(u.id) }}
                  >🗑</button>
                )}
              </div>
            </div>
            {u.role === 'trainer' && list.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 32 }}>
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
                  🎫 {activeCount} активних{frozenCount > 0 ? `, ❄️ ${frozenCount} заморожено` : ''}
                </span>
                {activeCount > 0 && (
                  <button
                    className="btn-sm" disabled={busyId === u.id}
                    style={{ background: 'rgba(91,141,246,.1)', border: '1px solid rgba(91,141,246,.3)', color: 'var(--acc)', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}
                    onClick={() => freezeAll(u)}
                  >❄️ Заморозити всі</button>
                )}
                {frozenCount > 0 && (
                  <button
                    className="btn-sm" disabled={busyId === u.id}
                    style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt)', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}
                    onClick={() => unfreezeAll(u)}
                  >▶️ Розморозити всі</button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button className="btn btn-acc" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>+ Новий акаунт</button>

      {showAdd && <AddUserModal onSave={async (data) => { await createUser(data); setShowAdd(false) }} onClose={() => setShowAdd(false)} />}
      {pwdFor && <ChangePasswordModal onSave={async (pwd) => { await changeUserPassword(pwdFor, pwd); setPwdFor(null) }} onClose={() => setPwdFor(null)} />}
      {termsFor && updateUserTerms && (
        <TrainerTermsModal
          user={(users || []).find(u => u.id === termsFor)}
          onSave={async (terms) => { await updateUserTerms(termsFor, terms); setTermsFor(null) }}
          onClose={() => setTermsFor(null)}
        />
      )}
      {colorFor && updateUserColor && (
        <ColorPickerModal
          initial={(users.find(u => u.id === colorFor) || {}).color || '#FFC000'}
          onSave={async (color) => { await updateUserColor(colorFor, color); setColorFor(null) }}
          onClose={() => setColorFor(null)}
        />
      )}
    </div>
  )
}

function TrainerTermsModal({ user, onSave, onClose }) {
  const [pct, setPct] = useState(user?.trainerPct != null ? String(Math.round(user.trainerPct * 100)) : '')
  const [fee, setFee] = useState(user?.hallFee != null ? String(user.hallFee) : '')
  const [splitFee, setSplitFee] = useState(user?.splitHallFee != null ? String(user.splitHallFee) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    const pctNum = pct.trim() === '' ? null : Number(pct)
    if (pctNum !== null && !(pctNum > 0 && pctNum < 100)) { alert('Відсоток має бути від 1 до 99'); return }
    const feeNum = fee.trim() === '' ? null : Number(fee)
    if (feeNum !== null && !(feeNum >= 0)) { alert('Сума за зал не може бути відʼємною'); return }
    const splitNum = splitFee.trim() === '' ? null : Number(splitFee)
    if (splitNum !== null && !(splitNum >= 0)) { alert('Сума за зал (спліт) не може бути відʼємною'); return }

    setSaving(true)
    try {
      await onSave({
        trainerPct: pctNum === null ? null : pctNum / 100,
        hallFee: feeNum,
        splitHallFee: splitNum,
      })
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`💰 Умови оплати — ${user?.name || user?.login || ''}`} onClose={onClose}>
      <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16, lineHeight: 1.6 }}>
        Індивідуальні умови для цього тренера. Залиш поле порожнім, щоб діяли загальні значення (60% тренеру, 150 грн зал, 20 грн зал за спліт).
      </div>
      <FRow label="Відсоток тренера (%)">
        <input type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="60 (за замовчуванням)" min={1} max={99} />
      </FRow>
      <FRow label="Сума за зал — звичайне заняття (грн)">
        <input type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="150 (за замовчуванням)" min={0} />
      </FRow>
      <FRow label="Сума за зал — спліт, з кожного (грн)">
        <input type="number" value={splitFee} onChange={e => setSplitFee(e.target.value)} placeholder="20 (за замовчуванням)" min={0} />
      </FRow>
      <button className="btn btn-grn" onClick={save} disabled={saving}>
        {saving ? 'Збереження...' : '💾 Зберегти умови'}
      </button>
    </Modal>
  )
}

function ColorPickerModal({ initial, onSave, onClose }) {
  const [color, setColor] = useState(initial)
  const presets = ['#FFC000', '#5B9BD5', '#ED7D31', '#70AD47', '#FF3366', '#7C5DF5', '#A5A5A5']
  return (
    <Modal title="🎨 Колір акаунта" onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {presets.map(c => (
          <button
            key={c} onClick={() => setColor(c)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--txt)' : '2px solid var(--brd)', cursor: 'pointer' }}
          />
        ))}
      </div>
      <FRow label="Або вибери довільний колір">
        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 44, padding: 4, cursor: 'pointer' }} />
      </FRow>
      <button className="btn btn-grn" onClick={() => onSave(color)}>💾 Зберегти колір</button>
    </Modal>
  )
}

function AddUserModal({ onSave, onClose }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('admin')
  const [color, setColor] = useState('#FFC000')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const presets = ['#FFC000', '#5B9BD5', '#ED7D31', '#70AD47', '#FF3366', '#7C5DF5', '#A5A5A5']

  async function save() {
    if (!login.trim() || !password) { setError('Заповніть логін і пароль'); return }
    if (password.length < 4) { setError('Пароль має бути не менше 4 символів'); return }
    setSaving(true); setError('')
    try {
      await onSave({ login: login.trim(), password, name: name.trim(), role, color })
    } catch (e) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto' }}>
      <div className="mhdr"><button className="back" onClick={onClose}>← Назад</button><span style={{ fontWeight: 600 }}>Новий акаунт</span></div>
      <div style={{ padding: 14 }}>
        <div className="frow">
          <div className="flabel">Роль</div>
          <div className="method-toggle">
            <button className={`method-btn ${role === 'admin' ? 'on-card' : ''}`} onClick={() => setRole('admin')}>🛠 Адмін</button>
            <button className={`method-btn ${role === 'trainer' ? 'on-cash' : ''}`} onClick={() => setRole('trainer')}>🏋️ Тренер</button>
          </div>
        </div>
        <div className="frow"><div className="flabel">Логін</div><input type="text" value={login} onChange={e => setLogin(e.target.value)} placeholder="напр: admin2" autoComplete="off" /></div>
        <div className="frow"><div className="flabel">Пароль</div><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="мінімум 4 символи" autoComplete="new-password" /></div>
        <div className="frow"><div className="flabel">Ім'я (відображається)</div><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="напр: Олена" /></div>
        <div className="frow">
          <div className="flabel">🎨 Колір (для табеля)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {presets.map(c => (
              <button
                key={c} onClick={() => setColor(c)}
                style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--txt)' : '2px solid var(--brd)', cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-grn" onClick={save} disabled={saving}>{saving ? 'Збереження...' : '💾 Створити акаунт'}</button>
      </div>
    </div>
  )
}

function ChangePasswordModal({ onSave, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (password.length < 4) { setError('Пароль має бути не менше 4 символів'); return }
    setSaving(true); setError('')
    try { await onSave(password) } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fullscreen" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, overflowY: 'auto' }}>
      <div className="mhdr"><button className="back" onClick={onClose}>← Назад</button><span style={{ fontWeight: 600 }}>Новий пароль</span></div>
      <div style={{ padding: 14 }}>
        <div className="frow"><div className="flabel">Пароль</div><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="мінімум 4 символи" autoComplete="new-password" /></div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-grn" onClick={save} disabled={saving}>{saving ? 'Збереження...' : '🔑 Змінити пароль'}</button>
      </div>
    </div>
  )
}

// ── Audit log (owner only) ──────────────────────────────────────────────────────
function AuditLogTab({ auditLog }) {
  const ACTION_LABEL = {
    member_delete: '🗑 Видалено клієнта',
    members_delete_many: '🗑 Видалено клієнтів',
    member_edit: '✏️ Змінено дані клієнта',
    abon_deactivate: '🧾 Стерто абонемент',
    payment_delete: '💸 Видалено платіж',
    reset_abons: '🔄 Скинуто абонементи',
    reset_payments: '💸 Скинуто касу',
    reset_all: '⚠️ Скинуто всю базу',
    user_create: '➕ Створено акаунт',
    user_delete: '🗑 Видалено акаунт',
    user_password_change: '🔑 Змінено пароль акаунта',
    user_readonly: '👁 Змінено режим «лише перегляд»',
    backup_create: '💾 Створено резервну копію',
    backup_restore: '↩️ Відновлено з резервної копії',
    abon_auto_unfreeze: '▶️ Авто-розморозка абонемента',
    backup_restore_file: '↩️ Відновлено з файлу копії',
  }

  function describe(entry) {
    const d = entry.details || {}
    switch (entry.action) {
      case 'member_delete': return d.name || '—'
      case 'members_delete_many': return (d.names || []).join(', ') || `${d.count} клієнт(ів)`
      case 'member_edit': return `${d.from?.name || '?'} → ${d.to?.name || '?'}`
      case 'abon_deactivate': return `${d.memberName || '?'} (${d.abonType === 'month' ? 'місячний' : 'разовий'})`
      case 'payment_delete': return `${d.memberName || '?'} · ${d.amount} грн · ${d.date || ''}`
      case 'user_create': case 'user_delete': case 'user_password_change': return `@${d.login || '?'}`
      case 'user_readonly': return `@${d.login || '?'} → ${d.readOnly ? 'лише перегляд' : 'повний доступ'}`
      case 'abon_auto_unfreeze': return `${d.days || 0} дн. додано`
      default: return ''
    }
  }

  return (
    <div className="card">
      <div className="ct">Журнал дій ({(auditLog||[]).length})</div>
      {(!auditLog || auditLog.length === 0) ? (
        <div className="empty">Подій ще немає</div>
      ) : auditLog.map(entry => (
        <div key={entry.id} className="irow">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{ACTION_LABEL[entry.action] || entry.action}</div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{describe(entry)}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{entry.by}</div>
            <div style={{ fontSize: 11, color: 'var(--txt2)' }}>{new Date(entry.at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </div>
  )
}