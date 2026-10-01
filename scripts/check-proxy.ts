/**
 * Checks a deployed Rumbo proxy (the Cloudflare Worker) from the outside, the way the app and a stranger would use it.
 *
 *   npm run check:proxy -- https://rumbo-proxy.<you>.workers.dev https://<your-app>.vercel.app
 *
 * First argument: the Worker's URL. Second: the origin of the app (it must be in ALLOWED_ORIGINS).
 * Needs Node 22.18+ (runs TypeScript natively).
 */

import { randomBytes } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

const [workerArg, appArg] = process.argv.slice(2)
if (!workerArg || !appArg) {
  console.error('Usage: npm run check:proxy -- <worker-url> <app-origin>')
  process.exit(2)
}
const worker = workerArg.replace(/\/+$/, '')
const app = appArg.replace(/\/+$/, '')
const EVIL = 'https://evil.example'

let failed = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (!ok) failed += 1
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${name}${detail ? `  → ${detail}` : ''}`)
}
const get = (path: string, origin: string | null = app, init: RequestInit = {}) =>
  fetch(`${worker}${path}`, { ...init, headers: { ...(origin ? { Origin: origin } : {}), ...init.headers } })

/** The reason the Worker gives when it refuses (its answers carry a short JSON message). */
const why = async (response: Response) => (response.ok ? '' : ` — ${(await response.clone().text()).slice(0, 200)}`)

const health = await get('/health')
check(health.status === 200, 'el Worker responde', `HTTP ${health.status}`)

const session = await get('/api/session', app, { method: 'POST' })
const sessionBody = await session.text()
check(session.status === 200, 'inicia sesión en Traccar con la cuenta guardada en el Worker', `HTTP ${session.status} ${sessionBody.slice(0, 200)}`)
check(!session.headers.get('set-cookie') && !/@/.test(sessionBody), 'no devuelve cookie ni datos de la cuenta')
check(session.headers.get('access-control-allow-origin') === app, 'CORS: acepta el origen de la app', session.headers.get('access-control-allow-origin') ?? 'sin cabecera')

const devices = await get('/api/devices')
const list = devices.ok ? ((await devices.json()) as Array<{ name: string; status: string }>) : []
check(devices.status === 200, 'lista los dispositivos', `HTTP ${devices.status}, ${list.length} dispositivo(s)${await why(devices)}`)
if (list.length > 0) console.log(`       ${list.map((d) => `${d.name} (${d.status})`).join(', ')}`)
const positions = await get('/api/positions')
check(positions.status === 200, 'lista las posiciones', `HTTP ${positions.status}${await why(positions)}`)

const foreign = await get('/api/devices', EVIL)
check(foreign.status === 403, 'rechaza un origen ajeno', `HTTP ${foreign.status}`)
const del = await get('/api/devices/1', app, { method: 'DELETE' })
check(del.status === 404 || del.status === 405, 'no reenvía borrados', `HTTP ${del.status}`)
const users = await get('/api/users')
check(users.status === 404, 'no expone otras rutas de Traccar (/api/users)', `HTTP ${users.status}`)

// WebSocket: the handshake must succeed for the app, and be refused for a foreign origin.
// Done by hand over HTTPS (instead of `new WebSocket`) so a refusal comes with its status and the Worker's message.
interface Handshake {
  upgraded: boolean
  status: number | null
  body: string
  bytes: number
}
const handshake = (origin: string | null) =>
  new Promise<Handshake>((resolve) => {
    const target = new URL(worker)
    const request = (target.protocol === 'http:' ? http : https).request({
      hostname: target.hostname,
      port: target.port || undefined,
      path: '/api/socket',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        ...(origin ? { Origin: origin } : {}),
      },
    })
    const result: Handshake = { upgraded: false, status: null, body: '', bytes: 0 }
    const done = () => {
      clearTimeout(timer)
      request.destroy()
      resolve(result)
    }
    const timer = setTimeout(done, 8_000)
    request.on('upgrade', (response, socket) => {
      result.upgraded = true
      result.status = response.statusCode ?? null
      socket.on('data', (chunk) => (result.bytes += chunk.length))
      setTimeout(done, 2_500) // listen a moment: messages arrive when Traccar has news
    })
    request.on('response', (response) => {
      result.status = response.statusCode ?? null
      response.on('data', (chunk) => (result.body += chunk.toString()))
      response.on('end', done)
    })
    request.on('error', done)
    request.end()
  })

const good = await handshake(app)
const why2 = good.upgraded ? '' : ` — HTTP ${good.status ?? 'sin respuesta'} ${good.body.slice(0, 220)}`
check(good.upgraded, 'WebSocket: el apretón de manos funciona', good.upgraded ? `101, ${good.bytes} byte(s) recibidos en 2,5 s (llegan cuando hay posiciones nuevas)` : why2.trim())
const bad = await handshake(EVIL)
check(!bad.upgraded, 'WebSocket: rechaza un origen ajeno', bad.upgraded ? 'se abrió (mal)' : `HTTP ${bad.status}`)

console.log(failed === 0 ? '\nTodo en orden.' : `\n${failed} comprobación(es) fallaron.`)
process.exit(failed === 0 ? 0 : 1)
