import React, { useState } from 'react'
import { api } from '../api'

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState('admin')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    if (!password) { setError('Введіть пароль'); return }
    if (role === 'trainer' && !name.trim()) { setError('Введіть ваше ім\'я'); return }
    setLoading(true); setError('')
    try {
      const data = await api('/login', 'POST', { role, password, name: name.trim() })
      localStorage.setItem('gym_token', data.token)
      localStorage.setItem('gym_role', data.role)
      localStorage.setItem('gym_uname', data.name || '')
      onLogin({ role: data.role, name: data.name || '' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏋️</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Спортзал</div>
        </div>
        <div className="role-toggle">
          <button className={`role-btn ${role === 'admin' ? 'on' : ''}`} onClick={() => setRole('admin')}>
            👑 Адмін
          </button>
          <button className={`role-btn ${role === 'trainer' ? 'on' : ''}`} onClick={() => setRole('trainer')}>
            🏋️ Тренер
          </button>
        </div>
        {role === 'trainer' && (
          <div className="frow">
            <div className="flabel">Ваше ім'я</div>
            <input
              type="text" placeholder="напр: Ярослав"
              value={name} onChange={e => setName(e.target.value)}
            />
          </div>
        )}
        <div className="frow">
          <div className="flabel">Пароль</div>
          <input
            type="password" placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-acc" onClick={doLogin} disabled={loading}>
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </div>
    </div>
  )
}
