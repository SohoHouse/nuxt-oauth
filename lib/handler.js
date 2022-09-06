const sessions = require('client-sessions')
const OAuth2 = require('client-oauth2')
const { atob, btoa } = require('Base64')
const { parse } = require('qs')
const join = require('url-join')

function Handler (opts) {
  this.init(opts)
}

Handler.prototype.init = function init ({
  req, res, next, options = { sessionName: 'nuxtSession' }
} = {}) {
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
  const protocol = this.req.headers['x-forwarded-proto'] || this.req.headers['X-Forwarded-Proto'] || 'http'

  return new OAuth2({
    authorizationUri: join(oauthHost, authorizationPath),
    accessTokenUri: join(oauthHost, accessTokenPath),
    clientId,
    clientSecret,
    redirectUri: `${protocol}://${this.req.headers.host}/auth/callback`,
    scopes
  })
}

/**
 * TODO Handle some max retry logic to stop the spam when a token is not valid
 * * x-Retries - could be passed as a simple header
 * * npm library (requestretry)[https://www.npmjs.com/package/requestretry] might also be helpful
 */
Handler.prototype.redirect = function redirect (path) {
  this.res.writeHead(302, { location: path })
  this.res.end()
}

Handler.prototype.createSession = function createSession () {
  if (this.req[this.opts.sessionName]) return Promise.resolve()
  const session = sessions({
    cookieName: this.opts.sessionName,
    secret: this.opts.secretKey,
    duration: this.opts.sessionDuration
  })
  return new Promise(resolve => session(this.req, this.res, resolve))
}

Handler.prototype.getSessionToken = function getSessionToken () {
  const { token } = this.req[this.opts.sessionName] || {}

  return token || {}
}

Handler.prototype.checkRequestAuthorization = async function checkRequestAuthorization () {
  const existingToken = this.extractToken()

  try {
    // when an existing token exists try to authenticate the session
    if (existingToken) {
      await this.saveData({ accessToken: existingToken })
    }
  } catch (e) {
    // saveData failed, clear the session
    return this.logout()
  }

  return false
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

// @deprecated updateToken renamed to authenticate
Handler.prototype.updateToken = function updateToken (...args) {
  errorLog('nuxt-oauth [DEPRECATED] - please change any reference from `updateToken` to `authenticate`')
  return this.authenticate(...args)
}

Handler.prototype.authenticate = async function authenticate () {
  await this.createSession()

  const { accessToken, refreshToken, expires } = this.getSessionToken()

  if (!accessToken) {
    return null
  }

  try {
    const token = await this.auth.createToken(accessToken, refreshToken, 'bearer')

    token.expiresIn(new Date(expires))

    if (token.expired()) {
      const refreshedToken = await token.refresh()

      await this.saveData(refreshedToken)

      return refreshedToken
    }

    await this.saveData(token)

    return token
  } catch (e) {
    errorLog(e)
    return null
  }
}

Handler.prototype.useRefreshToken = async function useRefreshToken () {
  await this.createSession()

  const { accessToken, refreshToken } = this.getSessionToken()

  if (!accessToken || !refreshToken) {
    return null
  }

  try {
    const token = await this.auth.createToken(accessToken, refreshToken, 'bearer')

    const refreshedToken = await token.refresh()

    await this.saveData(refreshedToken)

    return refreshedToken
  } catch (e) {
    errorLog(e)
    return null
  }
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

Handler.prototype.setTokens = async function setTokens (accessToken, refreshToken) {
  await this.createSession()

  try {
    const token = await this.auth.createToken(accessToken, refreshToken, 'bearer')

    const refreshedToken = await token.refresh()

    await this.saveData(refreshedToken)

    return true
  } catch (e) {
    errorLog(e)
    return null
  }
}

Handler.routes = {
  login: '/auth/login',
  callback: '/auth/callback',
  logout: '/auth/logout',
  refresh: '/auth/refresh'
}

Handler.prototype.isRoute = function isRoute (route) {
  const path = this.constructor.routes[route]

  return this.req.url.startsWith(path)
}

Handler.prototype.extractToken = function extractToken () {
  const { headers: { authorization } } = this.req

  if (!authorization) return null

  // Take the second split, handles all token types
  const [, token] = authorization.split(' ')

  return token
}

module.exports = Handler
