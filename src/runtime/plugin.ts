import { defineNuxtPlugin } from '#app'
import { useOAuthState, oauthRedirect } from './composables/useOAuth'

/**
 * Provides `$login` / `$logout`, preserving the Nuxt 2 injection names so
 * existing call sites keep working, and primes the shared session state during
 * SSR so it is serialised into the payload.
 */
export default defineNuxtPlugin((nuxtApp) => {
  useOAuthState()

  // Call sites invoke `$login()` with no argument (e.g. the nav bar), so the
  // current path has to be derived here. This runs on a click, outside any
  // setup/plugin context, so composables like useRoute() are unavailable — and
  // anything that throws here dies inside the click handler, making the button
  // look dead. Hence the defensive chain rather than `$router.currentRoute`.
  const currentPath = () => {
    const fromRouter = (nuxtApp as any).$router?.currentRoute?.value?.fullPath
    if (fromRouter) return fromRouter
    if (import.meta.client) return window.location.pathname + window.location.search
    return '/'
  }

  const createAuth =
    (action: 'login' | 'logout') =>
    (redirectUrl?: string) => {
      const target = redirectUrl ?? (action === 'login' ? currentPath() : '/')
      return oauthRedirect(action, target)
    }

  return {
    provide: {
      login: createAuth('login'),
      logout: createAuth('logout'),
    },
  }
})
