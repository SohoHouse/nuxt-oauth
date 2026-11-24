import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NuxtServerHooks } from 'nuxt/schema'
import type { RequestEvent } from 'nuxt/server'

const getOAuthSession = vi.fn()
const saveToken = vi.fn()

vi.mock('nuxt/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('nuxt/server')>()),
  getRequestHeader: (event: RequestEvent, name: string) =>
    (event as any).headers[name],
}))

vi.mock('../../src/runtime/server/utils/oauth', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../src/runtime/server/utils/oauth')
  >()),
  getOAuthOptions: () => ({
    sessionName: 'oauthSession',
    routePrefixes: ['/auth', '/api/auth'],
  }),
  getOAuthSession: (...args: unknown[]) => getOAuthSession(...args),
  // saveToken reaches the real session through its own module binding, so it
  // is stubbed here rather than through getOAuthSession.
  saveToken: (...args: unknown[]) => saveToken(...args),
}))

const { useServerHooks } = await import('nuxt/server')
const { default: middleware } = await import(
  '../../src/runtime/server/middleware/session'
)

const request = (path: string, headers: Record<string, string> = {}) => {
  const event = {
    url: new URL(path, 'http://localhost'),
    headers: { cookie: 'oauthSession=sealed', ...headers },
    context: {} as Record<string, any>,
  }
  return { event, run: () => middleware(event as unknown as RequestEvent) }
}

describe('session middleware', () => {
  beforeEach(() => {
    getOAuthSession.mockReset()
    getOAuthSession.mockResolvedValue({
      data: { accessToken: 'tok', expires: Date.now() + 3_600_000, user: null },
      clear: vi.fn(),
    })
  })

  it('exposes a valid session on event.context.oauth', async () => {
    const { event, run } = request('/planner')
    await run()
    expect(event.context.oauth).toMatchObject({ accessToken: 'tok' })
  })

  it('leaves the auth routes to manage the session themselves', async () => {
    for (const path of ['/auth/callback', '/api/auth/login', '/auth']) {
      const { event, run } = request(path)
      await run()
      expect(event.context.oauth).toBeUndefined()
    }
    expect(getOAuthSession).not.toHaveBeenCalled()
  })

  // Regression: a bare startsWith('/auth') used to skip these app pages.
  it('still resolves the session on pages that merely start with /auth', async () => {
    for (const path of ['/authors', '/authentication-help']) {
      const { event, run } = request(path)
      await run()
      expect(event.context.oauth).toMatchObject({ accessToken: 'tok' })
    }
  })

  it('skips static and island requests', async () => {
    await request('/_nuxt/entry.js').run()
    await request('/__nuxt_island/x').run()
    expect(getOAuthSession).not.toHaveBeenCalled()
  })

  it('does nothing without a session cookie or bearer token', async () => {
    const { event, run } = request('/planner', { cookie: 'other=1' })
    await run()
    expect(getOAuthSession).not.toHaveBeenCalled()
    expect(event.context.oauth).toBeUndefined()
  })
})

describe('session middleware bearer tokens', () => {
  const unregister: Array<() => void> = []
  const verifyToken = vi.fn<NuxtServerHooks['oauth:verifyToken']>()

  beforeEach(() => {
    saveToken.mockReset()
    verifyToken.mockReset()
    getOAuthSession.mockReset()
    getOAuthSession.mockResolvedValue({
      data: { accessToken: 'held', expires: Date.now() + 3_600_000, user: {} },
      clear: vi.fn(),
    })
    unregister.push(useServerHooks().hook('oauth:verifyToken', verifyToken))
  })

  afterEach(() => {
    unregister.splice(0).forEach((off) => off())
  })

  const bearer = (token: string, cookie = 'other=1') =>
    request('/planner', { authorization: `Bearer ${token}`, cookie })

  // The app's own routes treat event.context.oauth as proof of sign-in.
  it('ignores a bearer token that no handler vouches for', async () => {
    const { event, run } = bearer('forged')
    await run()
    expect(verifyToken).toHaveBeenCalledWith(
      event,
      'forged',
      expect.objectContaining({ valid: false })
    )
    expect(event.context.oauth).toBeUndefined()
    expect(saveToken).not.toHaveBeenCalled()
    // No session behind the request, so nothing is read or sealed either.
    expect(getOAuthSession).not.toHaveBeenCalled()
  })

  it('ignores a bearer token when no handler is registered at all', async () => {
    unregister.splice(0).forEach((off) => off())
    const { event, run } = bearer('forged')
    await run()
    expect(event.context.oauth).toBeUndefined()
    expect(saveToken).not.toHaveBeenCalled()
  })

  it('adopts a bearer token once a handler vouches for it', async () => {
    verifyToken.mockImplementation((_event, _token, result) => {
      result.valid = true
    })
    const { event, run } = bearer('good')
    await run()
    expect(saveToken).toHaveBeenCalledWith(event, { access_token: 'good' })
    expect(event.context.oauth).toMatchObject({ accessToken: 'held' })
  })

  it('treats a throwing handler as a rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    verifyToken.mockImplementation(() => {
      throw new Error('api down')
    })
    const { event, run } = bearer('good')
    await run()
    expect(event.context.oauth).toBeUndefined()
    expect(saveToken).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not verify the token its session already holds', async () => {
    const { event, run } = bearer('held', 'oauthSession=sealed')
    await run()
    expect(verifyToken).not.toHaveBeenCalled()
    expect(event.context.oauth).toMatchObject({ accessToken: 'held' })
  })

  // A bad header must not knock out a member who is legitimately signed in.
  it('falls back to the session cookie when the bearer is rejected', async () => {
    const { event, run } = bearer('forged', 'oauthSession=sealed')
    await run()
    expect(saveToken).not.toHaveBeenCalled()
    expect(event.context.oauth).toMatchObject({ accessToken: 'held' })
  })
})
