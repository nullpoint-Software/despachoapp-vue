import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'
import type { ClientAccess } from './clients'

/**
 * Movimientos GLOBAL del despacho: un único modelo `income` / `expense`, de un contribuyente o, desde 4.3a,
 * **del propio despacho** (sin cliente y con categoría fija; ADR-027). Los del despacho se ven y operan con
 * los permisos `officeMovements.*`; los de clientes, con `movements.*` y la asignación del cliente.
 * El importe viaja siempre como texto decimal con dos decimales ("1234.50"); nunca como número de
 * coma flotante. Las fechas de negocio son días `YYYY-MM-DD` del calendario del despacho.
 *
 * Hora de negocio (2026-10-10, pedido del usuario para auditorías y cortes por turno): cada movimiento lleva además
 * `movementTime` `HH:MM` (24 h, zona del despacho), la hora en que ocurrió el pago según quien lo captura. No sustituye a
 * `createdAt`/`updatedAt`, que son los sellos de auditoría inmutables que pone MySQL al registrar o modificar.
 */
export const movementsChannel = 'movements:operate'
export const movementPageSize = 50
export const movementTypes = ['income', 'expense'] as const
export const paymentMethods = ['cash', 'transfer', 'card', 'other'] as const
export type MovementType = typeof movementTypes[number]
export type PaymentMethod = typeof paymentMethods[number]
/** Categorías fijas de los movimientos del despacho (decisión del usuario, 2026-10-03). */
export const officeCategories = ['rent', 'utilities', 'stationery', 'payroll', 'taxes', 'services', 'interest', 'refund', 'other'] as const
export type OfficeCategory = typeof officeCategories[number]
/** Origen de la consulta: todos los visibles, sólo de clientes o sólo del despacho. */
export const movementScopes = ['all', 'clients', 'office'] as const
export type MovementScope = typeof movementScopes[number]
/** Nombre que muestra la vista (y el ticket) en lugar del cliente para los movimientos del despacho. */
export const officePartyName = 'Despacho'
export type MovementState = 'active' | 'voided'
/** Zona horaria del despacho para calcular "hoy"; los días guardados no dependen de la zona del equipo. */
export const officeTimeZone = 'America/Mexico_City'
/** Máximo de DECIMAL(12,2). */
export const maximumMovementCents = 999_999_999_999n
/** Rango máximo de una consulta o corte, en días naturales. */
export const maximumMovementRangeDays = 1827

export interface Movement {
  movementId: string
  folio: number
  /** `null` en los movimientos del despacho; entonces `clientDisplayName` es "Despacho". */
  clientId: string | null
  clientDisplayName: string
  officeCategory: OfficeCategory | null
  /** Para los del despacho, `readWrite` si la sesión puede editarlos o anularlos. */
  access: ClientAccess
  movementType: MovementType
  amount: string
  paymentMethod: PaymentMethod
  concept: string
  movementDate: string
  /** Hora de negocio `HH:MM` en la zona del despacho; `createdAt` sigue siendo el sello de registro. */
  movementTime: string
  state: MovementState
  voidReason: string | null
  revision: number
  /** Quien registró el pago (2026-10-04): permite mostrar su foto junto a "Atendió". */
  createdByUserId: string
  createdByDisplayName: string
  updatedByDisplayName: string | null
  createdAt: string
  updatedAt: string | null
}
export interface MovementFilter {
  scope: MovementScope
  /** Sólo con `scope: 'clients'`. */
  clientId: string | null
  /** Sólo con `scope: 'office'`. */
  officeCategory: OfficeCategory | null
  fromDate: string
  /** Hora inicial `HH:MM` del primer día (incluida); `null` = desde las 00:00. */
  fromTime: string | null
  toDate: string
  /** Hora final `HH:MM` del último día (incluido ese minuto); `null` = hasta las 23:59. */
  toTime: string | null
  movementType: MovementType | null
  paymentMethod: PaymentMethod | null
  search: string
  includeVoided: boolean
}
export interface MovementTotals { incomeAmount: string; expenseAmount: string; netAmount: string; movementCount: number }
/** El corte incluye los movimientos del despacho visibles; `office` es su subtotal y `byOfficeCategory` su desglose. */
export interface MovementSummary extends MovementTotals { byPaymentMethod: Array<MovementTotals & { paymentMethod: PaymentMethod }>; office: MovementTotals | null; byOfficeCategory: Array<MovementTotals & { officeCategory: OfficeCategory }> }
export interface MovementDraft { movementType: MovementType; amount: string; paymentMethod: PaymentMethod; concept: string; movementDate: string; movementTime: string }

