import sessions from 'client-sessions'
import OAuth2 from 'client-oauth2'
import { atob, btoa } from 'Base64'
import { get } from 'axios'

const {
  env: {
    OAUTH_CLIENT_ID: oauthClientID,
    OAUTH_CLIENT_SECRET: oauthClientSecret,
    OAUTH_HOST: oauthHost,
    SECRET_KEY: secretKey
  } = {}
} = process || {}

const sessionName = 'sohoHouseSession'

export default class AuthHandler {
  constructor ({ route, redirect, store, req, res, isServer } = {}) {
    this.req = req
    this.res = res
    this.route = route
    this.redirect = redirect
    this.store = store
    this.isServer = isServer
  }

  static async init (context) {
    const handler = new AuthHandler(context)
    return handler
  }

  get auth () {
    if (this.authClient) return this.authClient
    this.authClient = new OAuth2({
      authorizationUri: `${oauthHost}/oauth/authorize`,
      accessTokenUri: `${oauthHost}/oauth/token`,
      clientId: oauthClientID,
      clientSecret: oauthClientSecret,
      redirectUri: 'http://localhost:3000/auth/callback'
    })
    return this.authClient
  }

  createSession () {
    return new Promise(resolve => sessions({
      cookieName: sessionName,
      secret: secretKey,
      duration: 24 * 60 * 60 * 1000
    })(this.req, this.res, resolve))
  }

  async authenticateToken () {
    let redirectUrl
    try {
      redirectUrl = JSON.parse(atob(this.route.query.state)).redirectUrl
    } catch (e) {
      redirectUrl = '/'
    }
    try {
      const token = await this.auth.code.getToken(this.route)
      const { accessToken, refreshToken, expires } = token
      const { data } = await get(`${oauthHost}/api/v1/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      await this.saveUser({ ...data, token: accessToken }, { refreshToken, expires })
      return this.redirect(redirectUrl)
    } catch (e) {
      console.error(e)
      return this.redirectToOAuth()
    }
  }

  async saveUser (user, token) {
    if (!this.req[sessionName]) await this.createSession()
    this.req[sessionName].user = user
    this.req[sessionName].token = token
    this.store.commit('SET_USER', this.req[sessionName].user)
  }

  async updateUser () {
    await this.createSession()
    let { user, token } = this.req[sessionName]

    if (!user) return false
    try {
      const newToken = await this.auth.createToken(user.token, token.refreshToken, 'bearer')
      newToken.expiresIn(new Date(token.expires))

      if (newToken.expired()) {
        const { accessToken, refreshToken } = await newToken.refresh()
        user.token = accessToken
        token.refreshToken = refreshToken
      }
    } catch (e) {
      user = token = {}
    }

    return this.saveUser(user, token)
  }

  async redirectToOAuth () {
    if (!this.isServer) {
      window.location.href = this.route.path
      return this.redirect('/')
    }
    const state = JSON.stringify({ redirectUrl: this.route.path })
    const url = this.auth.code.getUri({
      state: btoa(state)
    })
    return this.redirect(url)
  }
}
