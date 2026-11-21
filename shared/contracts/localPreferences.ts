/**
 * Preferencias LOCAL de este equipo ([[02-DATA-OWNERSHIP]]): nunca se envían al Host ni se guardan
 * en almacenamiento web. El tema sólo elige entre Light y Dark; `system` sigue al sistema operativo
 * entre esos dos. La fuente es Geist, empaquetada con la aplicación: no existe preferencia de fuente.
 */
export const localPreferencesChannels = { read: 'preferences:read', update: 'preferences:update', listPrinters: 'preferences:listPrinters' } as const
export const themePreferences = ['system', 'light', 'dark'] as const
export type ThemePreference = typeof themePreferences[number]
/**
 * Apariencia del equipo (ADR-039, pedido del usuario 2026-10-12). No son temas: el tema sigue siendo Light o Dark.
 * - `backgroundStyle`: fondo de la mesa. `dither` (Vue Bits, WebGL) es el de siempre; los demás se dibujan con Canvas 2D.
 * - `accentColor` (adenda 2026-10-13): color libre `#RRGGBB` elegido por el usuario. Lo que se pinta se deriva en el Renderer
 *   (`accentPalette.ts`) para cumplir ≥ 4.5:1 en Light y en Dark; aquí sólo se guarda lo elegido.
 */
export const backgroundStyles = ['dither', 'dotGrid', 'squares', 'waves', 'threads', 'hyperspeed', 'gridDistortion', 'ribbons', 'iridescence', 'none'] as const
export type BackgroundStyle = typeof backgroundStyles[number]
/** Presets guardados por la primera versión de ADR-039 (2026-10-12): al leer el archivo se traducen a su hexadecimal Light. */
export const previousAccentColors: Readonly<Record<string, string>> = { blue: '#1F3BD6', red: '#B3132B', green: '#13703A', orange: '#A84300', violet: '#6B2BD9', teal: '#0B5F73', ink: '#0B0B0B' }
/** `#RRGGBB` en mayúsculas: una sola forma en disco para comparar sin ambigüedad. */
export function parseAccentColor(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error('Invalid accent')
  return value.toUpperCase()
}
/**
 * Tamaño de página de las listas (2026-10-17, pedido del usuario: "decir de cuánto queremos para que empiece la
 * paginación, esto en filtros, aplicar también en pagos y clientes"). Se elige en el modal de Filtros de cada lista y
 * se recuerda en este equipo. Sólo valores de `listPageSizes`.
 */
export const listPageSizes = [6, 10, 20, 50] as const
export type ListPageSize = typeof listPageSizes[number]
export const pagedLists = ['tasks', 'clients', 'movements'] as const
export type PagedList = typeof pagedLists[number]
export type ListPageSizes = Record<PagedList, ListPageSize>
export const ticketWidths = [58, 80] as const
export type TicketWidth = typeof ticketWidths[number]
/** Páginas del menú que se restauran tras iniciar sesión, si la sesión todavía puede abrirlas. */
export const restorablePages = ['home', 'tasks', 'clients', 'payments', 'fiscal', 'compliance', 'reconciliation', 'catalogs', 'mail', 'notes', 'settings'] as const
export type RestorablePage = typeof restorablePages[number]
/**
 * Claves de la navegación anterior (5.3), guardadas en `preferences.json` de equipos ya actualizados.
 * Se traducen al leer para no descartar el resto de las preferencias por una página renombrada.
 */
export const previousPageKeys: Readonly<Record<string, RestorablePage>> = { installation: 'home', clients: 'clients', movements: 'payments', branding: 'settings', tasks: 'tasks', notes: 'notes', xml: 'fiscal', settings: 'settings', reference: 'settings' }
export interface PrinterPreference { printerName: string | null; ticketWidthMillimeters: TicketWidth }
/**
 * `shouldRunHostInBackground` (7.4, sólo en el equipo Host instalado): iniciar con Windows y, al cerrar la ventana,
 * seguir en la bandeja atendiendo Clientes, respaldos y programaciones.
 */
