import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuxtServerHooks } from 'nuxt/schema'
import type { RequestEvent } from 'nuxt/server'

const clear = vi.fn()

// The route is exercised for real; only the pieces that need a live server
// (the sealed session and the response writer) are stubbed.
vi.mock('nuxt/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuxt/server')>()),
  getQuery: (event: RequestEvent) =>
    Object.fromEntries(event.url.searchParams),
  sendRedirect: (_event: RequestEvent, location: string, code: number) => ({
    location,
    code,
  }),
}))

vi.mock('../../src/runtime/server/utils/oauth', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../src/runtime/server/utils/oauth')
  >()),
  getOAuthSession: async () => ({ clear }),
}))

const { useServerHooks } = await import('nuxt/server')
const { default: logout } = await import(
  '../../src/runtime/server/routes/logout.get'
)

const call = (query: string) =>
  logout({
    url: new URL(`/auth/logout${query}`, 'http://localhost'),
  } as RequestEvent) as unknown as Promise<{ location: string; code: number }>

type LogoutHook = NuxtServerHooks['oauth:logout']

describe('logout route', () => {
  const unregister: Array<() => void> = []
  // The hooks registry is process-wide, so each test removes what it added.
  const onLogout = (fn: LogoutHook) =>
    unregister.push(useServerHooks().hook('oauth:logout', fn))

  beforeEach(() => {
    clear.mockClear()
  })

  afterEach(() => {
    unregister.splice(0).forEach((off) => off())
    vi.restoreAllMocks()
  })

  it('clears the session and returns to the requested path', async () => {
    expect(await call('?redirect-url=/planner')).toEqual({
      location: '/planner',
      code: 302,
    })
    expect(clear).toHaveBeenCalledOnce()
  })

  // The contract the app's IdP sign-out relies on: the hook supplies the
  // destination, the route does the redirecting.
  it('redirects to result.redirect when the hook sets it', async () => {
    onLogout((_event, redirectUrl, result) => {
      result.redirect = `https://idp.example.com/destroy?to=${redirectUrl}`
    })

    expect(await call('?redirect-url=/')).toEqual({
      location: 'https://idp.example.com/destroy?to=/',
      code: 302,
    })
  })

  it('works with an async hook', async () => {
    onLogout(async (_event, _url, result) => {
      await Promise.resolve()
      result.redirect = 'https://idp.example.com/destroy'
    })

    expect((await call('?redirect-url=/')).location).toBe(
      'https://idp.example.com/destroy'
    )
  })

  it('falls back to the requested path and reports it when the hook throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    onLogout(() => {
      throw new Error('idp url build failed')
    })

    expect((await call('?redirect-url=/planner')).location).toBe('/planner')
    expect(clear).toHaveBeenCalledOnce()
    // Visible in production, not only in dev: the IdP session is left alive.
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('oauth:logout hook failed'),
      'idp url build failed'
    )
  })

  it('never redirects to an absolute URL from the query', async () => {
    expect((await call('?redirect-url=https://evil.example.com')).location).toBe(
      '/'
    )
  })

  it('defaults to / without a redirect-url', async () => {
    expect((await call('')).location).toBe('/')
  })
})
