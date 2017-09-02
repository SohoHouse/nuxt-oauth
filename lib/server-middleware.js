const { parse } = require('qs')
const Handler = require('./handler')

module.exports = options => async (req, res, next) => {
  const handler = new Handler({ req, res, options })

  // Start the OAuth dance
  if (req.url.startsWith('/auth/login')) {
    const { redirectUrl = '/' } = parse(req.url.split('?')[1])
    return handler.redirectToOAuth(redirectUrl)
  }

  // Complete the OAuth dance
  if (req.url.startsWith('/auth/callback')) return handler.authenticateToken()

  // On any other route, refresh the token
  handler.updateToken()
  return next()
}
