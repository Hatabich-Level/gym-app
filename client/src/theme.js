const KEY = 'gym_theme'
const COLORS = { light: '#ECF3F0', dark: '#0A1311' }

// Збережений вибір: 'light' | 'dark' | 'auto' (за замовчуванням — як у системі)
export function getThemePref() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto' } catch { return 'auto' }
}

function systemDark() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

export function resolveTheme(pref) {
  return pref === 'auto' ? (systemDark() ? 'dark' : 'light') : pref
}

export function applyTheme(pref) {
  const t = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', t)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', COLORS[t])
}

export function setTheme(pref) {
  try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref) } catch {}
  applyTheme(pref)
}

// Якщо вибрано «авто» — стежимо за зміною системної теми
export function watchSystemTheme() {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => { if (getThemePref() === 'auto') applyTheme('auto') }
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  } catch { return () => {} }
}