export interface LocalPreferences { theme: ThemePreference; isSidebarCollapsed: boolean; isBackgroundPaused: boolean; lastPage: RestorablePage | null; printer: PrinterPreference; shouldRunHostInBackground: boolean; backgroundStyle: BackgroundStyle; accentColor: string; pageSizes: ListPageSizes }
export type LocalPreferencesPatch = Partial<LocalPreferences>
export interface LocalPrinter { name: string; displayName: string }
export const defaultPreferences: LocalPreferences = { theme: 'system', isSidebarCollapsed: false, isBackgroundPaused: false, lastPage: null, printer: { printerName: null, ticketWidthMillimeters: 80 }, shouldRunHostInBackground: true, backgroundStyle: 'dither', accentColor: '#1F3BD6', pageSizes: { tasks: 6, clients: 10, movements: 10 } }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid preferences')
  return value as Record<string, unknown>
}
function printerName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid printer')
  return value
}
function parsePrinter(value: unknown): PrinterPreference {
  const data = record(value)
  if (Object.keys(data).sort().join() !== 'printerName,ticketWidthMillimeters') throw new Error('Invalid printer')
  if (!ticketWidths.includes(data.ticketWidthMillimeters as TicketWidth)) throw new Error('Invalid ticket width')
  return { printerName: data.printerName === null ? null : printerName(data.printerName), ticketWidthMillimeters: data.ticketWidthMillimeters as TicketWidth }
}
function parsePageSizes(value: unknown): ListPageSizes {
  const data = record(value)
  if (Object.keys(data).sort().join() !== [...pagedLists].sort().join() || pagedLists.some(list => !listPageSizes.includes(data[list] as ListPageSize))) throw new Error('Invalid page sizes')
  return { tasks: data.tasks as ListPageSize, clients: data.clients as ListPageSize, movements: data.movements as ListPageSize }
}
/** Cambio parcial con claves conocidas; nada fuera de este contrato llega a disco. */
export function parsePreferencesPatch(value: unknown): LocalPreferencesPatch {
  const data = record(value)
  const patch: LocalPreferencesPatch = {}
  for (const key of Object.keys(data)) {
    if (key === 'theme') { if (!themePreferences.includes(data.theme as ThemePreference)) throw new Error('Invalid theme'); patch.theme = data.theme as ThemePreference }
    else if (key === 'isSidebarCollapsed' || key === 'isBackgroundPaused' || key === 'shouldRunHostInBackground') { if (typeof data[key] !== 'boolean') throw new Error('Invalid preference'); patch[key] = data[key] as boolean }
    else if (key === 'lastPage') { if (data.lastPage !== null && !restorablePages.includes(data.lastPage as RestorablePage)) throw new Error('Invalid page'); patch.lastPage = data.lastPage as RestorablePage | null }
    else if (key === 'backgroundStyle') { if (!backgroundStyles.includes(data.backgroundStyle as BackgroundStyle)) throw new Error('Invalid background'); patch.backgroundStyle = data.backgroundStyle as BackgroundStyle }
    else if (key === 'accentColor') patch.accentColor = parseAccentColor(data.accentColor)
    else if (key === 'printer') patch.printer = parsePrinter(data.printer)
    else if (key === 'pageSizes') patch.pageSizes = parsePageSizes(data.pageSizes)
    else throw new Error('Invalid preference')
  }
  return patch
}
export function parseLocalPreferences(value: unknown): LocalPreferences {
  const data = record(value)
  // Migración del color: un preset de la primera versión (`'red'`) pasa a su hexadecimal; cualquier otro valor se valida igual.
  const previousAccent = typeof data.accentColor === 'string' && Object.hasOwn(previousAccentColors, data.accentColor) ? previousAccentColors[data.accentColor] : undefined
  const patch = parsePreferencesPatch(previousAccent ? { ...data, accentColor: previousAccent } : data)
  // Los archivos anteriores a 7.4 no traen `shouldRunHostInBackground`, ni los anteriores a ADR-039 `backgroundStyle` y
  // `accentColor`, ni los anteriores al 2026-10-17 `pageSizes`: se completan con el valor por omisión sin descartar el resto.
  const requiredKeys = ['theme', 'isSidebarCollapsed', 'isBackgroundPaused', 'lastPage', 'printer'] as const
  if (requiredKeys.some(key => !(key in patch))) throw new Error('Invalid preferences')
  return { ...defaultPreferences, ...patch }
}
export function parseLocalPrinters(value: unknown): LocalPrinter[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid printers')
  return value.map(item => {
    const data = record(item)
    if (Object.keys(data).sort().join() !== 'displayName,name') throw new Error('Invalid printers')
    return { name: printerName(data.name), displayName: printerName(data.displayName) }
  })
}
