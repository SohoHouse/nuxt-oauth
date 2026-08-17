import { defineNuxtPlugin } from '#app'
import { useOAuthState, oauthRedirect } from './composables/useOAuth'

/** Provides `$login` / `$logout`, and primes the session state for SSR. */
export default defineNuxtPlugin((nuxtApp) => {
  useOAuthState()

  // Runs from a click handler, where composables are unavailable and a throw
  // would silently kill the button — hence the fallbacks.
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
