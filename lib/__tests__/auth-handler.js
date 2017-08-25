import AuthHandler from '../auth-handler'

describe('AuthHandler', () => {
  it('is a class', () => {
    const a = new AuthHandler()
    expect(a instanceof AuthHandler).toBeTruthy()
  })
})
