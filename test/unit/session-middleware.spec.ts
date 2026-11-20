import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequestEvent } from 'nuxt/server'

const getOAuthSession = vi.fn()

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
}))

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
