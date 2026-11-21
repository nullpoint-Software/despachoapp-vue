import { readonly, ref, watch } from 'vue'
import type { RestorablePage } from '../../../shared/contracts/localPreferences'

/**
 * Solicitudes de navegación de la app (2026-10-10, pedido del usuario: "que al hacer clic [en el aviso] te lleve a ella").
 * Estado EPHEMERAL de la ventana; no se guarda ni sale del Renderer.
 *
 * Flujo:
 * 1. Quien emite un aviso adjunta un `NavigationTarget` (sección y, si aplica, el elemento).
 * 2. Al activar el aviso, `NotificationRegion` llama `requestNavigation(target)`: queda UNA solicitud pendiente
 *    (una nueva sustituye a la anterior).
 * 3. `App.vue` observa la solicitud y cambia de sección (respetando permisos y la ficha sin guardar).
 * 4. La página de esa sección la recoge con `useNavigationRequest(section, handler)` al montarse —o en caliente si ya
 *    estaba abierta—, la consume y resalta el elemento cuando sus datos ya están cargados.
 * 5. Si ninguna página la reclamó tras montar la sección, `App.vue` la descarta (`discardNavigationRequest`) para que
 *    no se aplique más tarde por sorpresa.
 */
export interface NavigationTarget {
  section: RestorablePage
  /** Identificador del elemento dentro de la sección (`taskId`, `movementId`, `clientId`, `reportId`…). */
  itemId?: string
  /** Vista secundaria dentro de la sección, por ejemplo el cajón `reports` de Fiscal. */
  view?: string
  /** Elemento dentro de esa vista secundaria, por ejemplo el `reportId` que se abre en el cajón de reportes. */
  nestedItemId?: string
  /** Texto visible del destino para el nombre accesible del aviso ("Ver la tarea"). Por omisión, el de la sección. */
  label?: string
}
export interface NavigationRequest extends NavigationTarget { requestId: number }

/** Nombres de sección en español para "…, ir a Tareas". */
export const navigationSectionLabels: Readonly<Record<RestorablePage, string>> = {
  home: 'Inicio', tasks: 'Tareas', clients: 'Clientes', payments: 'Pagos', fiscal: 'Fiscal', compliance: 'Cumplimiento',
  reconciliation: 'Conciliación', catalogs: 'Catálogos SAT', mail: 'Correo', notes: 'Notas', settings: 'Configuración'
}

const pendingRequest = ref<NavigationRequest | null>(null)
let nextRequestId = 0

/** Solicitud pendiente, de sólo lectura: la observa `App.vue` para cambiar de sección. */
export const navigationRequest = readonly(pendingRequest)

/** Registra una solicitud nueva (sustituye a la pendiente) y la devuelve. Copia el destino para no retener proxies. */
export function requestNavigation(target: NavigationTarget): NavigationRequest {
  const request: NavigationRequest = { ...target, requestId: ++nextRequestId }
  pendingRequest.value = request
  return request
}

/** Retira la solicitud si sigue pendiente; con `requestId`, sólo si es esa misma (no borra una más nueva). */
export function discardNavigationRequest(requestId?: number): void {
  if (!pendingRequest.value) return
  if (requestId === undefined || pendingRequest.value.requestId === requestId) pendingRequest.value = null
}

/** Consume la solicitud si es de `section`; devuelve `null` si no hay o es de otra sección. */
export function consumeNavigationRequest(section: RestorablePage): NavigationRequest | null {
  const request = pendingRequest.value
  if (!request || request.section !== section) return null
  pendingRequest.value = null
  return request
}

/** Texto del destino para lectores de pantalla y para la pista visible del aviso. */
export function describeNavigationTarget(target: NavigationTarget): string {
  return target.label?.trim() || navigationSectionLabels[target.section]
}

/** "ir a la tarea…", "ir al reporte…" (contracción de "a el"), "ir a Tareas". */
export function describeNavigationAction(target: NavigationTarget): string {
  const destination = describeNavigationTarget(target)
  return destination.startsWith('el ') ? 'ir al ' + destination.slice(3) : 'ir a ' + destination
}

/**
 * Para las páginas: llama `handler` con cada solicitud dirigida a `section`, también con la que ya estaba pendiente
 * al montarse. Debe usarse dentro de `setup`; el observador se detiene solo al desmontar el componente.
 */
export function useNavigationRequest(section: RestorablePage, handler: (request: NavigationRequest) => void): void {
  watch(pendingRequest, request => {
    if (request?.section !== section) return
    const consumed = consumeNavigationRequest(section)
    if (consumed) handler(consumed)
  }, { immediate: true })
}
