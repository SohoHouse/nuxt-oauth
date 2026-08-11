import { defineNuxtPlugin } from '#app'
import { useOAuthState, oauthRedirect } from './composables/useOAuth'

/**
 * Provides `$login` / `$logout`, preserving the Nuxt 2 injection names so
 * existing call sites keep working, and primes the shared session state during
 * SSR so it is serialised into the payload.
 */
export default defineNuxtPlugin((nuxtApp) => {
  useOAuthState()

  const createAuth =
    (action: 'login' | 'logout') =>
    (redirectUrl?: string) => {
      const fallback = action === 'login' ? nuxtApp.$router.currentRoute.value.fullPath : '/'
      return oauthRedirect(action, redirectUrl ?? fallback)
    }

  return {
    provide: {
      login: createAuth('login'),
      logout: createAuth('logout'),
    },
  }
})
