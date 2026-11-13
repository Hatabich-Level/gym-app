import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { uid, TODAY, fmtDate, abonStatus, getActiveAbon, STATUS_LABEL } from '../utils'

function download(filename, text, mime) {
  const blob = new Blob(['﻿' + text], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const csvCell = v => {
  const s = v == null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// Розбір CSV: роздільник ; або , або табуляція, лапки підтримуються
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '')
  const first = clean.split(/\r?\n/)[0] || ''
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (q) {
      if (c === '"' && clean[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else if (c !== '\r') cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

export default function DataTab({ members, abons, pushMembers, onReload }) {
  const [backups, setBackups] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const csvRef = useRef(null)
  const fileRef = useRef(null)

  async function loadBackups() {
    try { setBackups(await api('/backups')) } catch (e) { setMsg('⚠️ ' + e.message) }
  }
  useEffect(() => { loadBackups() }, [])

  // ── Експорт клієнтів ──
  function exportCsv() {
    const head = ['ПІБ', 'Телефон', 'Статус', 'Абонемент до', 'Тренер?']
    const lines = [head.join(';')]
    members.forEach(m => {
      const ab = getActiveAbon(m.id, abons)
      const st = ab ? abonStatus(ab) : null
      lines.push([m.name, m.phone || '', st ? STATUS_LABEL[st] : 'Без абонементу', ab && ab.type === 'month' ? fmtDate(ab.endDate) : '', m.isTrainer ? 'так' : ''].map(csvCell).join(';'))
    })
    download(`klienty_${TODAY}.csv`, lines.join('\r\n'), 'text/csv')
  }

  // ── Імпорт клієнтів із CSV ──
  async function onCsv(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    setBusy('import'); setMsg('')
    try {
      const rows = parseCsv(await file.text())
      if (!rows.length) { setMsg('⚠️ Файл порожній'); return }
      const h = rows[0].map(x => x.trim().toLowerCase())
      const hasHead = h.some(x => /піб|імʼя|ім'я|name|телефон|phone/.test(x))
      let iN = 0, iP = 1
      if (hasHead) {
        const n = h.findIndex(x => /піб|імʼя|ім'я|name/.test(x)); const p = h.findIndex(x => /телефон|phone|тел/.test(x))
        if (n >= 0) iN = n; if (p >= 0) iP = p
      }
      const data = rows.slice(hasHead ? 1 : 0)
      const key = m => (m.name || '').trim().toLowerCase() + '|' + String(m.phone || '').replace(/\D/g, '')
      const existing = new Set(members.map(key))
      const seenNames = new Set(members.map(m => (m.name || '').trim().toLowerCase()))
      const fresh = []; let skipped = 0
      data.forEach(r => {
        const name = (r[iN] || '').trim(); const phone = (r[iP] || '').trim()
        if (!name) return
        const m = { id: uid(), name, phone }
        if (existing.has(key(m)) || (!phone && seenNames.has(name.toLowerCase()))) { skipped++; return }
        existing.add(key(m)); fresh.push(m)
      })
      if (!fresh.length) { setMsg(`ℹ️ Нових клієнтів немає (пропущено дублікатів: ${skipped})`); return }
      if (!confirm(`Імпортувати ${fresh.length} нових клієнтів? Дублікатів пропущено: ${skipped}.`)) return
      for (let i = 0; i < fresh.length; i += 200) await pushMembers(fresh.slice(i, i + 200))
      setMsg(`✅ Додано ${fresh.length} клієнтів (пропущено дублікатів: ${skipped})`)
    } catch (err) { setMsg('⚠️ ' + err.message) } finally { setBusy('') }
  }

  // ── Резервні копії ──
  async function makeBackup() {
    setBusy('run'); setMsg('')
    try { await api('/backups/run', 'POST', {}); setMsg('✅ Копію створено'); await loadBackups() }
    catch (e) { setMsg('⚠️ ' + e.message) } finally { setBusy('') }
  }

  async function downloadBackup(b) {
    setBusy(b.id)
    try {
      const res = await fetch('/api/backups/' + encodeURIComponent(b.id) + '/download', { headers: { Authorization: 'Bearer ' + localStorage.getItem('gym_token') } })
      if (!res.ok) throw new Error('Не вдалося скачати')
      const text = await res.text()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = `sportcity-backup-${b.id}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
    } catch (e) { setMsg('⚠️ ' + e.message) } finally { setBusy('') }
  }

  async function restore(b) {
    const word = prompt(`Відновити базу зі стану ${fmtBackup(b)}?\n\nПОТОЧНІ клієнти, абонементи, платежі й борги будуть замінені. Перед цим автоматично зробиться страхувальна копія.\n\nЩоб підтвердити, введи слово: ВІДНОВИТИ`)
    if (word !== 'ВІДНОВИТИ') return
    setBusy(b.id); setMsg('')
    try {
      await api(`/backups/${encodeURIComponent(b.id)}/restore`, 'POST', { confirm: 'ВІДНОВИТИ' })
      await onReload(); await loadBackups(); setMsg('✅ Дані відновлено')
    } catch (e) { setMsg('⚠️ ' + e.message) } finally { setBusy('') }
  }

  async function restoreFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    let backup
    try { backup = JSON.parse(await file.text()) } catch { setMsg('⚠️ Це не файл резервної копії'); return }
    if (!backup || !backup.tables) { setMsg('⚠️ Це не файл резервної копії'); return }
    const word = prompt(`Відновити базу з файлу «${file.name}»?\n\nПОТОЧНІ дані будуть замінені (страхувальна копія зробиться автоматично).\n\nВведи слово: ВІДНОВИТИ`)
    if (word !== 'ВІДНОВИТИ') return
    setBusy('file'); setMsg('')
    try {
      await api('/backups/restore-file', 'POST', { confirm: 'ВІДНОВИТИ', backup })
      await onReload(); await loadBackups(); setMsg('✅ Дані відновлено з файлу')
    } catch (err) { setMsg('⚠️ ' + err.message) } finally { setBusy('') }
  }

  const KIND = { auto: '🤖 Авто', manual: '✋ Вручну', 'pre-restore': '🛟 Перед відновленням' }
  function fmtBackup(b) { return b.at ? new Date(b.at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : b.id }

  return (
    <>
      {msg && <div className="card" style={{ fontSize: 13 }}>{msg}</div>}

      <div className="card">
        <div className="ct">Клієнти: експорт / імпорт</div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 10, lineHeight: 1.5 }}>
          Експорт відкривається в Excel. Імпорт: CSV з колонками «ПІБ; Телефон» (дублікати пропускаються).
        </div>
        <button className="btn btn-acc keep-ro" onClick={exportCsv}>⬇️ Експорт клієнтів (CSV)</button>
        <button className="btn btn-ylw" disabled={busy === 'import'} onClick={() => csvRef.current && csvRef.current.click()}>⬆️ Імпорт клієнтів (CSV)</button>
        <input ref={csvRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={onCsv} />
      </div>

      <div className="card">
        <div className="ct">Резервні копії</div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 10, lineHeight: 1.5 }}>
          Щодня після 03:00 сервер сам робить копію (клієнти, абонементи, платежі, борги, зміни). Зберігається 14 автоматичних. Акаунти й паролі в копії не входять.
        </div>
        <button className="btn btn-acc" disabled={busy === 'run'} onClick={makeBackup}>💾 Зробити копію зараз</button>
        <button className="btn btn-ylw" disabled={busy === 'file'} onClick={() => fileRef.current && fileRef.current.click()}>📂 Відновити з файлу…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={restoreFile} />

        <div style={{ marginTop: 14 }}>
          {backups === null ? <div className="empty">Завантаження…</div>
            : backups.length === 0 ? <div className="empty">Копій ще немає</div>
            : backups.map(b => (
              <div key={b.id} className="irow" style={{ alignItems: 'center', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtBackup(b)}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                    {KIND[b.kind] || b.kind}{b.by ? ' · ' + b.by : ''} · {(b.counts && b.counts.members) || 0} клієнтів, {(b.counts && b.counts.abons) || 0} абон., {(b.counts && b.counts.payments) || 0} плат.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn-sm keep-ro" disabled={busy === b.id} style={{ background: 'var(--s2)', border: '1px solid var(--brd)', color: 'var(--txt)', borderRadius: 8, padding: '6px 10px' }} onClick={() => downloadBackup(b)} title="Скачати">⬇️</button>
                  <button className="btn-sm" disabled={busy === b.id} style={{ background: 'rgba(245,166,35,.12)', border: '1px solid rgba(245,166,35,.3)', color: 'var(--ylw)', borderRadius: 8, padding: '6px 10px' }} onClick={() => restore(b)} title="Відновити">↩️</button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
