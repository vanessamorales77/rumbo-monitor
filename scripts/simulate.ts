/**
 * Sends simulated GPS positions to a Traccar demo server through its OsmAnd HTTP endpoint,
 * so the app can be demoed with real, moving data without physical trackers.
 * Vehicles follow real street routes (src/api/demoRoutes.json), never straight lines over water.
 *
 *   npm run simulate
 *   npm run simulate -- --host=demo4.traccar.org --interval=10 --turn=20 --min-gap=3
 *   npm run simulate -- --dry-run=3600     # sends nothing: shows the position budget and how far the trail strays from the road
 *
 * Reporting works like a real tracker's "smart reporting": a position every --interval seconds, plus an
 * extra one as soon as the heading has changed by --turn degrees (never more often than --min-gap seconds).
 * Without the extra ones, a 10 s interval puts ~100 m between fixes and the trail cuts corners on every curve.
 * --turn=0 turns the extra positions off.
 *
 * Devices must already exist in Traccar with the identifiers listed below.
 * --unit is how the server reads the `speed` parameter. Traccar's OsmAnd endpoint expects knots (default, verified against the app); kmh and ms exist for debugging.
 * Requires Node 22.18+ (runs TypeScript natively).
 *
 * Mind the budget: the Traccar demo servers cap stored positions at roughly 1,500 per device per day
 * (unofficial; it renews daily at an unknown hour). Each of our devices hit exactly 1,500 twice.
 * Every vehicle has its own budget, so three vehicles do not share it. Use --dry-run to see how long a setting lasts.
 * Run it only while working or recording.
 */
import { readFileSync } from 'node:fs'
import { createWalker, type LatLon, type RoutePoint, type Walker } from '../src/api/routeWalker.ts'

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

const HOST = args.host ?? 'demo4.traccar.org'
const PORT = args.port ?? '5055'
const INTERVAL_S = Number(args.interval ?? 10)
const TURN_DEG = Number(args.turn ?? 20)
const MIN_GAP_S = Number(args['min-gap'] ?? 3)
const UNIT = args.unit ?? 'kn'
const DRY_RUN_S = args['dry-run'] ? Number(args['dry-run']) : null
/** The vehicles move in one-second steps; positions are sent only when the rules above say so. */
const STEP_S = 1

const KMH_TO: Record<string, number> = { kmh: 1, kn: 1 / 1.852, ms: 1 / 3.6 }
if (!(UNIT in KMH_TO)) {
  console.error(`Unknown --unit=${UNIT}. Use kmh, kn or ms.`)
  process.exit(1)
}

const routes = JSON.parse(
  readFileSync(new URL('../src/api/demoRoutes.json', import.meta.url), 'utf-8'),
) as Record<string, LatLon[]>

interface Vehicle {
  id: string
  label: string
  cruise: number
  battery: number
  /** The vehicle pauses for 4 intervals every N intervals (traffic light, delivery). 0 = never. */
  stopEvery: number
  start: number
  walker: Walker
  distance: number
  /** Simulated second of the last position sent, and its heading. */
  lastSentAt: number
  lastBearing: number
  /** Metres along the route at each position sent (for the dry run). */
  sentAt: number[]
}

const vehicles: Vehicle[] = [
  { id: 'rumbo-npr-01', label: 'Chevrolet NPR', cruise: 34, battery: 92, stopEvery: 40, start: 0.0 },
  { id: 'rumbo-master-03', label: 'Renault Master', cruise: 42, battery: 78, stopEvery: 0, start: 0.35 },
  { id: 'rumbo-nmax-06', label: 'Yamaha NMAX', cruise: 30, battery: 64, stopEvery: 25, start: 0.6 },
].map((v) => {
  const walker = createWalker(routes[v.id])
  return { ...v, walker, distance: walker.total * v.start, lastSentAt: -Infinity, lastBearing: 0, sentAt: [] }
})

/** Simulated seconds since the start. */
let clock = 0
/** Speed and battery change once per interval, like before. */
const slot = () => Math.floor(clock / INTERVAL_S)

const headingChange = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

function speedNow(vehicle: Vehicle): number {
  const s = slot()
  const stopped = vehicle.stopEvery > 0 && s % vehicle.stopEvery >= vehicle.stopEvery - 4
  return stopped ? 0 : Math.max(8, vehicle.cruise + Math.sin(s * 0.4 + vehicle.start * 10) * 10)
}

