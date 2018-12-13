const sessions = require('client-sessions')
const OAuth2 = require('client-oauth2')
const { atob, btoa } = require('Base64')
const { parse } = require('qs')
const join = require('url-join')

function Handler (opts) {
  this.init(opts)
}

Handler.prototype.init = function init ({ req, res, next, options = { sessionName: 'nuxtSession' } } = {}) {
  this.req = req
  this.res = res
  this.next = next
  this.opts = options
  this.auth = this.createAuth()
}

const errorLog = e => process.env.NODE_ENV === 'development' && console.error(e)

Handler.prototype.createAuth = function createAuth () {
  const {
    oauthHost,
    authorizationPath = '/authorize',
    accessTokenPath = '/token',
    oauthClientID: clientId,
    oauthClientSecret: clientSecret,
    scopes = []
  } = this.opts
  let baseUrl = process.env.BASE_URL;

  if (!baseUrl) {
    const protocol = this.req.headers['x-forwarded-proto'] || this.req.headers['X-Forwarded-Proto'] || 'http'
    baseUrl = `${protocol}://${this.req.headers.host}`;
  }

  return new OAuth2({
    authorizationUri: join(oauthHost, authorizationPath),
    accessTokenUri: join(oauthHost, accessTokenPath),
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/auth/callback`,
    scopes
  }, this.opts.request)
}

Handler.prototype.redirect = function redirect (path) {
  this.res.writeHead(302, { location: path })
  this.res.end()
}

Handler.prototype.createSession = function createSession () {
  if (this.req[this.opts.sessionName]) return Promise.resolve()
  const session = sessions({
    cookieName: this.opts.sessionName,
    secret: this.opts.secretKey,
    duration: 24 * 60 * 60 * 1000,
    cookie: this.opts.domain ? {
      domain: this.opts.domain
    } : undefined
  })
  return new Promise(resolve => session(this.req, this.res, resolve))
}

Handler.prototype.authenticateCallbackToken = async function authenticateCallbackToken () {
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
    await this.saveData({ accessToken, refreshToken, expires })
    return this.redirect(redirectUrl)
  } catch (e) {
    errorLog(e)
    return this.redirectToOAuth(redirectUrl)
  }
}

Handler.prototype.saveData = async function saveData (token) {
  await this.createSession()
  if (!token) return this.req[this.opts.sessionName].reset()

  const { accessToken, refreshToken, expires } = token
  this.req[this.opts.sessionName].token = { accessToken, refreshToken, expires }
  this.req.accessToken = accessToken

  const fetchUser = async () => {
    try {
      return await this.opts.fetchUser(accessToken, this.req, this.opts)
    } catch (e) {
      return {}
    }
  }

  const user = this.req[this.opts.sessionName].user || await fetchUser()
  this.req[this.opts.sessionName].user = user
  this.req.user = user
  return true
}

Handler.prototype.updateToken = async function updateToken () {
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
  this.saveData(token)
  return true
}

Handler.prototype.redirectToOAuth = async function redirectToOAuth (redirect) {
  const redirectUrl = redirect || this.req.url
  const state = JSON.stringify({ redirectUrl })
  const url = this.auth.code.getUri({
    state: btoa(state)
  })
  return this.redirect(url)
}

Handler.prototype.logout = async function logout () {
  await this.createSession()
  this.req[this.opts.sessionName].reset()
  this.req[this.opts.sessionName].setDuration(0)

  const redirectUrl = parse(this.req.url.split('?')[1])['redirect-url'] || '/'
  try {
    await this.opts.onLogout(this.req, this.res, redirectUrl)
  } catch (err) {
    errorLog(err)
  }

  if (this.res.headersSent) return
  this.redirect(redirectUrl)
}

Handler.routes = {
  login: '/auth/login',
  callback: '/auth/callback',
  logout: '/auth/logout'
}

Handler.prototype.isRoute = function isRoute (route) {
  const path = this.constructor.routes[route]

  return this.req.url.startsWith(path)
}

module.exports = Handler
