<script setup lang="ts">
import { ref, watch, nextTick, useId, onBeforeUnmount } from 'vue'
import { useDialogMotion } from '../motion/dialogMotion'
import ActionButton from './ActionButton.vue'
import HoldButton from '../vueBits/HoldButton.vue'
// `confirmLabel` nombra la acción (por ejemplo "Imprimir ticket"); sin él se muestra "Confirmar".
// `holdLabel` (pulido 2026-10-03): para eliminar o anular, se confirma manteniendo presionado (Hold Button).
const props = defineProps<{ isOpen: boolean; title: string; isLoading?: boolean; isConfirmDisabled?: boolean; confirmLabel?: string; holdLabel?: string }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
// Misma transición que FormModal (transitions.dev): 250 ms al abrir, 150 ms al cerrar.
const motion = useDialogMotion(dialog)
let previousFocus: HTMLElement | null = null
watch(() => props.isOpen, async (isOpen) => {
  await nextTick()
  if (isOpen !== props.isOpen) return
  if (isOpen) {
    previousFocus = document.activeElement as HTMLElement | null
    motion.open()
  } else {
    motion.close()
    ;(previousFocus?.isConnected ? previousFocus : document.querySelector<HTMLElement>('main'))?.focus()
  }
})
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close() })
</script>
<template>
  <dialog
    ref="dialog"
    class="motion-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="!isLoading && emit('close')"
  >
    <h2 :id="titleId">
      {{ title }}
    </h2><slot />
    <div class="actions">
      <ActionButton
        :disabled="isLoading"
        autofocus
        @click="emit('close')"
      >
        Cancelar
      </ActionButton><HoldButton
        v-if="holdLabel"
        :is-disabled="isConfirmDisabled || isLoading"
        done-label="Confirmado"
        @hold="emit('confirm')"
      >
        {{ holdLabel }}
      </HoldButton><ActionButton
        v-else
        variant="primary"
        :disabled="isConfirmDisabled"
        :is-loading="isLoading"
        @click="emit('confirm')"
      >
        {{ confirmLabel ?? 'Confirmar' }}
      </ActionButton>
    </div>
  </dialog>
</template>
