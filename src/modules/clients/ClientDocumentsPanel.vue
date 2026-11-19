<script setup lang="ts">
import HoldButton from '../../shared/vueBits/HoldButton.vue'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import { FileText, Upload, Download, Eye, Trash2, RefreshCw, FileWarning, Mail } from '@lucide/vue'
import { openMailComposer } from '../mail/mailComposerState'
import { workspaceAccess } from '../workspace/sessionState'
import { documentCategories, type ClientDocument, type DocumentCategory, type DocumentListResult } from '../../../shared/contracts/documents'
import type { AssignedClient } from '../../../shared/contracts/clients'
import { documentCategoryLabels, formatDocumentDate, formatDocumentSize } from './documentLabels'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import FormModal from '../../shared/components/FormModal.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { showPdf } from '../../shared/pdf/pdfViewerState'
import type { NavigationTarget } from '../../shared/navigation/navigationRequests'

/**
 * Expediente GLOBAL dentro de la ficha. Sólo presenta metadata y solicita operaciones cerradas a Main:
 * no recibe rutas ni claves, y bytes sólo al abrir un PDF en el visor de Fiscenix ("Ver" o el nombre del documento,
 * 2026-10-11): Main lo pide al Host y la vista lo entrega a `showPdf`, sin guardarlo en el panel. Tras cualquier escritura vuelve a consultar al Host en lugar de
 * suponer el resultado, porque una respuesta perdida no demuestra que la operación fallara.
 * Subir un documento ocurre en el modal de captura de la app (FormModal, como "Nuevo pago"): se elige el tipo y
 * Main abre el explorador; al confirmarse la carga el modal se cierra y la lista se vuelve a consultar.
 * "Obtener CSF con RFC y CIEC" ([[SAT-PORTAL]]) vivió aquí del 2026-10-13 al 2026-10-17; ahora está en Cumplimiento →
 * Constancias (`TaxCertificatesPanel`). Las constancias que obtiene siguen guardándose en este expediente.
 */
const props = defineProps<{ client: AssignedClient }>()
/** Destino de los avisos del expediente (2026-10-10): Clientes, el renglón del cliente y su expediente abierto. */
function documentsTarget(): NavigationTarget {
  return { section: 'clients', itemId: props.client.clientId, view: 'documents', label: 'el expediente de ' + props.client.displayName }
}
const { notify } = useNotifications()
const list = ref<DocumentListResult | null>(null), documents = ref<ClientDocument[]>([]), nextCursor = ref<number | null>(null)
const isLoading = ref(false), isWorking = ref(false), error = ref(''), hasRemoteChanges = ref(false)
const category = ref<string>('taxStatusCertificate')
const isUploadOpen = ref(false), uploadError = ref(''), uploadStep = ref(0)
const uploadSteps = [{ stepId: 'document', title: 'Documento' }]
const uploadReview = computed(() => [{ label: 'Cliente', value: props.client.displayName }, { label: 'Tipo de documento', value: documentCategoryLabels[selectedCategory.value] }, { label: 'Archivo', value: 'Se elige al confirmar (PDF de hasta 20 MB)' }])
/** SelectField trabaja con texto; sólo una categoría del catálogo cruza a Preload. */
const selectedCategory = computed<DocumentCategory>(() => documentCategories.find(value => value === category.value) ?? 'other')
const listElement = ref<HTMLElement | null>(null)
const categoryOptions = documentCategories.map(value => ({ value, label: documentCategoryLabels[value] }))
const isUnavailable = computed(() => list.value !== null && list.value.availability !== 'ready')
let isMounted = true
let documentVersion: number | undefined
let eventsTimer: ReturnType<typeof setTimeout> | undefined
/** Entrada escalonada de filas nuevas, limitada al panel. */
const rowEntrance = new StaggeredEntrance({ selector: '.document-row', staggerSeconds: .035 })


