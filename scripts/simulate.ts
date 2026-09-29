/**
 * Sends simulated GPS positions to a Traccar demo server through its OsmAnd HTTP endpoint,
 * so the app can be demoed with real, moving data without physical trackers.
 * Vehicles follow real street routes (src/api/demoRoutes.json), never straight lines over water.
 *
 *   npm run simulate
 *   npm run simulate -- --host=demo4.traccar.org --interval=3
 *
 * Devices must already exist in Traccar with the identifiers listed below.
 * --unit is how the server reads the `speed` parameter. Traccar's OsmAnd endpoint expects knots (default, verified against the app); kmh and ms exist for debugging.
 * Requires Node 22.18+ (runs TypeScript natively).
 */
import { readFileSync } from 'node:fs'
import { createWalker, type LatLon } from '../src/api/routeWalker.ts'

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

const HOST = args.host ?? 'demo4.traccar.org'
const PORT = args.port ?? '5055'
const INTERVAL_S = Number(args.interval ?? 3)
const UNIT = args.unit ?? 'kn'

const KMH_TO: Record<string, number> = { kmh: 1, kn: 1 / 1.852, ms: 1 / 3.6 }
if (!(UNIT in KMH_TO)) {
  console.error(`Unknown --unit=${UNIT}. Use kmh, kn or ms.`)
  process.exit(1)
}

const routes = JSON.parse(
  readFileSync(new URL('../src/api/demoRoutes.json', import.meta.url), 'utf-8'),
) as Record<string, LatLon[]>

// `stopEvery`: the vehicle pauses for a few ticks every N ticks (traffic light, delivery).
const vehicles = [
  { id: 'rumbo-npr-01', label: 'Chevrolet NPR', cruise: 34, battery: 92, stopEvery: 40, start: 0.0 },
  { id: 'rumbo-master-03', label: 'Renault Master', cruise: 42, battery: 78, stopEvery: 0, start: 0.35 },
  { id: 'rumbo-nmax-06', label: 'Yamaha NMAX', cruise: 30, battery: 64, stopEvery: 25, start: 0.6 },
].map((v) => {
  const walker = createWalker(routes[v.id])
  return { ...v, walker, distance: walker.total * v.start }
})

let tick = 0

async function send(vehicle: (typeof vehicles)[number]) {
  const stopped = vehicle.stopEvery > 0 && tick % vehicle.stopEvery >= vehicle.stopEvery - 4
  const kmh = stopped ? 0 : Math.max(8, vehicle.cruise + Math.sin(tick * 0.4 + vehicle.start * 10) * 10)
  vehicle.distance += (kmh / 3.6) * INTERVAL_S
  const here = vehicle.walker.at(vehicle.distance)

  const query = new URLSearchParams({
    id: vehicle.id,
    lat: here.lat.toFixed(6),
    lon: here.lon.toFixed(6),
    speed: (kmh * KMH_TO[UNIT]).toFixed(2),
    bearing: here.bearing.toFixed(0),
    batt: String(Math.max(5, vehicle.battery - Math.floor(tick / 20))),
    timestamp: String(Math.floor(Date.now() / 1000)),
  })

  try {
    const response = await fetch(`http://${HOST}:${PORT}/?${query}`, { signal: AbortSignal.timeout(8_000) })
    const status = response.ok ? 'ok' : `HTTP ${response.status}`
    console.log(`${new Date().toLocaleTimeString()}  ${vehicle.label.padEnd(15)} ${kmh.toFixed(0).padStart(3)} km/h  ${status}`)
  } catch (error) {
    console.log(`${new Date().toLocaleTimeString()}  ${vehicle.label.padEnd(15)} failed: ${(error as Error).message}`)
  }
}

console.log(`Simulating ${vehicles.length} vehicles → ${HOST}:${PORT} every ${INTERVAL_S}s (speed unit: ${UNIT}). Ctrl+C to stop.`)

async function loop() {
  await Promise.all(vehicles.map(send))
  tick += 1
}

await loop()
setInterval(loop, INTERVAL_S * 1_000)
