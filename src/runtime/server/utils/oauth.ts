import { createHash } from 'node:crypto'
import {
  getRequestHeader,
  getRequestHost,
  useRuntimeConfig,
  useServerHooks,
  useSession,
  type RequestEvent,
  type SessionConfig,
} from 'nuxt/server'
import { ofetch } from 'ofetch'
import type { ModuleOptions, OAuthSessionData } from '../../../types'

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

// The event is unused: runtime config is not per-request under `nuxt/server`.
export const getOAuthOptions = (_event?: RequestEvent): ModuleOptions =>
  (useRuntimeConfig() as any).oauth as ModuleOptions

/** The sealed session requires a >= 32 char password, and SECRET_KEY is often shorter. */
const sessionPassword = (secretKey: string) =>
  createHash('sha256').update(String(secretKey)).digest('hex')

export const getOAuthSession = (event: RequestEvent) => {
  const opts = getOAuthOptions(event)
  const config: SessionConfig = {
    name: opts.sessionName,
    password: sessionPassword(opts.secretKey),
    maxAge: Math.floor(opts.sessionDuration / 1000),
  }
  return useSession<OAuthSessionData>(event, config)
}

const requestProtocol = (event: RequestEvent) =>
  getRequestHeader(event, 'x-forwarded-proto') ||
  (getRequestHost(event).startsWith('localhost') ? 'http' : 'https')

/** Resolution order: the `oauth:host` hook, then `oauthHost`, then `oauthDomain`. */
export const resolveOAuthHost = async (event: RequestEvent): Promise<string> => {
  const opts = getOAuthOptions(event)
  const result: { host: string | null } = { host: null }
  await useServerHooks().callHook('oauth:host', event, result)
  if (result.host) return result.host

  // Verbatim: oauthHost carries its own path.
  if (opts.oauthHost) return stripSlash(opts.oauthHost)

  if (!opts.oauthDomain) {
    throw new Error(
      'nuxt-oauth: neither `oauthHost` nor `oauthDomain` is configured'
    )
  }

  const branch = getRequestHost(event).split('.')[0].replace(/^dih-/, '')
  return `https://${branch}.${stripSlash(opts.oauthDomain)}${opts.oauthPath}`
}

const stripSlash = (value: string) => value.replace(/\/+$/, '')

/** Whichever prefix this request came in on, so redirects stay on it. */
export const authPrefix = (event: RequestEvent) =>
  event.url.pathname.startsWith('/api/auth') ? '/api/auth' : '/auth'

const DEFAULT_PREFIXES = ['/auth', '/api/auth']

/**
 * Whether a path belongs to one of the auth route mounts. Matches the prefix
 * itself or anything below it, so `/auth/login` qualifies but `/authors` — a
 * page of the app — does not.
 */
export const isAuthPath = (
  path: string,
  prefixes: readonly string[] = DEFAULT_PREFIXES
) =>
  prefixes.some((p) => {
    const prefix = p.replace(/\/+$/, '')
    return path === prefix || path.startsWith(`${prefix}/`)
  })

/** Built from the incoming request, so it matches on any host or prefix. */
export const buildRedirectUri = (event: RequestEvent) =>
  `${requestProtocol(event)}://${getRequestHost(event)}${authPrefix(event)}/callback`

export const encodeState = (redirectUrl: string) =>
  Buffer.from(JSON.stringify({ redirectUrl }), 'utf8').toString('base64')

export const decodeState = (state?: string): string => {
  if (!state) return '/'
  try {
    const { redirectUrl } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf8')
    )
    return sanitizeRedirect(redirectUrl)
  } catch {
    // Some callers pass the path unencoded.
    return sanitizeRedirect(state)
  }
}

/** Only ever redirect to a path on this origin — never to an absolute URL. */
export const sanitizeRedirect = (target?: string): string => {
  if (!target || typeof target !== 'string') return '/'
  if (!target.startsWith('/') || target.startsWith('//')) return '/'
  return target
}

export const exchangeToken = async (
  event: RequestEvent,
  params: Record<string, string>
): Promise<TokenResponse> => {
  const opts = getOAuthOptions(event)
  const host = await resolveOAuthHost(event)

  return ofetch<TokenResponse>(`${host}${opts.accessTokenPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.oauthClientID,
      client_secret: opts.oauthClientSecret,
      ...params,
    }).toString(),
  })
}

/** Persists a token to the session and resolves the user via the `oauth:fetchUser` hook. */
export const saveToken = async (event: RequestEvent, token: TokenResponse) => {
  const session = await getOAuthSession(event)
  const expires = Date.now() + (token.expires_in ?? 1800) * 1000

  const result: { user: unknown } = { user: session.data.user ?? null }
  if (!result.user) {
    try {
      await useServerHooks().callHook(
        'oauth:fetchUser',
        event,
        token.access_token,
        result
      )
    } catch (e) {
      // The member still signs in; only the session's cached user is missing.
      reportError('oauth:fetchUser hook failed', e, 'warn')
      result.user = null
    }
  }

  await session.update({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? session.data.refreshToken ?? null,
    expires,
    user: result.user,
  })

  return { accessToken: token.access_token, expires, user: result.user }
}

/**
 * Whether a caller-supplied bearer token may be adopted into the session.
 * Denied unless an `oauth:verifyToken` handler sets `result.valid = true`.
 */
export const isTokenVerified = async (
  event: RequestEvent,
  accessToken: string
): Promise<boolean> => {
  const result = { valid: false }
  try {
    await useServerHooks().callHook(
      'oauth:verifyToken',
      event,
      accessToken,
      result
    )
  } catch (e) {
    reportError('oauth:verifyToken hook failed, ignoring bearer token', e, 'warn')
    return false
  }
  return result.valid === true
}

/** Signs a member in from tokens obtained elsewhere, e.g. account creation. */
export const setSessionTokens = (
  event: RequestEvent,
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number
) =>
  saveToken(event, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  })

export const isExpired = (expires?: number) =>
  !expires || expires - Date.now() < 60_000

/** Refreshes the session token in place. Returns null when refresh is impossible. */
export const refreshSession = async (event: RequestEvent) => {
  const session = await getOAuthSession(event)
  const { refreshToken } = session.data
  if (!refreshToken) return null

  try {
    const token = await exchangeToken(event, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    return await saveToken(event, token)
  } catch (e) {
    // Expected when the refresh token expired or was rotated, but it is also
    // how a provider outage looks: the member is silently signed out either way.
    reportError('token refresh failed', e, 'warn')
    return null
  }
}

export const logError = (e: unknown) => {
  if (!import.meta.dev) return
  // ofetch hides the provider's reason in response._data; surface it.
  const err = e as any
  console.error('[nuxt-oauth]', err?.message ?? err)
  const body = err?.response?._data ?? err?.data
  if (body) console.error('[nuxt-oauth] provider response:', body)
}

/**
 * Unlike `logError`, this logs in production too. Use it where a failure
 * quietly changes what the member sees (signed out, IdP session left alive).
 * Only the message is logged: the provider's response body can carry secrets,
 * so it is shown in dev alone.
 */
export const reportError = (
  what: string,
  e: unknown,
  level: 'warn' | 'error' = 'error'
) => {
  const err = e as any
  console[level](`[nuxt-oauth] ${what}:`, err?.message ?? String(e))
  if (!import.meta.dev) return
  const body = err?.response?._data ?? err?.data
  if (body) console[level]('[nuxt-oauth] provider response:', body)
}

export const fakeToken = (): TokenResponse => ({
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 1800,
})
