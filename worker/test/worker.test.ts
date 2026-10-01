import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { handleRequest, resetSession, type Env } from '../src/index.ts'

const APP = 'https://rumbo.example.app'
const env: Env = {
  TRACCAR_EMAIL: 'demo@example.com',
  TRACCAR_PASSWORD: 'not-a-real-password',
  TRACCAR_URL: 'https://traccar.test',
  ALLOWED_ORIGINS: `${APP}, http://localhost:5173`,
}

interface Seen {
  method: string
  url: string
  cookie: string | null
  origin: string | null
  body: string
}

/** A stand-in for Traccar that records what the Worker sends it. */
function fakeTraccar(
  options: { expireAfter?: number; rejectLogin?: boolean; down?: boolean; cookieName?: string; noCookie?: boolean; rejectSession?: boolean } = {},
) {
  const cookieName = options.cookieName ?? 'JSESSIONID'
  const seen: Seen[] = []
  let logins = 0
  let served = 0
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    seen.push({
      method: request.method,
      url: request.url,
      cookie: request.headers.get('Cookie'),
      origin: request.headers.get('Origin'),
      body: request.method === 'POST' ? await request.clone().text() : '',
    })
    if (options.down) throw new TypeError('network down')
    const { pathname } = new URL(request.url)
    if (pathname === '/api/session' && request.method === 'POST') {
      if (options.rejectLogin) return new Response('nope', { status: 401 })
      logins += 1
      return new Response(JSON.stringify({ id: 1, email: 'demo@example.com', administrator: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(options.noCookie ? {} : { 'Set-Cookie': `${cookieName}=session-${logins}; Path=/; HttpOnly` }),
        },
      })
    }
    // Everything else needs the latest session cookie (and can be made to expire it after N calls).
    served += 1
    const expired = options.expireAfter !== undefined && served > options.expireAfter && logins < 2
    if (options.rejectSession || expired || request.headers.get('Cookie') !== `${cookieName}=session-${logins}`) return new Response('no', { status: 401 })
    return new Response(JSON.stringify([{ id: 7 }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'JSESSIONID=leak; Path=/' },
    })
  }) as typeof fetch
  return { seen, logins: () => logins }
}

const call = (path: string, init: RequestInit & { origin?: string | null } = {}) => {
  const { origin = APP, ...rest } = init
  const headers = new Headers(rest.headers)
  if (origin) headers.set('Origin', origin)
  return handleRequest(new Request(`https://proxy.test${path}`, { ...rest, headers }), env)
}

const realFetch = globalThis.fetch
beforeEach(() => resetSession())
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('allow-list', () => {
  it('forwards only the four calls the app makes', async () => {
    fakeTraccar()
    assert.equal((await call('/api/devices')).status, 200)
    assert.equal((await call('/api/positions')).status, 200)
    assert.equal((await call('/api/session', { method: 'POST' })).status, 200)
  })

  it('refuses anything else, so it cannot be used to change the account', async () => {
    const { seen } = fakeTraccar()
    assert.equal((await call('/api/devices', { method: 'POST' })).status, 405)
    assert.equal((await call('/api/devices/7', { method: 'DELETE' })).status, 404)
    assert.equal((await call('/api/users')).status, 404)
    assert.equal((await call('/api/session', { method: 'DELETE' })).status, 405)
    assert.equal((await call('/api/permissions', { method: 'POST' })).status, 404)
    assert.equal(seen.length, 0, 'nothing reached Traccar')
  })
})

describe('CORS', () => {
  it('answers the preflight for an allowed origin only', async () => {
    fakeTraccar()
    const ok = await call('/api/devices', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'GET' } })
    assert.equal(ok.status, 204)
    assert.equal(ok.headers.get('Access-Control-Allow-Origin'), APP)
    assert.equal(ok.headers.get('Access-Control-Allow-Credentials'), 'true')
    const bad = await call('/api/devices', { method: 'OPTIONS', origin: 'https://evil.example' })
    assert.equal(bad.status, 403)
    assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null)
  })

  it('never answers a disallowed origin, and never uses a wildcard', async () => {
    const { seen } = fakeTraccar()
    const bad = await call('/api/devices', { origin: 'https://evil.example' })
    assert.equal(bad.status, 403)
    assert.equal(seen.length, 0)
    const good = await call('/api/devices')
    assert.equal(good.headers.get('Access-Control-Allow-Origin'), APP)
    assert.equal(good.headers.get('Vary'), 'Origin')
  })
})

