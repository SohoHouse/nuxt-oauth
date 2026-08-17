import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import {
  authPrefix,
  buildRedirectUri,
  decodeState,
  exchangeToken,
  logError,
  saveToken,
} from '../utils/oauth'

export default defineEventHandler(async (event) => {
  const { code, state } = getQuery(event) as { code?: string; state?: string }
  const redirectUrl = decodeState(state)

  // Stay on the prefix this request arrived on, or a callback to /api/auth
  // would bounce the member to the other mount.
  const retry = `${authPrefix(event)}/login?redirect-url=${encodeURIComponent(redirectUrl)}`

  if (!code) {
    // No code means the dance was interrupted — send them back to the start
    // rather than surfacing a 400 to a member.
    return sendRedirect(event, retry, 302)
  }

  try {
    const token = await exchangeToken(event, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: buildRedirectUri(event),
    })
    await saveToken(event, token)
    return sendRedirect(event, redirectUrl, 302)
  } catch (e) {
    logError(e)
    return sendRedirect(event, retry, 302)
  }
})
