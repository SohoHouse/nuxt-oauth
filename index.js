const { resolve } = require('path')

const ServerMiddleware = require('./lib/server-middleware')

const { DEFAULT_SESSION_DURATION } = require('./lib/constants')

const defaultOptions = {
  moduleName: 'oauth',
  fetchUser: () => ({}),
  onLogout: () => {},
  scopes: [],
  pageComponentPath: resolve(__dirname, './lib/route.js'),
  sessionDuration: DEFAULT_SESSION_DURATION,
  protocol: (req) => req.protocol,
  host: (req) => req.headers.host,
  logging: true,
}

module.exports = function NuxtOAuth (moduleOptions) {
  const options = Object.assign({}, defaultOptions, this.options.oauth, moduleOptions)
  
  // Check for required options types
  if (typeof options.onLogout !== 'function') throw new Error('options.onLogout must be a function')
  if (typeof options.fetchUser !== 'function') throw new Error('options.fetchUser must be a function')
  if (options.scopes && !Array.isArray(options.scopes)) throw new Error('options.scopes must be an array')
  
  // Setup middlewares
  const OAuthMiddleware = ServerMiddleware(options)

  this.options.serverMiddleware.unshift(OAuthMiddleware)
  
  this.addPlugin({
    src: resolve(__dirname, 'lib/plugin.js'),
    fileName: 'nuxt-oauth.plugin.js',
    options: {
      moduleName: options.moduleName,
      sessionName: options.sessionName,
    }
  })

  // Add router middleware to config
  this.options.router = this.options.router || {}
  this.options.router.middleware = this.options.router.middleware || []
  this.options.router.middleware.push('auth')

  // Setup the /auth/login route
  this.extendRoutes((routes, res) => {
    routes.push({
      name: 'oauth-login',
      path: '/auth/login',
      component: res(options.pageComponentPath)
    }, {
      name: 'oauth-logout',
      path: '/auth/logout',
      component: res(options.pageComponentPath)
    })
  })
}

// @see https://nuxtjs.org/docs/directory-structure/modules#write-your-own-module
module.exports.meta = require('./package.json')
