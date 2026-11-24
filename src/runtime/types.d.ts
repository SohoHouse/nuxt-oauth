import type { RequestEvent } from 'nuxt/server'
import type { OAuthContext } from '../types'

declare module 'nuxt/schema' {
  interface RequestEventContext {
    oauth?: OAuthContext
  }

  interface NuxtServerHooks {
    /** Override the OAuth host per-request. Set `result.host` to take effect. */
    'oauth:host': (event: RequestEvent, result: { host: string | null }) => void
    /** Vouch for a bearer token: set `result.valid = true` once it is accepted. */
    'oauth:verifyToken': (
      event: RequestEvent,
      accessToken: string,
      result: { valid: boolean }
    ) => void | Promise<void>
    /** Resolve the member for a freshly issued token. Set `result.user`. */
    'oauth:fetchUser': (
      event: RequestEvent,
      accessToken: string,
      result: { user: unknown }
    ) => void | Promise<void>
    /**
     * Sign the member out at the identity provider. Set `result.redirect` to
     * send the member there instead of `redirectUrl`.
     */
    'oauth:logout': (
      event: RequestEvent,
      redirectUrl: string,
      result: { redirect: string | null }
    ) => void | Promise<void>
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Guard this route behind a valid OAuth session. */
    authenticated?: boolean | ((route: unknown) => boolean)
  }
}

export {}
