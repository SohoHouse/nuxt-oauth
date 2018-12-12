import Middleware from '@@/.nuxt/middleware'
import Plugin from '@/plugin' // eslint-disable-line no-unused-vars

jest.mock('@@/.nuxt/middleware', () => ({}), { virtual: true })

const moduleName = '<%= options.moduleName %>'
let context

beforeEach(() => {
  process.client = true
  context = {
    store: {
      registerModule: jest.fn(),
      state: {
        [moduleName]: {}
      }
    },
    redirect: jest.fn(),
    route: {
      matched: [],
      path: '/path'
    }
  }
})

describe('Plugin', () => {
  it('adds the store module on server side', async () => {
    process.client = false
    await (Plugin(context, () => {}))

    expect(context.store.registerModule).toHaveBeenCalled()
  })

  it('does not add the store module on client side', async () => {
    await (Plugin(context, () => {}))

    expect(context.store.registerModule).not.toHaveBeenCalled()
  })
})

describe('Middleware', () => {
  it('adds the middleware', () => {
    expect(Middleware).toHaveProperty('auth')
    expect(Middleware.auth).toBeInstanceOf(Function)
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
        context.store.state[moduleName].accessToken = 'i am an access token'
      })

      it('does nothing', async () => {
        await (Middleware.auth(context))

        expect(context.redirect).not.toHaveBeenCalled()
      })
    })
  })

  describe('when using a function for the authenticated option', () => {
    describe('with an authenticated component', () => {
      let authenticatedMock

      beforeEach(() => {
        authenticatedMock = jest.fn(() => true)
        const comp = { components: [{ options: { authenticated: authenticatedMock } }] }
        context.route.matched.push(comp)
      })

      it('redirects', async () => {
        await (Middleware.auth(context))

        expect(context.redirect).toHaveBeenCalled()
      })

      it('calls authenticated', async () => {
        await (Middleware.auth(context))

        expect(authenticatedMock).toHaveBeenCalled()
        expect(authenticatedMock).toHaveBeenCalledWith({
          options: { authenticated: authenticatedMock }
        })
      })

      describe('with an access token', () => {
        beforeEach(() => {
          context.store.state[moduleName].accessToken = 'i am an access token'
        })

        it('does nothing', async () => {
          await (Middleware.auth(context))

          expect(context.redirect).not.toHaveBeenCalled()
        })
      })
    })

    describe('with an unauthenticated component', () => {
      let unAuthenticatedMock

      beforeEach(() => {
        unAuthenticatedMock = jest.fn(() => false)
        const comp = { components: [{ options: { authenticated: unAuthenticatedMock } }] }
        context.route.matched.push(comp)
      })

      it('does not redirect', async () => {
        await (Middleware.auth(context))

        expect(unAuthenticatedMock).toHaveBeenCalledWith({
          options: { authenticated: unAuthenticatedMock }
        })
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

        const expected = `/auth/${actionName}?redirect-url=${context.route.fullPath}`
        expect(context.redirect).toHaveBeenCalledWith(expected)
      })

      it('redirects correctly with custom redirect url', () => {
        const redirectUrl = '/custom'
        action(redirectUrl)

        const expected = `/auth/${actionName}?redirect-url=${encodeURIComponent(redirectUrl)}`
        expect(context.redirect).toHaveBeenCalledWith(expected)
      })

      it('retains query parameters during redirect', () => {
        const redirectUrl = '/custom?foo=bar'
        action(redirectUrl)

        const expected = `/auth/${actionName}?redirect-url=${encodeURIComponent(redirectUrl)}`
        expect(context.redirect).toHaveBeenCalledWith(expected)
      })
    })
  )
})