export type MovementRequest =
  { action: 'list'; filter: MovementFilter; beforeCursor: string | null } |
  { action: 'summarize'; filter: MovementFilter } |
  { action: 'get'; movementId: string } |
  { action: 'create'; clientId: string; draft: MovementDraft } |
  { action: 'createOffice'; officeCategory: OfficeCategory; draft: MovementDraft } |
  { action: 'update'; movementId: string; revision: number; draft: MovementDraft; officeCategory: OfficeCategory | null } |
  { action: 'void'; movementId: string; revision: number; reason: string }
/** Capacidades calculadas en Host para mostrar acciones; cada operación vuelve a validarlas. */
export interface MovementCapabilities { canCreate: boolean; canUpdate: boolean; canVoid: boolean; canReadOffice: boolean; canCreateOffice: boolean; canUpdateOffice: boolean; canVoidOffice: boolean }
export const movementCapabilityKeys = ['canCreate', 'canUpdate', 'canVoid', 'canReadOffice', 'canCreateOffice', 'canUpdateOffice', 'canVoidOffice'] as const
export type MovementResult =
  { status: 'listed'; movements: Movement[]; nextCursor: string | null; capabilities: MovementCapabilities } |
  { status: 'summarized'; summary: MovementSummary } |
  { status: 'saved'; movement: Movement } |
  { status: 'found'; movement: Movement }

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid movement request')
}
function oneOf<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (!options.includes(value as T)) throw new Error('Invalid ' + label)
  return value as T
}
function parseRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid movement revision')
  return Number(value)
}

/**
 * Importe positivo con hasta dos decimales, sin signo, exponentes ni separadores de miles.
 * Devuelve la forma canónica con dos decimales ("7" → "7.00"). El tope es el de DECIMAL(12,2).
 */
export function parseMovementAmount(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid amount')
  const text = value.trim()
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new Error('Invalid amount')
  const cents = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (cents <= 0n || cents > maximumMovementCents) throw new Error('Invalid amount')
  return formatCents(cents)
}
/** Centavos enteros → texto decimal canónico; admite negativos para el neto. */
export function formatCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : ''
  const absolute = cents < 0n ? -cents : cents
  return sign + (absolute / 100n).toString() + '.' + (absolute % 100n).toString().padStart(2, '0')
}
/** Texto decimal (incluido el neto negativo que devuelve MySQL) → centavos enteros. */
export function parseDecimalCents(value: unknown): bigint {
  if (typeof value !== 'string' || !/^-?\d{1,20}\.\d{2}$/.test(value)) throw new Error('Invalid decimal')
  const negative = value.startsWith('-')
  const [whole, fraction] = value.replace('-', '').split('.') as [string, string]
  const cents = BigInt(whole) * 100n + BigInt(fraction)
  return negative ? -cents : cents
}

/** Día de calendario real (rechaza 2026-02-30); no aplica zona horaria. */
export function parseBusinessDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date')
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 2000 || year > 2099 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Invalid date')
  return value
}
/**
 * Hora de negocio estricta `HH:MM` de 24 h (00:00–23:59), sin segundos ni formato de 12 h: es la precisión que se
 * captura, se guarda (TIME con segundos en 0) y se imprime. Rechaza "7:05", "24:00" y "07:05:00".
 */
