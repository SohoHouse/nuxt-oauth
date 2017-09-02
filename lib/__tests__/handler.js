import moment from 'moment'
import OAuth from 'client-oauth2'
import sessions from 'client-sessions'
import { atob, btoa } from 'Base64'
import Handler from '../handler'

jest.mock('client-oauth2')
jest.mock('client-sessions', () => jest.fn(() => (req, res, resolve) => resolve()))

let req
let res
let options
let token
let refreshedToken
let reqWithSession
let mockToken

beforeEach(() => {
  req = {
    headers: { host: 'localhost:3000' },
    url: '/path'
  }
  res = {}
  options = {
    oauthHost: 'oauthHost',
    oauthClientID: 'oauthClientID',
    oauthClientSecret: 'oauthClientSecret',
    sessionName: 'testSession',
    secretKey: 'sekret'
  }
  token = {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    expires: moment().add(1, 'd').format()
  }
  refreshedToken = {
    accessToken: 'newAccessToken',
    refreshToken: 'newRefreshToken',
    expires: moment().add(1, 'd').format()
  }
  reqWithSession = {
    ...req,
    [options.sessionName]: {
      token
    }
  }
  mockToken = {
    expiresIn: jest.fn(),
    expired: jest.fn(() => false),
    refresh: jest.fn(() => refreshedToken)
  }
})


afterEach(() => {
  sessions.mockClear()
  OAuth.mockClear()
})

describe('Handler', () => {
  it('is a constructor', () => {
    const handler = new Handler({ req, res, options })
    expect(handler instanceof Handler).toBeTruthy()
  })

  it('instantiates an OAuth client', () => {
    const expected = {
      authorizationUri: `${options.oauthHost}/oauth/authorize`,
      accessTokenUri: `${options.oauthHost}/oauth/token`,
      clientId: options.oauthClientID,
      clientSecret: options.oauthClientSecret,
      redirectUri: `http://${req.headers.host}/auth/callback`
    }
    const handler = new Handler({ req, res, options })

    expect(OAuth).toBeCalledWith(expected)
    expect(handler.auth).toBeTruthy()
  })

  describe('#createSession', () => {
    it('uses the correct options', async () => {
      const handler = new Handler({ req, res, options })
      await handler.createSession()

      expect(sessions).toBeCalledWith({
        duration: 86400000, // 1 day,
        cookieName: options.sessionName,
        secret: options.secretKey
      })
    })

    it('doesnt do anything if the session exists', async () => {
      const handler = new Handler({ req: reqWithSession, res, options })
      await handler.createSession()

      expect(sessions).not.toBeCalled()
    })
  })

  describe('#saveToken', () => {
    let handler
    beforeEach(async () => {
      handler = new Handler({ req: reqWithSession, res, options })
      handler.createSession = jest.fn(async () => {})
      await handler.saveToken(token)
    })

    it('creates a session', () => {
      expect(handler.createSession).toHaveBeenCalled()
    })

    it('saves the access token', () => {
      expect(handler.req.accessToken).toBe(token.accessToken)
    })

    it('saves the token details to the session', () => {
      expect(handler.req[options.sessionName]).toEqual({ token })
    })
  })

  describe('#updateToken', () => {
    let handler

    beforeEach(() => {
      handler = new Handler({ req: reqWithSession, res, options })
      handler.createSession = jest.fn(async () => {})
      handler.saveToken = jest.fn(async () => {})

      handler.auth.createToken = jest.fn(() => mockToken)
    })

    it('creates a session', async () => {
      await handler.updateToken()
      expect(handler.createSession).toHaveBeenCalled()
    })

    it('does nothing else if no token exists already', async () => {
      handler.req[options.sessionName] = {}
      await handler.updateToken()

      await handler.updateToken()
      expect(mockToken.refresh).not.toHaveBeenCalled()
      expect(handler.saveToken).not.toHaveBeenCalled()
    })

    it('saves the token', async () => {
      await handler.updateToken()
      expect(mockToken.refresh).not.toHaveBeenCalled()
      expect(handler.saveToken).toHaveBeenCalledWith(token)
    })

    it('refreshes the token if its expired', async () => {
      mockToken.expired.mockImplementationOnce(() => true)
      await handler.updateToken()
      expect(mockToken.refresh).toHaveBeenCalled()
      expect(handler.saveToken).toHaveBeenCalledWith(refreshedToken)
    })
  })

  describe('#authenticateToken', () => {
    let handler
    beforeEach(() => {
      const state = btoa(JSON.stringify({ redirectUrl: '/path' }))
      req.url = `/auth/callback?state=${state}`

      handler = new Handler({ req, res, options })
      handler.saveToken = jest.fn(async () => {})
      handler.redirect = jest.fn(() => {})
      handler.redirectToOAuth = jest.fn(() => {})

      handler.auth.code = {
        getToken: jest.fn(() => token)
      }
    })

    it('saves the token', async () => {
      await handler.authenticateToken()
      expect(handler.saveToken).toHaveBeenCalledWith(token)
    })

    it('redirects to the correct url', async () => {
      await handler.authenticateToken()
      expect(handler.redirect).toHaveBeenCalledWith('/path')
    })

    it('falls back to the root if cannot understand redirect url', async () => {
      handler.req.url = '/auth/callback?state=not-valid'
      await handler.authenticateToken()
      expect(handler.redirect).toHaveBeenCalledWith('/')
    })

    it('redirects back to oauth if cannot create token', async () => {
      handler.auth.code.getToken = () => { throw new Error('beep boop') }
      await handler.authenticateToken()
      expect(handler.redirectToOAuth).toHaveBeenCalled()
    })
  })
})
