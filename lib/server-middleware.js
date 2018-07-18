const { parse } = require('qs')
const Handler = require('./handler')
const createTestHandler = require('./test-mode')

const setCustomValues = (options, req) => async key => {
  if (typeof options[key] !== 'function') return
  options[key] = await options[key](req)
}

module.exports = options => async (req, res, next) => {
  if (options.testMode) createTestHandler(Handler)

  const customKeys = ['oauthHost', 'oauthClientID', 'oauthClientSecret']
  const optionSetter = setCustomValues(options, req)
  await Promise.all(customKeys.map(optionSetter))

  var handler = new Handler({ req, res, next, options })

  // Start the OAuth dance
  if (handler.isRoute('login')) {
    const queryParams = parse(req.url.split('?')[1])

    const redirectUrl = queryParams['redirect-url'] || '/'
    const oauthHost = queryParams['oauthHost'] || null
    if(oauthHost && !(oauthHost.toLowerCase() === handler.opts.oauthHost.toLowerCase())) {
        // re-configure oauthHost
        options.oauthHost = oauthHost
        handler = new Handler({ req, res, next, options })
    }
    return handler.redirectToOAuth(redirectUrl, oauthHost)
  }

  // Complete the OAuth dance
  if (handler.isRoute('callback')) return handler.authenticateCallbackToken()

  // Clear the session
  if (handler.isRoute('logout')) return handler.logout()

  // On any other route, refresh the token
  await handler.updateToken()
  return next()
}
