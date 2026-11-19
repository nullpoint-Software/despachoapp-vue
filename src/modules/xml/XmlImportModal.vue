<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FolderOpen, Upload } from '@lucide/vue'
import { maximumDroppedBytes, maximumDroppedFileBytes, maximumImportFileCount, maximumImportFileListSize, type XmlImportFileResult, type XmlImportResult, type XmlImportSummary } from '../../../shared/contracts/localXml'
import FormModal from '../../shared/components/FormModal.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { rejectionLabels } from './xmlLabels'

/**
 * Modal "Importar XML" (2026-10-12), compartido por la Biblioteca XML y Fiscal del cliente.
 * - Arrastrar XML o ZIP a la zona: el Renderer lee cada `File` y manda sólo nombre y bytes por
 *   `importLocalXmlFiles` (Main valida de nuevo y aplica el mismo presupuesto que el diálogo). La zona también es
 *   un botón: con clic, Enter o Espacio abre el diálogo nativo, igual que "Elegir archivos" (`importLocalXml`).
 * - Mientras el modal está abierto, contadores y lista **suman** todas las importaciones (2026-10-12); al reabrirlo empieza
 *   de cero.
 * - Tras cada importación muestra los contadores y la lista por archivo (Importado, Ya existía, Conflicto o
 *   Rechazado con su motivo). El modal sigue abierto para soltar más; quien lo abre recarga su lista al cerrarlo.
 * Emite `imported` con el resumen para que la página avise (notificación) como antes.
 */
const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: []; imported: [summary: XmlImportSummary] }>()
const isImporting = ref(false), isDragging = ref(false), error = ref(''), summary = ref<XmlImportSummary | null>(null)
const outcomeLabels: Record<XmlImportFileResult['outcome'], string> = { imported: 'Importado', duplicate: 'Ya existía', conflict: 'Conflicto', rejected: 'Rechazado' }
const outcomeTones = { imported: 'success', duplicate: 'neutral', conflict: 'warning', rejected: 'error' } as const
/** Archivos que no caben en la lista (tope de 500 resultados); los contadores sí los incluyen. */
const hiddenFileCount = computed(() => summary.value ? summary.value.imported + summary.value.duplicates + summary.value.conflicts + summary.value.rejected - summary.value.files.length : 0)
// Cada apertura empieza limpia; el resultado anterior ya se avisó.
watch(() => props.isOpen, isOpen => { if (isOpen) { summary.value = null; error.value = '' } })

