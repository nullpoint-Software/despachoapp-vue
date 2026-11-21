import { reactive } from 'vue'

/**
 * Fotos de perfil en memoria (EPHEMERAL, 2026-10-04): la vista pide las que le faltan en lotes de hasta 100 y las
 * comparte entre pantallas (tareas, pagos, Inicio, barra superior). No se guardan en el equipo; al cerrar sesión se
 * vacían. `undefined` = no consultada; `null` = el usuario no tiene foto.
 */
const photos = reactive(new Map<string, string | null>())
const pending = new Set<string>()
let queued: string[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined

async function flush(): Promise<void> {
  const userIds = queued.splice(0, 100)
  if (!userIds.length) return
  try {
    const result = await window.contapp.manageUserPhotos({ action: 'list', userIds })
    for (const photo of result.photos) photos.set(photo.userId, photo.photoDataUrl)
  } catch { /* Sin Host o sin sesión: se muestran las iniciales y se reintenta en la siguiente petición. */ }
  finally { for (const userId of userIds) pending.delete(userId) }
  if (queued.length) await flush()
}

/** Pide (agrupando en el mismo ciclo) las fotos que todavía no se conocen. */
export function requestUserPhotos(userIds: Iterable<string>): void {
  for (const userId of userIds) {
    if (photos.has(userId) || pending.has(userId)) continue
    pending.add(userId); queued.push(userId)
  }
  if (!queued.length) return
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => { void flush() }, 0)
}
export function photoFor(userId: string): string | null | undefined { return photos.get(userId) }
/** Tras guardar o quitar una foto, el resultado del Host reemplaza la copia en memoria. */
export function rememberUserPhoto(userId: string, photoDataUrl: string | null): void { photos.set(userId, photoDataUrl) }
export function clearUserPhotos(): void { photos.clear(); pending.clear(); queued = [] }
