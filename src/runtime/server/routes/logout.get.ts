import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import { useNitroApp } from '#imports'
import { getSession, logError, sanitizeRedirect } from '../utils/oauth'

export default defineEventHandler(async (event) => {
  const redirectUrl = sanitizeRedirect(
    getQuery(event)['redirect-url'] as string
  )

  const session = await getSession(event)
  await session.clear()

  // Lets the app sign the member out at the identity provider too — the
  // replacement for the old `onLogout(req, res, redirectPath)` option.
  // A handler that sends its own response ends the request here.
  try {
    await useNitroApp().hooks.callHook('oauth:logout', event, redirectUrl)
  } catch (e) {
    logError(e)
  }

  if (event.handled) return
  return sendRedirect(event, redirectUrl, 302)
})
