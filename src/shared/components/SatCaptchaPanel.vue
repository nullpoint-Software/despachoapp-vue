<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImageUp, LogIn, RotateCw, X } from '@lucide/vue'
import ActionButton from './ActionButton.vue'
import DitherProgressBar from './DitherProgressBar.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * Panel del portal del SAT con RFC y CIEC ([[SAT-PORTAL#Captcha]]), común a la CSF (`SatPortalAction`) y a la descarga
 * de CFDI (`SatPortalCfdiAction`). Muestra la fase de la ejecución que lleva Main:
 * - **Pasos** (2026-10-17): una barra con dithering (`DitherProgressBar`) dividida en los `stepLabels` (por ejemplo
 *   Preparando navegador → Captcha → Entrando → Generando → Guardado) y el texto «Paso N de 5 · nombre». Con error o
 *   cancelado se queda en el último paso alcanzado («Se detuvo en…»), en rojo si fue error.
 * - `captcha`: la **imagen del captcha** que tomó Main del SAT, «Escribe el texto de la imagen», «Entrar» y «Otra
 *   imagen». El texto se escribe siempre en **mayúsculas** (los captchas del SAT lo son). Fiscenix no lee ni resuelve el
 *   captcha: lo escribe la persona y Main lo envía con RFC y CIEC.
 * - `waiting`: el SAT prepara un paquete; el mensaje dice cuándo es el siguiente intento.
 * - `done`, `cancelled` y `error`: el mensaje final; con error o cancelado, «Reintentar».
 * Mientras la ejecución está activa ofrece «Cancelar» (con el captcha a la vista, junto a «Entrar»). El slot va debajo
 * (avance detallado). Nunca recibe RFC ni CIEC.
 */
export type SatCaptchaPanelPhase = 'preparing' | 'captcha' | 'signingIn' | 'working' | 'waiting' | 'done' | 'cancelled' | 'error'
/** `isCaseSensitive` (Validación de RFC, 2026-10-17): el texto se envía como se escribe, sin pasarlo a mayúsculas. */
const props = withDefaults(defineProps<{ id: string; phase: SatCaptchaPanelPhase; message: string; captchaImage: string | null; stepLabels?: readonly [string, string, string, string, string]; isCaseSensitive?: boolean }>(),
  { stepLabels: () => ['Preparando navegador', 'Captcha', 'Entrando', 'Trabajando', 'Listo'] as const, isCaseSensitive: false })
const emit = defineEmits<{ submitCaptcha: [text: string]; refreshCaptcha: []; cancel: []; retry: [] }>()

const captchaText = ref('')
const labels: Readonly<Record<SatCaptchaPanelPhase, string>> = { preparing: 'Preparando', captcha: 'Escribe el captcha', signingIn: 'Entrando al SAT', working: 'Trabajando', waiting: 'Esperando al SAT', done: 'Listo', cancelled: 'Cancelado', error: 'Con error' }
const tones: Readonly<Record<SatCaptchaPanelPhase, 'neutral' | 'info' | 'success' | 'warning' | 'error'>> = { preparing: 'info', captcha: 'warning', signingIn: 'info', working: 'info', waiting: 'warning', done: 'success', cancelled: 'neutral', error: 'error' }
/** Índice del paso actual en la barra; con error o cancelado no hay paso actual (-1). */
const stepIndexes: Readonly<Record<SatCaptchaPanelPhase, number>> = { preparing: 0, captcha: 1, signingIn: 2, working: 3, waiting: 3, done: 4, cancelled: -1, error: -1 }
/** Último paso alcanzado: con error o cancelado la barra se queda donde se detuvo. */
const lastStep = ref(0)
watch(() => props.phase, phase => { if (stepIndexes[phase] >= 0) lastStep.value = stepIndexes[phase] }, { immediate: true })
const isActive = computed(() => !['done', 'cancelled', 'error'].includes(props.phase))
const isCaptchaVisible = computed(() => props.phase === 'captcha' && Boolean(props.captchaImage))
const stepCaption = computed(() => {
  const stepName = props.stepLabels[lastStep.value] ?? ''
  if (props.phase === 'done') return 'Paso ' + props.stepLabels.length + ' de ' + props.stepLabels.length + ' · ' + props.stepLabels[props.stepLabels.length - 1]
  if (!isActive.value) return 'Se detuvo en el paso ' + (lastStep.value + 1) + ' de ' + props.stepLabels.length + ' · ' + stepName
  return 'Paso ' + (lastStep.value + 1) + ' de ' + props.stepLabels.length + ' · ' + stepName
})

