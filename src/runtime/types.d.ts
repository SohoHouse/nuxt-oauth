import type { H3Event } from 'h3'
import type { OAuthContext } from '../types'

declare module 'h3' {
  interface H3EventContext {
    oauth?: OAuthContext
  }
}

declare module 'nitropack' {
  interface NitroRuntimeHooks {
    /** Override the OAuth host per-request. Set `result.host` to take effect. */
    'oauth:host': (event: H3Event, result: { host: string | null }) => void
    /** Resolve the member for a freshly issued token. Set `result.user`. */
    'oauth:fetchUser': (
      event: H3Event,
      accessToken: string,
      result: { user: unknown }
    ) => void
    /** Sign the member out at the identity provider. May send its own response. */
    'oauth:logout': (event: H3Event, redirectUrl: string) => void
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Guard this route behind a valid OAuth session. */
    authenticated?: boolean | ((route: unknown) => boolean)
  }
}

export {}
