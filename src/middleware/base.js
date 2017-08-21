import AuthHandler from '../auth-handler'


export default async (context) => {
  if (context.isClient) return null
  const handler = await AuthHandler.init(context)
  if (context.req.url.startsWith('/auth/callback')) return handler.authenticateToken()
  return handler.updateUser()
}
