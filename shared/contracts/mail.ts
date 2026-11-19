import { pairingRecord } from './pairing'
import { parseHostId } from './discovery'
import { parseMailDocument, maximumMessageDocumentLength, type MailDocument } from '../mail/mailDocument'

/**
 * Correo a clientes (2026-10-17, pedido del usuario; módulo [[MAIL]]).
 *
 * Tres niveles de contrato:
 * - **Cuenta** (`mail:account`, Renderer ↔ Main, LOCAL): la cuenta SMTP vinculada por la persona en ESTE equipo. La
 *   contraseña de aplicación sólo cruza al guardarla; leer devuelve los datos de conexión, nunca la contraseña.
 * - **Operación** (`mail:operate`, Renderer ↔ Main): plantillas GLOBAL, archivos elegidos del equipo (Main guarda sus
 *   bytes; la vista recibe un `attachmentId`, nunca la ruta) y el envío.
 * - **Host** (acción de sesión `mail`): leer y guardar plantillas, y autorizar y registrar cada envío (`mail.send`,
 *   asignación del cliente y `documents.read` si se adjunta el expediente). El Host nunca recibe la contraseña, el
 *   cuerpo, las direcciones ni los adjuntos: sólo el asunto y los conteos para la auditoría.
 */
export const mailChannels = { account: 'mail:account', operate: 'mail:operate' } as const

export const mailProviders = ['gmail', 'yahoo', 'outlook', 'office365', 'custom'] as const
export type MailProvider = typeof mailProviders[number]
/**
 * Servidores SMTP de cada proveedor. Se usa SMTP con contraseña de aplicación (sin OAuth, ver ADR-041):
 * Gmail y Yahoo la exigen (con verificación en dos pasos); Outlook.com/Hotmail y Microsoft 365 la aceptan cuando la
 * cuenta tiene la verificación en dos pasos y SMTP AUTH habilitado. `isSecure`: TLS desde el inicio (465); si es
 * `false`, STARTTLS obligatorio (587).
 */
export const mailProviderPresets: Record<Exclude<MailProvider, 'custom'>, { label: string; host: string; port: number; isSecure: boolean }> = {
  gmail: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, isSecure: true },
  yahoo: { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, isSecure: true },
  outlook: { label: 'Outlook.com / Hotmail', host: 'smtp-mail.outlook.com', port: 587, isSecure: false },
  office365: { label: 'Microsoft 365 (Office 365)', host: 'smtp.office365.com', port: 587, isSecure: false }
}

export interface MailAccountSettings {
  provider: MailProvider
  /** Nombre visible del remitente ("Despacho Ruiz"). */
  senderName: string
  emailAddress: string
  host: string
  port: number
  isSecure: boolean
  /** Usuario SMTP; casi siempre el mismo correo. */
  username: string
}
export interface MailAccountStatus { account: MailAccountSettings | null; savedAt: string | null }

/**
 * - `read`: la cuenta de la persona en este equipo (sin contraseña).
 * - `save`: Main prueba la conexión con `verify()` y sólo si responde la sella con safeStorage.
 * - `test`: vuelve a probar la cuenta guardada.
 * - `delete`: desvincula (borra el archivo sellado).
 */
export type MailAccountRequest =
  { action: 'read' } | { action: 'test' } | { action: 'delete' } |
  { action: 'save'; account: MailAccountSettings; password: string }
export type MailAccountResult = { status: 'account' | 'verified'; account: MailAccountStatus }

export type MailTemplateKind = 'body' | 'signature'
export interface MailTemplates {
  body: MailDocument
  signature: MailDocument
  /** Quién puede cambiarlas: `office.manage` en el Host. */
  canEdit: boolean
  /** "Correo principal" del despacho (2026-10-18): el redactor lo agrega a todos los correos; se puede quitar en cada uno. */
  defaultRecipient: string | null
  /**
   * URL pública (https) del logo para los correos (2026-10-19, pedido del usuario: "el icono se manda como archivo
   * adjunto, hay que configurar poner una url para el logo"). Con ella, el correo enlaza la imagen y no la adjunta;
   * sin ella, Main adjunta el logo del despacho como imagen incrustada (`cid:`).
   */
  logoUrl: string | null
}

/**
 * Contacto de correo de un cliente (2026-10-18, GLOBAL): nombre y de 1 a 10 correos.
 * `isClientAddress`: correos del propio cliente (además del de su ficha); si no, un cliente del cliente.
 */
