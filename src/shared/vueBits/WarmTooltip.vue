<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useId, watch } from 'vue'
import { tooltipGroupKey, type TooltipSide } from './WarmTooltipGroup'

/**
 * Disparador de "Warm Tooltip" (Vue Bits, adaptado). Envuelve un botón y comparte la etiqueta del
 * `WarmTooltipGroup` que App monta una vez. Sin grupo (pruebas aisladas) no muestra nada y el botón
 * conserva su nombre accesible. Abre con el puntero tras la espera del grupo, al instante con foco de
 * teclado y con pulsación larga en pantallas táctiles; Escape cierra.
 * Expone `aria-describedby` por el slot para enlazar el botón con la etiqueta visible.
 */
const props = withDefaults(defineProps<{ content: string; side?: TooltipSide; isDisabled?: boolean }>(), { side: 'top', isDisabled: false })
const group = inject(tooltipGroupKey, null)
const tooltipId = useId()
const trigger = ref<HTMLElement | null>(null)
let openTimer: ReturnType<typeof setTimeout> | undefined, pressTimer: ReturnType<typeof setTimeout> | undefined
const isActive = computed(() => group?.activeId() === tooltipId)

function payload() { return { tooltipId, trigger: trigger.value!, content: props.content, side: props.side } }
function hide(isInstant = false): void { clearTimeout(openTimer); group?.hide(tooltipId, isInstant) }
function arm(): void {
  if (!group || !trigger.value) return
  if (group.isWarm()) { group.show(payload(), 'warm'); return }
  openTimer = setTimeout(() => group.show(payload(), 'cold'), group.delay)
}
function onPointerEnter(event: PointerEvent): void { if (!props.isDisabled && event.pointerType !== 'touch' && event.buttons === 0) arm() }
function onPointerLeave(event: PointerEvent): void { if (event.pointerType !== 'touch') hide() }
function onPointerDown(event: PointerEvent): void {
  if (props.isDisabled || !group) return
  if (event.pointerType === 'mouse') { hide(); return }
  pressTimer = setTimeout(() => group.show(payload(), 'cold'), 500)
}
function onPointerEnd(): void { clearTimeout(pressTimer) }
function onFocusIn(event: FocusEvent): void { if (!props.isDisabled && group && (event.target as HTMLElement).matches?.(':focus-visible')) group.show(payload(), 'instant') }
function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape') hide(true) }
watch(() => props.isDisabled, isDisabled => { if (isDisabled) hide(true) })
onBeforeUnmount(() => { clearTimeout(openTimer); clearTimeout(pressTimer); hide(true) })
</script>
<template>
  <span
    ref="trigger"
    class="warm-tooltip-trigger"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
    @focusin="onFocusIn"
    @focusout="hide(true)"
    @keydown="onKeyDown"
  >
    <slot :describedby="isActive ? group?.groupId : undefined" />
  </span>
</template>
<style scoped>
.warm-tooltip-trigger { display: inline-flex; position: relative; vertical-align: middle; }
</style>
