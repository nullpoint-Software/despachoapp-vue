import { pairingRecord } from './pairing'

/**
 * Catálogos SAT de CFDI 4.0 (ADR-032). Son datos públicos, guardados como caché LOCAL en cada equipo: la
 * persona elige qué descargar en "Catálogos SAT" y busca códigos sin conexión.
 * - Origen fijo: el repositorio público bambucode/catalogos_sat_JSON (JSON generados de los Excel del SAT). La
 *   vista nunca envía direcciones: sólo el identificador de un catálogo de esta lista.
 * - c_RegimenFiscal viene incluido en la aplicación (`shared/fiscal/taxRegimes.ts`) porque la ficha del cliente
 *   lo necesita siempre; aparece como "Incluido" y no se descarga.
 * - Se omiten los catálogos que no traducen un código a un significado (pedimentos, patentes, tasas, factores).
 */
export const satCatalogDefinitions = [
  { catalogId: 'regimenFiscal', fileName: 'c_RegimenFiscal.json', title: 'Régimen fiscal', usage: 'Régimen del cliente y de emisores y receptores de CFDI.', approximateBytes: 4750, isBundled: true },
  { catalogId: 'usoCfdi', fileName: 'c_UsoCFDI.json', title: 'Uso del CFDI', usage: 'Para qué usará el receptor la factura (G01, G03, D01…).', approximateBytes: 5279, isBundled: false },
  { catalogId: 'formaPago', fileName: 'c_FormaPago.json', title: 'Forma de pago', usage: 'Efectivo, transferencia, tarjeta y demás formas de pago.', approximateBytes: 12823, isBundled: false },
  { catalogId: 'metodoPago', fileName: 'c_MetodoPago.json', title: 'Método de pago', usage: 'PUE o PPD.', approximateBytes: 304, isBundled: false },
  { catalogId: 'tipoComprobante', fileName: 'c_TipoDeComprobante.json', title: 'Tipo de comprobante', usage: 'Ingreso, egreso, traslado, nómina o pago.', approximateBytes: 1088, isBundled: false },
  { catalogId: 'tipoRelacion', fileName: 'c_TipoRelacion.json', title: 'Tipo de relación', usage: 'Cómo se relaciona un CFDI con otro (nota de crédito, sustitución…).', approximateBytes: 1486, isBundled: false },
  { catalogId: 'impuesto', fileName: 'c_Impuesto.json', title: 'Impuesto', usage: 'ISR, IVA e IEPS.', approximateBytes: 483, isBundled: false },
  { catalogId: 'moneda', fileName: 'c_Moneda.json', title: 'Moneda', usage: 'Claves de moneda (MXN, USD…).', approximateBytes: 33921, isBundled: false },
  { catalogId: 'pais', fileName: 'c_Pais.json', title: 'País', usage: 'Claves de país para residencia fiscal y comercio exterior.', approximateBytes: 55961, isBundled: false },
  { catalogId: 'aduana', fileName: 'c_Aduana.json', title: 'Aduana', usage: 'Aduanas de México.', approximateBytes: 7864, isBundled: false },
  { catalogId: 'claveUnidad', fileName: 'c_ClaveUnidad.json', title: 'Clave de unidad', usage: 'Unidades de medida de los conceptos (H87, E48…).', approximateBytes: 659938, isBundled: false },
  { catalogId: 'claveProdServ', fileName: 'c_ClaveProdServ.json', title: 'Clave de producto o servicio', usage: 'Qué se vende en cada concepto de una factura.', approximateBytes: 18251998, isBundled: false },
  { catalogId: 'codigoPostal', fileName: 'c_CodigoPostal.json', title: 'Código postal', usage: 'Estado, municipio y localidad de cada código postal.', approximateBytes: 25184752, isBundled: false }
] as const
export type SatCatalogId = typeof satCatalogDefinitions[number]['catalogId']
export const satCatalogIds = satCatalogDefinitions.map(definition => definition.catalogId) as readonly SatCatalogId[]
export const satCatalogsChannel = 'satCatalogs:operate'
export const maximumSearchResults = 50
export const maximumDescribedCodes = 100

export type SatCatalogRequest =
  { action: 'list' } |
  { action: 'download'; catalogId: SatCatalogId } |
  { action: 'delete'; catalogId: SatCatalogId } |
  { action: 'search'; catalogId: SatCatalogId; text: string } |
  { action: 'describe'; catalogId: SatCatalogId; codes: string[] }