async function runImport(request: () => Promise<XmlImportResult>): Promise<void> {
  if (isImporting.value) return
  isImporting.value = true; error.value = ''
  try {
    const result = await request()
    if (result.status === 'cancelled') return
    const previous = summary.value
    summary.value = previous ? { imported: previous.imported + result.summary.imported, duplicates: previous.duplicates + result.summary.duplicates, conflicts: previous.conflicts + result.summary.conflicts, rejected: previous.rejected + result.summary.rejected,
      rejections: [...previous.rejections, ...result.summary.rejections], files: [...result.summary.files, ...previous.files].slice(0, maximumImportFileListSize) } : result.summary
    emit('imported', result.summary)
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se completó la importación. Los XML ya guardados se conservan.') }
  finally { isImporting.value = false }
}
function chooseFiles(): void { void runImport(() => window.contapp.importLocalXml()) }
/** Revisa los límites antes de leer para no cargar en memoria una selección que Main rechazaría. */
function dropFiles(event: DragEvent): void {
  isDragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (!files.length || isImporting.value) return
  const largeFile = files.find(file => file.size > maximumDroppedFileBytes)
  if (largeFile) { error.value = largeFile.name + ' pesa más de 50 MB. Para archivos grandes usa «Elegir archivos». No se importó nada.'; return }
  if (files.length > maximumImportFileCount || files.reduce((total, file) => total + file.size, 0) > maximumDroppedBytes) {
    error.value = 'Suelta hasta ' + maximumImportFileCount + ' archivos y 100 MB por vez; para más usa «Elegir archivos». No se importó nada.'
    return
  }
  void runImport(async () => window.contapp.importLocalXmlFiles(await Promise.all(files.map(async file => ({ name: file.name, content: new Uint8Array(await file.arrayBuffer()) })))))
}
</script>

<template>
  <FormModal
    :is-open="isOpen"
    title="Importar XML"
    description="XML o el ZIP del SAT. Se guardan cifrados sólo en este equipo."
    test-id="xml-import-modal"
    :is-busy="isImporting"
    @close="emit('close')"
  >
    <section class="xml-import">
      <button
        type="button"
        class="xml-drop-zone"
        :class="{ 'is-dragging': isDragging }"
        :disabled="isImporting"
        data-testid="xml-drop-zone"
        @click="chooseFiles"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="dropFiles"
      >
        <Upload
          :size="28"
          aria-hidden="true"
        />
        <strong>{{ isImporting ? 'Importando…' : 'Arrastra aquí archivos XML o ZIP' }}</strong>
        <span>o haz clic para elegirlos. Al arrastrar: hasta 50 MB por archivo y 100 MB por vez.</span>
      </button>
      <div class="actions">
        <ActionButton
          variant="primary"
          :is-loading="isImporting"
          @click="chooseFiles"
        >
          <FolderOpen
            :size="16"
            aria-hidden="true"
          /> Elegir archivos
        </ActionButton>
      </div>
      <InlineNotice
        v-if="error"
        title="Importación no completada"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <template v-if="summary">
        <p
          class="xml-import-summary"
          role="status"
        >
          {{ summary.imported }} nuevo(s), {{ summary.duplicates }} ya existían, {{ summary.conflicts }} en conflicto y {{ summary.rejected }} rechazado(s).
        </p>
        <ul
          class="xml-import-files"
          aria-label="Resultado por archivo"
        >
          <li
            v-for="(file, index) in summary.files"
            :key="index"
          >
            <span class="xml-import-name">{{ file.name }}</span>
            <StatusBadge :tone="outcomeTones[file.outcome]">
              {{ outcomeLabels[file.outcome] }}
            </StatusBadge>
            <small v-if="file.outcome === 'rejected'">{{ rejectionLabels[file.reason] }}</small>
            <small v-else-if="file.outcome === 'conflict'">El UUID ya existe con otro contenido; se conservó el original.</small>
          </li>
        </ul>
        <p
          v-if="hiddenFileCount > 0"
          class="field-help"
        >
          Y {{ hiddenFileCount }} archivo(s) más que no caben en la lista.
        </p>
      </template>
    </section>
  </FormModal>
</template>

<style scoped>
.xml-import { display: grid; gap: var(--spaceMedium); }
.xml-drop-zone { display: grid; justify-items: center; gap: 6px; padding: 32px 16px; border: 2px dashed var(--borderColor); background: var(--subtleColor); color: var(--textColor); font: inherit; text-align: center; cursor: pointer; }
.xml-drop-zone span { color: var(--mutedTextColor); font-size: 13px; }
.xml-drop-zone:hover:not(:disabled), .xml-drop-zone.is-dragging { border-color: var(--accentColor); border-style: solid; }
.xml-drop-zone:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.xml-drop-zone:disabled { cursor: progress; opacity: .7; }
.xml-import-summary { margin: 0; font-weight: 700; }
.xml-import-files { list-style: none; margin: 0; padding: 0; border-top: 2px solid var(--borderColor); }
.xml-import-files li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--hairlineColor); }
.xml-import-name { min-width: 0; overflow-wrap: anywhere; font-family: var(--monoFontFamily); font-size: 12px; }
.xml-import-files small { grid-column: 1 / -1; color: var(--mutedTextColor); }
</style>