async function send(vehicle: Vehicle, here: RoutePoint, kmh: number, byTurn: boolean) {
  const query = new URLSearchParams({
    id: vehicle.id,
    lat: here.lat.toFixed(6),
    lon: here.lon.toFixed(6),
    speed: (kmh * KMH_TO[UNIT]).toFixed(2),
    bearing: here.bearing.toFixed(0),
    batt: String(Math.max(5, vehicle.battery - Math.floor(slot() / 20))),
    timestamp: String(Math.floor(Date.now() / 1000)),
  })
  const when = new Date().toLocaleTimeString()
  const speed = `${kmh.toFixed(0).padStart(3)} km/h`
  const why = byTurn ? '  (curva)' : ''
  try {
    const response = await fetch(`http://${HOST}:${PORT}/?${query}`, { signal: AbortSignal.timeout(8_000) })
    console.log(`${when}  ${vehicle.label.padEnd(15)} ${speed}  ${response.ok ? 'ok' : `HTTP ${response.status}`}${why}`)
  } catch (error) {
    console.log(`${when}  ${vehicle.label.padEnd(15)} failed: ${(error as Error).message}`)
  }
}

/** One second of simulated time: every vehicle moves, and sends a position if the rules say so. */
async function step(deliver: (vehicle: Vehicle, here: RoutePoint, kmh: number, byTurn: boolean) => Promise<void> | void) {
  const jobs: Array<Promise<void> | void> = []
  for (const vehicle of vehicles) {
    const kmh = speedNow(vehicle)
    vehicle.distance += (kmh / 3.6) * STEP_S
    const here = vehicle.walker.at(vehicle.distance)
    const since = clock - vehicle.lastSentAt
    const due = since >= INTERVAL_S
    const turned = TURN_DEG > 0 && kmh > 0 && since >= MIN_GAP_S && headingChange(here.bearing, vehicle.lastBearing) >= TURN_DEG
    if (!due && !turned) continue
    vehicle.lastSentAt = clock
    vehicle.lastBearing = here.bearing
    vehicle.sentAt.push(vehicle.distance)
    jobs.push(deliver(vehicle, here, kmh, turned && !due))
  }
  clock += STEP_S
  await Promise.all(jobs)
}

/** How far the straight line between two consecutive fixes strays from the road it was driven on (metres). */
function worstStray(vehicle: Vehicle): { max: number; p95: number } {
  const metres = (point: RoutePoint, origin: RoutePoint): [number, number] => [
    (point.lon - origin.lon) * Math.cos((origin.lat * Math.PI) / 180) * 111_320,
    (point.lat - origin.lat) * 110_540,
  ]
  const strays: number[] = []
  for (let i = 0; i + 1 < vehicle.sentAt.length; i += 1) {
    const from = vehicle.walker.at(vehicle.sentAt[i])
    const to = vehicle.walker.at(vehicle.sentAt[i + 1])
    const [bx, by] = metres(to, from)
    const length = Math.hypot(bx, by) || 1
    let worst = 0
    for (let d = vehicle.sentAt[i]; d < vehicle.sentAt[i + 1]; d += 3) {
      const [px, py] = metres(vehicle.walker.at(d), from)
      worst = Math.max(worst, Math.abs(px * by - py * bx) / length) // distance from the road point to the chord
    }
    strays.push(worst)
  }
  strays.sort((a, b) => a - b)
  return { max: strays[strays.length - 1] ?? 0, p95: strays[Math.floor(strays.length * 0.95)] ?? 0 }
}

if (DRY_RUN_S !== null) {
  for (let i = 0; i < DRY_RUN_S; i += STEP_S) await step(() => undefined)
  const hours = DRY_RUN_S / 3600
  console.log(`Dry run: ${DRY_RUN_S} s simulated, interval ${INTERVAL_S} s, turn ${TURN_DEG}°, min gap ${MIN_GAP_S} s (nothing was sent)\n`)
  console.log('vehicle          positions   per hour   hours to 1,500   stray p95   stray max')
  for (const vehicle of vehicles) {
    const perHour = vehicle.sentAt.length / hours
    const stray = worstStray(vehicle)
    console.log(
      `${vehicle.label.padEnd(15)} ${String(vehicle.sentAt.length).padStart(10)} ${perHour.toFixed(0).padStart(10)} ${(1500 / perHour).toFixed(1).padStart(16)} ${(stray.p95.toFixed(1) + ' m').padStart(11)} ${(stray.max.toFixed(1) + ' m').padStart(11)}`,
    )
  }
  process.exit(0)
}

console.log(
  `Simulating ${vehicles.length} vehicles → ${HOST}:${PORT}, a position every ${INTERVAL_S} s` +
    (TURN_DEG > 0 ? ` plus one on every ${TURN_DEG}° turn (min ${MIN_GAP_S} s apart)` : '') +
    ` (speed unit: ${UNIT}). Ctrl+C to stop.`,
)

await step(send)
setInterval(() => void step(send), STEP_S * 1_000)
