const sessions = require('client-sessions')
const OAuth2 = require('client-oauth2')
const { atob, btoa } = require('Base64')
const { parse } = require('qs')

const AuthHandler = function AuthHandler ({ req, res, options = { sessionName: 'nuxtSession' } } = {}) {
  this.req = req
  this.res = res
  this.opts = options
  this.auth = this.createAuth()
}

const errorLog = e => process.env.NODE_ENV === 'development' && console.error(e)

AuthHandler.prototype.createAuth = function createAuth () {
  const { oauthHost, oauthClientID, oauthClientSecret } = this.opts

  return new OAuth2({
    authorizationUri: `${oauthHost}/oauth/authorize`,
    accessTokenUri: `${oauthHost}/oauth/token`,
    clientId: oauthClientID,
    clientSecret: oauthClientSecret,
    redirectUri: `http://${this.req.headers.host}/auth/callback`
  })
}

AuthHandler.prototype.redirect = function redirect (path) {
  this.res.writeHead(301, { location: path })
  this.res.end()
}

AuthHandler.prototype.createSession = function createSession () {
  if (this.req[this.opts.sessionName]) return Promise.resolve()
  return new Promise(resolve => sessions({
    cookieName: this.opts.sessionName,
    secret: this.opts.secretKey,
    duration: 24 * 60 * 60 * 1000
  })(this.req, this.res, resolve))
}

AuthHandler.prototype.authenticateToken = async function authenticateToken () {
  let redirectUrl
  try {
    const { state } = parse(this.req.url.split('?')[1])
    redirectUrl = JSON.parse(atob(state)).redirectUrl
  } catch (e) {
    errorLog(e)
    redirectUrl = '/'
  }
  try {
    const token = await this.auth.code.getToken(this.req.url)
    const { accessToken, refreshToken, expires } = token
    await this.saveToken({ accessToken, refreshToken, expires })
    return this.redirect(redirectUrl)
  } catch (e) {
    errorLog(e)
    return this.redirectToOAuth(redirectUrl)
  }
}

AuthHandler.prototype.saveToken = async function saveToken (token) {
  await this.createSession()
  this.req[this.opts.sessionName].token = token
  this.req.accessToken = token.accessToken
}

AuthHandler.prototype.updateToken = async function updateToken () {
  await this.createSession()
  let { token } = this.req[this.opts.sessionName]
  if (!token) return false

  try {
    const newToken = await this.auth.createToken(token.accessToken, token.refreshToken, 'bearer')
    newToken.expiresIn(new Date(token.expires))

    if (newToken.expired()) {
      const { accessToken, refreshToken } = await newToken.refresh()
      token.accessToken = accessToken
      token.refreshToken = refreshToken
    }
  } catch (e) {
    errorLog(e)
    token = null
  }
  this.saveToken(token)
  return true
}

AuthHandler.prototype.redirectToOAuth = async function redirectToOAuth (redirect) {
  const redirectUrl = redirect || this.req.url
  const state = JSON.stringify({ redirectUrl })
  const url = this.auth.code.getUri({
    state: btoa(state)
  })
  return this.redirect(url)
}

module.exports = AuthHandler
