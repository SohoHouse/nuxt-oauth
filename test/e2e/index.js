jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000
process.env.PORT = process.env.PORT || 5060

const { Nuxt, Builder } = require('nuxt')
const request = require('request-promise-native')

const config = require('./fixture/nuxt.config')

const url = path => `http://localhost:${process.env.PORT}${path}`
const get = path => request({
  followRedirect: req => req.headers.location.startsWith('/'),
  resolveWithFullResponse: true,
  simple: false,
  url: url(path)
})

let nuxt

const setup = (configOverride = {}) => {
  beforeAll(async () => {
    nuxt = new Nuxt({
      ...config,
      ...configOverride
    })
    await new Builder(nuxt).build()
    await nuxt.listen(process.env.PORT)
  })

  afterAll(async () => {
    await nuxt.close()
  })
}

describe('without test mode', () => {
  setup()

  test('render', async () => {
    const { body } = await get('/')
    expect(body).toContain('Works!')
  })

  test('secret redirect', async () => {
    const { statusCode, headers } = await get('/secret')
    expect(statusCode).toEqual(302)
    expect(headers.location).toContain(config.oauth.oauthHost())
  })

  test('login redirect', async () => {
    const { statusCode, headers } = await get('/auth/login')
    expect(statusCode).toEqual(302)
    expect(headers.location).toContain(config.oauth.oauthHost())
  })
})

describe('with test mode', () => {
  setup({ oauth: { testMode: true } })

  test('render', async () => {
    const { body } = await get('/')
    expect(body).toContain('Works!')
  })

  test('secret redirect', async () => {
    const { statusCode, body } = await get('/secret')
    expect(statusCode).toEqual(200)
    expect(body).toContain('Shhh')
  })
})
