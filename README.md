![nuxt-oauth](https://raw.githubusercontent.com/feathericons/feather/master/icons/lock.svg?sanitize=true)

**nuxt-oauth** Simple OAuth2 integration for your Nuxt app

[![CircleCI](https://circleci.com/gh/SohoHouse/nuxt-oauth.svg?style=svg)](https://circleci.com/gh/SohoHouse/nuxt-oauth)

- [Usage](#usage)
  - [Requirements](#requirements)
  - [Get Setup](#get-setup)
  - [Use in your application](#use-in-your-application)
  - [Configuration](#configuration)
  - [Server hooks](#server-hooks)
  - [Routes](#routes)
  - [With your tests](#with-your-tests)
- [Upgrading from 3.x](#upgrading-from-3x)
- [Develop](#develop)
  - [Contributing](#contributing)
  - [Thanks](#thanks)
  - [License](#license)

## Usage

### Requirements

- [Nuxt](https://nuxt.com/) 4.6 or newer (the server code imports from `nuxt/server`)
- Universal deployment (i.e. a server rendered app, not an SPA): the session lives in a sealed cookie that the server reads

### Get Setup

1. Install the dependency:
```bash
yarn add nuxt-oauth
```

2. Add to your `nuxt.config.ts` and configure:
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-oauth'],
  oauth: {
    sessionName: 'mySession',
    secretKey: process.env.SECRET_KEY,
    // Includes the provider's OAuth path, e.g. https://idp.example.com/oauth
    oauthHost: process.env.OAUTH_HOST,
    oauthClientID: process.env.OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
  },
})
```

Looking up the member and signing them out at the provider are done with [server hooks](#server-hooks), not config functions.

### Use in your application

- Read the session with `useOAuth()` (or the raw state with `useOAuthState()`):
```vue
<script setup>
const { isAuthenticated, accessToken, expires, user, login, logout } = useOAuth()
</script>

<template>
  <a v-if="isAuthenticated" @click="logout('/')">Log Out</a>
  <a v-else @click="login()">Log In</a>
</template>
```
`login(redirectUrl)` defaults to the current route and `logout(redirectUrl)` to `/`. Both do a full page redirect to the matching [route](#routes). `$login` and `$logout` are also provided on the Nuxt app.

- Mark your authenticated pages (`nuxt-oauth` redirects to login when there is no session):
```vue
<script setup>
definePageMeta({ authenticated: true })
</script>
```
`authenticated` may also be a function `(route) => boolean`.

- On the server, `event.context.oauth` holds `{ accessToken, expires, user }` for a request that has a session, and `setSessionTokens(event, accessToken, refreshToken?, expiresIn?)` signs a member in from tokens you obtained yourself (for example after creating an account).

The refresh token stays in the sealed cookie and is never sent to the browser. Expired access tokens are refreshed on the server before render; client code can call [`/auth/refresh`](#routes) to recover from a 401.

### Configuration

| Option | Required? | Description |
| :----- | :-------- | :---------- |
| `sessionName` | | Name of the session cookie _(defaults to `oauthSession`)_ |
| `secretKey` | * | Secret used to seal the session cookie. Keep it stable across deployments and instances, and do not leak it. |
| `oauthHost` | * or `oauthDomain` | Full URL of your OAuth provider including its OAuth path, e.g. `https://idp.example.com/oauth`. A string only: for a per-request value use the `oauth:host` hook. |
| `oauthDomain` | * or `oauthHost` | Provider domain. The host becomes `https://<first label of the request host, minus a leading "dih-">.<oauthDomain><oauthPath>`, which suits per-branch environments. |
| `oauthPath` | | Path appended to `oauthDomain` _(defaults to `/oauth`)_ |
| `oauthClientID` | * | Client ID registered with your OAuth provider |
| `oauthClientSecret` | * | Client secret registered with your OAuth provider |
| `scopes` | | An array of scopes to request |
| `authorizationPath` | | Path to send members to authenticate _(defaults to `/authorize`)_ |
| `accessTokenPath` | | Path to request tokens from _(defaults to `/token`)_ |
| `sessionDuration` | | How long the session cookie lives, in milliseconds _(defaults to 1 year)_ |
| `routePrefixes` | | Where the [routes](#routes) are mounted _(defaults to `['/auth', '/api/auth']`)_. Register a `/callback` URL for each prefix you use with your provider. |
| `testMode` | | Skip the OAuth dance and sign everyone in _(see [here](#with-your-tests))_. Refuses to build for production. |

### Server hooks

The app customises the module through server hooks, registered with `useServerHooks()` from `nuxt/server`, typically in a Nitro plugin. On a Nitro v2 build this is the same hook bus as `nitroApp.hooks`, so either works there; `useServerHooks()` is preferred because it also works on other server builders, without importing from Nitro:

```ts
// server/plugins/oauth-hooks.ts
import { useServerHooks } from 'nuxt/server'

export default defineNitroPlugin(() => {
  const hooks = useServerHooks()

  // Resolve the member for a freshly issued token. Set `result.user`.
  // The result is sealed into the session cookie (4096 bytes at most) and
  // also reaches the client through `useOAuth().user`, so keep it small.
  hooks.hook('oauth:fetchUser', async (event, accessToken, result) => {})

  // Sign the member out at the identity provider: set `result.redirect`.
  // Do not send a response yourself; the route redirects for you.
  hooks.hook('oauth:logout', (event, redirectUrl, result) => {
    result.redirect = `https://idp.example.com/logout?to=${encodeURIComponent(redirectUrl)}`
  })

  // Override the OAuth host per request. Set `result.host`.
  hooks.hook('oauth:host', (event, result) => {})

  // Vouch for a bearer token before it is trusted. Without this hook, bearer
  // tokens are ignored. Set `result.valid` once your API has accepted it.
  hooks.hook('oauth:verifyToken', async (event, accessToken, result) => {})
})
```

A throwing `oauth:logout` hook is logged and the member is sent to `redirectUrl` instead, which leaves their provider session alive. A throwing `oauth:fetchUser` hook is logged and the member still signs in, just without `user` on the session.

### Routes

Each is mounted under every `routePrefixes` entry (`/auth/…` and `/api/auth/…` by default):

| Route | Purpose |
| :---- | :------ |
| `GET /login?redirect-url=/path` | Redirects to the provider |
| `GET /callback` | Exchanges the code, saves the session, redirects to the original path |
| `GET /logout?redirect-url=/path` | Clears the session, runs `oauth:logout`, redirects |
| `GET /refresh` | Refreshes the token and returns `{ accessToken, expires }`, or `401` |
| `GET /session` | Returns `{ authenticated, accessToken?, expires?, user? }`, refreshing if expired |

`redirect-url` must be a path on your own site; anything else becomes `/`. The session middleware does not run for these routes, but does run for every other path, including ones that merely start with `/auth`, such as `/authors`.

A request carrying an `Authorization: Bearer <token>` header has that token adopted into its session, but only if an `oauth:verifyToken` hook sets `result.valid = true`. With no handler registered the header is ignored, so a caller cannot sign in with an arbitrary token. A token the session already holds is not verified again, so the hook runs once per new token, not on every request. A throwing hook counts as a rejection.

### With your tests

Set `oauth.testMode` to `true` to skip authentication: `/auth/login` signs in a fake member (`fakeToken()`) and redirects straight back. Combine it with an `oauth:fetchUser` hook to stub your test users.

## Upgrading from 3.x

- **Nuxt 4.6+ required**, and the module now imports from `nuxt/server` rather than `h3`.
- **Bearer tokens need `oauth:verifyToken`.** 3.x adopted any `Authorization: Bearer` header into the session unchecked. 4.x ignores the header unless a hook vouches for the token (see above).
- **Register hooks with `useServerHooks()`** from `nuxt/server`. On Nitro v2 it is the same bus as `useNitroApp().hooks`, so existing registrations keep firing, but it is the portable API and the one the examples use.
- **`oauth:logout` no longer sends a response.** It receives a third `result` argument; set `result.redirect` instead of calling `sendRedirect`. A 3.x hook that sends its own redirect will fail on 4.x.
- **Everyone is signed out once.** Sessions are sealed by `nuxt/server`'s `useSession`, whose cookies are not interchangeable with h3's. Use a new `sessionName` so the old cookie is not mistaken for a corrupt one.
- **Path matching:** the session middleware now skips only whole path segments under `routePrefixes`, so `/authors` gets its session.

## Develop

```bash
git clone git@github.com:SohoHouse/nuxt-oauth.git
cd nuxt-oauth
yarn
yarn test

# To use while developing other apps (build first, then re-publish after each change):
yarn build
yalc publish --no-scripts
cd ../my-other-app
yalc add nuxt-oauth   # or `yalc update nuxt-oauth` after the first time
```

### Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/SohoHouse/nuxt-oauth. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

### Thanks

- Many thanks to [Evan You](https://github.com/yyx990803) and the [VueJS](https://github.com/vuejs) team for sustaining such a vibrant and supportive community around Vue JS
- Many thanks also [Alex Chopin](https://github.com/alexchopin), [Sébastien Chopin](https://github.com/Atinux), [Pooya Parsa](https://github.com/pi0) and the other [Nuxt](https://github.com/nuxt) contributors for creating this awesome library

### License

The module is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
