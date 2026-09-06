<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AgnesConnectionNotice from '../Print/AgnesConnectionNotice.vue'
import {
  getPrinterPreferences,
  listLocalPrinters,
  syncPrinterPreferences,
  effectivePrinterPreferences
} from '@/utils/printerSettings'
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLElement | null>(null)
const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
const wasModalOpen = document.body.classList.contains('modal-open')
onMounted(() => {
  document.body.classList.add('modal-open')
  dialog.value?.focus()
})
onBeforeUnmount(() => {
  if (!wasModalOpen) document.body.classList.remove('modal-open')
  if (previousFocus?.isConnected) previousFocus.focus()
})
function close() {
  if (!busy.value) emit('close')
}
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [
    ...dialog.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]'
    )
  ].filter((element) => element.getClientRects().length > 0)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    dialog.value.focus()
  } else if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialog.value)
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === dialog.value)
  ) {
    event.preventDefault()
    first.focus()
  }
}
const form = ref(getPrinterPreferences())
const agnesConnectionRevision = ref(0)
const savedPrinter = ref(form.value.printer)
const applicationOrigin = window.location.origin
const printers = ref<string[]>([])
const busy = ref(false)
const message = ref('')
const error = ref(false)
const connectedToken = ref('')
async function connect() {
  busy.value = true
  message.value = ''
  connectedToken.value = ''
  printers.value = []
  try {
    printers.value = await listLocalPrinters(form.value.token)
    form.value = await effectivePrinterPreferences(form.value, true)
    savedPrinter.value = form.value.printer
    connectedToken.value = form.value.token.trim()
    if (!printers.value.includes(form.value.printer)) form.value.printer = ''
    error.value = false
    message.value = printers.value.length
      ? 'Agente conectado. Selecciona y guarda tu impresora.'
      : 'No hay impresoras físicas disponibles. Instala su controlador en Windows.'
  } catch (e) {
    error.value = true
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    agnesConnectionRevision.value++
  }
}
async function save() {
  busy.value = true
  try {
    const available = await listLocalPrinters(form.value.token)
    if (!available.includes(form.value.printer))
      throw new Error('La impresora ya no está disponible. Actualiza la lista.')
    await syncPrinterPreferences(form.value)
    savedPrinter.value = form.value.printer
    message.value = 'Impresora guardada. Los tickets se enviarán directamente desde este navegador.'
    error.value = false
  } catch (e) {
    error.value = true
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
    agnesConnectionRevision.value++
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="printer-overlay" @click.self="close">
      <section
        ref="dialog"
        class="printer-preferences"
        role="dialog"
        aria-modal="true"
        aria-labelledby="printer-preferences-title"
        :aria-busy="busy"
        tabindex="-1"
        @keydown="handleKeydown"
      >
        <header class="printer-header">
          <div>
            <small>EQUIPO / AGNES</small>
            <h2 id="printer-preferences-title">Impresora de este equipo</h2>
          </div>
          <button
            type="button"
            class="printer-close"
            aria-label="Cerrar configuración de impresora"
            :disabled="busy"
            @click="close"
          >
            ×
          </button>
        </header>
        <div class="printer-body">
          <AgnesConnectionNotice :refresh-key="agnesConnectionRevision" />
          <p>
            Esta computadora comparte una sola impresora de Agnes. Cambiar de cuenta en la
            aplicación no cambia la configuración.
          </p>
          <p v-if="savedPrinter">
            Guardada: <strong>{{ savedPrinter }}</strong>
          </p>
          <details>
            <summary>Abrir y vincular el agente de Windows</summary>
            <ol>
              <li>
                <a href="/printing/AgnesPrinterPlugin-1.2.zip" download
                  >Descarga Agnes Printer Plugin 1.2</a
                >, extrae el ZIP y abre AgnesPrinterPlugin.exe.
              </li>
              <li>
                En Agnes, escribe la dirección y pulsa Agregar para autorizar
                <code>{{ applicationOrigin }}</code> y copia la clave de vinculación.
              </li>
              <li>
                Pega la clave aquí, conecta y elige la impresora. Permite el acceso a la red local
                si el navegador lo solicita.
              </li>
            </ol>
            <p>
              La vinculación se conserva al reiniciar. Agnes preguntará una vez si deseas iniciarlo
              con Windows. Puedes cambiarlo, junto con las preferencias del equipo, haciendo clic
              derecho en su icono junto al reloj.
            </p>
          </details>
          <form @submit.prevent="save">
            <label
              >Clave de vinculación
              <input v-model="form.token" type="password" autocomplete="off" :disabled="busy" />
            </label>
            <button type="button" :disabled="busy || !form.token.trim()" @click="connect">
              {{ busy ? 'Conectando…' : 'Conectar / actualizar impresoras' }}
            </button>
            <label
              >Impresora
              <select v-model="form.printer" :disabled="busy || !printers.length">
                <option value="" disabled>Selecciona una impresora</option>
                <option v-for="printer in printers" :key="printer" :value="printer">
                  {{ printer }}
                </option>
              </select>
            </label>
            <label
              >Ancho del papel
              <select v-model="form.paperWidth" :disabled="busy">
                <option :value="80">80 mm</option>
                <option :value="58">58 mm</option>
              </select>
            </label>
            <button
              type="submit"
              :disabled="busy || !form.printer || connectedToken !== form.token.trim()"
            >
              Guardar impresora
            </button>
          </form>
          <p role="status" :class="{ 'printer-error': error }">{{ message }}</p>
        </div>
      </section>
    </div></Teleport
  >
</template>

<style scoped>
.printer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 1rem;
  background: rgb(0 0 0 / 0.82);
  backdrop-filter: blur(3px);
}
.printer-preferences {
  display: flex;
  flex-direction: column;
  width: min(48rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
  border: 2px solid var(--br-line-strong);
  border-radius: 0;
  background: var(--br-panel);
  color: var(--br-text);
  box-shadow: 12px 12px 0 var(--br-accent);
}
.printer-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--br-line);
}
.printer-header > div {
  padding: 1.35rem 1.5rem 1.5rem;
}
.printer-header small {
  color: var(--br-accent);
  font:
    800 0.68rem/1 'Courier New',
    monospace;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}
