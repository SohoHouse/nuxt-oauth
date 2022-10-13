/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, prefer-template */
import middleware from '@@/.nuxt/middleware'

const moduleName = '<%= options.moduleName %>'

/**
 * Initializes the <%= options.moduleName %> module store
 *
 * @param { Object } context - The Nuxt context instance
 * @returns { undefined }
 */
const initStore = async context => {
  if (!context.store) {
    context.error('nuxt-oauth requires a Vuex store!')
    return
  }

  const accessToken = context.req && context.req.accessToken
  const user = context.req && context.req.user

  context.store.registerModule(
    moduleName,
    {
      namespaced: true,
      state: {
        accessToken: accessToken,
        user: user,
      },
      mutations: {
        setAccessToken (state, accessToken) {
          state.accessToken = accessToken
        }
      }
    }
  )
}

/**
 * Returns true if the component has a valid authenticated property
 *
 * @param { Object } component A Nuxt component instance
 * @returns { boolean }
 */
const isAuthenticatedRoute = component => {
  // return result(component)('options.authenticated', component)
  return typeof component.options.authenticated === 'function'
    ? component.options.authenticated(component)
    : component.options.authenticated
}

/**
 * Return true if any of the nested components requested has a
 * valid authenticated property
 *
 * @param { Object } context - The Nuxt context instance
 * @returns { boolean }
 */
const checkAuthenticatedRoute = ({ route: { matched } }) => {
  return process.client
    ? matched.some(({ components }) => {
      return Object.values(components).some(isAuthenticatedRoute)
    })
    : matched.some(({ components }) => {
      return components && Object.values(components).some(({ _Ctor }) => {
        return _Ctor && Object.values(_Ctor).some(c => {
          return c && c.options && isAuthenticatedRoute(c)
        })
      })
    })
  }

/**
 * Handler for constructing redirect urls for actions
 * Handles redirects on both client and server side
 *
 * @param { Object } context - The Nuxt context instance
 * @param { string } action - The path of the desired endpoint minus the `auth/` prefix
 * @param { string } [redirectUrl = ''] - The url of the page to be returned to once the redirect is completed. Defaults to home
 * @returns { undefined } redirectUrl 
 */
const redirectToOAuth = ({ redirect }, action, redirectUrl = '') => {
  const encodedRedirectUrl = `/auth/${action}?redirect-url=${encodeURIComponent(redirectUrl)}`
  if (process.client) {
    window.location.assign(encodedRedirectUrl)
  } else {
    console.log('redirect(302, encodedRedirectUrl)', encodedRedirectUrl)
    redirect(302, encodedRedirectUrl)
  }
}

/**
 * Registers the auth middleware. Checks whether an accessToken exists in
 * the Oauth module store and whether any nested component in the route
 * requires authentication before begining the Oauth flow
 *
 * @param { Object } context - The Nuxt context instance
 * @returns { undefined }
 */
middleware.auth = context => {
  // isAuthorizationRequiredForRoute
  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null } = context.store.state[moduleName]

  if (!isAuthenticated || !!accessToken) return
  redirectToOAuth(context, 'login', context.route.fullPath)
}

export default async (context, inject) => {
  await initStore(context)

  const createAuth = action => {
    return (redirectUrl = context.route.fullPath) => {
      return redirectToOAuth(context, action, redirectUrl)
    }
  }

  inject('login', createAuth('login'))
  inject('logout', createAuth('logout'))
}
