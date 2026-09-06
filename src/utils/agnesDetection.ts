export const AGNES_DOWNLOAD_URL = `${import.meta.env.BASE_URL}printing/AgnesPrinterPlugin-1.2.zip`
export type AgnesDetection = 'ready' | 'pairing' | 'unavailable' | 'incompatible'

/** A failed connection cannot distinguish a closed agent from browser/CORS restrictions. */
export async function detectAgnes(
  token: string,
  transport: typeof fetch = fetch
): Promise<AgnesDetection> {
  try {
    const response = await transport('http://127.0.0.1:18457/v1/info', {
      headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {},
      signal: AbortSignal.timeout(3500),
      credentials: 'omit',
      cache: 'no-store'
    })
    if (response.status === 401 || response.status === 403) return 'pairing'
    if (!response.ok) return 'incompatible'
    const info = await response.json()
    return info.name === 'Agnes Printer Plugin' && info.apiVersion === 1 ? 'ready' : 'incompatible'
  } catch {
    return 'unavailable'
  }
}
