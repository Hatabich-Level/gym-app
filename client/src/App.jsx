import React, { useState, useEffect, useCallback } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MembersPage from './pages/MembersPage'
import MemberDetail from './pages/MemberDetail'
import CheckinPage from './pages/CheckinPage'
import SessionsPage from './pages/SessionsPage'
import FinancePage from './pages/FinancePage'
import { LoadingOverlay, ReminderBanner } from './components/UI'
import { useStore } from './hooks/useStore'
import { uid, abonStatus, getActiveAbon, TODAY } from './utils'

const PAGES = ['home', 'members', 'checkin', 'sessions', 'finance']

export default function App() {
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem('gym_token') || '',
    role: localStorage.getItem('gym_role') || '',
    name: localStorage.getItem('gym_uname') || '',
  }))
  const [page, setPage] = useState('home')
  const [memberDetailId, setMemberDetailId] = useState(null)
  const [membersInitialTab, setMembersInitialTab] = useState('all')
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const store = useStore()

  const isLoggedIn = !!auth.token && !!auth.role

  // Load data on login
  useEffect(() => {
    if (isLoggedIn) {
      store.load().catch(() => {
        // Token expired
        handleLogout()
      })
    }
  }, [isLoggedIn])

  // Trainer goes to sessions by default
  useEffect(() => {
    if (auth.role === 'trainer' && page === 'home') setPage('sessions')
  }, [auth.role])

  function handleLogin(data) {
    setAuth({ token: data.token || localStorage.getItem('gym_token'), role: data.role, name: data.name || '' })
  }

  function handleLogout() {
    localStorage.removeItem('gym_token')
    localStorage.removeItem('gym_role')
    localStorage.removeItem('gym_uname')
    setAuth({ token: '', role: '', name: '' })
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

  // Nav items
  const navItems = [
    {
      key: 'home', label: 'Головна',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    },
    ...(role === 'admin' ? [{
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
      key: 'finance', label: 'Фінанси',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    },
  ]

  return (
    <>
      <LoadingOverlay show={store.loading} />

      {/* Reminder banner */}
      {role === 'admin' && endingCount > 0 && !reminderDismissed && page !== 'members' && (
        <ReminderBanner
          count={endingCount}
          onClick={() => { navigate('members', 'ending'); setReminderDismissed(true) }}
          onClose={() => setReminderDismissed(true)}
        />
      )}

      {/* Header */}
      {!memberDetailId && (
        <div className="hdr">
          <div>
            <h1>💪 Спортзал</h1>
            <p>Сьогодні: {new Date().toLocaleDateString('uk-UA')} · {role === 'admin' ? '👑 Адмін' : '🏋️ Тренер'} {uname}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              style={{ background: 'none', border: '1px solid var(--brd)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--txt2)', display: 'flex', alignItems: 'center' }}
              onClick={() => store.load()}
              title="Оновити"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
            {role === 'admin' && (
              <button className="logout-btn" onClick={() => setPage('settings')}>⚙️</button>
            )}
            <button className="logout-btn" onClick={handleLogout}>Вийти</button>
          </div>
        </div>
      )}

      {/* Member detail */}
      {memberDetailId && memberDetailId !== '__new__' && (
        <MemberDetail
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
          deletePayment={store.deletePayment}
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
              onNavigate={navigate}
            />
          )}
          {page === 'members' && role === 'admin' && (
            <MembersPage
              members={store.members}
              abons={store.abons}
              role={role}
              initialTab={membersInitialTab}
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
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'finance' && (
            <FinancePage
              members={store.members}
              abons={store.abons}
              payments={store.payments}
              manualDebts={store.manualDebts}
              role={role}
              uname={uname}
              deletePayment={store.deletePayment}
              saveManualDebt={store.saveManualDebt}
              payManualDebt={store.payManualDebt}
              deleteManualDebt={store.deleteManualDebt}
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'settings' && role === 'admin' && (
            <SettingsPage onReset={store.load} role={role} />
          )}
        </div>
      )}

      {/* Bottom nav */}
      {!memberDetailId && (
        <nav className="nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nb ${page === item.key ? 'on' : ''}`}
              onClick={() => { setPage(item.key); setMemberDetailId(null) }}
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

// ── New member modal ──────────────────────────────────────────────────────────
function NewMemberModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
        <button className="btn btn-grn" onClick={() => { if (!name.trim()) { alert('Введіть ПІБ'); return } onSave({ name: name.trim(), phone: phone.trim() }) }}>
          💾 Зберегти
        </button>
      </div>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────
function SettingsPage({ onReset }) {
  const [loading, setLoading] = useState(false)

  async function resetAbons() {
    if (!confirm('Скинути всі абонементи? Платежі залишаться.')) return
    setLoading(true)
    try {
      const token = localStorage.getItem('gym_token') || ''
      await fetch('/api/abons/reset', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
      await onReset()
      alert('✅ Абонементи скинуто')
    } finally { setLoading(false) }
  }

  async function resetPayments() {
    if (!confirm('Скинути всі платежі?')) return
    setLoading(true)
    try {
      const token = localStorage.getItem('gym_token') || ''
      await fetch('/api/payments/reset', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
      await onReset()
      alert('✅ Касу скинуто')
    } finally { setLoading(false) }
  }

  async function resetAll() {
    if (!confirm('⚠️ Скинути ВСЕ? Клієнти, абонементи, платежі — все буде видалено!')) return
    if (!confirm('Ви впевнені? Це незворотно!')) return
    setLoading(true)
    try {
      const token = localStorage.getItem('gym_token') || ''
      await fetch('/api/reset/all', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
      await onReset()
      alert('✅ Все скинуто')
    } finally { setLoading(false) }
  }

  return (
    <div className="pg">
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>⚙️ Налаштування</div>
      <div className="card">
        <div className="ct">Небезпечна зона</div>
        <button className="btn btn-ylw" style={{ marginBottom: 8 }} onClick={resetAbons} disabled={loading}>🔄 Скинути абонементи</button>
        <button className="btn btn-ylw" style={{ marginBottom: 8 }} onClick={resetPayments} disabled={loading}>💸 Скинути касу</button>
        <button className="btn btn-red" onClick={resetAll} disabled={loading}>🗑 Скинути все</button>
      </div>
    </div>
  )
}
