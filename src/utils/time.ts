const clock = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export const formatClock = (iso: string): string => clock.format(new Date(iso))

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

export function formatRelative(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 5) return 'Hace unos segundos'
  if (seconds < 60) return `Hace ${plural(seconds, 'segundo')}`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${plural(minutes, 'minuto')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${plural(hours, 'hora')}`
  return `Hace ${plural(Math.floor(hours / 24), 'día')}`
}
