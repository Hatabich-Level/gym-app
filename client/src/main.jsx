import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Більшість дій (зберегти, оплатити, відмітити) не мають власного catch, тож
// відмова сервера раніше проходила мовчки. Тепер будь-яка неперехоплена
// помилка показується користувачу.
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason && e.reason.message) || ''
  if (!msg || msg === 'Сесія закінчилась') return
  e.preventDefault()
  alert('❌ Не вдалося виконати дію: ' + (msg === 'Failed to fetch' ? 'немає звʼязку з сервером' : msg))
})

// Сервіс-воркер (тільки в продакшні): швидке відкриття застосунку з іконки
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
