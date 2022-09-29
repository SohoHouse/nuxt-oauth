/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, prefer-template */
import middleware from '@@/.nuxt/middleware'

const moduleName = '<%= options.moduleName %>'
const sessionName = '<%= options.sessionName %>'

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
        expires: (context.req && context.req[sessionName] && context.req[sessionName].token && context.req[sessionName].token.expires),
        user: (context.req && context.req.user)
      },
      mutations: {
        setAccessToken (state, accessToken) {
          state.accessToken = accessToken
        },
        setExpiry (state, expires) {
          state.expires = expires
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

middleware.auth = async context => {
 
  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null, expires } = context.store.state[moduleName]

  if(expires) {
    let expires_in = Math.floor((Date.parse(expires) - Date.now()) / 1000, 1000)
    if(expires_in < 0) {

      try {
        // get new token from auth endpoint
        const {
          data: { accessToken, refreshToken, expires },
        } = await context.$axios.get('/auth/refresh', {
          baseURL: '',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        // set new token within the store
        context.store.commit('oauth/setAccessToken', accessToken)
        context.store.commit('oauth/setExpiry', expires)
        context.$axios.setToken(context.store.state.oauth.accessToken, 'Bearer')
        // retry the original request with a new token
      } catch (error) {
        // token refresh has failed, the user should be signed out
        // app.$logout()
        // redirectToOAuth(context, 'logout', context.route.fullPath)
      }
    } else {
      console.log('nuxt plugin axios - not exipred', expires_in, accessToken);
    }
  }


  if (!isAuthenticated || !!accessToken) return
  redirectToOAuth(context, 'login', context.route.fullPath)
}

export default async (context, inject) => {
  await initStore(context)

  const createAuth = action => (redirectUrl = context.route.fullPath) => redirectToOAuth(context, action, redirectUrl)

  inject('login', createAuth('login'))
  inject('logout', createAuth('logout'))
}
