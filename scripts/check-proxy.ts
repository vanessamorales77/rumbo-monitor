/**
 * Checks a deployed Rumbo proxy (the Cloudflare Worker) from the outside, the way the app and a stranger would use it.
 *
 *   npm run check:proxy -- https://rumbo-proxy.<you>.workers.dev https://<your-app>.vercel.app
 *
 * First argument: the Worker's URL. Second: the origin of the app (it must be in ALLOWED_ORIGINS).
 * Needs Node 22.18+ (runs TypeScript natively).
 */

export {} // a module, so top-level await and these names stay local to the file

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
const openSocket = (origin: string | null) =>
  new Promise<{ opened: boolean; messages: number }>((resolve) => {
    const url = worker.replace(/^http/, 'ws') + '/api/socket'
    const socket = new WebSocket(url, origin ? ({ headers: { Origin: origin } } as never) : undefined)
    let messages = 0
    const done = (opened: boolean) => {
      clearTimeout(timer)
      try {
        socket.close()
      } catch {
        /* already closed */
      }
      resolve({ opened, messages })
    }
    const timer = setTimeout(() => done(false), 8_000)
    socket.addEventListener('open', () => setTimeout(() => done(true), 2_500))
    socket.addEventListener('message', () => (messages += 1))
    socket.addEventListener('error', () => done(false))
  })
const good = await openSocket(app)
check(good.opened, 'WebSocket: el apretón de manos funciona', `${good.messages} mensaje(s) en 2,5 s (llegan cuando hay posiciones nuevas)`)
const bad = await openSocket(EVIL)
check(!bad.opened, 'WebSocket: rechaza un origen ajeno')

console.log(failed === 0 ? '\nTodo en orden.' : `\n${failed} comprobación(es) fallaron.`)
process.exit(failed === 0 ? 0 : 1)
