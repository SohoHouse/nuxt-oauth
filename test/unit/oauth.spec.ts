import { describe, it, expect } from 'vitest'
import {
  decodeState,
  encodeState,
  fakeToken,
  isExpired,
  sanitizeRedirect,
} from '../../src/runtime/server/utils/oauth'

describe('sanitizeRedirect', () => {
  it('keeps a same-origin path', () => {
    expect(sanitizeRedirect('/my-planner')).toBe('/my-planner')
    expect(sanitizeRedirect('/settings/membership?tab=1')).toBe(
      '/settings/membership?tab=1'
    )
  })

  // An open redirect here would let a crafted login link bounce a member to
  // an attacker's site carrying the OAuth flow with them.
  it('rejects absolute URLs', () => {
    expect(sanitizeRedirect('https://evil.example.com')).toBe('/')
    expect(sanitizeRedirect('http://evil.example.com/x')).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeRedirect('//evil.example.com')).toBe('/')
  })

  it('falls back to / for empty or non-string input', () => {
    expect(sanitizeRedirect('')).toBe('/')
    expect(sanitizeRedirect(undefined)).toBe('/')
    expect(sanitizeRedirect(42 as unknown as string)).toBe('/')
  })
})

describe('state round trip', () => {
  it('encodes and decodes the redirect target', () => {
    expect(decodeState(encodeState('/settings/membership'))).toBe(
      '/settings/membership'
    )
  })

  it('sanitizes a redirect smuggled through state', () => {
    expect(decodeState(encodeState('https://evil.example.com'))).toBe('/')
  })

  it('accepts a bare path for callers not using the encoded form', () => {
    expect(decodeState('/my-planner')).toBe('/my-planner')
  })

  it('falls back to / when state is missing or malformed', () => {
    expect(decodeState(undefined)).toBe('/')
    expect(decodeState('not-base64-%%%')).toBe('/')
  })
})

describe('isExpired', () => {
  it('treats a missing expiry as expired', () => {
    expect(isExpired(undefined)).toBe(true)
  })

  it('treats a past expiry as expired', () => {
    expect(isExpired(Date.now() - 1000)).toBe(true)
  })

  // Refreshed early so a token cannot expire mid-request.
  it('treats an expiry inside the 60s skew as expired', () => {
    expect(isExpired(Date.now() + 30_000)).toBe(true)
  })

  it('treats a comfortably future expiry as valid', () => {
    expect(isExpired(Date.now() + 3_600_000)).toBe(false)
  })
})

describe('fakeToken', () => {
  it('has the shape saveToken expects', () => {
    const token = fakeToken()
    expect(token.access_token).toBeTruthy()
    expect(token.refresh_token).toBeTruthy()
    expect(typeof token.expires_in).toBe('number')
  })
})