/** Primera página o continuación. Un error retira la lista para no mostrar acceso antiguo como vigente. */
async function load(shouldContinue = false): Promise<void> {
  if (isLoading.value) return
  isLoading.value = true; error.value = ''
  if (!shouldContinue) hasRemoteChanges.value = false
  try {
    const result = await window.contapp.manageDocuments({ action: 'list', clientId: props.client.clientId, beforeCursor: shouldContinue ? nextCursor.value : null })
    if (!isMounted || result.status !== 'listed') return
    list.value = result.list
    documents.value = shouldContinue ? [...documents.value, ...result.list.documents] : result.list.documents
    nextCursor.value = result.list.nextCursor
    void rowEntrance.play(() => listElement.value)
  } catch {
    if (isMounted) { list.value = null; documents.value = []; nextCursor.value = null; error.value = 'No se pudo consultar el expediente. Revisa tu sesión, el permiso Consultar expediente y la asignación de este cliente.' }
  } finally { isLoading.value = false }
}

async function upload(): Promise<void> {
  if (isWorking.value) return
  isWorking.value = true; error.value = ''; uploadError.value = ''
  try {
    const result = await window.contapp.manageDocuments({ action: 'upload', clientId: props.client.clientId, category: selectedCategory.value })
    if (result.status === 'uploaded' && isMounted) { isUploadOpen.value = false; notify('Documento cargado', result.document.displayName + ' quedó cifrado en el Host.', 'success', { target: documentsTarget() }) }
  } catch (reason) {
    if (isMounted) uploadError.value = reason instanceof Error && reason.message.includes('otras transferencias') ? 'El Host está procesando otras transferencias. Espera unos segundos y vuelve a intentarlo.' : 'No se confirmó la carga. Elige un PDF válido de hasta 20 MB y revisa tus permisos. Actualiza la lista antes de reintentar: si el Host llegó a guardarlo, aparecerá ahí.'
  } finally { isWorking.value = false }
  if (isMounted) await load()
}

/** Abre el PDF en el visor de Fiscenix. Mismos permisos que "Guardar copia"; el Host lo audita como consulta (`view`). */
async function openDocument(clientDocument: ClientDocument): Promise<void> {
  if (isWorking.value || !canOpen(clientDocument)) return
  isWorking.value = true; error.value = ''
  try {
    const result = await window.contapp.manageDocuments({ action: 'view', clientId: props.client.clientId, documentId: clientDocument.documentId })
    if (result.status === 'viewed' && isMounted) showPdf(result.view)
  } catch {
    if (isMounted) error.value = 'No se pudo abrir el documento. Puede que perdieras acceso o que el archivo del Host requiera recuperación; el Host lo conserva sin cambios.'
  } finally { isWorking.value = false }
}
/** Abrir o copiar sólo con el expediente disponible y el archivo cifrado presente en el Host. */
function canOpen(clientDocument: ClientDocument): boolean { return !isUnavailable.value && clientDocument.hasStoredFile }

async function saveCopy(clientDocument: ClientDocument): Promise<void> {
  if (isWorking.value) return
  isWorking.value = true; error.value = ''
  try {
    const result = await window.contapp.manageDocuments({ action: 'saveCopy', clientId: props.client.clientId, documentId: clientDocument.documentId })
    if (result.status === 'saved' && isMounted) notify('Copia guardada', 'La copia queda en la ubicación que elegiste, fuera del expediente del Host.', 'success')
  } catch {
    if (isMounted) error.value = 'No se pudo obtener el documento. Puede que perdieras acceso o que el archivo del Host requiera recuperación; el Host lo conserva sin cambios.'
  } finally { isWorking.value = false }
}

