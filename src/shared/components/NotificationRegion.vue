<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert } from '@lucide/vue'
import { useNotifications, type Notification } from '../notifications/notificationStore'
import { describeNavigationAction, requestNavigation } from '../navigation/navigationRequests'
import SwipeToast from '../vueBits/SwipeToast.vue'

/**
 * Pila de avisos de la app, abajo a la derecha (2026-10-04): cada aviso es un SwipeToast de Vue Bits en línea.
 * - Se descartan arrastrándolos hacia abajo, con × o con Escape; los temporales se cierran solos a los 6.5 s (la mecha
 *   se pausa con el puntero o el foco encima).
 * - Los errores no tienen mecha (`duration = 0`), usan `role="alert"` y permanecen hasta cerrarlos.
 * - F8 lleva el foco al aviso más reciente.
 * - Avisos con destino (`notification.target`, 2026-10-10): la tarjeta entera se puede activar (clic o Enter); se cierran y
 *   piden la navegación con `requestNavigation`, que aplica `App.vue`. Arrastrar nunca navega. Su botón es sólo una flecha
 *   (→) en el lugar de la × (pedido del usuario): se descartan igual arrastrando, con Escape o al terminar la mecha.
 * - Avisos con acción (`notification.action`, 2026-10-17, p. ej. «Descargar»): la flecha blanca (→) ejecuta la acción en
 *   lugar de navegar (pedido del usuario: "el botón descargar debe ser la flecha blanca"); la tarjeta sigue llevando al
 *   elemento si hay destino. Su nombre accesible es la acción.
 * La deduplicación y el límite de avisos visibles siguen en `notificationStore`.
 */
const { notifications, dismiss } = useNotifications()
const region = ref<HTMLElement | null>(null)
const icons = { success: CircleCheck, info: Info, warning: TriangleAlert, error: CircleAlert }
const transientMilliseconds = 6500
function focusNotifications(event: KeyboardEvent): void {
  if (event.key !== 'F8' || !notifications.value.length) return
  event.preventDefault()
  const cards = region.value?.querySelectorAll<HTMLElement>('.swipe-toast-card')
  cards?.[cards.length - 1]?.focus()
}
/** Nombre accesible del botón "Ver →": el aviso y su destino ("Tarea creada, ir a la tarea T-000001"). */
function actionNameOf(notification: Notification): string | undefined {
  if (notification.action) return notification.action.label + ': ' + notification.title
  return notification.target ? notification.title + ', ' + describeNavigationAction(notification.target) : undefined
}
function openTarget(notification: Notification): void { if (notification.target) requestNavigation(notification.target) }
/** Flecha: la acción del aviso si la tiene; si no, su destino. */
function onArrow(notification: Notification): void { if (notification.action) void notification.action.run(); else openTarget(notification) }
onMounted(() => window.addEventListener('keydown', focusNotifications))
onBeforeUnmount(() => window.removeEventListener('keydown', focusNotifications))
</script>
<template>
  <aside
    ref="region"
    class="notification-region"
    aria-label="Notificaciones"
  >
    <SwipeToast
      v-for="notification in notifications"
      :key="notification.notificationId"
      :title="notification.title"
      :description="notification.message"
      :duration="notification.tone === 'error' ? 0 : transientMilliseconds"
      :role="notification.tone === 'error' ? 'alert' : 'status'"
      :close-label="'Cerrar notificación: ' + notification.title"
      :toast-class="'toast-notification tone-' + notification.tone"
      :close-button="!notification.target && !notification.action"
      :action-accessible-name="actionNameOf(notification)"
      :is-activatable="Boolean(notification.target)"
      @action="onArrow(notification)"
      @activate="openTarget(notification)"
      @close="dismiss(notification.notificationId)"
    >
      <template
        v-if="notification.target || notification.action"
        #action
      >
        <ArrowRight
          :size="18"
          aria-hidden="true"
        />
      </template>
      <template #icon>
        <component
          :is="icons[notification.tone]"
          :size="18"
        />
      </template>
      <template
        v-if="notification.tone === 'error'"
        #caption
      >
        <span class="toast-caption">Permanece hasta que lo cierres</span>
      </template>
    </SwipeToast>
  </aside>
</template>
