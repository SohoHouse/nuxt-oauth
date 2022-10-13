const sessions = require('client-sessions')
const OAuth2 = require('client-oauth2')
const { atob, btoa } = require('Base64')
const { parse } = require('url')
const join = require('url-join')

const { INVALID_SESSION, DEFAULT_TOKEN_DURATION } = require('./constants')

// Invoke runtime option methods with the request object
const evaluateRuntimeOptions = async (options, req) => Object.fromEntries(
  await Promise.all(Object.entries(options).map(
    async ([key, value]) => typeof value === 'function' ? [key, await value(req)] : [key, value]
  ))
)

const bindAll = (obj, that = null) => {
  const context = that || obj
  console.log('bindAll')
  Object.keys(obj).forEach((method) => {
    console.log('binding', method)
    const type = typeof obj[method]
    type === 'function' && obj[method].bind(context)
  })
}

const pick = (items) => (obj) => items
  .reduce((acc, key) => {
    obj[key] && (acc[key] = obj[key])
    return acc
  }, {})

const pickTokenProps = pick(['accessToken', 'refreshToken', 'expires'])

// Logs errors to the console if application is running in development mode
const errorLog = e => process.env.NODE_ENV === 'development' && console.error(e)

function Handler ({
  sessionName = 'nuxtSession',
  sessionDuration,
  secretKey,
  onLogout = () => {},
  fetchUser = () => {},
  ...options
}) {
  const session = sessions({
    cookieName: sessionName,
    secret: secretKey,
    duration: sessionDuration
  })

  const handler = async (req, res, next) => {
    /**
    * This is only required for the dynamic runtime options
    * NOTE: Please remove at your earliest convenience
    */
    const evalOptions = await evaluateRuntimeOptions(options, req)
    this.auth = this.createAuth(evalOptions)
    return session(req, res, next)
  }

  // Ensure return function inherits Handler prototype instance
  Object.setPrototypeOf(handler, this)

  // Assign static props to Handler instance
  Object.assign(handler, Handler, {
    sessionName,
    onLogout,
    fetchUser,
  })

  return handler
}

Handler.prototype.constructor = Handler

/**
 * @returns { Object } An OAuth2 Instance
 */
Handler.prototype.createAuth = function createAuth (
  {
    protocol = 'http',
    host,
    oauthHost,
    authorizationPath = '/oauth/authorize',
    accessTokenPath = '/oauth/token',
    oauthClientID: clientId,
    oauthClientSecret: clientSecret,
    scopes = [],
  }
) {
  return new OAuth2({
    authorizationUri: join(oauthHost, authorizationPath),
    accessTokenUri: join(oauthHost, accessTokenPath),
    clientId,
    clientSecret,
    redirectUri: `${protocol}://${host}/auth/callback`,
    scopes,
  })
}

/**
 * Begin the OAuth dance, redirect the user to the authorization endpoint
 *
 * @param {*} req 
 * @param {*} res 
 */
Handler.prototype.login = function login (req, res) {
  const { query: { redirect_url = req.url } } = parse(req.url, true)
  const state = JSON.stringify({ redirectUrl: redirect_url })
  const uri = this.auth.code.getUri({
    state: btoa(state)
  })

  res.writeHead(302, { location: uri })
  res.end()
}

/**
 * Accepts the authorised user code and requests an new accessToken
 * that is then stored on the client session
 *
 * @param {*} req 
 * @param {*} res 
 */
Handler.prototype.callback = async function callback (req, res) {
  const { query: { state } } = parse(req.url, true)
  const { redirectUrl = '/' } = JSON.parse(atob(state))
  
  try {
    const token = await this.auth.code.getToken(req.originalUrl)
    const { accessToken } = token

    req[this.sessionName].token = pickTokenProps(token)
    
    const fetchUser = async () => {
      try {
        return await this.fetchUser(accessToken, req)
      } catch (e) {
        errorLog(e)
        return {}
      }
    }
    req[this.sessionName].user = req[this.sessionName].user || await fetchUser()
    res.writeHead(302, { location: redirectUrl })
    res.end()
  } catch (e) {
    errorLog(e)
    // TODO: Redirect to login?
    // res.redirect(Handler.routes.login)???
  }
}

/**
 * Ends authentication session
 *
 * @param {*} req 
 * @param {*} res 
 */
Handler.prototype.logout = async function logout (req, res) {
  const { query: { redirect_url = '/' } } = parse(req.url, true)

  req[this.sessionName].reset()
  req[this.sessionName].setDuration(0)

  try {
    await this.onLogout(req, res, redirect_url)
  } catch (err) {
    errorLog(err)
    // TODO: How to handle error here?
  }

  if (res.headersSent) return
  res.writeHead(302, { location: redirect_url })
  res.end()
}

/**
 * Requests a new auth token
 *
 * @returns { undefined }
 */
Handler.prototype.refresh = async function refresh (req, res) {
  try {
    const { accessToken, refreshToken } = await req[this.sessionName].token
    const token = this.auth.createToken(accessToken, refreshToken, 'bearer')
    const refreshedToken = await token.refresh()
    const tokenProps = pickTokenProps(refreshedToken)
    const body = JSON.stringify(tokenProps)

    req[this.sessionName].token = tokenProps
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
  } catch(err) {
    errorLog(err)
    // NOTE: If token can't be refreshed then redirect user back to login
    const body = JSON.stringify({ error: INVALID_SESSION })

    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(body)
  }
}

module.exports = Handler
