import { defineEventHandler, getRequestHeader } from 'nuxt/server'
import {
  getOAuthOptions,
  getOAuthSession,
  isAuthPath,
  isExpired,
  logError,
  refreshSession,
  saveToken,
} from '../utils/oauth'
import type { OAuthContext } from '../../../types'

/** Puts the session on `event.context.oauth` so SSR can pass it to the client. */
export default defineEventHandler(async (event) => {
  const opts = getOAuthOptions(event)
  const path = event.url.pathname
  // The auth routes manage the session themselves; running here too would
  // refresh a token mid-callback. Follows `routePrefixes`, and matches whole
  // path segments so an app page such as `/authors` still gets its session.
  if (
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt_island') ||
    isAuthPath(path, opts.routePrefixes)
  ) {
    return
  }

  const bearer = getRequestHeader(event, 'authorization')?.split(' ')[1]
  const hasSessionCookie = (getRequestHeader(event, 'cookie') || '').includes(
    `${opts.sessionName}=`
  )

  // Fast path: nothing to unseal.
  if (!bearer && !hasSessionCookie) return

  try {
    // A caller-supplied bearer token wins, and is adopted into the session.
    if (bearer) {
      await saveToken(event, { access_token: bearer })
    }

    const session = await getOAuthSession(event)
    let { accessToken, expires, user } = session.data

    if (accessToken && isExpired(expires)) {
      const refreshed = await refreshSession(event)
      if (refreshed) {
        ;({ accessToken, expires, user } = refreshed)
      } else {
        await session.clear()
        accessToken = undefined
      }
    }

    if (accessToken) {
      event.context.oauth = {
        accessToken,
        expires: expires ?? null,
        user: user ?? null,
      } satisfies OAuthContext
    }
  } catch (e) {
    logError(e)
  }
})
