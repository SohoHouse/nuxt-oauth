import { computed } from 'vue'
import { useState, useRequestEvent, navigateTo, useRoute } from '#app'
import type { OAuthContext } from '../../types'

export const OAUTH_STATE_KEY = 'nuxt-oauth'

/** Session state, put here by the server middleware and sent via the payload. */
export const useOAuthState = () =>
  useState<OAuthContext>(OAUTH_STATE_KEY, () => {
    const event = useRequestEvent()
    return (
      (event?.context.oauth as OAuthContext | undefined) ?? {
        accessToken: null,
        expires: null,
        user: null,
      }
    )
  })

const buildUrl = (action: 'login' | 'logout', redirectUrl: string) =>
  `/auth/${action}?redirect-url=${encodeURIComponent(redirectUrl)}`

/** A full document navigation, not a router push, so the server can set the cookie. */
export const oauthRedirect = (
  action: 'login' | 'logout',
  redirectUrl: string
) => {
  const url = buildUrl(action, redirectUrl)

  if (import.meta.client) {
    window.location.assign(url)
    return
  }

  return navigateTo(url, { external: true, redirectCode: 302 })
}

export const useOAuth = () => {
  const state = useOAuthState()
  const route = useRoute()

  return {
    accessToken: computed(() => state.value.accessToken),
    expires: computed(() => state.value.expires),
    user: computed(() => state.value.user),
    isAuthenticated: computed(() => !!state.value.accessToken),
    login: (redirectUrl: string = route.fullPath) =>
      oauthRedirect('login', redirectUrl),
    logout: (redirectUrl: string = '/') => oauthRedirect('logout', redirectUrl),
  }
}
