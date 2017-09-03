const { parse } = require('qs')
const Handler = require('./handler')

module.exports = options => async (req, res, next) => {
  const handler = new Handler({ req, res, options })

  // Start the OAuth dance
  if (req.url.startsWith('/auth/login')) {
    const redirectUrl = parse(req.url.split('?')[1])['redirect-url'] || '/'
    return handler.redirectToOAuth(redirectUrl)
  }

  // Complete the OAuth dance
  if (req.url.startsWith('/auth/callback')) return handler.authenticateToken()

  // Clear the session
  if (req.url.startsWith('/auth/logout')) return handler.logout()

  // On any other route, refresh the token
  await handler.updateToken()
  return next()
}
