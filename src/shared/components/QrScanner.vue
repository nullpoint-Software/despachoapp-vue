<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Camera, FileText, ImageUp, RotateCcw } from '@lucide/vue'
import ActionButton from './ActionButton.vue'
import InlineNotice from './InlineNotice.vue'
import SelectField from './SelectField.vue'
import { decodeQrFromDrawable, decodeQrFromImageFile, decodeQrFromPdfFile } from '../qr/readQrSources'

/**
 * Lector de códigos QR genérico (2026-10-11, pedido "escaner qr para el idCIF", [[changes/CSF-QR-SCANNER]]).
 * Va dentro de un modal del llamador (`FormModal`) y sólo emite el texto leído: quien lo usa valida el contenido.
 *
 * Fuentes:
 * - **Cámara:** `getUserMedia` sólo con video, vista previa en vivo y lectura de un cuadro cada 250 ms (jsQR, sin
 *   `BarcodeDetector`, que Electron no trae en Windows). Si hay varias cámaras, un selector. Main sólo concede el
 *   permiso de video a la ventana principal de Fiscenix (`cameraPermissionPolicy`). Las pistas se detienen al leer un
 *   código, al cambiar de fuente o cámara, al cerrar el modal (`isActive` en falso) y al desmontar.
 * - **Imagen:** PNG o JPG (foto o captura del QR), leída en un lienzo a varias escalas.
 * - **PDF:** las dos primeras páginas dibujadas con pdf.js.
 *
 * Nada sale de la ventana: ni cuadros de la cámara ni archivos viajan a Main o al Host, y el texto no se registra.
 * Tras emitir `decoded` el lector se detiene; si el llamador rechaza el contenido, lo explica con `rejectionMessage`
 * y la persona pulsa "Intentar otra vez" (`retry`).
 */
type QrSource = 'camera' | 'image' | 'pdf'
const props = withDefaults(defineProps<{ isActive: boolean; sources?: QrSource[]; rejectionMessage?: string }>(), { sources: () => ['camera', 'image', 'pdf'], rejectionMessage: '' })
const emit = defineEmits<{ decoded: [text: string]; retry: [] }>()

const sourceLabels: Record<QrSource, string> = { camera: 'Cámara', image: 'Imagen', pdf: 'PDF' }
const selectedSource = ref<QrSource>(props.sources[0] ?? 'image')
/** `idle`: esperando; `starting`/`scanning`: cámara; `reading`: archivo; `decoded`: ya se emitió un texto. */
const state = ref<'idle' | 'starting' | 'scanning' | 'reading' | 'decoded'>('idle')
const message = ref<{ title: string; text: string; tone: 'info' | 'warning' | 'error' } | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null), pdfInput = ref<HTMLInputElement | null>(null)
const cameras = ref<{ value: string; label: string }[]>([])
const selectedCameraId = ref('')

/** Cuadros por segundo que se intentan leer: suficiente para apuntar con calma y deja la ventana fluida. */
const scanIntervalMilliseconds = 250
/** Tope del archivo elegido: una foto de teléfono pesa 2-8 MB; una constancia, menos de 1 MB. */
const maximumFileBytes = 25 * 1024 * 1024
let stream: MediaStream | null = null
let scanTimer: ReturnType<typeof setInterval> | undefined
/** Versión del arranque de la cámara: una respuesta tardía de `getUserMedia` de un arranque anterior se descarta. */
let cameraVersion = 0

const isCameraVisible = computed(() => selectedSource.value === 'camera' && (state.value === 'starting' || state.value === 'scanning'))

/** Detiene la lectura y todas las pistas de la cámara (la luz de la cámara se apaga). */
function stopCamera(): void {
  cameraVersion++
  clearInterval(scanTimer); scanTimer = undefined
  for (const track of stream?.getTracks() ?? []) track.stop()
  stream = null
  if (video.value) video.value.srcObject = null
}

/** Traduce los errores de `getUserMedia` a una explicación para la persona. */
function describeCameraError(failure: unknown): { title: string; text: string; tone: 'warning' | 'error' } {
  const name = failure instanceof DOMException ? failure.name : ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { title: 'No hay cámara', text: 'No se encontró una cámara en este equipo. Usa una imagen o el PDF de la constancia.', tone: 'warning' }
  if (name === 'NotAllowedError' || name === 'SecurityError') return { title: 'Permiso de cámara denegado', text: 'Windows o Fiscenix no permitieron usar la cámara. Revisa en Configuración de Windows → Privacidad → Cámara que las aplicaciones de escritorio puedan usarla, o usa una imagen.', tone: 'error' }
  if (name === 'NotReadableError' || name === 'AbortError') return { title: 'La cámara está ocupada', text: 'Otra aplicación está usando la cámara. Ciérrala e intenta otra vez, o usa una imagen.', tone: 'warning' }
  return { title: 'No se pudo abrir la cámara', text: 'Intenta otra vez o usa una imagen o el PDF.', tone: 'error' }
}

