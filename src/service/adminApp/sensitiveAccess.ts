const STORAGE_KEY = 'despacho:sensitive-access'

interface SensitiveAccessRecord {
  token: string
  expiresAt: number
  userId: string
}

interface SensitiveAccessResponse {
  sensitiveAccessToken?: unknown
  sensitiveAccessExpiresIn?: unknown
}

function activeUserId() {
  return String(localStorage.getItem('userid') || '')
}

function readRecord(): SensitiveAccessRecord | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Partial<SensitiveAccessRecord>
    const valid =
      typeof record.token === 'string' &&
      typeof record.expiresAt === 'number' &&
      record.expiresAt > Date.now() &&
      record.userId === activeUserId()
    if (valid) return record as SensitiveAccessRecord
  } catch (_error) {
    // A malformed or unavailable session store is treated as an expired grant.
  }
  clearSensitiveAccess()
  return null
}

export function getSensitiveAccessToken() {
  return readRecord()?.token || ''
}

export function hasSensitiveAccess() {
  return Boolean(readRecord())
}

export function storeSensitiveAccess(response: SensitiveAccessResponse) {
  const token =
    typeof response.sensitiveAccessToken === 'string' ? response.sensitiveAccessToken : ''
  const expiresIn = Number(response.sensitiveAccessExpiresIn || 0)
  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) return
  const record: SensitiveAccessRecord = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
    userId: activeUserId()
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function clearSensitiveAccess() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (_error) {
    // There is nothing else to clear when storage is unavailable.
  }
}
