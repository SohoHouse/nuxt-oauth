// @flow

export default function (moduleOptions: {}) {
  const options = { ...this.options.oauth, moduleOptions }

  return options
}

module.exports.meta = require('../package.json')
