import React, { useState, useEffect, useCallback } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MembersPage from './pages/MembersPage'
import MemberDetail from './pages/MemberDetail'
import CheckinPage from './pages/CheckinPage'
import SessionsPage from './pages/SessionsPage'
import FinancePage from './pages/FinancePage'
import { LoadingOverlay, ReminderBanner, Tabs, Modal, FRow } from './components/UI'
import { useStore } from './hooks/useStore'
import { uid, abonStatus, getActiveAbon, TODAY } from './utils'

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
    ...(isAdmin ? [{
      key: 'finance', label: 'Фінанси',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    }] : []),
  ]

  return (
    <>
      <LoadingOverlay show={store.loading} />

      {/* Reminder banner */}
      {isAdmin && endingCount > 0 && !reminderDismissed && page !== 'members' && (
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
            <p>Сьогодні: {new Date().toLocaleDateString('uk-UA')} · {isOwner ? '👑 Головний адмін' : isAdmin ? '🛠 Адмін' : '🏋️ Тренер'} {uname}</p>
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
            {isAdmin && (
              <button className="logout-btn" onClick={() => setPage('settings')}>⚙️</button>
            )}
            <button className="logout-btn" onClick={handleLogout}>Вийти</button>
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
          {page === 'members' && isAdmin && (
            <MembersPage
              members={store.members}
              abons={store.abons}
              role={role}
              isOwner={isOwner}
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
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
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
              deletePayment={store.deletePayment}
              saveManualDebt={store.saveManualDebt}
              payManualDebt={store.payManualDebt}
              deleteManualDebt={store.deleteManualDebt}
              pushAbons={store.pushAbons}
              pushPayment={store.pushPayment}
            />
          )}
          {page === 'settings' && isAdmin && (
            <SettingsPage
              onReset={store.load} isOwner={isOwner}
              users={store.users} auditLog={store.auditLog}
              createUser={store.createUser} deleteUser={store.deleteUser} changeUserPassword={store.changeUserPassword} updateUserColor={store.updateUserColor}
              currentUid={auth.uid}
            />
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
function SettingsPage({ onReset, isOwner, users, auditLog, createUser, deleteUser, changeUserPassword, updateUserColor, currentUid }) {
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('accounts')

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

      {isOwner && (
        <Tabs
          tabs={[{ key: 'accounts', label: 'Акаунти' }, { key: 'log', label: 'Журнал дій' }, { key: 'danger', label: 'Небезпечна зона' }]}
          active={tab} onChange={setTab}
        />
      )}

      {isOwner && tab === 'accounts' && (
        <AccountsTab users={users} createUser={createUser} deleteUser={deleteUser} changeUserPassword={changeUserPassword} updateUserColor={updateUserColor} currentUid={currentUid} />
      )}

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
          Керування акаунтами та журнал дій доступні лише головному адміну.
        </div>
      )}
    </div>
  )
}

// ── Accounts management (owner only) ───────────────────────────────────────────
function AccountsTab({ users, createUser, deleteUser, changeUserPassword, updateUserColor, currentUid }) {
  const [showAdd, setShowAdd] = useState(false)
  const [pwdFor, setPwdFor] = useState(null) // user id, для зміни пароля
  const [colorFor, setColorFor] = useState(null) // user id, для зміни кольору

  const ROLE_LABEL = { owner: '👑 Головний адмін', admin: '🛠 Адмін', trainer: '🏋️ Тренер' }

  return (
    <div className="card">
      <div className="ct">Акаунти ({(users||[]).length})</div>
      <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 12, lineHeight: 1.5 }}>
        🎨 Колір акаунта використовується в експорті табеля — стовпець "час" за день фарбується кольором того, хто того дня вносив записи.
      </div>
      {(users||[]).map(u => (
        <div key={u.id} className="irow">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              title="Змінити колір"
              onClick={() => setColorFor(u.id)}
              style={{ width: 22, height: 22, borderRadius: '50%', background: u.color || '#FFC000', border: '2px solid var(--brd)', cursor: updateUserColor ? 'pointer' : 'default', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{u.name || u.login} <span style={{ color: 'var(--txt2)', fontSize: 12 }}>@{u.login}</span></div>
              <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{ROLE_LABEL[u.role] || u.role}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-sm" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt2)', borderRadius: 8, padding: '6px 10px' }} onClick={() => setPwdFor(u.id)}>🔑</button>
            {u.id !== currentUid && (
              <button className="btn-sm" style={{ background: 'rgba(255,51,102,.1)', border: '1px solid rgba(255,51,102,.3)', color: 'var(--red)', borderRadius: 8, padding: '6px 10px' }}
                onClick={() => { if (confirm(`Видалити акаунт «${u.login}»?`)) deleteUser(u.id) }}
              >🗑</button>
            )}
          </div>
        </div>
      ))}

      <button className="btn btn-acc" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}>+ Новий акаунт</button>

      {showAdd && <AddUserModal onSave={async (data) => { await createUser(data); setShowAdd(false) }} onClose={() => setShowAdd(false)} />}
      {pwdFor && <ChangePasswordModal onSave={async (pwd) => { await changeUserPassword(pwdFor, pwd); setPwdFor(null) }} onClose={() => setPwdFor(null)} />}
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