/** Lista las cámaras (con nombre sólo después de conceder el permiso). */
async function loadCameras(): Promise<void> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(device => device.kind === 'videoinput').map((device, index) => ({ value: device.deviceId, label: device.label || 'Cámara ' + (index + 1) }))
  } catch { cameras.value = [] }
}

async function startCamera(): Promise<void> {
  stopCamera()
  const version = cameraVersion
  message.value = null
  if (!navigator.mediaDevices?.getUserMedia) { message.value = { title: 'Sin cámara disponible', text: 'Este equipo no permite usar la cámara. Usa una imagen o el PDF.', tone: 'warning' }; state.value = 'idle'; return }
  state.value = 'starting'
  try {
    // Sólo video: el permiso de Main rechaza cualquier petición con audio.
    const videoConstraints: MediaTrackConstraints = selectedCameraId.value ? { deviceId: { exact: selectedCameraId.value } } : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    const opened = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false })
    if (version !== cameraVersion || !props.isActive) { for (const track of opened.getTracks()) track.stop(); return }
    stream = opened
    if (!selectedCameraId.value) selectedCameraId.value = opened.getVideoTracks()[0]?.getSettings().deviceId ?? ''
    await loadCameras()
    await nextTick()
    const element = video.value
    if (!element) { stopCamera(); return }
    element.srcObject = opened
    await element.play()
    if (version !== cameraVersion) return
    state.value = 'scanning'
    scanTimer = setInterval(scanFrame, scanIntervalMilliseconds)
  } catch (failure) {
    if (version !== cameraVersion) return
    stopCamera(); state.value = 'idle'; message.value = describeCameraError(failure)
  }
}

/** Lee el cuadro actual; al encontrar un código detiene la cámara y lo emite. */
function scanFrame(): void {
  const element = video.value
  if (!element || state.value !== 'scanning' || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
  let text: string | null = null
  try { text = decodeQrFromDrawable(element, element.videoWidth, element.videoHeight, [1]) } catch { return }
  if (!text) return
  stopCamera(); state.value = 'decoded'
  emit('decoded', text)
}

/** Imagen o PDF elegido: se lee en memoria; el archivo no se guarda ni se envía. */
async function handleFileChoice(event: Event, kind: 'image' | 'pdf'): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  message.value = null
  const isExpectedType = kind === 'image' ? ['image/png', 'image/jpeg'].includes(file.type) : file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isExpectedType) { message.value = { title: 'Archivo no admitido', text: kind === 'image' ? 'Elige una imagen PNG o JPG.' : 'Elige un archivo PDF.', tone: 'warning' }; return }
  if (file.size > maximumFileBytes) { message.value = { title: 'Archivo demasiado grande', text: 'El archivo pesa más de 25 MB.', tone: 'warning' }; return }
  state.value = 'reading'
  try {
    const text = kind === 'image' ? await decodeQrFromImageFile(file) : await decodeQrFromPdfFile(file)
    if (!props.isActive) return
    if (!text) { state.value = 'idle'; message.value = { title: 'No se encontró un código QR', text: kind === 'image' ? 'Prueba con una foto más cercana y nítida, de frente y con buena luz.' : 'El PDF no tiene un código QR legible en sus primeras páginas.', tone: 'warning' }; return }
    state.value = 'decoded'
    emit('decoded', text)
  } catch {
    if (props.isActive) { state.value = 'idle'; message.value = { title: 'No se pudo leer el archivo', text: kind === 'image' ? 'La imagen está dañada o no es PNG/JPG.' : 'El PDF está dañado o protegido.', tone: 'error' } }
  }
}

/** Después de un rechazo del llamador: limpia y vuelve a leer con la misma fuente. */
function retry(): void {
  emit('retry')
  state.value = 'idle'; message.value = null
  if (selectedSource.value === 'camera' && props.isActive) void startCamera()
}

function selectSource(source: QrSource): void {
  if (source === selectedSource.value) return
  stopCamera(); state.value = 'idle'; message.value = null
  selectedSource.value = source
}

// La cámara corre sólo con el modal abierto y la fuente "Cámara" elegida; al cambiar de cámara se reinicia.
watch(() => [props.isActive, selectedSource.value] as const, ([isActive, source]) => {
  if (!isActive) { stopCamera(); state.value = 'idle'; message.value = null; return }
  if (source === 'camera' && state.value !== 'decoded') void startCamera()
}, { immediate: true })
watch(selectedCameraId, (cameraId, previousCameraId) => {
  if (previousCameraId && cameraId !== previousCameraId && selectedSource.value === 'camera' && state.value === 'scanning') void startCamera()
})
onBeforeUnmount(stopCamera)
</script>

