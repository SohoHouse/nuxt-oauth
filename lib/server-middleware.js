const { parse } = require('qs')
const Handler = require('./handler')
const createTestHandler = require('./test-mode')

const setCustomValues = (options, req) => async key => {
  if (typeof options[key] !== 'function') return
  options[key] = await options[key](req)
}

const extractToken = req => {
  const { headers: { authorization } } = req

  if (!authorization) return null

  // Take the second split, handles all token types
  const [, token] = authorization.split(' ')

  return token
}

const isEmptyObject = (subject = {}) =>
  Object.entries(subject).length === 0 && subject.constructor === Object

module.exports = options => async (req, res, next) => {
  if (options.testMode) createTestHandler(Handler)

  const customKeys = ['oauthHost', 'oauthClientID', 'oauthClientSecret']
  const optionSetter = setCustomValues(options, req)
  await Promise.all(customKeys.map(optionSetter))

  const handler = new Handler({ req, res, next, options })

  const existingToken = extractToken(req)
  let invalidToken = false

  // when an existing token exists try to authenticate the session
  if (existingToken) {
    await handler.saveData({ accessToken: existingToken })

    // If we have a user, the token was valid
    if (!isEmptyObject(req.user)) {
      return next()
    }

    // Detected an invalid token being used, we should clear the session
    invalidToken = true
  }

  // Start the OAuth dance
  if (handler.isRoute('login')) {
    const redirectUrl = parse(req.url.split('?')[1])['redirect-url'] || '/'
    return handler.redirectToOAuth(redirectUrl)
  }

  // Complete the OAuth dance
  if (handler.isRoute('callback')) {
    return handler.authenticateCallbackToken()
  }

  // Clear the session
  if (invalidToken || handler.isRoute('logout')) {
    return handler.logout()
  }

  // On any other route, refresh the token
  await handler.updateToken()

  return next()
}