export function parseBusinessTime(value: unknown): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid time')
  return value
}
/** Hora actual `HH:MM` en la zona del despacho: la que propone el formulario al registrar un pago nuevo. */
export function getOfficeTime(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: officeTimeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
}
/** Día actual en la zona del despacho: un movimiento capturado a las 23:30 de CDMX no cae en el día siguiente UTC. */
export function getOfficeToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: officeTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
/** Desfase (ms) de la zona del despacho respecto a UTC en un instante dado; negativo al oeste de Greenwich. */
export function officeOffsetMilliseconds(instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: officeTimeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant))
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - instant
}
/**
 * Instante en que empieza un día de negocio (00:00 en la zona del despacho), para comparar contra
 * columnas TIMESTAMP. "2026-09-30" en CDMX (UTC−6) es 2026-09-30T06:00:00Z. Se corrige dos veces por si
 * el día cruza un cambio de horario.
 */
export function getOfficeDayStart(businessDate: string): Date {
  const [year, month, day] = parseBusinessDate(businessDate).split('-').map(Number) as [number, number, number]
  const midnight = Date.UTC(year, month - 1, day)
  const firstGuess = midnight - officeOffsetMilliseconds(midnight)
  return new Date(midnight - officeOffsetMilliseconds(firstGuess))
}
/** Instante UTC de una hora de pared del despacho (`YYYY-MM-DD`, `HH:MM:SS`); misma doble corrección que `getOfficeDayStart`. */
export function getOfficeInstant(businessDate: string, businessTime: string): Date {
  const [year, month, day] = parseBusinessDate(businessDate).split('-').map(Number) as [number, number, number]
  const [hour, minute, second] = businessTime.split(':').map(Number) as [number, number, number]
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second)
  const firstGuess = wallClock - officeOffsetMilliseconds(wallClock)
  return new Date(wallClock - officeOffsetMilliseconds(firstGuess))
}
function daysBetween(fromDate: string, toDate: string): number {
  return (Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000
}

export function parseMovementFilter(value: unknown): MovementFilter {
  const data = pairingRecord(value)
  exactKeys(data, ['scope', 'clientId', 'officeCategory', 'fromDate', 'fromTime', 'toDate', 'toTime', 'movementType', 'paymentMethod', 'search', 'includeVoided'])
  const scope = oneOf(data.scope, movementScopes, 'movement scope')
  // Un cliente sólo tiene sentido con origen "clientes" y una categoría sólo con origen "despacho".
  if ((data.clientId !== null && scope !== 'clients') || (data.officeCategory !== null && scope !== 'office')) throw new Error('Invalid movement filter')
  const fromDate = parseBusinessDate(data.fromDate), toDate = parseBusinessDate(data.toDate)
  const range = daysBetween(fromDate, toDate)
  if (range < 0 || range > maximumMovementRangeDays) throw new Error('Invalid date range')
  // Las horas son opcionales (null = día completo) y acotan sólo el primer y el último día del periodo. En un periodo de
  // un solo día el inicio no puede ser posterior al fin; un mismo minuto en ambos extremos es válido (corte de un minuto).
  const fromTime = data.fromTime === null ? null : parseBusinessTime(data.fromTime), toTime = data.toTime === null ? null : parseBusinessTime(data.toTime)
  if (range === 0 && (fromTime ?? '00:00') > (toTime ?? '23:59')) throw new Error('Invalid date range')
  if (typeof data.search !== 'string' || data.search.length > 100 || [...data.search].some(character => character.charCodeAt(0) < 32)) throw new Error('Invalid search')
  if (typeof data.includeVoided !== 'boolean') throw new Error('Invalid filter')
  return { scope, clientId: data.clientId === null ? null : parseHostId(data.clientId), officeCategory: data.officeCategory === null ? null : oneOf(data.officeCategory, officeCategories, 'office category'), fromDate, fromTime, toDate, toTime,
    movementType: data.movementType === null ? null : oneOf(data.movementType, movementTypes, 'movement type'),
    paymentMethod: data.paymentMethod === null ? null : oneOf(data.paymentMethod, paymentMethods, 'payment method'),
    search: data.search.trim(), includeVoided: data.includeVoided }
}
export function parseMovementDraft(value: unknown): MovementDraft {
  const data = pairingRecord(value)
  exactKeys(data, ['movementType', 'amount', 'paymentMethod', 'concept', 'movementDate', 'movementTime'])
  return { movementType: oneOf(data.movementType, movementTypes, 'movement type'), amount: parseMovementAmount(data.amount),
    paymentMethod: oneOf(data.paymentMethod, paymentMethods, 'payment method'), concept: pairingText(data.concept, 200), movementDate: parseBusinessDate(data.movementDate),
    movementTime: parseBusinessTime(data.movementTime) }
}
/**
 * Cursor opaco para la vista: fecha y hora de negocio y folio del último elemento de la página
 * (`AAAA-MM-DDTHH:MM:folio`), el mismo orden en que el Host pagina (fecha, hora y folio descendentes).
 */
export function parseMovementCursor(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{1,15}$/.test(value)) throw new Error('Invalid movement cursor')
  parseBusinessDate(value.slice(0, 10))
  parseBusinessTime(value.slice(11, 16))
  return value
}
/** Separa un cursor ya validado en sus tres partes. */
export function splitMovementCursor(cursor: string): { movementDate: string; movementTime: string; folio: number } {
  return { movementDate: cursor.slice(0, 10), movementTime: cursor.slice(11, 16), folio: Number(cursor.slice(17)) }
}

