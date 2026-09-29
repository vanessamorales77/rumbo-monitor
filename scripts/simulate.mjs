#!/usr/bin/env node
/**
 * Sends simulated GPS positions to a Traccar demo server through its OsmAnd HTTP endpoint,
 * so the app can be demoed with real, moving data without physical trackers.
 *
 *   npm run simulate
 *   npm run simulate -- --host=demo4.traccar.org --interval=3 --unit=kmh
 *
 * Devices must already exist in Traccar with the identifiers listed below.
 * --unit is how the server reads the `speed` parameter: kmh (default), kn or ms.
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)

const HOST = args.host ?? 'demo4.traccar.org'
const PORT = args.port ?? '5055'
const INTERVAL_S = Number(args.interval ?? 3)
const UNIT = args.unit ?? 'kmh'
const CENTER = { lat: Number(args.lat ?? 4.711), lon: Number(args.lon ?? -74.0721) }

const KMH_TO = { kmh: 1, kn: 1 / 1.852, ms: 1 / 3.6 }
if (!(UNIT in KMH_TO)) {
  console.error(`Unknown --unit=${UNIT}. Use kmh, kn or ms.`)
  process.exit(1)
}

// Loops around CENTER; `stopEvery` makes the vehicle pause now and then (speed 0).
const vehicles = [
  { id: 'rumbo-npr-01', label: 'Chevrolet NPR', radius: 0.012, omega: 0.045, phase: 0.0, cruise: 38, battery: 92, stopEvery: 40 },
  { id: 'rumbo-master-03', label: 'Renault Master', radius: 0.02, omega: 0.03, phase: 2.1, cruise: 46, battery: 78, stopEvery: 0 },
  { id: 'rumbo-nmax-06', label: 'Yamaha NMAX', radius: 0.008, omega: 0.07, phase: 4.2, cruise: 30, battery: 64, stopEvery: 25 },
]

const point = (v, angle) => ({
  lat: CENTER.lat + Math.sin(angle) * v.radius,
  lon: CENTER.lon + Math.cos(angle) * v.radius * 1.3,
})

let tick = 0

async function send(vehicle) {
  const angle = vehicle.phase + tick * vehicle.omega
  const here = point(vehicle, angle)
  const ahead = point(vehicle, angle + 0.01)
  const bearing = (Math.atan2(ahead.lon - here.lon, ahead.lat - here.lat) * 180) / Math.PI
  const stopped = vehicle.stopEvery > 0 && tick % vehicle.stopEvery < 4
  const kmh = stopped ? 0 : Math.max(5, vehicle.cruise + Math.sin(tick * 0.4 + vehicle.phase) * 12)

  const query = new URLSearchParams({
    id: vehicle.id,
    lat: here.lat.toFixed(6),
    lon: here.lon.toFixed(6),
    speed: (kmh * KMH_TO[UNIT]).toFixed(2),
    bearing: ((bearing + 360) % 360).toFixed(0),
    batt: String(Math.max(5, vehicle.battery - Math.floor(tick / 20))),
    timestamp: String(Math.floor(Date.now() / 1000)),
  })

  try {
    const response = await fetch(`http://${HOST}:${PORT}/?${query}`, { signal: AbortSignal.timeout(8_000) })
    const status = response.ok ? 'ok' : `HTTP ${response.status}`
    console.log(`${new Date().toLocaleTimeString()}  ${vehicle.label.padEnd(15)} ${kmh.toFixed(0).padStart(3)} km/h  ${status}`)
  } catch (error) {
    console.log(`${new Date().toLocaleTimeString()}  ${vehicle.label.padEnd(15)} failed: ${error.message}`)
  }
}

console.log(`Simulating ${vehicles.length} vehicles → ${HOST}:${PORT} every ${INTERVAL_S}s (speed unit: ${UNIT}). Ctrl+C to stop.`)

async function loop() {
  await Promise.all(vehicles.map(send))
  tick += 1
}

await loop()
setInterval(loop, INTERVAL_S * 1_000)
