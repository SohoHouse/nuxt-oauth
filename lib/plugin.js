/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, prefer-template */
import middleware from '@@/.nuxt/middleware'
import Vue from 'vue'

const moduleName = 'oauth'

const initStore = async context => {
  if (process.client) return
  if (!context.store) {
    const Vuex = await import('vuex')
    Vue.use(Vuex)
    context.store = new Vuex.Store({})
  }
  context.store.registerModule(moduleName, {
    namespaced: true,
    state: {
      accessToken: (context.req && context.req.accessToken),
      user: (context.req && context.req.user)
    }
  })
}

const isAuthenticatedRoute = component =>
  typeof component.options.authenticated === 'function' ? component.options.authenticated(component) : component.options.authenticated

const checkAuthenticatedRoute = ({ route: { matched } }) => process.client
  ? matched.some(({ components }) => Object.values(components).some(c => isAuthenticatedRoute(c)))
  : matched.some(({ components }) => Object.values(components).some(({ _Ctor }) =>
    Object.values(_Ctor).some(c => c.options && isAuthenticatedRoute(c))))

middleware.auth = async context => {
  await initStore(context)

  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null } = context.store.state[moduleName]

  if (!isAuthenticated || !!accessToken) return
  context.redirect(302, '/auth/login?redirect-url=' + context.route.path)
}

export default ({ redirect, route }, inject) => {
  const createAuth = action => (redirectUrl = route.path) =>
    redirect('/auth/' + action + '?redirect-url=' + redirectUrl)

  inject('login', createAuth('login'))
  inject('logout', createAuth('logout'))
}
