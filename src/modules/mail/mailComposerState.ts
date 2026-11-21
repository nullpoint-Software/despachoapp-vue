import { ref } from 'vue'
import type { MailAttachmentReference } from '../../../shared/contracts/mail'

/** Adjunto que el punto de entrada ya eligió (un documento del expediente, un CFDI) con su nombre visible. */
export interface PresetMailAttachment { reference: Exclude<MailAttachmentReference, { kind: 'file' }>; label: string }
/**
 * Petición para abrir el redactor ([[MAIL]]). La hacen Clientes, el expediente y Fiscal; un solo redactor vive en App.vue.
 * `clientId` NULL: correo genérico a cualquier dirección (sección Correo, 2026-10-18), sin documento ni adjuntos.
 * - `documentLabel`: "(documento)" del asunto, p. ej. "Factura" o "Opinión de cumplimiento".
 * - `recipientName`: "para (cliente del cliente)", p. ej. el receptor de una factura emitida.
 */
export interface MailComposerRequest { clientId: string | null; clientName: string; documentLabel?: string; recipientName?: string; attachments?: PresetMailAttachment[] }

export const mailComposerRequest = ref<MailComposerRequest | null>(null)
export function openMailComposer(request: MailComposerRequest): void { mailComposerRequest.value = request }
export function closeMailComposer(): void { mailComposerRequest.value = null }
