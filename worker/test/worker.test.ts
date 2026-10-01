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
const BASIC = `Basic ${Buffer.from(`${env.TRACCAR_EMAIL}:${env.TRACCAR_PASSWORD}`).toString('base64')}`

interface Seen {
  method: string
  url: string
  cookie: string | null
  authorization: string | null
  origin: string | null
  body: string
}

interface TraccarOptions {
  /** The account is wrong: neither the sign-in nor Basic credentials are accepted. */
  rejectCredentials?: boolean
  /** Session cookies are never recognised after the sign-in (what the real demo server did when called from Cloudflare). */
  cookiesUseless?: boolean
  /** The sign-in answers 200 but sets no cookie. */
  noCookie?: boolean
  /** Name of the session cookie. */
  cookieName?: string
  /** The server is unreachable. */
  down?: boolean
  /** The session stops being valid after this many authenticated calls (until a second sign-in). */
  expireAfter?: number
}

/** A stand-in for Traccar that records what the Worker sends it. */
function fakeTraccar(options: TraccarOptions = {}) {
  const seen: Seen[] = []
  const cookieName = options.cookieName ?? 'JSESSIONID'
  let logins = 0
  let served = 0
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const cookie = request.headers.get('Cookie')
    const authorization = request.headers.get('Authorization')
    seen.push({
      method: request.method,
      url: request.url,
      cookie,
      authorization,
      origin: request.headers.get('Origin'),
      body: request.method === 'POST' ? await request.clone().text() : '',
    })
    if (options.down) throw new TypeError('network down')
    const { pathname } = new URL(request.url)

    if (pathname === '/api/session' && request.method === 'POST') {
      if (options.rejectCredentials) return new Response('nope', { status: 401 })
      logins += 1
      return new Response(JSON.stringify({ id: 1, email: 'demo@example.com', administrator: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...(options.noCookie ? {} : { 'Set-Cookie': `${cookieName}=session-${logins}; Path=/; HttpOnly` }),
        },
      })
    }

    const basicOk = !options.rejectCredentials && authorization === BASIC
    served += 1
    const expired = options.expireAfter !== undefined && served > options.expireAfter && logins < 2
    const cookieOk = !options.cookiesUseless && !expired && cookie === `${cookieName}=session-${logins}`
    // Like Traccar's sockets, a path that wants a session does not look at Basic credentials.
    const needsSession = pathname === '/api/socket'
    if (!(needsSession ? cookieOk : basicOk || cookieOk)) return new Response('no', { status: 401 })
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
const upgrade = { Upgrade: 'websocket', Connection: 'Upgrade' }

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

describe('REST calls', () => {
  it('authenticate with the account on every request, so no session has to survive between calls', async () => {
    const { seen, logins } = fakeTraccar()
    await call('/api/devices')
    await call('/api/positions')
    const upstream = seen.filter((s) => /\/api\/(devices|positions)$/.test(s.url))
    assert.equal(upstream.length, 2)
    for (const request of upstream) {
      assert.equal(request.authorization, BASIC)
      assert.equal(request.cookie, null)
    }
    assert.equal(logins(), 0, 'no sign-in was needed')
  })

  it('work even when Traccar never recognises a session cookie (the real demo-server behaviour)', async () => {
    fakeTraccar({ cookiesUseless: true })
    assert.equal((await call('/api/devices')).status, 200)
    assert.equal((await call('/api/positions')).status, 200)
  })

  it('ignore whatever credentials the browser sends, and never pass Traccar cookies back', async () => {
    const { seen } = fakeTraccar()
    const response = await call('/api/devices', { headers: { Cookie: 'browser=cookie', Authorization: 'Basic YXR0YWNrZXI6eA==' } })
    assert.equal(response.headers.get('Set-Cookie'), null, 'the cookie Traccar sets never reaches the browser')
    const upstream = seen.find((s) => s.url.endsWith('/api/devices'))
    assert.equal(upstream?.authorization, BASIC, 'the browser Authorization is replaced')
    assert.equal(upstream?.cookie, null, 'the browser cookie is dropped')
    assert.equal(upstream?.origin, 'https://traccar.test', 'Origin is Traccar’s own, as with the dev proxy')
  })

  it('report wrong credentials as 401 with CORS and an explanation', async () => {
    fakeTraccar({ rejectCredentials: true })
    const response = await call('/api/devices')
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), APP)
    assert.match(((await response.json()) as { error: string }).error, /rejected the Worker account/)
  })

  it('answer 502 with CORS when Traccar is down', async () => {
    fakeTraccar({ down: true })
    const response = await call('/api/devices')
    assert.equal(response.status, 502)
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), APP)
  })
})

