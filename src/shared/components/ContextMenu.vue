<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'

/** Acción de un menú contextual; `group` separa bloques (por ejemplo "Mover a"). */
export interface ContextMenuItem { itemId: string; label: string; icon?: Component; tone?: 'neutral' | 'danger'; isDisabled?: boolean; group?: string; onSelect: () => void }

/**
 * Menú contextual (2026-10-04, pedido del usuario para las tarjetas de Tareas): al hacer clic derecho el resto de la
 * pantalla se pone borroso y aparece, junto al puntero, qué se puede hacer con el elemento.
 * - Se abre en (`x`, `y`) y se recorre para no salirse de la ventana.
 * - Teclado: ↑ ↓ Inicio Fin recorren, Enter o Espacio eligen, Escape o Tab cierran; el foco vuelve a quien lo abrió.
 * - Clic fuera del menú (en el fondo borroso) lo cierra.
 * Elegir una acción cierra el menú antes de ejecutarla.
 */
const props = defineProps<{ isOpen: boolean; x: number; y: number; title: string; items: ContextMenuItem[] }>()
const emit = defineEmits<{ close: [] }>()
const menu = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })
let previousFocus: HTMLElement | null = null
const enabledItems = computed(() => props.items.filter(item => !item.isDisabled))
const groups = computed(() => {
  const result: Array<{ group: string; items: ContextMenuItem[] }> = []
  for (const item of props.items) {
    const group = item.group ?? ''
    const last = result[result.length - 1]
    if (last && last.group === group) last.items.push(item); else result.push({ group, items: [item] })
  }
  return result
})

watch(() => props.isOpen, async isOpen => {
  if (!isOpen) { previousFocus?.focus(); previousFocus = null; return }
  previousFocus = document.activeElement as HTMLElement | null
  position.value = { left: props.x, top: props.y }
  await nextTick()
  const element = menu.value
  if (!element) return
  // Se ajusta a la ventana con un margen de 8 px.
  const bounds = element.getBoundingClientRect()
  position.value = { left: Math.max(8, Math.min(props.x, window.innerWidth - bounds.width - 8)), top: Math.max(8, Math.min(props.y, window.innerHeight - bounds.height - 8)) }
  element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
})
function choose(item: ContextMenuItem): void { if (item.isDisabled) return; emit('close'); item.onSelect() }
function handleKey(event: KeyboardEvent): void {
  const buttons = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const targets: Record<string, number> = { ArrowDown: (index + 1) % buttons.length, ArrowUp: (index - 1 + buttons.length) % buttons.length, Home: 0, End: buttons.length - 1 }
  if (event.key in targets && buttons.length) { event.preventDefault(); buttons[targets[event.key]!]?.focus() }
  else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); emit('close') }
}
</script>
<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="isOpen"
        class="context-menu-backdrop"
        data-testid="context-menu"
        @pointerdown.self="emit('close')"
        @contextmenu.prevent.self="emit('close')"
      >
        <div
          ref="menu"
          class="context-menu"
          role="menu"
          :aria-label="title"
          :style="{ left: position.left + 'px', top: position.top + 'px' }"
          @keydown="handleKey"
        >
          <p class="context-menu-title">
            {{ title }}
          </p>
          <div
            v-for="block in groups"
            :key="block.group || '(acciones)'"
            class="context-menu-group"
            role="group"
            :aria-label="block.group || undefined"
          >
            <p
              v-if="block.group"
              class="context-menu-heading"
              aria-hidden="true"
            >
              {{ block.group }}
            </p>
            <button
              v-for="item in block.items"
              :key="item.itemId"
              type="button"
              role="menuitem"
              class="context-menu-item"
              :class="{ 'is-danger': item.tone === 'danger' }"
              :disabled="item.isDisabled"
              @click="choose(item)"
            >
              <component
                :is="item.icon"
                v-if="item.icon"
                :size="16"
                aria-hidden="true"
              />{{ item.label }}
            </button>
          </div>
          <p
            v-if="!enabledItems.length"
            class="context-menu-empty"
          >
            No hay acciones disponibles.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<style>
/* Sin "scoped": vive en <body> (Teleport). Fondo atenuado y borroso; el menú conserva el marco brutalista. */
.context-menu-backdrop { position: fixed; inset: 0; z-index: 60; background: color-mix(in srgb, var(--canvasColor) 35%, transparent); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }
.context-menu { position: fixed; min-width: 220px; max-width: min(320px, calc(100vw - 16px)); padding: 6px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: var(--overlayShadow); }
.context-menu-title { margin: 0; padding: 6px 8px 8px; border-bottom: 2px solid var(--borderColor); font-size: 13px; font-weight: 800; overflow-wrap: anywhere; }
.context-menu-group { display: grid; padding: 4px 0; }
.context-menu-group + .context-menu-group { border-top: 1px solid var(--hairlineColor); }
.context-menu-heading { margin: 0; padding: 4px 8px 2px; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.context-menu-item { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 0 10px; border: 2px solid transparent; background: transparent; color: inherit; font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.context-menu-item:hover:not(:disabled), .context-menu-item:focus-visible { border-color: var(--borderColor); background: var(--hoverColor); outline: none; }
.context-menu-item.is-danger { color: var(--errorColor); }
.context-menu-item:disabled { opacity: .45; cursor: not-allowed; }
.context-menu-empty { margin: 0; padding: 8px; font-size: 13px; color: var(--mutedTextColor); }
.context-menu-enter-active, .context-menu-leave-active { transition: opacity var(--durationQuick, 150ms) var(--easeSmoothOut, ease-out); }
.context-menu-enter-active .context-menu, .context-menu-leave-active .context-menu { transition: transform var(--durationQuick, 150ms) var(--easeSmoothOut, ease-out); }
.context-menu-enter-from, .context-menu-leave-to { opacity: 0; }
.context-menu-enter-from .context-menu, .context-menu-leave-to .context-menu { transform: scale(.96); }
</style>
