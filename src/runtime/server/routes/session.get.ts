import { defineEventHandler } from 'h3'
import { getSession, isExpired, refreshSession } from '../utils/oauth'

export default defineEventHandler(async (event) => {
  const session = await getSession(event)

  if (!session.data.accessToken) return { authenticated: false }

  if (isExpired(session.data.expires)) {
    const refreshed = await refreshSession(event)
    if (!refreshed) return { authenticated: false }
    return {
      authenticated: true,
      accessToken: refreshed.accessToken,
      expires: refreshed.expires,
      user: refreshed.user,
    }
  }

  return {
    authenticated: true,
    accessToken: session.data.accessToken,
    expires: session.data.expires,
    user: session.data.user ?? null,
  }
})
