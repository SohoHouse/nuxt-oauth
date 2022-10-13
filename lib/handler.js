const sessions = require('client-sessions')
const OAuth2 = require('client-oauth2')
const { atob, btoa } = require('Base64')
const { parse } = require('qs')
const join = require('url-join')

const pick = (items) => (obj) => items
  .reduce((acc, key) => {
    obj[key] && (acc[key] = obj[key])
    return acc
  }, {})
const pickTokenProps = pick(['accessToken', 'refreshToken', 'expires'])

const DEFAULT_TOKEN_DURATION = 60 * 30 // NOTE: Half an hour

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

// Logs errors to the console if application is running in development mode
const errorLog = e => process.env.NODE_ENV === 'development' && console.error(e)

/**
 * 
 * @returns { Object } An OAuth2 Instance
 */
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

/**
 * Ensures an encrypted session is attached to the request object
 * TODO: The session instance could be added to Nuxt serverMiddleware
 * Connect handler, ensuring that it was always available on each request 
 *
 * @returns { Promise } An encrypted sessionToken instance 
 */
Handler.prototype.createSession = function createSession () {
  if (this.req[this.opts.sessionName]) return Promise.resolve()
  const session = sessions({
    cookieName: this.opts.sessionName,
    secret: this.opts.secretKey,
    duration: this.opts.sessionDuration
  })
  return new Promise(resolve => session(this.req, this.res, resolve))
}

/**
 * Returns the accessToken appended to the sessionToken instance or an emopty object
 * TODO: Rename getAccessToken?
 *
 * @returns { [string|Object] } The accessToken if it has been added to the sessionToken
 */
Handler.prototype.getSessionToken = function getSessionToken () {
  const { token } = this.req[this.opts.sessionName] || {}
  return token || {}
}

/**
 * Checks that an accessToken is available before authenticating
 * TODO: Replace check for Bearer token to support other systems
 * progamatically logging in in this way
 *
 * @returns { [boolean|Promise|undefined] }
 */
Handler.prototype.checkRequestAuthorization = async function checkRequestAuthorization () {
  await this.createSession()
  const sessionToken = this.req[this.opts.sessionName].token
  
  try {
    // when a token exists update the session token
    if (sessionToken.accessToken) {
      await this.saveData(sessionToken)
    }
  } catch (e) {
    // saveData failed, clear the session
    return this.logout()
  }

  return false
}

/**
 * Checks that a valid token was passed to the callback url and stores
 * that on the session and adds a client side available accessToken to
 * the Node HTTP Request object
 *
 * @returns { Promise }
 */
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

/**
 * Appends the token to the session variable and appends the accessToken to the
 * request which makes it available to the plugin initStore method when passing
 * the authenticate middleware method
 *
 * @param { Object } token 
 * @returns 
 */
Handler.prototype.saveData = async function saveData (token) {
  await this.createSession()
  if (!token) return this.req[this.opts.sessionName].reset()
  
  const updatedToken = pickTokenProps(token)

  this.req[this.opts.sessionName].token = updatedToken
  this.req.accessToken = updatedToken.accessToken

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

/**
 * Makes a request to OAuth to check token is valid, if it isn't and has expired
 * it uses the refreshToken to fetch a new token and appends this to the sessionToken
 * TODO: This method of refreshing the token appears like it may be incorrect
 *
 * @returns { [Object|null] }
 */
Handler.prototype.authenticate = async function authenticate () {
  await this.createSession()
  
  const { token = {} } = this.req[this.opts.sessionName]
  const { accessToken, refreshToken, expires } = token
  const data = { expires_in: DEFAULT_TOKEN_DURATION }

  if (!accessToken) {
    return null
  }

  if (expires) {
    // client-oauth2 has a bug in handling expire dates passed in through data param
    // see issue https://github.com/mulesoft-labs/js-client-oauth2/issues/106
    // so we need to always pass duration, rathern than a date
    if (typeof expires === 'number' && !isNaN(expires)) {
      data.expires_in = expires
    } else {
      data.expires_in = Math.floor((Date.parse(expires) - Date.now()) / 1000, 1000)
    }
  }

  try {

    const token = await this.auth.createToken(accessToken, refreshToken, 'bearer', data)

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

/**
 * Handles the `auth/refresh` route
 *
 * @returns { [Object|null] } An OAuth2 token or null
 */
Handler.prototype.useRefreshToken = async function useRefreshToken () {
  await this.createSession()

  const { accessToken, refreshToken } = this[this.opts.sessionName].token

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

/**
 * Requests an OAuth2 Token instance using the accessToken and refreshToken
 *
 * @param { string } accessToken 
 * @param { string } refreshToken 
 * @returns { [boolean|null]} true on success null on error
 */
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

/**
 * Checks if a route path matches the Node HTTP request url path
 * TODO: This could be handled by utilising the builtin Nuxt
 * serverMiddleware Connect handler
 *
 * @param { string } route - A Handler.routes route key 
 * @returns { boolean }
 */
Handler.prototype.isRoute = function isRoute (route) {
  const path = this.constructor.routes[route]

  return this.req.url.startsWith(path)
}

module.exports = Handler
