export interface PrinterPreferences {
  token: string
  printer: string
  paperWidth: 58 | 80
}

const endpoint = 'http://127.0.0.1:18457'
const settingsKey = 'agnes.printer.v1'
function normalize(value: Partial<PrinterPreferences>): PrinterPreferences {
  return {
    token: typeof value.token === 'string' ? value.token : '',
    printer: typeof value.printer === 'string' ? value.printer : '',
    paperWidth: value.paperWidth === 58 ? 58 : 80
  }
}
export function getPrinterPreferences(): PrinterPreferences {
  try {
    const saved = localStorage.getItem(settingsKey)
    if (saved) return normalize(JSON.parse(saved))
    // Migrate only unambiguous legacy settings, without choosing an account.
    const legacy: PrinterPreferences[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('despacho.printer.v1.')) continue
      try {
        legacy.push(normalize(JSON.parse(localStorage.getItem(key) || '{}')))
      } catch {
        /* skip corrupt entries */
      }
    }
    const tokens = [...new Set(legacy.map((item) => item.token).filter(Boolean))]
    if (tokens.length !== 1) return normalize({})
    const candidates = legacy.filter((item) => item.token === tokens[0] && item.printer)
    const choices = new Set(
      candidates.map((item) => JSON.stringify([item.printer, item.paperWidth]))
    )
    const migrated = choices.size === 1 ? candidates[0] : normalize({ token: tokens[0] })
    localStorage.setItem(settingsKey, JSON.stringify(migrated))
    return migrated
  } catch {
    return normalize({})
  }
}
export function savePrinterPreferences(value: PrinterPreferences) {
  if (!value.token.trim() || !value.printer)
    throw new Error('Conecta el agente y elige una impresora.')
  localStorage.setItem(
    settingsKey,
    JSON.stringify(normalize({ ...value, token: value.token.trim() }))
  )
}
export async function printerRequest<T>(path: string, token: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(body === undefined ? 8000 : 45000),
      credentials: 'omit',
      cache: 'no-store'
    })
  } catch {
    throw new Error(
      path !== '/print'
        ? 'No se pudo conectar al agente local. Ábrelo en este equipo y permite el acceso local del navegador.'
        : 'No se recibió confirmación del agente. Revisa la cola de impresión antes de reintentar para evitar duplicados.'
    )
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'El agente rechazó la solicitud.')
  return result as T
}
export async function listLocalPrinters(token: string): Promise<string[]> {
  const result = await printerRequest<{ printers: string[] }>('/printers', token.trim())
  return result.printers
}

type AgentPreferences = Pick<PrinterPreferences, 'printer' | 'paperWidth'>
export async function syncPrinterPreferences(value: PrinterPreferences): Promise<void> {
  await printerRequest('/preferences', value.token, {
    printer: value.printer,
    paperWidth: value.paperWidth
  })
  savePrinterPreferences(value)
}
export async function effectivePrinterPreferences(
  value: PrinterPreferences,
  allowUnconfigured = false
): Promise<PrinterPreferences> {
  const result = await printerRequest<{ preferences: AgentPreferences | null }>(
    '/preferences',
    value.token
  )
  if (!result.preferences) {
    // Migrate the shared browser preference once without a new pairing.
    if (!value.printer && allowUnconfigured) return value
    if (!value.printer)
      throw new Error('Selecciona tu impresora en Configuración y guarda los cambios.')
    await syncPrinterPreferences(value)
    return value
  }
  const next = { ...value, ...result.preferences }
  savePrinterPreferences(next)
  return next
}
