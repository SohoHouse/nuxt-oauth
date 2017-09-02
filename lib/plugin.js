/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
import middleware from '@/.nuxt/middleware'

const moduleName = 'oauth'
const UPDATE_TOKEN = 'UPDATE_TOKEN'

const saveToken = context => {
  if (!context.req || !context.req.accessToken) return
  const mutationName = [moduleName, UPDATE_TOKEN].join('/')
  context.store.commit(mutationName, context.req.accessToken)
}


const initStore = context => {
  if (context.isClient) return
  context.store.registerModule(moduleName, {
    namespaced: true,
    state: { accessToken: null },
    mutations: {
      [UPDATE_TOKEN]: (state, token) => { state.accessToken = token }
    }
  })
  saveToken(context)
}

const checkAuthenticatedRoute = ({ route: { matched }, isServer }) => isServer
  ? matched.some(({ components }) => Object.values(components).some(({ _Ctor }) =>
    Object.values(_Ctor).some(({ options }) => options.authenticated)))
  : matched.some(({ components }) => Object.values(components).some(c => c.options.authenticated))

middleware.auth = async context => {
  initStore(context)

  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken } = context.store.state[moduleName]
  if (!isAuthenticated || !!accessToken) return
  context.redirect(302, '/auth/login?redirectUrl=' + context.route.path) // eslint-disable-line prefer-template
}