describe('sign-in route', () => {
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

  it('reports a rejected sign-in as 401 and a cookie-less one as 502', async () => {
    fakeTraccar({ rejectCredentials: true })
    assert.equal((await call('/api/session', { method: 'POST' })).status, 401)
    fakeTraccar({ noCookie: true })
    const response = await call('/api/session', { method: 'POST' })
    assert.equal(response.status, 502)
    assert.match(((await response.json()) as { error: string }).error, /no session cookie/)
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
    const response = await call('/api/socket', { origin: 'https://evil.example', headers: upgrade })
    assert.equal(response.status, 403)
    assert.equal(seen.length, 0)
  })

  it('forwards the upgrade with a fresh session cookie, and the account as well', async () => {
    const { seen } = fakeTraccar()
    const response = await call('/api/socket', { headers: upgrade })
    assert.equal(response.status, 200)
    const upstream = seen.find((s) => s.url.endsWith('/api/socket'))
    assert.equal(upstream?.cookie, 'JSESSIONID=session-1')
    assert.equal(upstream?.authorization, BASIC)
    assert.equal(upstream?.origin, 'https://traccar.test')
  })

  it('signs in once for simultaneous upgrades and reuses the session', async () => {
    const fake = fakeTraccar()
    await Promise.all([call('/api/socket', { headers: upgrade }), call('/api/socket', { headers: upgrade })])
    await call('/api/socket', { headers: upgrade })
    assert.equal(fake.logins(), 1)
  })

  it('signs in again, once, when Traccar expires the session', async () => {
    const fake = fakeTraccar({ expireAfter: 1 })
    assert.equal((await call('/api/socket', { headers: upgrade })).status, 200)
    assert.equal((await call('/api/socket', { headers: upgrade })).status, 200)
    assert.equal(fake.logins(), 2)
  })

  it('uses whatever name Traccar gives its session cookie', async () => {
    const { seen } = fakeTraccar({ cookieName: 'TRACCAR_SESSION' })
    assert.equal((await call('/api/socket', { headers: upgrade })).status, 200)
    assert.equal(seen.find((s) => s.url.endsWith('/api/socket'))?.cookie, 'TRACCAR_SESSION=session-1')
  })

  it('still tries the upgrade when the sign-in brought no cookie, and says why if Traccar refuses it', async () => {
    fakeTraccar({ noCookie: true })
    const response = await call('/api/socket', { headers: upgrade })
    assert.equal(response.status, 401)
    const body = (await response.json()) as { error: string; cookies: string[] }
    assert.match(body.error, /rejected the WebSocket/)
    assert.deepEqual(body.cookies, [])
  })

  it('names the cookies (never their values) when Traccar rejects the session even after a fresh sign-in', async () => {
    fakeTraccar({ cookiesUseless: true })
    const response = await call('/api/socket', { headers: upgrade })
    assert.equal(response.status, 401)
    const body = (await response.json()) as { error: string; cookies: string[] }
    assert.deepEqual(body.cookies, ['JSESSIONID'])
    assert.ok(!JSON.stringify(body).includes('session-'), 'no cookie value in the answer')
  })
})
