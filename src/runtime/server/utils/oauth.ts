import { createHash } from 'node:crypto'
import {
  getRequestHeader,
  getRequestHost,
  useSession,
  type H3Event,
  type SessionConfig,
} from 'h3'
import { ofetch } from 'ofetch'
import { useRuntimeConfig, useNitroApp } from '#imports'
import type { ModuleOptions, OAuthSessionData } from '../../../types'

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export const getOAuthOptions = (event: H3Event): ModuleOptions =>
  (useRuntimeConfig(event) as any).oauth as ModuleOptions

/**
 * h3's `useSession` requires a >= 32 character password. Existing deployments
 * set SECRET_KEY to arbitrary (often shorter) values, so derive a stable
 * 64-char key from whatever is configured rather than crashing at runtime.
 */
const sessionPassword = (secretKey: string) =>
  createHash('sha256').update(String(secretKey)).digest('hex')

export const getOAuthSession = (event: H3Event) => {
  const opts = getOAuthOptions(event)
  const config: SessionConfig = {
    name: opts.sessionName,
    password: sessionPassword(opts.secretKey),
    maxAge: Math.floor(opts.sessionDuration / 1000),
  }
  return useSession<OAuthSessionData>(event, config)
}

const requestProtocol = (event: H3Event) =>
  getRequestHeader(event, 'x-forwarded-proto') ||
  (getRequestHost(event).startsWith('localhost') ? 'http' : 'https')

/**
 * Resolves the OAuth host for this request.
 *
 * Order: the `oauth:host` Nitro hook (escape hatch replacing the old
 * `oauthHost(req)` function option), then the static `oauthHost`, then
 * derivation from the request subdomain via `oauthDomain`.
 */
export const resolveOAuthHost = async (event: H3Event): Promise<string> => {
  const opts = getOAuthOptions(event)
  const result: { host: string | null } = { host: null }
  await useNitroApp().hooks.callHook('oauth:host', event, result)
  if (result.host) return result.host

  if (opts.oauthHost) return `${stripSlash(opts.oauthHost)}${opts.oauthPath}`

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
export const authPrefix = (event: H3Event) =>
  event.path.startsWith('/api/auth') ? '/api/auth' : '/auth'

/**
 * Builds the redirect URI from the *incoming* request, so it matches whichever
 * prefix the client entered on (`/auth` or `/api/auth`) and works on localhost.
 */
export const buildRedirectUri = (event: H3Event) =>
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
    // Older clients (and the /api mount) may pass the path unencoded.
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
  event: H3Event,
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
export const saveToken = async (event: H3Event, token: TokenResponse) => {
  const session = await getOAuthSession(event)
  const expires = Date.now() + (token.expires_in ?? 1800) * 1000

  const result: { user: unknown } = { user: session.data.user ?? null }
  if (!result.user) {
    try {
      await useNitroApp().hooks.callHook(
        'oauth:fetchUser',
        event,
        token.access_token,
        result
      )
    } catch {
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
 * Establishes a session from tokens obtained outside the OAuth dance — e.g.
 * account creation, which signs the new member straight in. Replaces the Nuxt 2
 * `req.oauth.setTokens(accessToken, refreshToken)`.
 */
export const setSessionTokens = (
  event: H3Event,
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
export const refreshSession = async (event: H3Event) => {
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
    logError(e)
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

export const fakeToken = (): TokenResponse => ({
  access_token: 'accessToken',
  refresh_token: 'refreshToken',
  expires_in: 1800,
})
