import React from 'react'

// ── Loading overlay ───────────────────────────────────────────────────────────
export function LoadingOverlay({ show }) {
  if (!show) return null
  return (
    <div className="loading-overlay">
      <span>Завантаження...</span>
    </div>
  )
}

// ── Method pill ───────────────────────────────────────────────────────────────
export function MethodPill({ method }) {
  return (
    <span className={`method-pill ${method === 'card' ? 'pill-card' : 'pill-cash'}`}>
      {method === 'card' ? '💳' : '💵'}
    </span>
  )
}

// ── Method toggle (cash/card) ─────────────────────────────────────────────────
export function MethodToggle({ value, onChange }) {
  return (
    <div className="method-toggle" style={{ marginBottom: 14 }}>
      <button
        className={`method-btn ${value === 'cash' ? 'on-cash' : ''}`}
        onClick={() => onChange('cash')}
      >💵 Готівка</button>
      <button
        className={`method-btn ${value === 'card' ? 'on-card' : ''}`}
        onClick={() => onChange('card')}
      >💳 Картка</button>
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Ava({ name, size = 38 }) {
  return (
    <div className="ava" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div className="modal">
      <div className="mhdr">
        <button className="back" onClick={onClose}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад
        </button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
      </div>
      <div className="mbody">{children}</div>
    </div>
  )
}

// ── Form row ──────────────────────────────────────────────────────────────────
export function FRow({ label, children, hidden }) {
  return (
    <div className="frow" style={hidden ? { display: 'none' } : {}}>
      <div className="flabel">{label}</div>
      {children}
    </div>
  )
}

// ── Status tag ────────────────────────────────────────────────────────────────
import { STATUS_TAG, STATUS_LABEL } from '../utils'
export function StatusTag({ status }) {
  if (!status) return <span className="ai-tag tag-gray">—</span>
  return <span className={`ai-tag ${STATUS_TAG[status] || 'tag-gray'}`}>{STATUS_LABEL[status] || status}</span>
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >{t.label}</button>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ text = 'Поки нічого нема' }) {
  return <div className="empty">{text}</div>
}

// ── Custom checkbox ───────────────────────────────────────────────────────────
export function CustomCheckbox({ checked, onChange, onClick }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onClick && onClick(e); onChange && onChange(!checked) }}
      style={{
        width: 18, height: 18, flexShrink: 0, borderRadius: 5,
        border: `2px solid ${checked ? 'var(--acc)' : 'var(--brd)'}`,
        background: checked ? 'var(--acc)' : 'var(--s3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all .15s', fontSize: 11, color: '#fff'
      }}
    >{checked ? '✓' : ''}</span>
  )
}

// ── Reminder banner ───────────────────────────────────────────────────────────
export function ReminderBanner({ count, onClick, onClose }) {
  if (!count) return null
  return (
    <div className="reminder-banner" onClick={onClick}>
      <span>🔔</span>
      <span style={{ flex: 1 }}>{count} абонемент{count === 1 ? '' : count < 5 ? 'и' : 'ів'} закінчується або вже закінчились — натисни щоб побачити</span>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#000', padding: '0 4px' }}
        onClick={e => { e.stopPropagation(); onClose() }}
      >×</button>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'var(--acc)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="pbar">
      <div className="pfill" style={{ width: pct + '%', background: color }} />
    </div>
  )
}

// ── Icon button ───────────────────────────────────────────────────────────────
export function IconBtn({ onClick, title, children, style }) {
  return (
    <button
      className="alert-dismiss"
      onClick={e => { e.stopPropagation(); onClick(e) }}
      title={title}
      style={style}
    >{children}</button>
  )
}
