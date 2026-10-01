/**
 * Rumbo's proxy to Traccar, as a Cloudflare Worker.
 *
 * Why it exists: the public Traccar demo servers send no CORS headers, and a static host's rewrites cannot carry a
 * WebSocket. This Worker sits in between and also holds the Traccar sign-in, so neither the password nor the session
 * cookie ever reaches the browser.
 *
 * How it authenticates against Traccar: REST calls carry the account as HTTP Basic credentials on every request, so they
 * do not depend on a session surviving between two requests (Cloudflare may send them from different IP addresses, and
 * the demo servers did not recognise the cookie from one to the next). The WebSocket, which Traccar ties to a session,
 * first tries an access token (made with the Basic credentials and sent as ?token=, so it needs no session either) and
 * then a session cookie from a fresh sign-in. When neither opens it, the answer says what each attempt got.
 *
 * It is deliberately NOT an open proxy. It signs in as the demo account, so it only forwards the four calls the app
 * makes; anything else (creating or deleting devices, reading users…) is refused.
 *
 * Config (see worker/wrangler.jsonc and the README):
 *   TRACCAR_EMAIL, TRACCAR_PASSWORD   secrets: the demo account
 *   TRACCAR_URL                       var: the Traccar server (default https://demo4.traccar.org)
 *   ALLOWED_ORIGINS                   var: comma-separated origins of the app (CORS and WebSocket origin check)
 */

export interface Env {
  TRACCAR_EMAIL: string
  TRACCAR_PASSWORD: string
  TRACCAR_URL?: string
  ALLOWED_ORIGINS?: string
}

const DEFAULT_UPSTREAM = 'https://demo4.traccar.org'

/** The only calls the app needs. */
const ROUTES = [
  { method: 'POST', path: '/api/session' },
  { method: 'GET', path: '/api/devices' },
  { method: 'GET', path: '/api/positions' },
  { method: 'GET', path: '/api/socket' },
]

/** Traccar's session cookie(s) as a Cookie header ("JSESSIONID=…"), kept for as long as this Worker instance lives. */
let sessionCookie: string | null = null
let signingIn: Promise<string> | null = null

/** A Traccar access token for the WebSocket, made once and reused. */
let socketToken: { value: string; until: number } | null = null
let requestingToken: Promise<string | null> | null = null
/** How long a token is reused. Traccar is asked for one that lasts twice as long, so a cached one never expires mid-use. */
const TOKEN_REUSE_MS = 6 * 60 * 60 * 1000

/** For tests: forget the session and the token. */
export function resetSession() {
  sessionCookie = null
  signingIn = null
  socketToken = null
  requestingToken = null
}

const upstreamOf = (env: Env) => (env.TRACCAR_URL || DEFAULT_UPSTREAM).replace(/\/+$/, '')

/** "Basic base64(email:password)", UTF-8 safe. */
function basicAuth(env: Env): string {
  const bytes = new TextEncoder().encode(`${env.TRACCAR_EMAIL ?? ''}:${env.TRACCAR_PASSWORD ?? ''}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

const allowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

/** CORS headers for an allowed origin; `null` when the origin is not one of ours. No Origin header (curl, server): no CORS needed. */
function corsHeaders(origin: string | null, env: Env): Record<string, string> | null {
  if (!origin) return {}
  if (!allowedOrigins(env).includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

/** Every cookie Traccar set, as a Cookie header value. Not just one by name: whatever Traccar calls its session, we send back. */
function collectCookies(headers: Headers): string | null {
  const lines = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') ?? '']
  const pairs = lines
    .map((line) => line.split(';')[0].trim())
    .filter((pair) => /^[^=\s]+=[^\s]+$/.test(pair) && !/=deleteMe$/i.test(pair))
  return pairs.length > 0 ? pairs.join('; ') : null
}

/** Signs in to Traccar with the configured account. Returns the upstream response and the cookie it granted, if any. */
async function signIn(env: Env): Promise<{ response: Response; cookie: string | null }> {
  const response = await fetch(`${upstreamOf(env)}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ email: env.TRACCAR_EMAIL ?? '', password: env.TRACCAR_PASSWORD ?? '' }),
  })
  const cookie = response.ok ? collectCookies(response.headers) : null
  if (cookie) sessionCookie = cookie
  return { response, cookie }
}

/** The cookie to use, signing in first if there is none (or if the last one was rejected). Concurrent callers share one sign-in. */
async function cookieFor(env: Env, renew = false): Promise<string | null> {
  if (renew) sessionCookie = null
  if (sessionCookie) return sessionCookie
  signingIn ??= signIn(env)
    .then(({ cookie }) => cookie ?? '')
    .finally(() => {
      signingIn = null
    })
  return (await signingIn) || null
}

