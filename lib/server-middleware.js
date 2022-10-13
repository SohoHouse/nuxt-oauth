const connect = require('connect')

const Handler = require('./handler')

const createTestHandler = require('./test-mode')

const { logWrapper, decorateWith } = require('./utils')

const app = connect()

/**
 * Returns the serverMiddleware with options applied to the OAuth2 Handler instance
 *
 * TODO: Integrate middleware using different method. Either:
 * 1) Return an array of serverMiddleware objects
 * @see https://nuxtjs.org/docs/configuration-glossary/configuration-servermiddleware#usage
 * 2) Wrap using `render:serverMiddleware` nuxt hook handler which provides connect 
 * app instance as it's first argument
 * @see https://github.com/nuxt/nuxt.js/blob/a87f5dde6ad5c6a87553ac30e1eb4f462ea7657f/packages/server/src/server.js#L73
 *
 * @param { Object } options - The combined moduleOptions, Nuxt oauth options, and defaultOptions
 * @param { Boolean } options.testMode - Option to replace Handler methods with dummy implementations
 * @param { Boolean } options.logging - Option to add logging to the handlers
 * @returns { Function } A Connect middleware instance 
 */
module.exports = ({ testMode, logging, ...options }) => {
  console.log('SERVER MIDDLEWARE')

  // if (testMode) createTestHandler(Handler)

  // if (logging) decorateWith(logWrapper, {}, Handler)
  
  const handler = new Handler(options)
  
  console.log('SERVER MIDDLEWARE: handler', handler)

  // app.use(handler.init) // NOTE: Required to evaluate dynamic options
  
  app.use(handler) // Use Session

  app.use('/auth/login', handler.login.bind(handler))

  app.use('/auth/callback', handler.callback.bind(handler))
  
  app.use('/auth/refresh', handler.refresh.bind(handler))

  app.use('/auth/logout', handler.logout.bind(handler))

  return app
}
