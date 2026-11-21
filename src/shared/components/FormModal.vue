<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from '@lucide/vue'
import { useDialogMotion } from '../motion/dialogMotion'

/**
 * Modal de captura: toda acción de agregar o editar datos de la app usa éste, el mismo de "Nuevo pago"
 * (decisión del usuario, 2026-10-04). Base monocroma (ver 15-DESIGN-GUIDELINES):
 * - Tarjeta de 16 px; elevación sólo con sombra.
 * - Encabezado con título y descripción, sin etiqueta encima (impeccable).
 * - Botón × redondo en la esquina superior derecha.
 * - Cuerpo con su propio desplazamiento. El formulario del slot trae sus botones al pie.
 * - Pantalla completa por debajo de 760 px.
 *
 * Usa `<dialog>` con `showModal()`: foco confinado, fondo inerte y Escape. Mientras `isBusy`, Escape y ×
 * no cierran, para no perder una operación en curso. Abre y cierra con la transición de modal de
 * transitions.dev (useDialogMotion): 250 ms al abrir, 150 ms al cerrar; con movimiento reducido no hay animación.
 */
const props = defineProps<{ isOpen: boolean; title: string; description?: string; isBusy?: boolean; testId?: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const motion = useDialogMotion(dialog)
let previousFocus: HTMLElement | null = null

watch(() => props.isOpen, async (isOpen) => {
  await nextTick()
  if (isOpen !== props.isOpen || !dialog.value) return
  if (isOpen) {
    previousFocus = document.activeElement as HTMLElement | null
    motion.open()
  } else {
    motion.close()
    ;(previousFocus?.isConnected ? previousFocus : document.querySelector<HTMLElement>('main'))?.focus()
  }
}, { immediate: true })
function requestClose(): void { if (!props.isBusy) emit('close') }
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close() })
</script>
<template>
  <dialog
    ref="dialog"
    class="form-modal motion-dialog"
    :aria-labelledby="titleId"
    :data-testid="testId"
    @cancel.prevent="requestClose"
  >
    <header class="form-modal-header">
      <h2 :id="titleId">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="form-modal-description"
      >
        {{ description }}
      </p>
      <button
        type="button"
        class="form-modal-close"
        :aria-label="'Cerrar ' + title"
        :disabled="isBusy"
        @click="requestClose"
      >
        <X
          :size="26"
          aria-hidden="true"
        />
      </button>
    </header>
    <div class="form-modal-body">
      <slot v-if="isOpen || motion.isRendered.value" />
    </div>
  </dialog>
</template>
<style scoped>
.form-modal { width: min(720px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); padding: 0; border: 0; border-radius: var(--radiusCard); box-shadow: var(--overlayShadow); background: var(--surfaceColor); color: var(--textColor); overflow: hidden; }
.form-modal[open] { display: flex; flex-direction: column; }
/* Fondo plano en tinta, sin desenfoque (ADR-034). */
.form-modal::backdrop { background: rgb(11 11 11 / 55%); }
.form-modal-header { position: relative; flex-shrink: 0; padding: 20px 64px 16px 24px; border-bottom: 1px solid var(--borderColor); }
.form-modal-header h2 { margin: 0; font-size: 24px; line-height: 1.33; font-weight: 600; letter-spacing: -.025em; overflow-wrap: anywhere; }
.form-modal-description { margin: 6px 0 0; font-size: 14px; color: var(--mutedTextColor); }
.form-modal-close { position: absolute; top: 16px; right: 16px; display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 0; background: transparent; color: var(--mutedTextColor); cursor: pointer; }
.form-modal-close:hover:not(:disabled) { background: var(--hoverColor); color: var(--textColor); }
.form-modal-close:disabled { opacity: .5; cursor: not-allowed; }
.form-modal-close:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.form-modal-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px 24px 24px; container-type: inline-size; }
/* El formulario del slot ya es la superficie: sin marco ni sombra duplicados dentro del modal. */
.form-modal-body > :deep(form), .form-modal-body > :deep(section) { margin: 0; border: 0; border-radius: 0; box-shadow: none; padding: 0; background: transparent; }
@media (max-width: 760px) {
  .form-modal { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
  .form-modal-body { padding: 16px; }
}
</style>