export interface MailContact { contactId: string; clientId: string; displayName: string; emailAddresses: string[]; isClientAddress: boolean }
export interface MailContactList { clientId: string; contacts: MailContact[]; canEdit: boolean }
export const maximumMailContactCount = 200

/**
 * Operaciones del despacho que Main sólo transporta al Host (mismo contrato en la vista y en el Host):
 * plantillas, destinatario predeterminado (`office.manage`) y contactos por cliente.
 */
export type MailOfficeRequest =
  { action: 'readTemplates' } |
  { action: 'saveTemplate'; kind: MailTemplateKind; document: MailDocument } |
  { action: 'saveDefaultRecipient'; defaultRecipient: string | null } |
  { action: 'saveLogoUrl'; logoUrl: string | null } |
  { action: 'listContacts'; clientId: string } |
  { action: 'saveContact'; clientId: string; contactId: string | null; displayName: string; emailAddresses: string[]; isClientAddress: boolean } |
  { action: 'deleteContact'; clientId: string; contactId: string }
export type MailOfficeResult = { status: 'templates'; templates: MailTemplates } | { status: 'contacts'; contacts: MailContactList }

/** Adjuntos que la vista elige por referencia; Main obtiene los bytes. */
export type MailAttachmentReference =
  { kind: 'document'; documentId: string } |
  { kind: 'xml'; uuid: string } |
  { kind: 'cfdiPdf'; uuid: string } |
  { kind: 'file'; attachmentId: string }
export interface ChosenMailFile { attachmentId: string; fileName: string; sizeBytes: number }

/**
 * `clientId` NULL: correo genérico a cualquier dirección (2026-10-18, decisión del usuario), sin adjuntos ni
 * documento; el Host sólo exige `mail.send` y lo audita sin cliente.
 */
export interface MailSendRequest {
  clientId: string | null
  recipients: string[]
  subject: string
  body: MailDocument
  signature: MailDocument | null
  attachments: MailAttachmentReference[]
}
export type MailViewRequest =
  MailOfficeRequest |
  { action: 'chooseFiles' } |
  { action: 'releaseFiles'; attachmentIds: string[] } |
  ({ action: 'send' } & MailSendRequest)
export type MailViewResult =
  MailOfficeResult |
  { status: 'files'; files: ChosenMailFile[] } |
  { status: 'released' } |
  { status: 'sent'; acceptedCount: number; attachmentCount: number }

/**
 * Nivel Host. `authorizeSend` valida permisos y asignación, deja la fila `authorized` y devuelve `sendId`;
 * `recordSend` cierra ese envío con `sent` o `failed`. Las dos filas comparten `sendId`.
 */
export type MailHostRequest =
  MailOfficeRequest |
  { action: 'authorizeSend'; clientId: string | null; subject: string; recipientCount: number; attachmentCount: number; documentIds: string[] } |
  { action: 'recordSend'; sendId: string; outcome: 'sent' | 'failed' }
export type MailHostResult =
  MailOfficeResult |
  { status: 'authorized'; sendId: string } |
  { status: 'recorded' }

/** Hasta 18 MB en bruto: el base64 crece un tercio y Gmail, Outlook y Yahoo rechazan mensajes de más de 25 MB. */
export const maximumMailAttachmentBytes = 18 * 1024 * 1024
export const maximumMailAttachmentCount = 20
export const maximumMailRecipientCount = 10

const emailPattern = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const hostnamePattern = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid mail request')
}
/** Texto de una línea: sin caracteres de control (evita inyectar cabeceras en asunto o remitente). */
function line(value: unknown, maximum: number, isEmptyAllowed = false): string {
  if (typeof value !== 'string' || value.length > maximum || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Invalid mail text')
  const trimmed = value.trim()
  if (!trimmed && !isEmptyAllowed) throw new Error('Invalid mail text')
  return trimmed
}
export function parseEmailAddress(value: unknown): string {
  const address = line(value, 254).toLowerCase()
  if (!emailPattern.test(address)) throw new Error('Invalid email address')
  return address
}
function parseCount(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > maximum) throw new Error('Invalid mail count')
  return Number(value)
}
function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error('Invalid mail reference')
  return value
}

