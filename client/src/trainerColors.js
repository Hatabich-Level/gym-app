// Реєстр кольорів тренерів: заповнюється зі стану (/api/state), використовується скрізь,
// де показуємо тренера (заняття, фінанси, картки клієнтів).
let byId = {}
let byName = {}

export function setTrainerColors(list) {
  byId = {}; byName = {}
  ;(list || []).forEach(t => {
    if (!t || !t.color) return
    if (t.id) byId[t.id] = t.color
    if (t.name) byName[t.name] = t.color
    if (t.login) byName[t.login] = t.color
  })
}
export function setTrainerColor(id, name, color) {
  if (id) byId[id] = color
  if (name) byName[name] = color
}
export const trainerColorById = id => (id && byId[id]) || null
export const trainerColorByName = n => (n && byName[n]) || null
