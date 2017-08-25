const base = require('./lib/middleware/base')

module.exports = function NuxtOAuth (moduleOptions) {
  const options = Object.assign({}, moduleOptions, this.options.oauth)

  this.addServerMiddleware(base(options))
}

module.exports.meta = require('./package.json')
