import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Guards the static deployment contract: SPA fallback, response headers and the CSP meta of index.html. */
const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: Array<{ source: string; destination: string }>
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
}
const headerValue = (key: string): string | undefined =>
  vercelConfig.headers.find(entry => entry.source === '/(.*)')?.headers.find(header => header.key === key)?.value

describe('deployment policy', () => {
  it('rewrites every path to index.html', () => {
    expect(vercelConfig.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' })
  })

  it('sends the security headers', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff')
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headerValue('Content-Security-Policy')).toBe("frame-ancestors 'none'")
    expect(headerValue('Permissions-Policy')).toBe('camera=(self)')
  })

  it('limits connections to the same origin in index.html', () => {
    const html = readFileSync('src/index.html', 'utf8')
    for (const directive of ["connect-src 'self'", "img-src 'self' data: blob:", "worker-src 'self' blob:", "font-src 'self' data:", "form-action 'none'"]) {
      expect(html).toContain(directive)
    }
  })
})
