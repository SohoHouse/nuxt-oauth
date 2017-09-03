import moment from 'moment'
import OAuth from 'client-oauth2'
import sessions from 'client-sessions'
import { btoa } from 'Base64'
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
let savedSession
let user

beforeEach(() => {
  req = {
    headers: { host: 'localhost:3000' },
    url: '/path'
  }
  res = {}
  user = {
    name: 'Frodo Baggins',
    email: 'frodo@bag.end'
  }
  options = {
    oauthHost: 'oauthHost',
    oauthClientID: 'oauthClientID',
    oauthClientSecret: 'oauthClientSecret',
    sessionName: 'testSession',
    secretKey: 'sekret',
    fetchUser: jest.fn(() => user),
    onLogout: jest.fn(() => {})
  }
  token = {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    expires: moment().add(1, 'd').format()
  }
  savedSession = {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    expires: moment().add(1, 'd').format()
  }
  refreshedToken = {
    ...token,
    accessToken: 'newAccessToken',
    refreshToken: 'newRefreshToken'
  }
  reqWithSession = {
    ...req,
    [options.sessionName]: {
      token,
      reset: jest.fn(),
      setDuration: jest.fn()
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

  describe('#saveData', () => {
    let handler
    let testToken

    beforeAll(() => {
      testToken = token
    })

    beforeEach(async () => {
      handler = new Handler({ req: reqWithSession, res, options })
      handler.createSession = jest.fn(async () => {})
      await handler.saveData(testToken)
    })

    it('creates a session', () => {
      expect(handler.createSession).toHaveBeenCalled()
    })

    describe('for a valid token', () => {
      it('saves the access token', () => {
        expect(handler.req.accessToken).toBe(token.accessToken)
      })

      it('saves the token details to the session and the request', () => {
        expect(handler.req[options.sessionName].token).toEqual(savedSession)
        expect(handler.req.accessToken).toEqual(savedSession.accessToken)
      })

      it('fetches the user', () => {
        expect(options.fetchUser).toHaveBeenCalledWith(token.accessToken)
      })

      it('saves the user to the session and the request', () => {
        expect(handler.req[options.sessionName].user).toEqual(user)
        expect(handler.req.user).toEqual(user)
      })
    })

    describe('for a null token', () => {
      beforeAll(() => {
        testToken = null
      })

      it('resets the session', () => {
        expect(handler.req[options.sessionName].reset).toHaveBeenCalled()
      })

      it('does not fetch the user', () => {
        expect(options.fetchUser).not.toHaveBeenCalled()
      })

      it('does not save anything to the request', () => {
        expect(handler.req.user).toBeUndefined()
        expect(handler.req.accessToken).toBeUndefined()
      })
    })
  })

  describe('#updateToken', () => {
    let handler

    beforeEach(() => {
      handler = new Handler({ req: reqWithSession, res, options })
      handler.createSession = jest.fn(async () => {})
      handler.saveData = jest.fn(async () => {})

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
      expect(handler.saveData).not.toHaveBeenCalled()
    })

    it('saves the token', async () => {
      await handler.updateToken()
      expect(mockToken.refresh).not.toHaveBeenCalled()
      expect(handler.saveData).toHaveBeenCalledWith(token)
    })

    it('refreshes the token if its expired', async () => {
      mockToken.expired.mockImplementationOnce(() => true)
      await handler.updateToken()
      expect(mockToken.refresh).toHaveBeenCalled()
      expect(handler.saveData).toHaveBeenCalledWith(refreshedToken)
    })
  })

  describe('#authenticateToken', () => {
    let handler
    beforeEach(() => {
      const state = btoa(JSON.stringify({ redirectUrl: '/path' }))
      req.url = `/auth/callback?state=${state}`

      handler = new Handler({ req, res, options })
      handler.saveData = jest.fn(async () => {})
      handler.redirect = jest.fn(() => {})
      handler.redirectToOAuth = jest.fn(() => {})

      handler.auth.code = {
        getToken: jest.fn(() => token)
      }
    })

    it('saves the token', async () => {
      await handler.authenticateToken()
      expect(handler.saveData).toHaveBeenCalledWith(savedSession)
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

  describe('#logout', () => {
    let handler
    let testRes
    let testReq

    beforeAll(() => {
      testRes = {}
      testReq = { ...reqWithSession, url: '/path?redirect-url=/new-path' }
    })

    beforeEach(async () => {
      handler = new Handler({ req: testReq, res: testRes, options })
      handler.createSession = jest.fn(async () => {})
      handler.redirect = jest.fn(async () => {})
      await handler.logout()
    })

    it('resets the session', () => {
      expect(handler.req[options.sessionName].reset).toHaveBeenCalled()
      expect(handler.req[options.sessionName].setDuration).toHaveBeenCalledWith(0)
    })

    it('it calls the logout callback', () => {
      expect(options.onLogout).toHaveBeenCalledWith(testReq, testRes, '/new-path')
    })

    describe('for a logout callback which redirects', () => {
      beforeAll(() => {
        testRes = { headersSent: true }
        testReq = reqWithSession
      })

      it('it does not redirect again', () => {
        expect(handler.redirect).not.toHaveBeenCalled()
      })
    })

    describe('for a logout callback which does not redirect', () => {
      beforeAll(() => {
        testRes = {}
        testReq = { ...reqWithSession, url: '/path?redirect-url=/new-path' }
      })

      it('it redirects to the redirectUrl', () => {
        expect(handler.redirect).toHaveBeenCalledWith('/new-path')
      })

      describe('with no redirect url', () => {
        beforeAll(() => {
          testRes = {}
          testReq = reqWithSession
        })

        it('it fallsback to redirect to the root', () => {
          expect(handler.redirect).toHaveBeenCalledWith('/')
        })
      })
    })
  })
})
