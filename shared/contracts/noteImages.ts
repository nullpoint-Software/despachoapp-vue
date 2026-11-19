import { pairingRecord } from './pairing'

/**
 * Imágenes por URL en las notas (pulido 2026-10-03, decisión del usuario: descargar e incrustar).
 * Main descarga la imagen una sola vez (sólo HTTPS, PNG/JPEG/WebP/GIF, hasta 2 MB) y la devuelve como `data:` para
 * guardarla dentro de la nota LOCAL: se ve sin internet y nadie sabe cuándo se abre la nota. Si falla, la vista
 * inserta el marcador "Imagen no disponible" con su descripción y la dirección para reintentar.
 */
export const noteImageChannel = 'notes:fetchImage'
export const maximumNoteImageBytes = 2 * 1024 * 1024
export const noteImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type NoteImageFailure = 'unreachable' | 'tooLarge' | 'unsupported'
export type NoteImageResult = { status: 'downloaded'; dataUrl: string } | { status: 'failed'; reason: NoteImageFailure }

/** HTTPS sin usuario ni contraseña en la dirección; nunca file:, http: ni direcciones de datos. */
export function parseNoteImageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid image URL')
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('Invalid image URL') }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw new Error('Invalid image URL')
  return url.toString()
}
const dataUrlPattern = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/
export function parseNoteImageResult(value: unknown): NoteImageResult {
  const data = pairingRecord(value)
  if (data.status === 'downloaded' && typeof data.dataUrl === 'string' && data.dataUrl.length <= maximumNoteImageBytes * 1.4 + 64 && dataUrlPattern.test(data.dataUrl)) return { status: 'downloaded', dataUrl: data.dataUrl }
  if (data.status === 'failed' && (data.reason === 'unreachable' || data.reason === 'tooLarge' || data.reason === 'unsupported')) return { status: 'failed', reason: data.reason }
  throw new Error('Invalid image result')
}
