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

const isAuthenticatedRoute = component => {
  // return result(component)('options.authenticated', component)
  return typeof component.options.authenticated === 'function'
    ? component.options.authenticated(component)
    : component.options.authenticated
}

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

const redirectToOAuth = ({ redirect }, action, redirectUrl = '') => {
  const encodedRedirectUrl = `/auth/${action}?redirect-url=${encodeURIComponent(redirectUrl)}`
  if (process.client) {
    window.location.assign(encodedRedirectUrl)
  } else {
    console.log('redirect(302, encodedRedirectUrl)', encodedRedirectUrl)
    redirect(302, encodedRedirectUrl)
  }
}

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
