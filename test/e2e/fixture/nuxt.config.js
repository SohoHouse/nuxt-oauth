const DEV = process.env.NODE_ENV === 'development'

if (DEV) {
  require('dotenv').config()
}

module.exports = {
  srcDir: __dirname,
  dev: DEV,
  render: {
    resourceHints: false
  },
  modules: ['@@'],
  oauth: {
    sessionName: 'nuxtSession',
    secretKey: 'secretKey',
    oauthHost: DEV ? () => process.env.OAUTH_HOST : () => 'https://google.com',
    oauthClientID: process.env.OAUTH_CLIENT_ID || 'oauthClientID',
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET || 'oauthClientSecret',
    moduleName: 'nuxt-oauth'
  }
}
