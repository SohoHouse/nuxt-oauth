import {
  defineEventHandler,
  getQuery,
  sendRedirect,
  useServerHooks,
} from 'nuxt/server'
import { getOAuthSession, reportError, sanitizeRedirect } from '../utils/oauth'

export default defineEventHandler(async (event) => {
  const redirectUrl = sanitizeRedirect(
    getQuery(event)['redirect-url'] as string
  )

  const session = await getOAuthSession(event)
  await session.clear()

  // Lets the app sign the member out at the provider too: a handler sets
  // `result.redirect` to send the member there instead of `redirectUrl`.
  const result: { redirect: string | null } = { redirect: null }
  try {
    await useServerHooks().callHook('oauth:logout', event, redirectUrl, result)
  } catch (e) {
    // Falls back to `redirectUrl`, which leaves the provider's session alive:
    // the next login would silently re-authenticate. Make that visible.
    reportError('oauth:logout hook failed, skipping provider sign-out', e)
  }

  return sendRedirect(event, result.redirect ?? redirectUrl, 302)
})