.printer-header h2 {
  margin: 0.45rem 0 0;
  font:
    900 clamp(1.8rem, 5vw, 3rem)/0.95 Arial,
    sans-serif;
  letter-spacing: -0.055em;
  text-transform: uppercase;
}
.printer-header > .printer-close {
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid var(--br-line);
  border-bottom: 1px solid var(--br-line);
  background: var(--br-accent);
  color: var(--br-accent-text);
  font:
    400 2rem/1 Arial,
    sans-serif;
}
.printer-body {
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem;
}
p {
  margin: 0 0 1rem;
  line-height: 1.5;
}
details {
  margin: 1.25rem 0;
  padding: 1rem;
  border: 1px solid var(--br-line);
  background: var(--br-panel-2);
}
summary {
  cursor: pointer;
  font-weight: 700;
}
form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: end;
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--br-line);
}
label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.5rem;
  font:
    700 0.75rem/1.4 'Courier New',
    monospace;
}
input,
select,
button {
  min-height: 2.75rem;
  padding: 0.75rem;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
}
input,
select {
  width: 100%;
  min-width: 0;
  background: var(--br-panel-2);
  color: var(--br-text);
  font:
    400 0.9rem/1.3 Arial,
    sans-serif;
}
button {
  cursor: pointer;
  background: var(--br-panel-2);
  color: var(--br-text);
  font:
    800 0.72rem/1.4 'Courier New',
    monospace;
}
button[type='submit'] {
  grid-column: 1 / -1;
  background: var(--br-accent);
  color: var(--br-accent-text);
  text-transform: uppercase;
}
button:hover:not(:disabled) {
  border-color: var(--br-accent);
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
code {
  overflow-wrap: anywhere;
}
ol {
  padding-left: 1.5rem;
  margin: 1rem 0;
}
li + li {
  margin-top: 0.6rem;
}
a {
  text-decoration: underline;
}
[role='status']:not(:empty) {
  margin: 1rem 0 0;
}
.printer-error {
  font-weight: 700;
}
:focus-visible {
  outline: 2px solid var(--br-accent);
  outline-offset: 3px;
}
@media (max-width: 540px) {
  .printer-header > div,
  .printer-body {
    padding: 1rem;
  }
  form {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
