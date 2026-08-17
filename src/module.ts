import {
  defineNuxtModule,
  createResolver,
  addPlugin,
  addImports,
  addServerHandler,
  addServerImports,
  addRouteMiddleware,
} from '@nuxt/kit'
import { defu } from 'defu'
import type { ModuleOptions } from './types'

const ROUTES = ['login', 'callback', 'logout', 'refresh', 'session'] as const

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-oauth',
    configKey: 'oauth',
    compatibility: { nuxt: '>=3.0.0' },
  },

  defaults: {
    oauthPath: '/oauth',
    authorizationPath: '/authorize',
    accessTokenPath: '/token',
    oauthClientID: '',
    oauthClientSecret: '',
    scopes: [],
    sessionName: 'oauthSession',
    sessionDuration: 365 * 24 * 60 * 60 * 1000,
    secretKey: '',
    routePrefixes: ['/auth', '/api/auth'],
    testMode: false,
  },

  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    if (!Array.isArray(options.scopes)) {
      throw new TypeError('nuxt-oauth: `scopes` must be an array')
    }
    if (!options.oauthHost && !options.oauthDomain) {
      console.warn(
        '[nuxt-oauth] neither `oauthHost` nor `oauthDomain` is set — auth requests will fail'
      )
    }
    if (!options.secretKey) {
      console.warn(
        '[nuxt-oauth] `secretKey` is empty — sessions will not survive a restart'
      )
    }
    if (options.testMode && process.env.NODE_ENV === 'production') {
      throw new Error('nuxt-oauth: `testMode` must not be enabled in production')
    }

    // Server-only: never merged into runtimeConfig.public.
    nuxt.options.runtimeConfig.oauth = defu(
      nuxt.options.runtimeConfig.oauth as Partial<ModuleOptions>,
      options
    )

    // Populates event.context.oauth for SSR.
    addServerHandler({
      middleware: true,
      handler: resolver.resolve('./runtime/server/middleware/session.ts'),
    })

    // Mounted under every configured prefix so either registered redirect URI works.
    for (const prefix of options.routePrefixes) {
      for (const route of ROUTES) {
        addServerHandler({
          route: `${prefix}/${route}`,
          method: 'get',
          handler: resolver.resolve(`./runtime/server/routes/${route}.get.ts`),
        })
      }
    }

    // Only the public helper is auto-imported. Registering the whole utils dir
    // would make every export global and shadow h3's own getSession.
    addServerImports([
      {
        name: 'setSessionTokens',
        from: resolver.resolve('./runtime/server/utils/oauth.ts'),
      },
    ])

    addPlugin(resolver.resolve('./runtime/plugin.ts'))

    addRouteMiddleware({
      name: 'nuxt-oauth-auth',
      path: resolver.resolve('./runtime/middleware/auth.global.ts'),
      global: true,
    })

    const composables = resolver.resolve('./runtime/composables/useOAuth.ts')
    addImports([
      { name: 'useOAuth', from: composables },
      { name: 'useOAuthState', from: composables },
    ])
  },
})

export type { ModuleOptions, OAuthContext, OAuthSessionData } from './types'