/** Una entrada normalizada: código, significado, dato complementario y si el SAT le puso fin de vigencia. */
export interface SatCatalogEntry { code: string; description: string; detail: string; isRetired: boolean }
export interface SatCatalogStatus { catalogId: SatCatalogId; state: 'bundled' | 'downloaded' | 'available'; entryCount: number | null; downloadedAt: string | null }
export type SatCatalogResult =
  { action: 'list'; catalogs: SatCatalogStatus[] } |
  { action: 'download' | 'delete'; catalog: SatCatalogStatus } |
  { action: 'search' | 'describe'; entries: SatCatalogEntry[] }

export function findSatCatalogDefinition(catalogId: SatCatalogId): typeof satCatalogDefinitions[number] {
  return satCatalogDefinitions.find(definition => definition.catalogId === catalogId)!
}

function parseCatalogId(value: unknown): SatCatalogId {
  if (typeof value !== 'string' || !satCatalogIds.includes(value as SatCatalogId)) throw new Error('Invalid SAT catalog')
  return value as SatCatalogId
}
function catalogCode(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{1,10}$/.test(value)) throw new Error('Invalid SAT code')
  return value
}

export function parseSatCatalogRequest(value: unknown): SatCatalogRequest {
  const data = pairingRecord(value)
  const keys: Record<string, string> = { list: 'action', download: 'action,catalogId', delete: 'action,catalogId', search: 'action,catalogId,text', describe: 'action,catalogId,codes' }
  if (typeof data.action !== 'string' || !Object.hasOwn(keys, data.action) || Object.keys(data).sort().join() !== keys[data.action]) throw new Error('Invalid SAT catalog request')
  if (data.action === 'list') return { action: 'list' }
  const catalogId = parseCatalogId(data.catalogId)
  if (data.action === 'download' || data.action === 'delete') return { action: data.action, catalogId }
  if (data.action === 'search') {
    if (typeof data.text !== 'string' || data.text.length > 100 || [...data.text].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid SAT search')
    return { action: 'search', catalogId, text: data.text }
  }
  if (!Array.isArray(data.codes) || data.codes.length > maximumDescribedCodes) throw new Error('Invalid SAT codes')
  return { action: 'describe', catalogId, codes: data.codes.map(catalogCode) }
}

function parseStatus(value: unknown): SatCatalogStatus {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join() !== 'catalogId,downloadedAt,entryCount,state') throw new Error('Invalid SAT catalog status')
  if (data.state !== 'bundled' && data.state !== 'downloaded' && data.state !== 'available') throw new Error('Invalid SAT catalog status')
  if (data.entryCount !== null && (!Number.isSafeInteger(data.entryCount) || Number(data.entryCount) < 0)) throw new Error('Invalid SAT catalog status')
  if (data.downloadedAt !== null && (typeof data.downloadedAt !== 'string' || Number.isNaN(Date.parse(data.downloadedAt)))) throw new Error('Invalid SAT catalog status')
  return { catalogId: parseCatalogId(data.catalogId), state: data.state, entryCount: data.entryCount as number | null, downloadedAt: data.downloadedAt }
}
function entryText(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum) throw new Error('Invalid SAT entry')
  return value
}
function parseEntry(value: unknown): SatCatalogEntry {
  const data = pairingRecord(value)
  if (Object.keys(data).sort().join() !== 'code,description,detail,isRetired' || typeof data.isRetired !== 'boolean') throw new Error('Invalid SAT entry')
  return { code: entryText(data.code, 20), description: entryText(data.description, 1000), detail: entryText(data.detail, 2000), isRetired: data.isRetired }
}

export function parseSatCatalogResult(value: unknown): SatCatalogResult {
  const data = pairingRecord(value)
  if (data.action === 'list' && Array.isArray(data.catalogs) && data.catalogs.length <= satCatalogIds.length) return { action: 'list', catalogs: data.catalogs.map(parseStatus) }
  if ((data.action === 'download' || data.action === 'delete') && 'catalog' in data) return { action: data.action, catalog: parseStatus(data.catalog) }
  if ((data.action === 'search' || data.action === 'describe') && Array.isArray(data.entries) && data.entries.length <= Math.max(maximumSearchResults, maximumDescribedCodes)) return { action: data.action, entries: data.entries.map(parseEntry) }
  throw new Error('Invalid SAT catalog result')
}

/** Búsqueda sin acentos ni mayúsculas: "habitacion" encuentra "Habitación". */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-MX').trim()
}