/** Contrato cerrado: nunca acepta usuario actor, folio, estado ni totales calculados por la vista. */
export function parseMovementRequest(value: unknown): MovementRequest {
  const data = pairingRecord(value)
  if (data.action === 'list') { exactKeys(data, ['action', 'filter', 'beforeCursor']); return { action: 'list', filter: parseMovementFilter(data.filter), beforeCursor: parseMovementCursor(data.beforeCursor) } }
  if (data.action === 'summarize') { exactKeys(data, ['action', 'filter']); return { action: 'summarize', filter: parseMovementFilter(data.filter) } }
  // Lectura de un solo movimiento (recibo impreso por Main): mismo permiso y asignación que la lista.
  if (data.action === 'get') { exactKeys(data, ['action', 'movementId']); return { action: 'get', movementId: parseHostId(data.movementId) } }
  if (data.action === 'create') { exactKeys(data, ['action', 'clientId', 'draft']); return { action: 'create', clientId: parseHostId(data.clientId), draft: parseMovementDraft(data.draft) } }
  if (data.action === 'createOffice') { exactKeys(data, ['action', 'officeCategory', 'draft']); return { action: 'createOffice', officeCategory: oneOf(data.officeCategory, officeCategories, 'office category'), draft: parseMovementDraft(data.draft) } }
  // `officeCategory` sólo se usa al editar uno del despacho; en uno de cliente debe ser null (el Host lo verifica).
  if (data.action === 'update') {
    exactKeys(data, ['action', 'movementId', 'revision', 'draft', 'officeCategory'])
    return { action: 'update', movementId: parseHostId(data.movementId), revision: parseRevision(data.revision), draft: parseMovementDraft(data.draft), officeCategory: data.officeCategory === null ? null : oneOf(data.officeCategory, officeCategories, 'office category') }
  }
  if (data.action === 'void') { exactKeys(data, ['action', 'movementId', 'revision', 'reason']); return { action: 'void', movementId: parseHostId(data.movementId), revision: parseRevision(data.revision), reason: pairingText(data.reason, 200) } }
  throw new Error('Invalid movement request')
}

