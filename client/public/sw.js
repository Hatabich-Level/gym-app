// Сервіс-воркер: застосунок відкривається навіть при поганому звʼязку/сплячому
// сервері (Render Free), а оновлення після деплою підхоплюються як і раніше.
// API (/api/*) ніколи не кешується — дані завжди беруться з сервера.
const V = 'gym-v1'
const SHELL = '/'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin || u.pathname.startsWith('/api') || u.pathname === '/healthz') return
  if (r.mode === 'navigate') return e.respondWith(navigate(e))
  if (u.pathname.startsWith('/assets/')) return e.respondWith(cacheFirst(r))   // хешовані файли — незмінні
  e.respondWith(staleWhileRevalidate(r))                                      // іконки, manifest
})

// Сторінка: мережа в пріоритеті (щоб одразу бачити новий деплой), але якщо сервер
// мовчить понад 3,5 с або немає інтернету — відкриваємо збережену оболонку.
async function navigate(e) {
  const cache = await caches.open(V)
  const net = fetch(e.request).then((res) => { if (res.ok) cache.put(SHELL, res.clone()); return res })
  const timeout = new Promise((r) => setTimeout(() => r(null), 3500))
  try {
    const first = await Promise.race([net, timeout])
    if (first) return first
    const cached = await cache.match(SHELL)
    if (cached) { e.waitUntil(net.catch(() => {})); return cached }
    return await net
  } catch (err) {
    const cached = await cache.match(SHELL)
    if (cached) return cached
    throw err
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(V)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(V)
  const hit = await cache.match(req)
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res }).catch(() => hit)
  return hit || net
}
