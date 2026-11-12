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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
