import Middleware from '@/.nuxt/middleware'
import Plugin from '../plugin' // eslint-disable-line no-unused-vars

jest.mock('@/.nuxt/middleware', () => ({}), { virtual: true })

let context

beforeEach(() => {
  context = {
    store: {
      registerModule: jest.fn(),
      state: {
        oauth: {}
      }
    },
    redirect: jest.fn(),
    route: { matched: [] }
  }
})

describe('Plugin', () => {
  it('adds the middleware', () => {
    expect(Middleware).toHaveProperty('auth')
    expect(Middleware.auth).toBeInstanceOf(Function)
  })

  it('does something', async () => {
    await (Middleware.auth(context))
  })
})
