/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, prefer-template */
import middleware from '@@/.nuxt/middleware'

const moduleName = '<%= options.moduleName %>'

const initStore = async context => {
  if (!context.store) {
    context.error('nuxt-oauth requires a Vuex store!')
    return
  }

  context.store.registerModule(
    moduleName,
    {
      namespaced: true,
      state: {
        accessToken: (context.req && context.req.accessToken),
        user: (context.req && context.req.user)
      },
      mutations: {
        setAccessToken (state, accessToken) {
          state.accessToken = accessToken
        }
      }
    }
  )
}

const isAuthenticatedRoute = component => typeof component.options.authenticated === 'function' ? component.options.authenticated(component) : component.options.authenticated

const checkAuthenticatedRoute = ({ route: { matched } }) => process.client
  ? matched.some(({ components }) => Object.values(components).some(c => isAuthenticatedRoute(c)))
  : matched.some(({ components }) => components && Object.values(components).some(({ _Ctor }) => _Ctor && Object.values(_Ctor).some(c => c && c.options && isAuthenticatedRoute(c))))

const redirectToOAuth = ({ redirect }, action, redirectUrl = '') => {
  const encodedRedirectUrl = `/auth/${action}?redirect-url=${encodeURIComponent(redirectUrl)}`

  if (process.client) {
    window.location.assign(encodedRedirectUrl)
  } else {
    redirect(302, encodedRedirectUrl)
  }
}

middleware.auth = context => {
  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null } = context.store.state[moduleName]

  if (!isAuthenticated || !!accessToken) {
    console.log('no auth - plugin.js oauth', context.route)
    return
  }

  console.log('redirecting to login - plugin.js oauth', context.route)
  redirectToOAuth(context, 'login', context.route.fullPath)
}

export default async (context, inject) => {
  await initStore(context)

  const createAuth = action => (redirectUrl = context.route.fullPath) => redirectToOAuth(context, action, redirectUrl)

  inject('login', createAuth('login'))
  inject('logout', createAuth('logout'))
}
