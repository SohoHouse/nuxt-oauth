export interface ModuleOptions {
  /**
   * Static OAuth host, without the path — e.g. `https://auth.example.com`.
   * `oauthPath` is appended to it, so do not include that here.
   * When unset, the host is derived per-request from `oauthDomain`.
   */
  oauthHost?: string
  /**
   * Fallback domain used to derive the OAuth host per-request from the
   * incoming subdomain, e.g. `dih-my-branch.app.com` -> `https://my-branch.<oauthDomain>`.
   * Replaces the Nuxt 2 `oauthHost(req)` function option.
   */
  oauthDomain?: string
  /** Path appended to the derived host. Defaults to `/oauth`. */
  oauthPath: string
  /** Authorize endpoint, relative to the resolved host. */
  authorizationPath: string
  /** Token endpoint, relative to the resolved host. */
  accessTokenPath: string

  oauthClientID: string
  oauthClientSecret: string
  scopes: string[]

  /** Cookie name for the sealed session. */
  sessionName: string
  /** Session lifetime in milliseconds. */
  sessionDuration: number
  /** Secret used to seal the session cookie. Hashed to a valid length at runtime. */
  secretKey: string

  /**
   * Mount the handlers under `/api/auth/*` in addition to `/auth/*`.
   * Both are enabled by default so either registered redirect URI works.
   */
  routePrefixes: string[]

  /** Skip the real OAuth dance and mint a fake token. Never enable in production. */
  testMode: boolean
}

export interface OAuthSessionData {
  accessToken?: string
  refreshToken?: string | null
  expires?: number
  user?: unknown
}

export interface OAuthContext {
  accessToken: string | null
  expires: number | null
  user: unknown
}
