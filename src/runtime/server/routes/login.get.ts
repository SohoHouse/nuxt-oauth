import { defineEventHandler, getQuery, sendRedirect } from 'h3'
import {
  buildRedirectUri,
  encodeState,
  fakeToken,
  getOAuthOptions,
  resolveOAuthHost,
  sanitizeRedirect,
  saveToken,
} from '../utils/oauth'

export default defineEventHandler(async (event) => {
  const opts = getOAuthOptions(event)
  const query = getQuery(event)

  // `callbackUrl` is accepted as an alias for `redirect-url`.
  const redirectUrl = sanitizeRedirect(
    (query['redirect-url'] as string) || (query.callbackUrl as string)
  )

  if (opts.testMode) {
    await saveToken(event, fakeToken())
    return sendRedirect(event, redirectUrl, 302)
  }

  const host = await resolveOAuthHost(event)
  const params = new URLSearchParams({
    client_id: opts.oauthClientID,
    response_type: 'code',
    redirect_uri: buildRedirectUri(event),
    state: encodeState(redirectUrl),
  })
  if (opts.scopes.length) params.set('scope', opts.scopes.join(' '))

  return sendRedirect(
    event,
    `${host}${opts.authorizationPath}?${params}`,
    302
  )
})