/** Asks Traccar for an access token with the account's Basic credentials. `null` when the server does not give one. */
async function requestToken(env: Env): Promise<string | null> {
  const expiration = new Date(Date.now() + 2 * TOKEN_REUSE_MS).toISOString()
  const response = await fetch(`${upstreamOf(env)}/api/session/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(env),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/plain, application/json',
      Origin: new URL(upstreamOf(env)).origin,
    },
    body: new URLSearchParams({ expiration }),
  })
  if (!response.ok) return null
  const value = (await response.text()).trim().replace(/^"|"$/g, '')
  if (!value) return null
  socketToken = { value, until: Date.now() + TOKEN_REUSE_MS }
  return value
}

/** The token to use, requesting one if there is none (or if the last one was refused). Concurrent callers share one request. */
async function tokenFor(env: Env, renew = false): Promise<string | null> {
  if (renew) socketToken = null
  if (socketToken && socketToken.until > Date.now()) return socketToken.value
  requestingToken ??= requestToken(env).finally(() => {
    requestingToken = null
  })
  return requestingToken
}

/**
 * The request as Traccar should see it: the same call, authenticated as the Worker's account, and an Origin that is
 * Traccar's own (like the dev proxy). Nothing the browser sent for authentication (cookies, Authorization) goes through.
 */
function toUpstream(request: Request, url: URL, env: Env, cookie: string | null, token: string | null = null): Request {
  const headers = new Headers(request.headers)
  headers.set('Authorization', basicAuth(env))
  if (cookie) headers.set('Cookie', cookie)
  else headers.delete('Cookie')
  headers.set('Origin', new URL(upstreamOf(env)).origin)
  headers.delete('Referer')
  const target = new URL(`${upstreamOf(env)}${url.pathname}${url.search}`)
  if (token) target.searchParams.set('token', token)
  return new Request(target, { method: request.method, headers })
}

/** Passes the answer on without anything that would tie the browser to the Traccar session. */
function toBrowser(upstream: Response, cors: Record<string, string>): Response {
  const headers = new Headers(upstream.headers)
  for (const name of ['set-cookie', 'content-encoding', 'content-length', 'access-control-allow-origin']) headers.delete(name)
  headers.set('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(cors)) headers.set(name, value)
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const cors = corsHeaders(origin, env)

  if (request.method === 'OPTIONS') {
    if (!cors) return json(403, { error: 'Origin not allowed' })
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Accept',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (url.pathname === '/' || url.pathname === '/health') return json(200, { ok: true, service: 'rumbo-proxy' }, cors ?? {})

  const path = ROUTES.filter((route) => route.path === url.pathname)
  if (path.length === 0) return json(404, { error: 'Not found' }, cors ?? {})
  const route = path.find((candidate) => candidate.method === request.method)
  if (!route) return json(405, { error: 'Method not allowed' }, { ...(cors ?? {}), Allow: path.map((p) => p.method).join(', ') })
  if (!cors) return json(403, { error: 'Origin not allowed' })

  try {
    // The app asks to sign in; the Worker does it for real with its own account and ignores whatever the browser sent.
    // Traccar's answer is the user record (including the account's e-mail): the app does not need it, so it is not passed on.
    if (route.path === '/api/session') {
      const { response, cookie } = await signIn(env)
      if (response.ok && cookie) return json(200, { authenticated: true }, cors)
      if (response.ok) return json(502, { error: 'Traccar accepted the sign-in but sent no session cookie' }, cors)
      return json(response.status === 401 || response.status === 403 ? 401 : 502, { error: `Traccar did not accept the sign-in (HTTP ${response.status}); check TRACCAR_EMAIL and TRACCAR_PASSWORD` }, cors)
    }

    const isSocket = route.path === '/api/socket'
    if (isSocket && request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json(426, { error: 'Expected a WebSocket upgrade' }, cors)
    }

    if (!isSocket) {
      // REST: the account travels with the request, so there is no session to lose between calls.
      const response = await fetch(toUpstream(request, url, env, null))
      if (response.status === 401) {
        return json(401, { error: 'Traccar rejected the Worker account (check TRACCAR_EMAIL and TRACCAR_PASSWORD)' }, cors)
      }
      return toBrowser(response, cors)
    }

    // WebSocket. Traccar answers an upgrade it does not accept with a bare "200", so each attempt is checked for the 101
    // and what the others got is kept, to explain the failure if nothing opens.
    const tried: Array<{ via: string; status: number | string }> = []
    const attempt = async (via: string, cookie: string | null, token: string | null) => {
      const response = await fetch(toUpstream(request, url, env, cookie, token))
      if (response.status === 101) return response // the live socket: hand it over untouched
      tried.push({ via, status: response.status })
      return null
    }

    const token = await tokenFor(env)
    if (token) {
      const opened = await attempt('token', null, token)
      if (opened) return opened
      await tokenFor(env, true) // maybe it was refused: the next connection asks for a fresh one
    } else {
      tried.push({ via: 'token', status: 'not issued' })
    }

    let cookie = await cookieFor(env)
    if (cookie) {
      const opened = await attempt('cookie', cookie, null)
      if (opened) return opened
      cookie = await cookieFor(env, true) // the session may have expired: sign in again once
      if (cookie) {
        const renewed = await attempt('cookie (new sign-in)', cookie, null)
        if (renewed) return renewed
      }
    } else {
      tried.push({ via: 'cookie', status: 'no cookie' })
    }
    return json(502, { error: 'Traccar did not open the WebSocket', tried }, cors)
  } catch {
    // Traccar is down or unreachable. Say so with CORS headers, so the browser shows the app's error screen
    // instead of an opaque network failure.
    return json(502, { error: 'Could not reach Traccar' }, cors)
  }
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
}