<template>
  <div
    class="qr-scanner"
    data-testid="qr-scanner"
  >
    <div
      v-if="sources.length > 1"
      v-sliding-tabs
      class="segmented-tabs"
      role="tablist"
      aria-label="Fuente del código QR"
    >
      <button
        v-for="source in sources"
        :key="source"
        type="button"
        role="tab"
        :aria-selected="selectedSource === source"
        @click="selectSource(source)"
      >
        {{ sourceLabels[source] }}
      </button>
    </div>

    <template v-if="selectedSource === 'camera'">
      <SelectField
        v-if="cameras.length > 1"
        id="qr-scanner-camera"
        v-model="selectedCameraId"
        label="Cámara"
        :options="cameras"
        :disabled="state === 'starting'"
      />
      <div
        v-show="isCameraVisible"
        class="qr-scanner-preview"
      >
        <!-- Vista previa sin audio; `playsinline` evita la pantalla completa automática. -->
        <video
          ref="video"
          muted
          playsinline
          aria-label="Vista previa de la cámara"
        />
        <span
          class="qr-scanner-frame"
          aria-hidden="true"
        />
      </div>
      <p
        v-if="isCameraVisible"
        class="field-help"
        role="status"
      >
        {{ state === 'starting' ? 'Abriendo la cámara…' : 'Apunta al código QR de la constancia y mantenlo quieto.' }}
      </p>
      <ActionButton
        v-if="state === 'idle'"
        @click="startCamera"
      >
        <Camera
          :size="16"
          aria-hidden="true"
        /> Usar la cámara
      </ActionButton>
    </template>

    <div
      v-else
      class="qr-scanner-file"
    >
      <p class="field-help">
        {{ selectedSource === 'image' ? 'Elige una foto o captura del código QR (PNG o JPG).' : 'Elige el PDF de la constancia; se busca el QR en sus primeras páginas.' }}
      </p>
      <input
        ref="imageInput"
        class="sr-only"
        type="file"
        accept="image/png,image/jpeg"
        tabindex="-1"
        aria-hidden="true"
        @change="handleFileChoice($event, 'image')"
      >
      <input
        ref="pdfInput"
        class="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        tabindex="-1"
        aria-hidden="true"
        @change="handleFileChoice($event, 'pdf')"
      >
      <ActionButton
        :is-loading="state === 'reading'"
        :disabled="state === 'reading'"
        @click="(selectedSource === 'image' ? imageInput : pdfInput)?.click()"
      >
        <ImageUp
          v-if="selectedSource === 'image'"
          :size="16"
          aria-hidden="true"
        /><FileText
          v-else
          :size="16"
          aria-hidden="true"
        /> {{ selectedSource === 'image' ? 'Elegir imagen' : 'Elegir PDF' }}
      </ActionButton>
    </div>

    <InlineNotice
      v-if="message"
      :title="message.title"
      :tone="message.tone"
      data-testid="qr-scanner-message"
    >
      <p>{{ message.text }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="state === 'decoded' && rejectionMessage"
      title="Ese código no sirve aquí"
      tone="error"
      data-testid="qr-scanner-rejection"
    >
      <p>{{ rejectionMessage }}</p>
    </InlineNotice>
    <ActionButton
      v-if="state === 'decoded' && rejectionMessage"
      @click="retry"
    >
      <RotateCcw
        :size="16"
        aria-hidden="true"
      /> Intentar otra vez
    </ActionButton>
  </div>
</template>

<style scoped>
.qr-scanner { display: grid; gap: var(--spaceMedium, 16px); min-width: 0; }
.qr-scanner .inline-notice { margin: 0; }
.qr-scanner .field-help { margin: 0; }
.qr-scanner-file { display: grid; justify-items: start; gap: 12px; }
/* Vista previa con marco de tinta (brutalista) y una guía cuadrada donde colocar el QR. */
.qr-scanner-preview { position: relative; width: 100%; max-width: 480px; aspect-ratio: 4 / 3; border: var(--structureBorder, 2px) solid var(--strongBorderColor); background: #000; overflow: hidden; }
.qr-scanner-preview video { display: block; width: 100%; height: 100%; object-fit: cover; }
.qr-scanner-frame { position: absolute; inset: 18% 26%; border: 3px solid var(--focusColor); box-shadow: 0 0 0 9999px rgb(0 0 0 / 35%); pointer-events: none; }
</style>