/** Operaciones que modifican un registro existente: Host exige contraseña del actor. */
export function requiresMovementReauthentication(request: MovementRequest): boolean { return request.action === 'update' || request.action === 'void' }

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp')
  return new Date(Date.parse(value)).toISOString()
}
function parseTotals(value: unknown): MovementTotals {
  const data = pairingRecord(value)
  for (const key of ['incomeAmount', 'expenseAmount', 'netAmount'] as const) parseDecimalCents(data[key])
  if (!Number.isSafeInteger(data.movementCount) || Number(data.movementCount) < 0) throw new Error('Invalid movement count')
  return { incomeAmount: String(data.incomeAmount), expenseAmount: String(data.expenseAmount), netAmount: String(data.netAmount), movementCount: Number(data.movementCount) }
}
export function parseMovement(value: unknown): Movement {
  const data = pairingRecord(value)
  if (!Number.isSafeInteger(data.folio) || Number(data.folio) < 1) throw new Error('Invalid folio')
  if (data.state !== 'active' && data.state !== 'voided') throw new Error('Invalid movement state')
  if (data.access !== 'readOnly' && data.access !== 'readWrite') throw new Error('Invalid access')
  if ((data.clientId === null) !== (data.officeCategory !== null)) throw new Error('Invalid movement scope')
  return { movementId: parseHostId(data.movementId), folio: Number(data.folio), clientId: data.clientId === null ? null : parseHostId(data.clientId), clientDisplayName: pairingText(data.clientDisplayName),
    officeCategory: data.officeCategory === null ? null : oneOf(data.officeCategory, officeCategories, 'office category'),
    access: data.access, movementType: oneOf(data.movementType, movementTypes, 'movement type'), amount: parseMovementAmount(data.amount),
    paymentMethod: oneOf(data.paymentMethod, paymentMethods, 'payment method'), concept: pairingText(data.concept, 200), movementDate: parseBusinessDate(data.movementDate),
    movementTime: parseBusinessTime(data.movementTime), state: data.state, voidReason: data.voidReason === null ? null : pairingText(data.voidReason, 200), revision: parseRevision(data.revision),
    createdByUserId: parseHostId(data.createdByUserId), createdByDisplayName: pairingText(data.createdByDisplayName), updatedByDisplayName: data.updatedByDisplayName === null ? null : pairingText(data.updatedByDisplayName),
    createdAt: parseTimestamp(data.createdAt), updatedAt: data.updatedAt === null ? null : parseTimestamp(data.updatedAt) }
}
/** Reconstruye el resultado acotado: columnas adicionales o listas mayores a una página se rechazan. */
export function parseMovementResult(value: unknown): MovementResult {
  const data = pairingRecord(value)
  if (data.status === 'listed') {
    exactKeys(data, ['status', 'movements', 'nextCursor', 'capabilities'])
    if (!Array.isArray(data.movements) || data.movements.length > movementPageSize) throw new Error('Invalid movement list')
    const capabilities = pairingRecord(data.capabilities)
    exactKeys(capabilities, movementCapabilityKeys)
    if (!movementCapabilityKeys.every(key => typeof capabilities[key] === 'boolean')) throw new Error('Invalid capabilities')
    return { status: 'listed', movements: data.movements.map(parseMovement), nextCursor: parseMovementCursor(data.nextCursor), capabilities: capabilities as unknown as MovementCapabilities }
  }
  if (data.status === 'summarized') {
    exactKeys(data, ['status', 'summary'])
    const summary = pairingRecord(data.summary)
    if (!Array.isArray(summary.byPaymentMethod) || summary.byPaymentMethod.length > paymentMethods.length || !Array.isArray(summary.byOfficeCategory) || summary.byOfficeCategory.length > officeCategories.length) throw new Error('Invalid summary')
    return { status: 'summarized', summary: { ...parseTotals(summary), byPaymentMethod: summary.byPaymentMethod.map(item => ({ ...parseTotals(item), paymentMethod: oneOf(pairingRecord(item).paymentMethod, paymentMethods, 'payment method') })),
      office: summary.office === null ? null : parseTotals(summary.office),
      byOfficeCategory: summary.byOfficeCategory.map(item => ({ ...parseTotals(item), officeCategory: oneOf(pairingRecord(item).officeCategory, officeCategories, 'office category') })) } }
  }
  if (data.status === 'saved') { exactKeys(data, ['status', 'movement']); return { status: 'saved', movement: parseMovement(data.movement) } }
  if (data.status === 'found') { exactKeys(data, ['status', 'movement']); return { status: 'found', movement: parseMovement(data.movement) } }
  throw new Error('Invalid movement result')
}
