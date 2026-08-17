export interface ModuleOptions {
  /**
   * OAuth base, used verbatim and including its path —
   * e.g. `https://auth.example.com/oauth`. When unset, derived from `oauthDomain`.
   */
  oauthHost?: string
  /**
   * Derives the base per-request from the incoming subdomain:
   * `dih-my-branch.app.com` -> `https://my-branch.<oauthDomain><oauthPath>`.
   */
  oauthDomain?: string
  /** Appended only to an `oauthDomain`-derived base. Defaults to `/oauth`. */
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

  /** Prefixes the handlers mount under. Both are enabled by default. */
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
