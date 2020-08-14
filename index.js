const { resolve } = require('path')
const base = require('./lib/server-middleware')

const defaultOptions = {
  moduleName: 'oauth',
  fetchUser: () => ({}),
  onLogout: () => {},
  scopes: [],
  pageComponentPath: resolve(__dirname, './lib/route.js')
}

module.exports = function NuxtOAuth (moduleOptions) {
  const options = Object.assign(defaultOptions, moduleOptions, this.options.oauth)

  if (typeof options.onLogout !== 'function') throw new Error('options.onLogout must be a function')
  if (typeof options.fetchUser !== 'function') throw new Error('options.fetchUser must be a function')
  if (options.scopes && !Array.isArray(options.scopes)) throw new Error('options.scopes must be an array')

  // Setup middlewares
  this.options.serverMiddleware.unshift(base(options))
  this.addPlugin({
    src: resolve(__dirname, 'lib/plugin.js'),
    fileName: 'nuxt-oauth.plugin.js',
    options: {
      moduleName: options.moduleName
    }
  })

  // Add router middleware to config
  this.options.router = this.options.router || {}
  this.options.router.middleware = this.options.router.middleware || []
  this.options.router.middleware.push('auth')

  // Setup te /auth/login route
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

module.exports.meta = require('./package.json')