// Cada imagen nueva empieza con el campo vacío (por ejemplo, tras un captcha incorrecto).
watch(() => props.captchaImage, () => { captchaText.value = '' })
// Mayúsculas al escribir (además del estilo), para que lo que se ve sea lo que se envía.
function onCaptchaInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const position = input.selectionStart
  captchaText.value = props.isCaseSensitive ? input.value : input.value.toLocaleUpperCase('es-MX')
  input.value = captchaText.value
  if (position !== null) input.setSelectionRange(position, position)
}
function submit(): void {
  const text = props.isCaseSensitive ? captchaText.value.trim() : captchaText.value.trim().toLocaleUpperCase('es-MX')
  if (text) emit('submitCaptcha', text)
}
</script>

<template>
  <div
    class="sat-captcha-panel"
    role="status"
    :data-testid="id"
    :data-phase="phase"
  >
    <DitherProgressBar
      :value="phase === 'done' ? stepLabels.length : lastStep"
      :max="stepLabels.length"
      :label="stepCaption"
      :is-active="isActive"
      :tone="phase === 'error' ? 'error' : 'default'"
    />
    <div class="sat-captcha-status">
      <StatusBadge :tone="tones[phase]">
        {{ labels[phase] }}
      </StatusBadge>
      <span
        class="field-help"
        :data-testid="id + '-message'"
      >{{ message }}</span>
    </div>
    <form
      v-if="isCaptchaVisible"
      class="sat-captcha-form"
      @submit.prevent="submit"
    >
      <img
        :src="captchaImage ?? undefined"
        alt="Imagen del captcha del SAT"
        class="sat-captcha-image"
        :data-testid="id + '-image'"
      >
      <div class="sat-captcha-entry">
        <div class="field">
          <label :for="id + '-text'">{{ isCaseSensitive ? 'Escribe el texto de la imagen (respeta mayúsculas y minúsculas)' : 'Escribe el texto de la imagen' }}</label>
          <input
            :id="id + '-text'"
            :value="captchaText"
            class="sat-captcha-input"
            :class="{ 'is-case-sensitive': isCaseSensitive }"
            type="text"
            autocomplete="off"
            :autocapitalize="isCaseSensitive ? 'off' : 'characters'"
            spellcheck="false"
            maxlength="16"
            @input="onCaptchaInput"
          >
        </div>
        <div class="actions">
          <ActionButton
            variant="primary"
            type="submit"
            :disabled="!captchaText.trim()"
          >
            <LogIn
              :size="16"
              aria-hidden="true"
            /> Entrar
          </ActionButton>
          <ActionButton @click="emit('refreshCaptcha')">
            <ImageUp
              :size="16"
              aria-hidden="true"
            /> Otra imagen
          </ActionButton>
          <ActionButton @click="emit('cancel')">
            <X
              :size="16"
              aria-hidden="true"
            /> Cancelar
          </ActionButton>
        </div>
      </div>
    </form>
    <slot />
    <!-- Con el captcha en pantalla, «Cancelar» va junto a «Entrar»; esta fila sólo existe si tiene botones. -->
    <div
      v-if="(isActive && !isCaptchaVisible) || phase === 'error' || phase === 'cancelled'"
      class="actions"
    >
      <ActionButton
        v-if="isActive"
        @click="emit('cancel')"
      >
        <X
          :size="16"
          aria-hidden="true"
        /> Cancelar
      </ActionButton>
      <ActionButton
        v-if="phase === 'error' || phase === 'cancelled'"
        @click="emit('retry')"
      >
        <RotateCw
          :size="16"
          aria-hidden="true"
        /> Reintentar
      </ActionButton>
    </div>
  </div>
</template>

<style scoped>
.sat-captcha-panel { display: grid; gap: 12px; min-width: 0; padding: var(--spaceMedium); border: 2px solid var(--borderColor); background: var(--surfaceColor); border-radius: var(--radiusNested); }
.sat-captcha-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.sat-captcha-status .field-help { flex: 1 1 220px; min-width: 0; }
/*
 * Imagen a la izquierda y, a su lado, el campo con los botones alineados a la izquierda (2026-10-19, pedido del usuario:
 * "dejas muchos lugares vacíos y botones desalineados"). En angosto, el campo baja debajo de la imagen. Las filas de
 * botones anulan `dialog .actions` (margen de 24 px y alineación a la derecha, pensado para el pie de un diálogo).
 */
.sat-captcha-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; }
.sat-captcha-entry { display: grid; gap: 10px; flex: 1 1 260px; min-width: 0; }
.sat-captcha-panel :deep(.actions) { margin: 0; justify-content: flex-start; }
/* La imagen del SAT se muestra a su tamaño, con borde y fondo blanco propio de la imagen, legible en Light y Dark. */
.sat-captcha-image { flex: none; max-width: 100%; height: auto; border: 2px solid var(--borderColor); background: #fff; }
.sat-captcha-input { text-transform: uppercase; font-family: var(--monoFontFamily); letter-spacing: .12em; }
.sat-captcha-input.is-case-sensitive { text-transform: none; }
</style>
