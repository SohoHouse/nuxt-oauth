import { defineEventHandler, getRequestHeader } from 'h3'
import {
  getOAuthOptions,
  getOAuthSession,
  isExpired,
  logError,
  refreshSession,
  saveToken,
} from '../utils/oauth'
import type { OAuthContext } from '../../../types'

/**
 * Populates `event.context.oauth` on every render request so the Nuxt plugin
 * can hand the token to the client during SSR. Without this the app has no way
 * to learn it is authenticated and every guarded route bounces to login.
 */
export default defineEventHandler(async (event) => {
  const path = event.path
  if (
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt_island') ||
    path.startsWith('/auth') ||
    path.startsWith('/api/auth')
  ) {
    return
  }

  const opts = getOAuthOptions(event)
  const bearer = getRequestHeader(event, 'authorization')?.split(' ')[1]
  const hasSessionCookie = (getRequestHeader(event, 'cookie') || '').includes(
    `${opts.sessionName}=`
  )

  // Fast path: nothing to unseal.
  if (!bearer && !hasSessionCookie) return

  try {
    // A caller-supplied bearer token wins and is adopted into the session,
    // matching the old `checkRequestAuthorization` behaviour.
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
