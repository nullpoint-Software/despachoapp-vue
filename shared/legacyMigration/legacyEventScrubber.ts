/** Keys of the legacy audit payloads that carry secrets or heavy binary data; they never enter the global snapshot. */
export const scrubbedLegacyKeys = ['password', 'ciecf', 'fiel', 'imagen'] as const

/** Returns a deep copy of a parsed JSON value without the scrubbed keys (compared case-insensitively) at any depth. */
export function scrubLegacyPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubLegacyPayload)
  if (value === null || typeof value !== 'object') return value
  const scrubbed: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if ((scrubbedLegacyKeys as readonly string[]).includes(key.toLowerCase())) continue
    scrubbed[key] = scrubLegacyPayload(child)
  }
  return scrubbed
}
