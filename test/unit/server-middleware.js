import Middleware from '@/server-middleware'
import Handler from '@/handler'

import { INVALID_SESSION } from '../../lib/constants'

jest.mock('@/handler.js', () => jest.genMockFromModule('../../lib/handler'))

Handler.prototype.redirectToOAuth = jest.fn()
Handler.prototype.authenticateCallbackToken = jest.fn()
Handler.prototype.authenticate = jest.fn()
Handler.prototype.useRefreshToken = jest.fn()

let req
let res
let options
let next
let middleware

beforeEach(() => {
  req = {
    headers: { host: 'localhost:3000' },
    url: '/path'
  }
  res = {
    end: jest.fn(),
    writeHead: jest.fn()
  }
  options = {
    oauthHost: 'oauthHost',
    oauthClientID: 'oauthClientID',
    oauthClientSecret: 'oauthClientSecret',
    sessionName: 'testSession',
    secretKey: 'sekret'
  }
  next = jest.fn()
  middleware = Middleware(options)
})

describe('Server Middleware', () => {
  it('instantiates a handler', async () => {
    await middleware(req, res, next)
    expect(Handler).toHaveBeenCalledWith({
      req, res, next, options
    })
  })

  const customKeys = ['oauthHost', 'oauthClientID', 'oauthClientSecret']
  customKeys.forEach(key => {
    describe(`with ${key} as a function`, () => {
      const getter = jest.fn(({ url }) => url)

      beforeEach(async () => {
        const fnOptions = {
          ...options,
          [key]: getter
        }
        middleware = Middleware(fnOptions)
        await middleware(req, res, next)
      })

      it('calls the function', () => {
        expect(getter).toHaveBeenCalledWith(req)
      })

      it('passes through the result', () => {
        expect(Handler).toHaveBeenCalledWith({
          req,
          res,
          next,
          options: expect.objectContaining({ [key]: req.url })
        })
      })
    })
  })

  describe('for a normal route', () => {
    it('checks the request for a token', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.checkRequestAuthorization).toHaveBeenCalled()
    })

    it('authenticates the session', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.authenticate).toHaveBeenCalled()
    })

    it('calls next', async () => {
      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('for /auth/login', () => {
    beforeEach(() => {
      req.url = '/auth/login?redirect-url=/secret'
      Handler.prototype.isRoute = jest.fn(route => route === 'login')
    })

    it('does not call next', async () => {
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
    })

    it('redirects to auth', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.redirectToOAuth).toHaveBeenCalledWith('/secret')
    })

    it('fallsback to redirecting to root', async () => {
      req.url = '/auth/login?mangled=params'
      await middleware(req, res, next)
      expect(Handler.prototype.redirectToOAuth).toHaveBeenCalledWith('/')
    })
  })

  describe('for /auth/callback', () => {
    beforeEach(() => {
      req.url = '/auth/callback?hello=world&foo=bar'
      Handler.prototype.isRoute = jest.fn(route => route === 'callback')
    })

    it('does not call next', async () => {
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
    })

    it('complets the oauth handshake', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.authenticateCallbackToken).toHaveBeenCalled()
    })
  })

  describe('for /auth/refresh', () => {
    beforeEach(() => {
      req.url = '/auth/refresh'
      Handler.prototype.isRoute = jest.fn(route => route === 'refresh')
    })

    it('does not call next', async () => {
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
    })

    it('refreshes the token', async () => {
      const accessToken = 'validToken'
      const expires = '2020-04-30T09:31:40.386Z'

      Handler.prototype.useRefreshToken.mockReturnValueOnce({ accessToken, expires })

      await middleware(req, res, next)

      expect(Handler.prototype.useRefreshToken).toHaveBeenCalled()
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ accessToken, expires }))
    })

    it('returns 401 on invalid session', async () => {
      Handler.prototype.useRefreshToken.mockReturnValueOnce(null)

      await middleware(req, res, next)

      expect(Handler.prototype.useRefreshToken).toHaveBeenCalled()
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: INVALID_SESSION }))
    })
  })

  describe('for /auth/tokens', () => {
    beforeEach(() => {
      req.url = '/auth/tokens'
      Handler.prototype.isRoute = jest.fn(route => route === 'tokens')
    })

    it('does not call next', async () => {
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
    })

    it('refreshes the token', async () => {
      Handler.prototype.setTokens.mockReturnValueOnce(true)

      await middleware(req, res, next)

      expect(Handler.prototype.setTokens).toHaveBeenCalled()
    })

    it('returns 401 on invalid session', async () => {
      Handler.prototype.setTokens.mockReturnValueOnce(null)

      await middleware(req, res, next)

      expect(Handler.prototype.setTokens).toHaveBeenCalled()
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' })
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: INVALID_SESSION }))
    })
  })
})
