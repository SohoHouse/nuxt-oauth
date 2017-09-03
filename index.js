const { resolve } = require('path')
const base = require('./lib/server-middleware')

const defaultOptions = {
  moduleName: 'oauth',
  fetchUser: () => ({}),
  onLogout: () => {}
}

module.exports = function NuxtOAuth (moduleOptions) {
  const options = Object.assign(defaultOptions, moduleOptions, this.options.oauth)

  if (typeof options.onLogout !== 'function') throw new Error('options.onLogout must be a function')
  if (typeof options.fetchUser !== 'function') throw new Error('options.fetchUser must be a function')

  // Setup middlewares
  this.addServerMiddleware(base(options))
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
      component: res(__dirname, 'lib/route.js')
    }, {
      name: 'oauth-logout',
      path: '/auth/logout',
      component: res(__dirname, 'lib/route.js')
    })
  })
}

module.exports.meta = require('./package.json')