/** Eliminar es zona crítica (ADR-038): el diálogo único pide la contraseña siempre, con lo que se va a eliminar. */
async function deleteDocument(clientDocument: ClientDocument): Promise<void> {
  if (isWorking.value) return
  isWorking.value = true; error.value = ''
  try {
    const result = await withSensitiveConfirmation({ operation: 'documents.delete', title: 'Eliminar documento del expediente', description: clientDocument.displayName + ' dejará de estar disponible para todos los usuarios. La operación queda auditada.' },
      proof => window.contapp.manageDocuments({ action: 'delete', clientId: props.client.clientId, documentId: clientDocument.documentId }, proof))
    if (!result) return
    if (isMounted) notify('Documento eliminado', clientDocument.displayName + ' ya no forma parte del expediente.', 'success', { target: documentsTarget() })
  } catch {
    if (isMounted) error.value = 'No se confirmó la eliminación. Revisa tu contraseña y permisos; tras cinco intentos fallidos espera quince minutos. Actualiza la lista para ver el estado actual.'
  } finally { isWorking.value = false }
  if (isMounted) await load()
}

/** Avisos WSS sin contenido: con un diálogo abierto se conserva la vista y se ofrece actualizar. */
async function watchInvalidations(): Promise<void> {
  try {
    const events = await window.contapp.manageHostEvents('status')
    const version = events.documentInvalidationVersion
    if (version !== undefined && documentVersion !== undefined && version !== documentVersion && isMounted) {
      if (isWorking.value) hasRemoteChanges.value = true
      else await load()
    }
    if (version !== undefined) documentVersion = version
  } catch { /* El Host local no usa WSS; la lista se actualiza tras cada operación o manualmente. */ }
  if (isMounted) eventsTimer = setTimeout(() => { void watchInvalidations() }, 10000)
}

onMounted(() => { void load(); void watchInvalidations() })
onBeforeUnmount(() => { isMounted = false; clearTimeout(eventsTimer); rowEntrance.dispose(); documents.value = []; list.value = null })
</script>

