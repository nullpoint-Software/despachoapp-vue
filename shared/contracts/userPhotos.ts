import { pairingRecord } from './pairing'
import { parseHostId } from './discovery'

/**
 * Fotos de perfil de los usuarios (2026-10-04, pedido del usuario: "cuando se trate de algo de un trabajador, mostrar
 * foto de este"; la ContaApp anterior guardaba `usuarios.imagen`). Datos GLOBAL en el Host (tabla `userPhotos`).
 * - `list`: cualquier sesión válida consulta las fotos de hasta 100 usuarios (se muestran en tareas, pagos e Inicio).
 * - `save` / `remove`: la propia foto, o la de otro usuario con `users.manage`; el Host lo verifica y lo audita.
 * La vista recorta la imagen a 256×256 antes de enviarla; aquí sólo se aceptan JPEG, PNG o WebP en base64 y acotados.
 */
export const userPhotosChannel = 'userPhotos:operate'
export const maximumPhotoDataUrlLength = 300000
export type UserPhotoRequest = { action: 'list'; userIds: string[] } | { action: 'save'; userId: string; photoDataUrl: string } | { action: 'remove'; userId: string }
export interface UserPhoto { userId: string; photoDataUrl: string | null }
export type UserPhotoResult = { status: 'photos'; photos: UserPhoto[] }

const photoPattern = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid photo request') }
export function parsePhotoDataUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > maximumPhotoDataUrlLength || !photoPattern.test(value)) throw new Error('Invalid user photo')
  return value
}
export function parseUserPhotoRequest(value: unknown): UserPhotoRequest {
  const data = pairingRecord(value)
  if (data.action === 'list') {
    exactKeys(data, ['action', 'userIds'])
    if (!Array.isArray(data.userIds) || !data.userIds.length || data.userIds.length > 100) throw new Error('Invalid photo request')
    const userIds = data.userIds.map(parseHostId)
    if (new Set(userIds).size !== userIds.length) throw new Error('Invalid photo request')
    return { action: 'list', userIds }
  }
  if (data.action === 'save') { exactKeys(data, ['action', 'userId', 'photoDataUrl']); return { action: 'save', userId: parseHostId(data.userId), photoDataUrl: parsePhotoDataUrl(data.photoDataUrl) } }
  if (data.action === 'remove') { exactKeys(data, ['action', 'userId']); return { action: 'remove', userId: parseHostId(data.userId) } }
  throw new Error('Invalid photo request')
}
export function parseUserPhotoResult(value: unknown): UserPhotoResult {
  const data = pairingRecord(value)
  if (data.status !== 'photos' || !Array.isArray(data.photos) || data.photos.length > 100) throw new Error('Invalid photo result')
  return { status: 'photos', photos: data.photos.map(item => { const photo = pairingRecord(item); exactKeys(photo, ['userId', 'photoDataUrl']); return { userId: parseHostId(photo.userId), photoDataUrl: photo.photoDataUrl === null ? null : parsePhotoDataUrl(photo.photoDataUrl) } }) }
}
