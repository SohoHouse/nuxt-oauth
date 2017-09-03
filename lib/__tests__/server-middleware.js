import Middleware from '../server-middleware'
import Handler from '../handler'

jest.mock('../handler.js', () => jest.genMockFromModule('../handler'))

Handler.prototype.redirectToOAuth = jest.fn()
Handler.prototype.authenticateToken = jest.fn()
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
    expect(Handler).toHaveBeenCalledWith({ req, res, options })
  })

  describe('for a normal route', () => {
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
    beforeEach(() => { req.url = '/auth/login?redirect-url=/secret' })

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
    beforeEach(() => { req.url = '/auth/callback?hello=world&foo=bar' })

    it('does not call next', async () => {
      await middleware(req, res, next)
      expect(next).not.toHaveBeenCalled()
    })

    it('complets the oauth handshake', async () => {
      await middleware(req, res, next)
      expect(Handler.prototype.authenticateToken).toHaveBeenCalled()
    })
  })
})
