<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Printer } from '@lucide/vue'
import type { TicketLine, TicketPreview } from '../../../shared/contracts/printing'
import ConfirmDialog from './ConfirmDialog.vue'
import InlineNotice from './InlineNotice.vue'
import { useNotifications } from '../notifications/notificationStore'
import { readIpcErrorMessage } from '../ipcErrorMessage'

/**
 * Vista previa de un ticket, como el original: se ve exactamente lo que Main imprimirá (mismas líneas,
 * columnas, separadores y código de barras) y sólo "Imprimir ticket" lo envía. Mientras se envía no se
 * puede cerrar ni repetir; un error se muestra aquí y el ticket queda disponible para reintentar cuando
 * el usuario revise la impresora (no hay reintento automático para no duplicar tickets).
 */
const props = defineProps<{ preview: TicketPreview | null }>()
const emit = defineEmits<{ close: [] }>()
const { notify } = useNotifications()
const isSending = ref(false)
const error = ref('')
watch(() => props.preview?.ticketId, () => { error.value = '' })

/** Barras del código como rectángulos SVG, agrupando módulos consecutivos. */
function barsOf(line: Extract<TicketLine, { kind: 'barcode' }>): Array<{ x: number; width: number }> {
  const bars: Array<{ x: number; width: number }> = []
  for (let index = 0; index < line.pattern.length;) {
    if (line.pattern[index] === '0') { index++; continue }
    let end = index
    while (line.pattern[end] === '1') end++
    bars.push({ x: index, width: end - index }); index = end
  }
  return bars
}
const paperStyle = computed(() => props.preview ? { '--ticketColumns': String(props.preview.columnCount) } : {})

async function print(): Promise<void> {
  if (!props.preview || isSending.value) return
  isSending.value = true; error.value = ''
  try {
    await window.contapp.printTicket(props.preview.ticketId)
    notify('Ticket enviado', 'Se envió a ' + (props.preview.printerName ?? 'la impresora') + '. Si no sale, revisa la cola de impresión de Windows.', 'success')
    emit('close')
  } catch (caught) {
    error.value = readIpcErrorMessage(caught, 'No se pudo enviar el ticket. Revisa la impresora y la cola de impresión de Windows antes de reintentar.')
  } finally { isSending.value = false }
}
</script>
<template>
  <ConfirmDialog
    :is-open="preview !== null"
    :title="preview?.title ?? 'Ticket'"
    :is-loading="isSending"
    :is-confirm-disabled="!preview?.printerName"
    :confirm-label="isSending ? 'Enviando…' : 'Imprimir ticket'"
    @close="emit('close')"
    @confirm="print"
  >
    <template v-if="preview">
      <p class="ticket-target">
        <Printer
          :size="16"
          aria-hidden="true"
        />
        <span v-if="preview.printerName">{{ preview.printerName }} · papel de {{ preview.widthMillimeters }} mm</span>
        <span v-else>Sin impresora elegida en este equipo · papel de {{ preview.widthMillimeters }} mm</span>
      </p>
      <InlineNotice
        v-if="!preview.printerName"
        title="Elige una impresora"
        tone="warning"
      >
        <p>Selecciona tu impresora en Configuración &gt; Preferencias para poder imprimir este ticket.</p>
      </InlineNotice>
      <InlineNotice
        v-if="error"
        title="No se envió el ticket"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <div
        class="ticket-viewport"
        tabindex="0"
        aria-label="Vista previa del ticket"
      >
        <div
          class="ticket-paper"
          :style="paperStyle"
          data-testid="ticket-preview"
        >
          <img
            v-if="preview.logoDataUrl"
            class="ticket-logo"
            :src="preview.logoDataUrl"
            alt=""
          >
          <template
            v-for="(line, index) in preview.lines"
            :key="index"
          >
            <hr
              v-if="line.kind === 'rule'"
              :class="'ticket-rule ' + line.weight"
            >
            <figure
              v-else-if="line.kind === 'barcode'"
              class="ticket-barcode"
            >
              <svg
                :viewBox="'0 0 ' + line.pattern.length + ' 40'"
                preserveAspectRatio="none"
                aria-hidden="true"
              ><rect
                v-for="bar in barsOf(line)"
                :key="bar.x"
                :x="bar.x"
                y="0"
                :width="bar.width"
                height="40"
              /></svg>
              <figcaption>{{ line.value }}</figcaption>
            </figure>
            <!-- v-text: con white-space: pre, los espacios de la plantilla desalinearían las columnas. -->
            <div
              v-else
              class="ticket-line"
              :class="{ 'is-emphasized': line.isEmphasized }"
              v-text="line.text || '\u00a0'"
            />
          </template>
        </div>
      </div>
    </template>
  </ConfirmDialog>
</template>
<style scoped>
.ticket-target { display: flex; align-items: center; gap: 8px; margin: 0 0 var(--spaceMedium); font-size: 13px; color: var(--mutedTextColor); }
/* El papel es siempre blanco con tinta negra, también en tema oscuro: así sale de la impresora. */
.ticket-viewport { max-height: min(60dvh, 560px); overflow: auto; padding: var(--spaceMedium); background: var(--subtleColor); border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.ticket-paper { width: calc(var(--ticketColumns) * 1ch + 24px); margin: 0 auto; padding: 16px 12px 24px; background: #fff; color: #000; box-shadow: var(--cardShadow); font-family: Consolas, 'Courier New', ui-monospace, monospace; font-size: 12px; line-height: 1.4; }
.ticket-line { white-space: pre; overflow: hidden; }
.ticket-line.is-emphasized { font-weight: 700; }
.ticket-rule { border: 0; margin: 3px 0; }
.ticket-rule.light { border-top: 1px solid #000; }
.ticket-rule.heavy { border-top: 3px solid #000; }
.ticket-logo { display: block; max-width: 60%; max-height: 64px; margin: 0 auto 8px; filter: grayscale(1) contrast(10); }
.ticket-barcode { margin: 6px 12px 0; text-align: center; }
.ticket-barcode svg { display: block; width: 100%; height: 44px; fill: #000; }
.ticket-barcode figcaption { margin-top: 3px; }
</style>
