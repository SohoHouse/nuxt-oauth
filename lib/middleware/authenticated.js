import AuthHandler from '../auth-handler'


export default async (context) => {
  if (context.store.state.user.email) return
  const handler = await AuthHandler.init(context)
  handler.redirectToOAuth()
}
