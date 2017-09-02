const { resolve } = require('path')
const base = require('./lib/server-middleware')

const defaultOptions = {
  moduleName: 'oauth'
}

module.exports = function NuxtOAuth (moduleOptions) {
  const options = Object.assign(defaultOptions, moduleOptions, this.options.oauth)

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
  this.extendRoutes((routes, resolve) => {
    routes.push({
      name: 'oauth-login',
      path: '/auth/login',
      component: resolve(__dirname, 'lib/route.js')
    })
  })
}

module.exports.meta = require('./package.json')
