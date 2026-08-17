import { defineEventHandler, setResponseStatus } from 'h3'
import { refreshSession } from '../utils/oauth'

/** Used by the client to recover from a 401 without a full page redirect. */
export default defineEventHandler(async (event) => {
  const token = await refreshSession(event)

  if (!token) {
    setResponseStatus(event, 401)
    return { error: 'Invalid session' }
  }

  return { accessToken: token.accessToken, expires: token.expires }
})
