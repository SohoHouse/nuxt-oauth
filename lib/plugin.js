/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies */
import middleware from '@@/.nuxt/middleware'

const moduleName = 'oauth'


const initStore = context => {
  if (context.isClient) return
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
    Object.values(_Ctor).some(({ options }) => options.authenticated)))
  : matched.some(({ components }) => Object.values(components).some(c => c.options.authenticated))

middleware.auth = async context => {
  initStore(context)

  const isAuthenticated = checkAuthenticatedRoute(context)
  const { accessToken = null } = context.store.state[moduleName]
  if (!isAuthenticated || !!accessToken) return
  context.redirect(302, '/auth/login?redirect-url=' + context.route.path) // eslint-disable-line prefer-template
}