<template>
  <section
    class="surface-panel documents-panel"
    data-testid="client-documents"
    aria-labelledby="client-documents-title"
  >
    <header class="documents-header">
      <div>
        <h2 id="client-documents-title">
          Expediente
        </h2>
        <p class="field-help">
          PDFs compartidos del cliente, cifrados en el Host. Ábrelos en el visor; las copias que guardes quedan en tu equipo.
        </p>
      </div>
      <div class="actions">
        <ActionButton
          :is-loading="isLoading"
          :disabled="isWorking"
          aria-label="Actualizar expediente"
          @click="load()"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          /> Actualizar
        </ActionButton>
        <ActionButton
          v-if="list?.canUpload"
          variant="primary"
          :disabled="isLoading || isWorking"
          @click="isUploadOpen = true; uploadError = ''; uploadStep = 0"
        >
          <Upload
            :size="16"
            aria-hidden="true"
          /> Subir documento
        </ActionButton>
      </div>
    </header>

    <InlineNotice
      v-if="error"
      title="Operación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <InlineNotice
      v-if="hasRemoteChanges"
      title="El expediente cambió"
      tone="warning"
    >
      <p>Otro equipo modificó los documentos. Actualiza para ver la lista vigente.</p>
    </InlineNotice>
    <InlineNotice
      v-if="list?.availability === 'keyMismatch'"
      title="Expediente protegido no disponible"
      tone="error"
    >
      <p>La clave del expediente de este Host no coincide con la registrada en la base. Los documentos se conservan sin cambios; no se cargan ni abren archivos hasta restaurar la clave original del equipo Host.</p>
    </InlineNotice>
    <InlineNotice
      v-else-if="list?.availability === 'unconfigured'"
      title="Expediente en preparación"
      tone="warning"
    >
      <p>El Host todavía no activó el almacenamiento cifrado. Prepara la conexión segura del Host o reinícialo; mientras tanto puedes consultar la lista, pero no cargar ni abrir archivos.</p>
    </InlineNotice>
    <InlineNotice
      v-if="list?.recovery && (list.recovery.pendingOperationCount > 0 || (list.recovery.unreferencedFileCount ?? 0) > 0)"
      title="Coordinación pendiente en el Host"
      tone="info"
    >
      <p v-if="list.recovery.pendingOperationCount > 0">
        {{ list.recovery.pendingOperationCount }} operación(es) de este cliente esperan conciliación automática entre base y archivos.
      </p>
      <p v-if="(list.recovery.unreferencedFileCount ?? 0) > 0">
        {{ list.recovery.unreferencedFileCount }} archivo(s) cifrado(s) del Host no tienen registro. Se conservan para revisión; no se eliminan automáticamente.
      </p>
    </InlineNotice>

    <p
      v-if="list && list.availability === 'ready' && !list.canUpload"
      class="field-help documents-readonly"
    >
      {{ client.access === 'readOnly' ? 'Tu asignación es de solo lectura: puedes consultar y guardar copias.' : 'Tus permisos permiten consultar el expediente, no cargar documentos.' }}
    </p>
    <FormModal
      :is-open="isUploadOpen"
      title="Subir documento"
      :description="'Expediente de ' + client.displayName + '. El PDF se guarda cifrado en el Host.'"
      :is-busy="isWorking"
      test-id="document-upload-modal"
      @close="isUploadOpen = false"
    >
      <form
        class="documents-upload"
        @submit.prevent
      >
        <InlineNotice
          v-if="uploadError"
          title="No se subió el documento"
          tone="error"
        >
          <p>{{ uploadError }}</p>
        </InlineNotice>
        <CaptureSteps
          v-model="uploadStep"
          :steps="uploadSteps"
          :review-items="uploadReview"
          :is-busy="isWorking"
          complete-label="Cargar PDF"
          @complete="upload"
        >
          <template #step-document>
            <SelectField
              id="document-category"
              v-model="category"
              label="Tipo de documento"
              :options="categoryOptions"
              :disabled="isWorking"
            />
            <p class="field-help">
              Al confirmar se abre el explorador de este equipo. Sólo PDF, hasta 20 MB.
            </p>
          </template>
          <template #footer-start>
            <ActionButton
              :disabled="isWorking"
              @click="isUploadOpen = false"
            >
              Cancelar
            </ActionButton>
          </template>
        </CaptureSteps>
      </form>
    </FormModal>

    <div
      v-if="isLoading && !documents.length"
      class="documents-skeleton"
      aria-hidden="true"
    >
      <span
        v-for="index in 3"
        :key="index"
      />
    </div>
    <p
      v-if="isLoading"
      class="sr-only"
      role="status"
    >
      Consultando expediente
    </p>

    <ul
      ref="listElement"
      class="documents-list"
    >
      <li
        v-for="clientDocument in documents"
        :key="clientDocument.documentId"
        v-motion="'card'"
        class="document-row"
      >
        <FileText
          :size="22"
          aria-hidden="true"
          class="document-icon"
        />
        <div class="document-details">
          <!-- El nombre también abre el visor (clic o Enter), como "Ver". -->
          <h3>
            <button
              v-if="canOpen(clientDocument)"
              type="button"
              class="document-name"
              :disabled="isWorking"
              :title="'Ver ' + clientDocument.displayName"
              @click="openDocument(clientDocument)"
            >
              {{ clientDocument.displayName }}
            </button>
            <template v-else>
              {{ clientDocument.displayName }}
            </template>
          </h3>
          <p class="field-help">
            {{ documentCategoryLabels[clientDocument.category] }} · {{ formatDocumentSize(clientDocument.sizeBytes) }}
          </p>
          <p class="field-help">
            Cargado por {{ clientDocument.createdByDisplayName }}, {{ formatDocumentDate(clientDocument.createdAt) }}
          </p>
          <StatusBadge
            v-if="!clientDocument.hasStoredFile && list?.availability === 'ready'"
            tone="error"
          >
            <FileWarning
              :size="13"
              aria-hidden="true"
            /> Archivo no localizado en el Host
          </StatusBadge>
        </div>
        <div class="actions document-actions">
          <ActionButton
            :disabled="isWorking || !canOpen(clientDocument)"
            :aria-label="'Ver ' + clientDocument.displayName"
            @click="openDocument(clientDocument)"
          >
            <Eye
              :size="16"
              aria-hidden="true"
            /> Ver
          </ActionButton>
          <ActionButton
            :disabled="isWorking || !canOpen(clientDocument)"
            :aria-label="'Guardar copia de ' + clientDocument.displayName"
            @click="saveCopy(clientDocument)"
          >
            <Download
              :size="16"
              aria-hidden="true"
            /> Guardar copia
          </ActionButton>
          <!-- Correo (2026-10-17): abre el redactor con este documento adjunto; el Host vuelve a exigir permisos al enviar. -->
          <ActionButton
            v-if="workspaceAccess.canSendMail"
            :disabled="isWorking || !canOpen(clientDocument)"
            :aria-label="'Enviar por correo ' + clientDocument.displayName"
            @click="openMailComposer({ clientId: client.clientId, clientName: client.displayName, documentLabel: documentCategoryLabels[clientDocument.category], attachments: [{ reference: { kind: 'document', documentId: clientDocument.documentId }, label: clientDocument.displayName }] })"
          >
            <Mail
              :size="16"
              aria-hidden="true"
            /> Enviar
          </ActionButton>
          <!-- Mantener presionado abre la confirmación con contraseña: el Host la sigue exigiendo. -->
          <HoldButton
            v-if="list?.canDelete"
            :is-disabled="isWorking"
            :aria-label="'Eliminar ' + clientDocument.displayName"
            done-label="Confirma"
            @hold="deleteDocument(clientDocument)"
          >
            <template #icon>
              <Trash2
                :size="16"
                aria-hidden="true"
              />
            </template>
            Eliminar
          </HoldButton>
        </div>
      </li>
    </ul>
    <p
      v-if="list && !isLoading && !documents.length && !error"
      class="documents-empty"
    >
      Este cliente todavía no tiene documentos.
      <span v-if="list.canUpload">Elige el tipo y carga el primer PDF.</span>
    </p>
    <ActionButton
      v-if="nextCursor"
      :is-loading="isLoading"
      :disabled="isWorking"
      @click="load(true)"
    >
      Mostrar documentos anteriores
    </ActionButton>
  </section>
