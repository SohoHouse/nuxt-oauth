import { defineNuxtRouteMiddleware } from '#app'
import { useOAuthState, oauthRedirect } from '../composables/useOAuth'

/**
 * Guards routes that opt in with `definePageMeta({ authenticated: true })`.
 * Replaces the Nuxt 2 guard that read `component.options.authenticated`, which
 * relied on the Vue 2 `_Ctor` internals.
 */
export default defineNuxtRouteMiddleware((to) => {
  const authenticated =
    typeof to.meta.authenticated === 'function'
      ? (to.meta.authenticated as (route: typeof to) => boolean)(to)
      : to.meta.authenticated

  if (!authenticated) return
  if (useOAuthState().value.accessToken) return

  return oauthRedirect('login', to.fullPath)
})
