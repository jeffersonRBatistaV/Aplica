export function getTimeGroup(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const oneDay = 86_400_000
  const twoDays = 2 * oneDay
  const oneWeek = 7 * oneDay

  if (diff < 0) return 'Hoy'
  if (diff < oneDay) return 'Hoy'
  if (diff < twoDays) return 'Ayer'

  if (diff < oneWeek) {
    const days = Math.floor(diff / oneDay)
    return `Últimos ${days} días`
  }

  const date = new Date(timestamp)
  const nowYear = new Date().getFullYear()
  const month = date.toLocaleString('es-ES', { month: 'long' })
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1)

  if (date.getFullYear() === nowYear) return capitalized
  return `${capitalized} ${date.getFullYear()}`
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const oneDay = 86_400_000

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
    return 'Ayer'
  }

  if (diff < 7 * oneDay) {
    return date.toLocaleDateString('es-ES', { weekday: 'long' })
  }

  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function groupConversations<T extends { updatedAt: number }>(
  items: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = getTimeGroup(item.updatedAt)
    const existing = groups.get(group) ?? []
    existing.push(item)
    groups.set(group, existing)
  }
  return groups
}
