/**
 * Rumbo's proxy to Traccar, as a Cloudflare Worker.
 *
 * Why it exists: the public Traccar demo servers send no CORS headers, and a static host's rewrites cannot carry a
 * WebSocket. This Worker sits in between and also holds the Traccar sign-in, so neither the password nor the session
 * cookie ever reaches the browser.
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

/** For tests: forget the session. */
export function resetSession() {
  sessionCookie = null
  signingIn = null
}

const upstreamOf = (env: Env) => (env.TRACCAR_URL || DEFAULT_UPSTREAM).replace(/\/+$/, '')

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

/** Cookie names only (never values): safe to show when explaining what went wrong. */
const cookieNames = (cookie: string | null) => (cookie ? cookie.split(';').map((pair) => pair.split('=')[0].trim()) : [])

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

/** The request as Traccar should see it: same call, our cookie, and an Origin that is Traccar's own (like the dev proxy). */
function toUpstream(request: Request, url: URL, env: Env, cookie: string): Request {
  const headers = new Headers(request.headers)
  headers.set('Cookie', cookie)
  headers.set('Origin', new URL(upstreamOf(env)).origin)
  headers.delete('Referer')
  return new Request(`${upstreamOf(env)}${url.pathname}${url.search}`, { method: request.method, headers })
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

    const cannotSignIn = () =>
      json(401, { error: 'The Worker could not sign in to Traccar (wrong TRACCAR_EMAIL or TRACCAR_PASSWORD, or no session cookie came back)' }, cors)

    let cookie = await cookieFor(env)
    if (!cookie) return cannotSignIn()

    let response = await fetch(toUpstream(request, url, env, cookie))
    if (response.status === 401) {
      // The session expired on Traccar's side: sign in again once and repeat the call.
      cookie = await cookieFor(env, true)
      if (!cookie) return cannotSignIn()
      response = await fetch(toUpstream(request, url, env, cookie))
      if (response.status === 401) {
        return json(401, { error: 'Traccar rejected the Worker session even after signing in again', cookies: cookieNames(cookie) }, cors)
      }
    }

    // A successful upgrade (101) carries the live socket: hand it over untouched.
    if (isSocket && response.status === 101) return response
    return toBrowser(response, cors)
  } catch {
    // Traccar is down or unreachable. Say so with CORS headers, so the browser shows the app's error screen
    // instead of an opaque network failure.
    return json(502, { error: 'Could not reach Traccar' }, cors)
  }
}

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
}
