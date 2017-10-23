function createFakeToken () {
  return this.auth.createToken('accessToken', 'refreshToken', 'bearer')
}

async function redirectToOAuth () {
  const fakeToken = await this.createFakeToken()
  this.saveData(fakeToken)
  this.next()
}

async function updateToken () {
  const fakeToken = await this.createFakeToken()
  this.saveData(fakeToken)
  return true
}

module.exports = Handler => {
  Handler.prototype.createFakeToken = createFakeToken
  Handler.prototype.redirectToOAuth = redirectToOAuth
  Handler.prototype.updateToken = updateToken
}
