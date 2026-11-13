const KEY = 'gym_theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'light' ? '#f3f5fb' : '#0d0f18')
}

export function setTheme(t) {
  try { localStorage.setItem(KEY, t) } catch {}
  applyTheme(t)
}
