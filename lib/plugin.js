/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
import middleware from '@@/.nuxt/middleware'
import Vue from 'vue'

const moduleName = 'oauth'

const initStore = async context => {
  if (context.isClient) return
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

const checkAuthenticatedRoute = ({ route: { matched }, isServer }) => isServer
  ? matched.some(({ components }) => Object.values(components).some(({ _Ctor }) =>
    Object.values(_Ctor).some(({ options }) => options && options.authenticated)))
  : matched.some(({ components }) => Object.values(components).some(c => c.options.authenticated))

middleware.auth = async context => {
  await initStore(context)

  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null } = context.store.state[moduleName]

  if (!isAuthenticated || !!accessToken) return
  context.redirect(302, '/auth/login?redirect-url=' + context.route.path) // eslint-disable-line prefer-template
}
