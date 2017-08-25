const { parse } = require('qs')
const AuthHandler = require('../auth-handler')

module.exports = options => async (req, res, next) => {
  const handler = new AuthHandler({ req, res, options })
  if (req.url.startsWith('/auth/login')) {
    const { redirectUrl = '/' } = parse(req.url.split('?')[1])
    return handler.redirectToOAuth(redirectUrl)
  }
  if (req.url.startsWith('/auth/callback')) return handler.authenticateToken()
  handler.updateUser()
  return next()
}