export function parseMailAccountSettings(value: unknown): MailAccountSettings {
  const data = pairingRecord(value)
  exactKeys(data, ['provider', 'senderName', 'emailAddress', 'host', 'port', 'isSecure', 'username'])
  if (!mailProviders.includes(data.provider as MailProvider)) throw new Error('Invalid mail provider')
  const provider = data.provider as MailProvider
  const host = line(data.host, 253).toLowerCase()
  if (!hostnamePattern.test(host)) throw new Error('Invalid mail host')
  if (!Number.isSafeInteger(data.port) || Number(data.port) < 1 || Number(data.port) > 65535 || typeof data.isSecure !== 'boolean') throw new Error('Invalid mail port')
  // Un preajuste no admite otro servidor: evita mandar la contraseña de Gmail a un host distinto por error.
  if (provider !== 'custom') {
    const preset = mailProviderPresets[provider]
    if (host !== preset.host || data.port !== preset.port || data.isSecure !== preset.isSecure) throw new Error('Invalid mail preset')
  }
  return { provider, senderName: line(data.senderName, 80), emailAddress: parseEmailAddress(data.emailAddress), host, port: Number(data.port), isSecure: data.isSecure, username: line(data.username, 254) }
}
/** Contraseña de aplicación: 1–256 caracteres sin saltos de línea (Google la muestra con espacios; se aceptan). */
export function parseMailPassword(value: unknown): string {
  if (typeof value !== 'string' || !value.length || value.length > 256 || /[\r\n]/.test(value) || value.includes(String.fromCharCode(0))) throw new Error('Invalid mail password')
  return value
}
export function parseMailAccountRequest(value: unknown): MailAccountRequest {
  const data = pairingRecord(value)
  if (data.action === 'read' || data.action === 'test' || data.action === 'delete') { exactKeys(data, ['action']); return { action: data.action } }
  if (data.action !== 'save') throw new Error('Invalid mail request')
  exactKeys(data, ['action', 'account', 'password'])
  return { action: 'save', account: parseMailAccountSettings(data.account), password: parseMailPassword(data.password) }
}
export function parseMailAccountStatus(value: unknown): MailAccountStatus {
  const data = pairingRecord(value)
  exactKeys(data, ['account', 'savedAt'])
  if (data.account === null && data.savedAt === null) return { account: null, savedAt: null }
  if (typeof data.savedAt !== 'string' || Number.isNaN(Date.parse(data.savedAt))) throw new Error('Invalid mail account')
  return { account: parseMailAccountSettings(data.account), savedAt: data.savedAt }
}
export function parseMailAccountResult(value: unknown): MailAccountResult {
  const data = pairingRecord(value)
  exactKeys(data, ['status', 'account'])
  if (data.status !== 'account' && data.status !== 'verified') throw new Error('Invalid mail result')
  return { status: data.status, account: parseMailAccountStatus(data.account) }
}

function parseTemplateKind(value: unknown): MailTemplateKind {
  if (value !== 'body' && value !== 'signature') throw new Error('Invalid mail template')
  return value
}
/**
 * URL del logo de los correos: sólo `https://`, hasta 500 caracteres, sin espacios, comillas ni paréntesis (va dentro
 * de `src="…"` escapado). Vacía es "sin URL".
 */
