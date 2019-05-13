import Middleware from '@/server-middleware'
import Handler from '@/handler'

jest.mock('@/handler.js', () => jest.genMockFromModule('../../lib/handler'))

Handler.prototype.redirectToOAuth = jest.fn()
Handler.prototype.authenticateCallbackToken = jest.fn()
Handler.prototype.updateToken = jest.fn()

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
  res = {}
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
    expect(Handler).toHaveBeenCalledWith({ req, res, next, options })
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

    it('updates the token', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.updateToken).toHaveBeenCalled()
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
})
