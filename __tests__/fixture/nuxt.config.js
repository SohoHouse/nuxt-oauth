module.exports = {
  srcDir: __dirname,
  dev: false,
  render: {
    resourceHints: false
  },
  modules: ['@@'],
  oauth: {
    sessionName: 'nuxtSession',
    secretKey: 'secretKey',
    oauthHost: 'https://google.com',
    oauthClientID: 'oauthClientID',
    oauthClientSecret: 'oauthClientSecret'
  }
}
