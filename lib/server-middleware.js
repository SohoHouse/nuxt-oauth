const { parse } = require('qs')

const Handler = require('./handler')
const createTestHandler = require('./test-mode')
const { INVALID_SESSION } = require('./constants')

const setCustomValues = (options, req) => async key => {
  if (typeof options[key] !== 'function') return
  options[key] = await options[key](req)
}

module.exports = options => async (req, res, next) => {

  let optionsObj = { ...options }
  if (optionsObj.testMode) createTestHandler(Handler)

  const customKeys = ['oauthHost', 'oauthClientID', 'oauthClientSecret']
  const optionSetter = setCustomValues(optionsObj, req)
  await Promise.all(customKeys.map(optionSetter))

  const handler = new Handler({
    req, res, next, options: optionsObj
  })

  req.oauth = {
    setTokens: handler.setTokens.bind(handler)
  }

  // Refresh the token with the OAuth provider
  // useful for client side 401 handling
  if (handler.isRoute('refresh')) {
    const token = await handler.useRefreshToken()
    console.log('token', token)

    if (token) {
      const { accessToken, expires } = token
      res.writeHead(200, { 'Content-Type': 'application/json' })
      const body = JSON.stringify({ accessToken, expires })
      return res.end(body)
    }

    res.writeHead(401, { 'Content-Type': 'application/json' })
    const body = JSON.stringify({ error: INVALID_SESSION })
    console.log('!token', body)
    return res.end(body)
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
  if (handler.isRoute('logout')) {
    return handler.logout()
  }

  // Check to see if the request has a valid bearer token
  await handler.checkRequestAuthorization()

  // On any other route, authenticate
  await handler.authenticate()

  return next()
}