</template>

<style scoped>
.documents-panel { margin-top: var(--spaceLarge); display: grid; gap: var(--spaceMedium); min-width: 0; }
.documents-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--spaceMedium); }
.documents-header h2 { margin: 0 0 4px; }
.documents-upload { display: grid; gap: var(--spaceMedium); }
.documents-readonly { margin: 0; }
.documents-list { list-style: none; margin: 0; padding: 0; }
.document-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--spaceMedium); align-items: center; padding: var(--spaceMedium) 0; border-bottom: 1px solid var(--borderColor); }
.document-icon { color: var(--accentColor); align-self: start; margin-top: 2px; }
.document-details { min-width: 0; overflow-wrap: anywhere; display: grid; gap: 4px; }
.document-details h3 { font-size: 15px; margin: 0; }
/* Nombre que abre el visor: se lee como título, con subrayado al pasar y foco visible del sistema. */
.document-name { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: start; overflow-wrap: anywhere; cursor: pointer; }
.document-name:hover:not(:disabled) { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.document-name:focus-visible { outline: 2px solid var(--focusColor); outline-offset: 2px; }
.document-name:disabled { cursor: progress; }
.document-actions { justify-content: flex-end; }
.documents-empty { margin: 0; padding: var(--spaceLarge) 0; border-top: 1px solid var(--borderColor); border-bottom: 1px solid var(--borderColor); }
.documents-empty span { display: block; color: var(--mutedTextColor); margin-top: 4px; }
.documents-skeleton { display: grid; gap: 12px; }
.documents-skeleton span { display: block; height: 56px; background: var(--subtleColor); border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
@container (max-width: 640px) {
  .document-row { grid-template-columns: auto minmax(0, 1fr); }
  .document-actions { grid-column: 1 / -1; justify-content: flex-start; }
}
</style>