describe('sign-in and session', () => {
  it('signs in with its own account, whatever the browser sends, and returns no user data', async () => {
    const { seen } = fakeTraccar()
    const response = await call('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'attacker@example.com', password: 'guess' }),
    })
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.deepEqual(JSON.parse(text), { authenticated: true })
    assert.ok(!text.includes('demo@example.com'), 'the account e-mail is not exposed')
    assert.equal(response.headers.get('Set-Cookie'), null)
    const body = new URLSearchParams(seen[0].body)
    assert.equal(body.get('email'), env.TRACCAR_EMAIL)
    assert.equal(body.get('password'), env.TRACCAR_PASSWORD)
  })

  it('keeps the Traccar cookie to itself and attaches it to upstream calls', async () => {
    const { seen } = fakeTraccar()
    const response = await call('/api/devices', { headers: { Cookie: 'browser=cookie' } })
    assert.equal(response.headers.get('Set-Cookie'), null, 'the session cookie never reaches the browser')
    const upstream = seen.find((s) => s.url.endsWith('/api/devices'))
    assert.equal(upstream?.cookie, 'JSESSIONID=session-1', 'the browser cookie is replaced by the Worker session')
    assert.equal(upstream?.origin, 'https://traccar.test', 'Origin is Traccar’s own, as with the dev proxy')
  })

  it('signs in once for simultaneous calls and reuses the session afterwards', async () => {
    const fake = fakeTraccar()
    await Promise.all([call('/api/devices'), call('/api/positions'), call('/api/devices')])
    await call('/api/positions')
    assert.equal(fake.logins(), 1)
  })

  it('signs in again, once, when Traccar expires the session', async () => {
    const fake = fakeTraccar({ expireAfter: 1 })
    assert.equal((await call('/api/devices')).status, 200)
    const after = await call('/api/devices')
    assert.equal(after.status, 200)
    assert.equal(fake.logins(), 2)
  })

  it('uses whatever name Traccar gives its session cookie, and sends every cookie back', async () => {
    const { seen } = fakeTraccar({ cookieName: 'TRACCAR_SESSION' })
    assert.equal((await call('/api/devices')).status, 200)
    assert.equal(seen.find((s) => s.url.endsWith('/api/devices'))?.cookie, 'TRACCAR_SESSION=session-1')
  })

  it('does not claim success when the sign-in brought no session cookie', async () => {
    fakeTraccar({ noCookie: true })
    const session = await call('/api/session', { method: 'POST' })
    assert.equal(session.status, 502)
    assert.match(((await session.json()) as { error: string }).error, /no session cookie/)
    const devices = await call('/api/devices')
    assert.equal(devices.status, 401)
    assert.match(((await devices.json()) as { error: string }).error, /could not sign in/)
  })

  it('says so when Traccar rejects the session even after a fresh sign-in, naming the cookies (never their values)', async () => {
    fakeTraccar({ rejectSession: true })
    const response = await call('/api/devices')
    assert.equal(response.status, 401)
    const body = (await response.json()) as { error: string; cookies: string[] }
    assert.match(body.error, /rejected the Worker session/)
    assert.deepEqual(body.cookies, ['JSESSIONID'])
    assert.ok(!JSON.stringify(body).includes('session-'), 'no cookie value in the answer')
  })

  it('reports a rejected sign-in as 401 with CORS, so the app shows its credentials error', async () => {
    fakeTraccar({ rejectLogin: true })
    const response = await call('/api/devices')
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), APP)
    assert.equal((await call('/api/session', { method: 'POST' })).status, 401)
  })

  it('answers 502 with CORS when Traccar is down', async () => {
    fakeTraccar({ down: true })
    const response = await call('/api/devices')
    assert.equal(response.status, 502)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), APP)
  })
})

describe('WebSocket', () => {
  it('refuses a plain request to the socket path', async () => {
    const { seen } = fakeTraccar()
    assert.equal((await call('/api/socket')).status, 426)
    assert.equal(seen.length, 0)
  })

  it('refuses an upgrade from an origin that is not the app', async () => {
    const { seen } = fakeTraccar()
    const response = await call('/api/socket', { origin: 'https://evil.example', headers: { Upgrade: 'websocket' } })
    assert.equal(response.status, 403)
    assert.equal(seen.length, 0)
  })

  it('forwards the upgrade with the Worker session', async () => {
    const { seen } = fakeTraccar()
    await call('/api/socket', { headers: { Upgrade: 'websocket', Connection: 'Upgrade' } })
    const upstream = seen.find((s) => s.url.endsWith('/api/socket'))
    assert.equal(upstream?.cookie, 'JSESSIONID=session-1')
    assert.equal(upstream?.origin, 'https://traccar.test')
  })
})
