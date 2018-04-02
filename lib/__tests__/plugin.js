import Middleware from '@@/.nuxt/middleware'
import Plugin from '../plugin' // eslint-disable-line no-unused-vars

jest.mock('@@/.nuxt/middleware', () => ({}), { virtual: true })

let context

beforeEach(() => {
  process.client = true
  context = {
    store: {
      registerModule: jest.fn(),
      state: {
        oauth: {}
      }
    },
    redirect: jest.fn(),
    route: {
      matched: [],
      path: '/path'
    }
  }
})

describe('Middleware', () => {
  it('adds the middleware', () => {
    expect(Middleware).toHaveProperty('auth')
    expect(Middleware.auth).toBeInstanceOf(Function)
  })

  it('adds the store module on server side', async () => {
    process.client = false
    await (Middleware.auth(context))

    expect(context.store.registerModule).toHaveBeenCalled()
  })

  it('does not add the store module on client side', async () => {
    await (Middleware.auth(context))

    expect(context.store.registerModule).not.toHaveBeenCalled()
  })

  describe('without an authenticated component', () => {
    it('redirects', async () => {
      await (Middleware.auth(context))

      expect(context.redirect).not.toHaveBeenCalled()
    })
  })

  describe('with an authenticated component', () => {
    beforeEach(() => {
      const comp = { components: [{ options: { authenticated: true } }] }
      context.route.matched.push(comp)
    })

    it('redirects', async () => {
      await (Middleware.auth(context))

      expect(context.redirect).toHaveBeenCalled()
    })

    describe('with an access token', () => {
      beforeEach(() => {
        context.store.state.oauth.accessToken = 'i am an access token'
      })

      it('does nothing', async () => {
        await (Middleware.auth(context))

        expect(context.redirect).not.toHaveBeenCalled()
      })
    })
  })
})

describe('Helpers', () => {
  let inject
  const actions = ['login', 'logout']

  beforeEach(() => {
    inject = jest.fn()
    Plugin(context, inject)
  })

  it('injects login and logout', () => {
    actions.forEach(a =>
      expect(inject).toHaveBeenCalledWith(a, expect.any(Function))
    )
  })

  actions.forEach(actionName =>
    describe(actionName, () => {
      let action

      beforeEach(() => {
        action = inject.mock.calls.find(([name]) => name === actionName)[1]
      })

      it('redirects correctly', () => {
        action()

        const expected = `/auth/${actionName}?redirect-url=${context.route.path}`
        expect(context.redirect).toHaveBeenCalledWith(expected)
      })

      it('redirects correctly with custom redirect url', () => {
        const redirectUrl = '/custom'
        action(redirectUrl)

        const expected = `/auth/${actionName}?redirect-url=${redirectUrl}`
        expect(context.redirect).toHaveBeenCalledWith(expected)
      })
    })
  )
})
