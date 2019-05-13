import moment from 'moment'
import OAuth from 'client-oauth2'
import sessions from 'client-sessions'
import { btoa } from 'Base64'
import Handler from '@/handler'

jest.mock('client-oauth2')
jest.mock('client-sessions', () => jest.fn(() => (req, res, resolve) => resolve()))

let req
let res
let options
let errorOptions
let token
let refreshedToken
let reqWithSession
let reqWithHttps
let reqWithAuth
let mockToken
let savedSession
let user

const error = new Error('I am a teapot')

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
    oauthHost: 'https://google.com/oauth',
    oauthClientID: 'oauthClientID',
    oauthClientSecret: 'oauthClientSecret',
    accessTokenPath: '/token2',
    sessionName: 'testSession',
    secretKey: 'sekret',
    fetchUser: jest.fn(() => user),
    onLogout: jest.fn(() => {})
  }
  errorOptions = {
    ...options,
    fetchUser: () => { throw error },
    onLogout: () => { throw error }
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
  reqWithHttps = {
    headers: {
      host: 'localhost:3000',
      'x-forwarded-proto': 'https'
    },
    url: '/path'
  }
  reqWithAuth = {
    headers: {
      authorization: 'Bearer accessToken'
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
      authorizationUri: 'https://google.com/oauth/authorize',
      accessTokenUri: 'https://google.com/oauth/token2',
      clientId: options.oauthClientID,
      clientSecret: options.oauthClientSecret,
      redirectUri: `http://${req.headers.host}/auth/callback`,
      scopes: []
    }
    const handler = new Handler({ req, res, options })

    expect(OAuth).toBeCalledWith(expected)
    expect(handler.auth).toBeTruthy()
  })

  it('instantiates an OAuth client with https', () => {
    const expected = {
      authorizationUri: 'https://google.com/oauth/authorize',
      accessTokenUri: 'https://google.com/oauth/token2',
      clientId: options.oauthClientID,
      clientSecret: options.oauthClientSecret,
      redirectUri: `https://${req.headers.host}/auth/callback`,
      scopes: []
    }
    const handler = new Handler({ req: reqWithHttps, res, options })

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
    let testOptions
    let thrownError

    beforeAll(() => {
      testToken = token
      testOptions = options
    })

    beforeEach(async () => {
      handler = new Handler({ req: reqWithSession, res, options: testOptions })
      handler.createSession = jest.fn(async () => {})
      try {
        await handler.saveData(testToken)
      } catch (e) {
        thrownError = e
        console.error(thrownError)
      }
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
        expect(testOptions.fetchUser)
          .toHaveBeenCalledWith(token.accessToken, handler.req, testOptions)
      })

      it('saves the user to the session and the request', () => {
        expect(handler.req[options.sessionName].user).toEqual(user)
        expect(handler.req.user).toEqual(user)
      })
    })

    describe('with a fetchUser that throws an error', () => {
      beforeAll(async () => {
        testOptions = errorOptions
      })

      it('does not raise an error', async () => {
        expect(thrownError).toBeUndefined()
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

  describe('#authenticateCallbackToken', () => {
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
      await handler.authenticateCallbackToken()
      expect(handler.saveData).toHaveBeenCalledWith(savedSession)
    })

    it('redirects to the correct url', async () => {
      await handler.authenticateCallbackToken()
      expect(handler.redirect).toHaveBeenCalledWith('/path')
    })

    it('falls back to the root if cannot understand redirect url', async () => {
      handler.req.url = '/auth/callback?state=not-valid'
      await handler.authenticateCallbackToken()
      expect(handler.redirect).toHaveBeenCalledWith('/')
    })

    it('redirects back to oauth if cannot create token', async () => {
      handler.auth.code.getToken = () => { throw new Error('beep boop') }
      await handler.authenticateCallbackToken()
      expect(handler.redirectToOAuth).toHaveBeenCalled()
    })
  })

  describe('#logout', () => {
    let handler
    let testRes
    let testReq
    let testOptions
    let thrownError

    beforeAll(() => {
      testRes = {}
      testReq = { ...reqWithSession, url: '/path?redirect-url=/new-path' }
      testOptions = options
    })

    beforeEach(async () => {
      handler = new Handler({ req: testReq, res: testRes, options: testOptions })
      handler.createSession = jest.fn(async () => {})
      handler.redirect = jest.fn(async () => {})

      try {
        await handler.logout()
      } catch (e) {
        thrownError = e
        console.error(thrownError)
      }
    })

    it('resets the session', () => {
      expect(handler.req[options.sessionName].reset).toHaveBeenCalled()
      expect(handler.req[options.sessionName].setDuration).toHaveBeenCalledWith(0)
    })

    it('it calls the logout callback', () => {
      expect(testOptions.onLogout).toHaveBeenCalledWith(testReq, testRes, '/new-path')
    })

    describe('for a logout callback which throws an error', () => {
      it('does not throw an error', () => {
        expect(thrownError).toBeUndefined()
      })
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

  describe('#checkRequestAuthorization', () => {
    let handler
    let testReq
    let testRes
    let result
    let hasToken = true
    let saveDataError = false

    const accessToken = '1q2w3e4r5t6y7u8i9o0p'

    beforeAll(() => {
      result = undefined
      testRes = {}
      testReq = { ...reqWithSession, ...reqWithAuth, url: '/path?redirect-url=/new-path' }
    })

    beforeEach(async () => {
      handler = new Handler({ req: testReq, res: testRes, options })
      handler.saveData = jest.fn(async () => {
        if (saveDataError) throw new Error('could not save')
      })
      handler.extractToken = jest.fn(() => hasToken ? accessToken : null)
      handler.logout = jest.fn(() => null)

      try {
        await handler.checkRequestAuthorization()
      } catch (e) {
        // catch error
      }
    })

    it('returns false when an existing token is used', async () => {
      expect(result).toBeFalsy()
    })

    describe('failing saveData', () => {
      beforeAll(() => {
        saveDataError = true
      })
      it('returns calls logout when saveData fails', () => {
        expect(handler.logout).toHaveBeenCalled()
      })
    })

    describe('without a token', () => {
      beforeAll(async () => {
        hasToken = false
      })

      it('returns false when no token is presented', () => {
        expect(result).toBeFalsy()
      })
    })
  })

  describe('#extractToken', () => {
    let handler
    const accessToken = '1q2w3e4r5t6y7u8i9o0p'

    it('takes just the token from a bearer authorization', () => {
      handler = new Handler({ req: { ...req, headers: { authorization: `Bearer ${accessToken}` } }, res, options })

      expect(handler.extractToken()).toBe(accessToken)
    })

    it('takes just the token from a other authorization', () => {
      handler = new Handler({ req: { ...req, headers: { authorization: `Basic ${accessToken}` } }, res, options })

      expect(handler.extractToken()).toBe(accessToken)
    })

    it('returns null when no authorization is found', () => {
      handler = new Handler({ req, res, options })

      expect(handler.extractToken()).toBeNull()
    })
  })
})
