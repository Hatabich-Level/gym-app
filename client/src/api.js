const getToken = () => localStorage.getItem('gym_token') || ''

export async function api(path, method = 'GET', body = null) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getToken()
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (res.status === 401) {
    localStorage.removeItem('gym_token')
    localStorage.removeItem('gym_role')
    localStorage.removeItem('gym_uname')
    localStorage.removeItem('gym_uid')
    window.location.reload()
    throw new Error('Сесія закінчилась')
  }
  if (!res.ok) {
    let msg = 'Помилка сервера'
    try { msg = (await res.json()).error || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}