export function parseMailLogoUrl(value: unknown): string | null {
  if (value === null) return null
  const url = line(value, 500, true)
  if (!url) return null
  if (!/^https:\/\/[^\s<>"'()\\]+$/i.test(url)) throw new Error('Invalid mail logo URL')
  return url
}
export function parseMailTemplates(value: unknown): MailTemplates {
  const data = pairingRecord(value)
  exactKeys(data, ['body', 'signature', 'canEdit', 'defaultRecipient', 'logoUrl'])
  if (typeof data.canEdit !== 'boolean') throw new Error('Invalid mail templates')
  return { body: parseMailDocument(data.body), signature: parseMailDocument(data.signature), canEdit: data.canEdit, defaultRecipient: data.defaultRecipient === null ? null : parseEmailAddress(data.defaultRecipient), logoUrl: parseMailLogoUrl(data.logoUrl) }
}
/** Correos de un contacto: 1 a 10, sin repetir. */
function parseContactAddresses(value: unknown): string[] {
  const addresses = parseList(value, 10, parseEmailAddress, false)
  if (new Set(addresses).size !== addresses.length) throw new Error('Invalid mail contact')
  return addresses
}
function parseContact(value: unknown): MailContact {
  const data = pairingRecord(value)
  exactKeys(data, ['contactId', 'clientId', 'displayName', 'emailAddresses', 'isClientAddress'])
  if (typeof data.isClientAddress !== 'boolean') throw new Error('Invalid mail contact')
  return { contactId: parseHostId(data.contactId), clientId: parseHostId(data.clientId), displayName: line(data.displayName, 120), emailAddresses: parseContactAddresses(data.emailAddresses), isClientAddress: data.isClientAddress }
}
/** Parte común de la vista y el Host; `null` si la acción no es de este grupo. */
function parseMailOfficeRequest(data: Record<string, unknown>): MailOfficeRequest | null {
  if (data.action === 'readTemplates') { exactKeys(data, ['action']); return { action: 'readTemplates' } }
  if (data.action === 'saveTemplate') { exactKeys(data, ['action', 'kind', 'document']); return { action: 'saveTemplate', kind: parseTemplateKind(data.kind), document: parseMailDocument(data.document) } }
  if (data.action === 'saveDefaultRecipient') { exactKeys(data, ['action', 'defaultRecipient']); return { action: 'saveDefaultRecipient', defaultRecipient: data.defaultRecipient === null ? null : parseEmailAddress(data.defaultRecipient) } }
  if (data.action === 'saveLogoUrl') { exactKeys(data, ['action', 'logoUrl']); return { action: 'saveLogoUrl', logoUrl: parseMailLogoUrl(data.logoUrl) } }
  if (data.action === 'listContacts') { exactKeys(data, ['action', 'clientId']); return { action: 'listContacts', clientId: parseHostId(data.clientId) } }
  if (data.action === 'deleteContact') { exactKeys(data, ['action', 'clientId', 'contactId']); return { action: 'deleteContact', clientId: parseHostId(data.clientId), contactId: parseHostId(data.contactId) } }
  if (data.action !== 'saveContact') return null
  exactKeys(data, ['action', 'clientId', 'contactId', 'displayName', 'emailAddresses', 'isClientAddress'])
  if (typeof data.isClientAddress !== 'boolean') throw new Error('Invalid mail contact')
  return { action: 'saveContact', clientId: parseHostId(data.clientId), contactId: data.contactId === null ? null : parseHostId(data.contactId), displayName: line(data.displayName, 120), emailAddresses: parseContactAddresses(data.emailAddresses), isClientAddress: data.isClientAddress }
}
function parseMailOfficeResult(data: Record<string, unknown>): MailOfficeResult | null {
  if (data.status === 'templates') { exactKeys(data, ['status', 'templates']); return { status: 'templates', templates: parseMailTemplates(data.templates) } }
  if (data.status !== 'contacts') return null
  exactKeys(data, ['status', 'contacts'])
  const list = pairingRecord(data.contacts)
  exactKeys(list, ['clientId', 'contacts', 'canEdit'])
  if (typeof list.canEdit !== 'boolean') throw new Error('Invalid mail contacts')
  return { status: 'contacts', contacts: { clientId: parseHostId(list.clientId), contacts: parseList(list.contacts, maximumMailContactCount, parseContact), canEdit: list.canEdit } }
}
function parseAttachmentReference(value: unknown): MailAttachmentReference {
  const data = pairingRecord(value)
  if (data.kind === 'document') { exactKeys(data, ['kind', 'documentId']); return { kind: 'document', documentId: parseHostId(data.documentId) } }
  if (data.kind === 'xml' || data.kind === 'cfdiPdf') { exactKeys(data, ['kind', 'uuid']); return { kind: data.kind, uuid: parseUuid(data.uuid) } }
  if (data.kind === 'file') { exactKeys(data, ['kind', 'attachmentId']); return { kind: 'file', attachmentId: parseUuid(data.attachmentId) } }
  throw new Error('Invalid mail attachment')
}
function parseList<T>(value: unknown, maximum: number, parse: (item: unknown) => T, isEmptyAllowed = true): T[] {
  if (!Array.isArray(value) || value.length > maximum || (!isEmptyAllowed && !value.length)) throw new Error('Invalid mail list')
  return value.map(parse)
}
export function parseMailSubject(value: unknown): string { return line(value, 200) }
export function parseMailViewRequest(value: unknown): MailViewRequest {
  const data = pairingRecord(value)
  const office = parseMailOfficeRequest(data)
  if (office) return office
  if (data.action === 'chooseFiles') { exactKeys(data, ['action']); return { action: 'chooseFiles' } }
  if (data.action === 'releaseFiles') { exactKeys(data, ['action', 'attachmentIds']); return { action: 'releaseFiles', attachmentIds: parseList(data.attachmentIds, maximumMailAttachmentCount * 5, parseUuid) } }
  if (data.action !== 'send') throw new Error('Invalid mail request')
  exactKeys(data, ['action', 'clientId', 'recipients', 'subject', 'body', 'signature', 'attachments'])
  const recipients = parseList(data.recipients, maximumMailRecipientCount, parseEmailAddress, false)
  const attachments = parseList(data.attachments, maximumMailAttachmentCount, parseAttachmentReference)
  // Duplicados: la misma dirección o el mismo adjunto dos veces es un error de la vista, no algo que repetir.
  if (new Set(recipients).size !== recipients.length || new Set(attachments.map(item => JSON.stringify(item))).size !== attachments.length) throw new Error('Invalid mail request')
  // Correo genérico (sin cliente): sin adjuntos, "sin envío de nada" más que el mensaje.
  if (data.clientId === null && attachments.length) throw new Error('Invalid mail request')
  return {
    action: 'send', clientId: data.clientId === null ? null : parseHostId(data.clientId), recipients, subject: parseMailSubject(data.subject),
    body: parseMailDocument(data.body, maximumMessageDocumentLength), signature: data.signature === null ? null : parseMailDocument(data.signature, maximumMessageDocumentLength), attachments
  }
}
export function parseMailViewResult(value: unknown): MailViewResult {
  const data = pairingRecord(value)
  const office = parseMailOfficeResult(data)
  if (office) return office
  if (data.status === 'released') { exactKeys(data, ['status']); return { status: 'released' } }
  if (data.status === 'sent') { exactKeys(data, ['status', 'acceptedCount', 'attachmentCount']); return { status: 'sent', acceptedCount: parseCount(data.acceptedCount, maximumMailRecipientCount), attachmentCount: parseCount(data.attachmentCount, maximumMailAttachmentCount) } }
  if (data.status !== 'files') throw new Error('Invalid mail result')
  exactKeys(data, ['status', 'files'])
  return { status: 'files', files: parseList(data.files, maximumMailAttachmentCount, item => {
    const file = pairingRecord(item)
    exactKeys(file, ['attachmentId', 'fileName', 'sizeBytes'])
    return { attachmentId: parseUuid(file.attachmentId), fileName: parseMailFileName(file.fileName), sizeBytes: parseCount(file.sizeBytes, maximumMailAttachmentBytes) }
  }) }
}
/** Nombre de un adjunto: sin separadores de ruta ni caracteres de control; nunca se interpreta como ubicación. */
export function parseMailFileName(value: unknown): string {
  const name = line(value, 180)
  if (/[\\/:*?"<>|]/.test(name) || name === '.' || name === '..') throw new Error('Invalid mail file name')
  return name
}

export function parseMailHostRequest(value: unknown): MailHostRequest {
  const data = pairingRecord(value)
  const office = parseMailOfficeRequest(data)
  if (office) return office
  if (data.action === 'recordSend') {
    exactKeys(data, ['action', 'sendId', 'outcome'])
    if (data.outcome !== 'sent' && data.outcome !== 'failed') throw new Error('Invalid mail outcome')
    return { action: 'recordSend', sendId: parseHostId(data.sendId), outcome: data.outcome }
  }
  if (data.action !== 'authorizeSend') throw new Error('Invalid mail request')
  exactKeys(data, ['action', 'clientId', 'subject', 'recipientCount', 'attachmentCount', 'documentIds'])
  const documentIds = parseList(data.documentIds, maximumMailAttachmentCount, parseHostId)
  if (new Set(documentIds).size !== documentIds.length) throw new Error('Invalid mail request')
  const recipientCount = parseCount(data.recipientCount, maximumMailRecipientCount)
  if (recipientCount < 1) throw new Error('Invalid mail count')
  const attachmentCount = parseCount(data.attachmentCount, maximumMailAttachmentCount)
  if (data.clientId === null && (documentIds.length || attachmentCount)) throw new Error('Invalid mail request')
  return { action: 'authorizeSend', clientId: data.clientId === null ? null : parseHostId(data.clientId), subject: parseMailSubject(data.subject), recipientCount, attachmentCount, documentIds }
}
export function parseMailHostResult(value: unknown): MailHostResult {
  const data = pairingRecord(value)
  const office = parseMailOfficeResult(data)
  if (office) return office
  if (data.status === 'authorized') { exactKeys(data, ['status', 'sendId']); return { status: 'authorized', sendId: parseHostId(data.sendId) } }
  if (data.status === 'recorded') { exactKeys(data, ['status']); return { status: 'recorded' } }
  throw new Error('Invalid mail result')
}
