<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Plus, FolderPlus, Download, Upload, FilePlus, ListTodo, Trash2 } from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import NotesFolderIndex from './NotesFolderIndex.vue'
import NotesFileList from './NotesFileList.vue'
import { notesState, activeNoteId, hasUnsavedNotes, loadNotes, saveNotes } from './notesState'
import { mergeImportedNotes, toIncomingNotes } from './notesImport'
import { markdownToDocument } from './markdownDocument'
import { countNoteText, extractNoteText } from './noteText'
import { describeView, filterNotes, reservedViewNames, type NotesView } from './notesView'
import ActionButton from '../../shared/components/ActionButton.vue'
import ListToolbar from '../../shared/components/ListToolbar.vue'
import FormModal from '../../shared/components/FormModal.vue'
import ContextMenu, { type ContextMenuItem } from '../../shared/components/ContextMenu.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import NoteQuickTaskModal from './NoteQuickTaskModal.vue'
import { workspaceAccess } from '../workspace/sessionState'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import SelectField from '../../shared/components/SelectField.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Notas LOCAL organizadas como el "Directorio" del sistema original:
 * - Directorio: índice de carpetas a la izquierda y lista de documentos a la derecha, con búsqueda,
 *   anclar, archivar, eliminar y arrastrar a otra carpeta.
 * - Documento: al abrir una nota la vista pasa al editor de hoja completa, con título, ubicación y
 *   conteo de palabras; "Volver al directorio" conserva el borrador en memoria hasta guardarlo.
 * Todo se guarda en este equipo (Main exige sesión con `notes.use`); nada pasa por el Host.
 */
const { notify } = useNotifications()
const query = ref('')
const view = ref<NotesView>('all')
const folderName = ref('')
const isCreatingFolder = ref(false)
/** Nueva carpeta por pasos (ADR-034): dentro de qué carpeta y nombre → Revisar. */
const parentFolder = ref(''), folderStep = ref(0), folderError = ref('')
const folderSteps = [{ stepId: 'folder', title: 'Carpeta' }]
// Una carpeta intermedia implícita (sólo existe `A/B`) puede ser el padre elegido desde su menú contextual.
const parentOptions = computed(() => [{ value: '', label: 'Raíz' }, ...[...notesState.value.folders, ...(parentFolder.value && !notesState.value.folders.includes(parentFolder.value) ? [parentFolder.value] : [])].map(folder => ({ value: folder, label: folder }))])
const folderPath = computed(() => (parentFolder.value ? parentFolder.value + '/' : '') + folderName.value.trim())
const folderReview = computed(() => [{ label: 'Nombre', value: folderName.value.trim() }, { label: 'Ruta completa', value: 'Raíz / ' + folderPath.value.replaceAll('/', ' / ') }])
function validateFolder(): boolean {
  const name = folderPath.value
  folderError.value = !folderName.value.trim() || folderName.value.includes('/') || name.length > 120 || reservedViewNames.includes(name) || notesState.value.folders.includes(name) ? 'Escribe un nombre de carpeta distinto, sin / (la ruta completa admite hasta 120 caracteres).' : ''
  return !folderError.value
}
function closeFolderModal(): void { isCreatingFolder.value = false; folderName.value = ''; parentFolder.value = ''; folderStep.value = 0; folderError.value = '' }
const error = ref('')
const isBusy = ref(false)
const editorReference = ref<InstanceType<typeof NoteEditor> | null>(null)
const pageElement = ref<HTMLElement | null>(null)
/** Entrada de los bloques de la vista (cabecera, índice, lista o documento), como el original. */
const stageEntrance = new StaggeredEntrance({ selector: '.notes-stage', distancePixels: 14, staggerSeconds: .06 })

const activeNote = computed(() => notesState.value.notes.find(note => note.noteId === activeNoteId.value))
// El texto plano se calcula una vez por cambio de notas y lo comparten búsqueda y vista previa.
const noteTexts = computed(() => new Map(notesState.value.notes.map(note => [note.noteId, extractNoteText(note.content)])))
const visibleNotes = computed(() => filterNotes(notesState.value.notes, view.value, query.value, note => noteTexts.value.get(note.noteId) ?? ''))
const viewTitle = computed(() => describeView(view.value))
const emptyMessage = computed(() => query.value.trim() ? 'Ningún documento coincide con la búsqueda.' : view.value === 'archive' ? 'No hay notas archivadas.' : view.value === 'pinned' ? 'No hay notas ancladas.' : 'Esta carpeta todavía no tiene documentos.')
const textCount = computed(() => activeNote.value ? countNoteText(activeNote.value.content) : { wordCount: 0, characterCount: 0 })

function findNote(noteId: string) { return notesState.value.notes.find(note => note.noteId === noteId) }
async function persist(successTitle = 'Nota guardada'): Promise<void> {
  isBusy.value = true
  try { editorReference.value?.applyPendingMarkdown(); await saveNotes(); error.value = ''; notify(successTitle, 'Se guardó en este dispositivo.', 'success') }
  catch { error.value = 'No se pudo guardar. El borrador sigue disponible en esta sesión.' }
  finally { isBusy.value = false }
}
function changeNote(noteId: string, change: (note: NonNullable<ReturnType<typeof findNote>>) => void, successTitle: string): void {
  const note = findNote(noteId)
  if (!note) return
  change(note); hasUnsavedNotes.value = true; void persist(successTitle)
}
/**
 * Crea una nota vacía y la abre. Sin destino usa la vista actual (carpeta elegida o General; anclada en Ancladas).
 * Desde un menú contextual el destino es explícito; una carpeta implícita (`A` de `A/B`) se guarda primero como carpeta.
 */
function createNote(target: { folder?: string; isPinned?: boolean } = {}): void {
  const noteId = crypto.randomUUID()
  const folder = target.folder ?? (notesState.value.folders.includes(view.value) ? view.value : 'General')
  if (!notesState.value.folders.includes(folder)) notesState.value.folders.push(folder)
  notesState.value.notes.unshift({ noteId, title: 'Nueva nota', folder, isPinned: target.isPinned ?? view.value === 'pinned', isArchived: false, updatedAt: new Date().toISOString(), content: { type: 'doc', content: [{ type: 'paragraph' }] } })
  activeNoteId.value = noteId; hasUnsavedNotes.value = true
}
function changeContent(content: Record<string, unknown>): void {
  if (!activeNote.value) return
  activeNote.value.content = content; activeNote.value.updatedAt = new Date().toISOString(); hasUnsavedNotes.value = true
}
function createFolder(): void {
  if (!validateFolder()) { folderStep.value = 0; return }
  const name = folderPath.value
  notesState.value.folders.push(name); closeFolderModal(); view.value = name; hasUnsavedNotes.value = true; void persist('Carpeta creada')
}
/** Quitar una carpeta nunca elimina su contenido: sus notas pasan a General. */
function deleteFolder(folder: string): void {
  if (!folder || folder === 'General') return
  notesState.value.notes.forEach(note => { if (note.folder === folder) note.folder = 'General' })
  notesState.value.folders = notesState.value.folders.filter(item => item !== folder)
  if (view.value === folder) view.value = 'General'
  hasUnsavedNotes.value = true; void persist('Carpeta quitada')
}
function moveNote(noteId: string, folder: string): void {
  const note = findNote(noteId)
  if (!note || note.folder === folder) return
  changeNote(noteId, item => { item.folder = folder; item.updatedAt = new Date().toISOString() }, 'Nota movida a ' + folder)
}
/** Ya confirmada al mantener presionado el botón (Hold Button); no hay diálogo adicional. */
function deleteNote(noteId: string): void {
  notesState.value.notes = notesState.value.notes.filter(note => note.noteId !== noteId)
  if (activeNoteId.value === noteId) activeNoteId.value = null
  hasUnsavedNotes.value = true; void persist('Nota eliminada')
}
/** El respaldo sale del estado guardado: con cambios pendientes se pide guardar primero. */
async function exportBackup(): Promise<void> {
  if (hasUnsavedNotes.value) { error.value = 'Guarda la nota antes de exportar: el respaldo incluye sólo lo guardado en este dispositivo.'; return }
  isBusy.value = true
  try {
    const result = await window.contapp.exportLocalNotes()
    error.value = ''
    if (result.status === 'exported') notify('Respaldo exportado', notesState.value.notes.length + ' nota(s) en un archivo que puedes importar en cualquier equipo.', 'success')
  } catch { error.value = 'No se pudo exportar el respaldo. Revisa la carpeta elegida y el espacio disponible.' }
  finally { isBusy.value = false }
}
/**
 * Importa un respaldo Fiscenix o una exportación del sistema anterior. La fusión nunca borra ni
 * sobrescribe: omite idénticas y agrega copias "(importada)". Se guarda de inmediato con la revisión
 * vigente; si el guardado falla, el estado vuelve a lo que había.
 */
async function importNotes(): Promise<void> {
  if (hasUnsavedNotes.value) { error.value = 'Guarda la nota antes de importar para no mezclar cambios pendientes.'; return }
  isBusy.value = true
  const previous = JSON.stringify(notesState.value)
  try {
    const result = await window.contapp.chooseNotesImport()
    if (result.status === 'cancelled') return
    const { next, summary } = mergeImportedNotes(notesState.value, toIncomingNotes(result.file, markdownToDocument))
    notesState.value = next; hasUnsavedNotes.value = true
    await saveNotes()
    error.value = ''
    notify('Notas importadas', summary.added + ' nueva(s), ' + summary.copied + ' como copia y ' + summary.skipped + ' ya existían.', 'success')
  } catch {
    notesState.value = JSON.parse(previous); hasUnsavedNotes.value = false
    error.value = 'No se importó nada. El archivo no es un respaldo válido, supera el máximo de 1000 notas o no se pudo guardar; tus notas no cambiaron.'
  } finally { isBusy.value = false }
}
/**
 * Menús contextuales del índice (2026-10-10, como el tablero de Tareas): clic derecho, Shift+F10 o la tecla de menú.
 * - Carpeta: Nueva nota aquí, Nueva subcarpeta (el modal por pasos con el padre ya elegido), Nueva tarea… (sólo si la
 *   sesión puede ver Tareas; el modal confirma con el Host que también puede crearlas) y Quitar carpeta (salvo General
 *   y las intermedias implícitas), que se confirma manteniendo presionado como el botón del renglón.
 * - Todas, Ancladas y Archivadas: Nueva nota (anclada desde Ancladas; desde Archivadas se crea activa en General).
 * Cada acción avisa en el centro de notificaciones. Al cerrar, el menú devuelve el foco al renglón que lo abrió.
 */
const indexMenu = ref<{ x: number; y: number; title: string; items: ContextMenuItem[] } | null>(null)
const quickTaskFolder = ref<string | null>(null)
const folderPendingRemoval = ref<string | null>(null)
function createNoteFromMenu(target: { folder: string; isPinned: boolean }): void {
  createNote(target)
  notify('Nota creada', 'En ' + target.folder.replaceAll('/', ' / ') + (target.isPinned ? ', anclada' : '') + '. Guárdala con Ctrl+S o Guardar nota.', 'success')
}
function openFolderMenu(folder: string, x: number, y: number): void {
  const items: ContextMenuItem[] = [
    { itemId: 'new-note', label: 'Nueva nota aquí', icon: FilePlus, onSelect: () => createNoteFromMenu({ folder, isPinned: false }) },
    { itemId: 'new-subfolder', label: 'Nueva subcarpeta', icon: FolderPlus, onSelect: () => { parentFolder.value = folder; isCreatingFolder.value = true } }
  ]
  if (workspaceAccess.value.canReadTasks) items.push({ itemId: 'new-task', label: 'Nueva tarea…', icon: ListTodo, onSelect: () => { quickTaskFolder.value = folder } })
  if (folder !== 'General' && notesState.value.folders.includes(folder)) items.push({ itemId: 'remove-folder', label: 'Quitar carpeta', icon: Trash2, tone: 'danger', group: 'Carpeta', onSelect: () => { folderPendingRemoval.value = folder } })
  indexMenu.value = { x, y, title: 'Carpeta ' + folder.replaceAll('/', ' / '), items }
}
function openViewMenu(menuView: NotesView, x: number, y: number): void {
  indexMenu.value = { x, y, title: describeView(menuView), items: [{ itemId: 'new-note', label: 'Nueva nota', icon: FilePlus, onSelect: () => createNoteFromMenu({ folder: 'General', isPinned: menuView === 'pinned' }) }] }
}
function confirmFolderRemoval(): void {
  const folder = folderPendingRemoval.value
  folderPendingRemoval.value = null
  if (folder) deleteFolder(folder)
}
// Pasar del directorio al documento (o volver) repite la entrada de los bloques de la vista.
watch(() => activeNote.value?.noteId ?? null, () => { void stageEntrance.play(() => pageElement.value) })
onMounted(async () => {
  void stageEntrance.play(() => pageElement.value)
  try { await loadNotes() } catch { error.value = 'No se pudieron leer las notas locales. No se sobrescribió ningún archivo.' }
})
onBeforeUnmount(() => stageEntrance.dispose())
</script>
<template>
  <section
    ref="pageElement"
    class="notes-page"
  >
    <p
      v-if="error"
      role="alert"
      class="tone-error notes-error"
    >
      {{ error }}
    </p>
    <template v-if="activeNote">
      <header class="document-header notes-stage">
        <div>
          <h1>{{ activeNote.title || 'Sin título' }}</h1>
        </div>
        <ActionButton @click="activeNoteId = null">
          <ArrowLeft
            :size="18"
            aria-hidden="true"
          />Volver al directorio
        </ActionButton>
      </header>
      <div class="note-document notes-stage">
        <div class="note-metadata">
          <label class="field">Título de nota<input
            v-model="activeNote.title"
            maxlength="200"
            @input="hasUnsavedNotes = true"
          ></label><label class="field">Ubicación<select
            v-model="activeNote.folder"
            @change="hasUnsavedNotes = true"
          ><option
            v-for="item in notesState.folders"
            :key="item"
          >{{ item }}</option></select></label>
        </div>
        <p class="route-strip">
          <span>Ruta: Raíz / {{ activeNote.folder }}</span><span>{{ textCount.wordCount }} palabras · {{ textCount.characterCount }} caracteres</span>
        </p>
        <NoteEditor
          ref="editorReference"
          :key="activeNote.noteId"
          :content="activeNote.content"
          @update="changeContent"
          @dirty="hasUnsavedNotes = true"
          @save="persist()"
        />
        <div class="actions form-footer">
          <ActionButton
            variant="primary"
            :is-loading="isBusy"
            @click="persist()"
          >
            Guardar nota
          </ActionButton><span
            role="status"
            class="field-help"
          >{{ hasUnsavedNotes ? 'Cambios sin guardar' : 'Guardado en este dispositivo' }}</span>
        </div>
      </div>
    </template>
    <template v-else>
      <header class="section-heading page-heading notes-stage">
        <div class="help-title-row">
          <h1>Directorio</h1>
          <HelpTip
            title="Notas de este equipo"
            text="Las notas son LOCALES: se guardan sólo en esta computadora y no se sincronizan con el Host ni con otros equipos. Para llevarlas a otra PC usa Exportar respaldo e Importar notas."
          />
        </div>
      </header>
      <!-- Barra común (ListToolbar), igual que en Clientes, Pagos y XML: la búsqueda filtra en vivo. -->
      <ListToolbar
        v-model:search="query"
        class="surface-panel toolbar-panel notes-stage"
        search-id="notes-search"
        search-label="Buscar notas"
        placeholder="Título, texto o carpeta"
        :filter-count="null"
      >
        <template #actions>
          <ActionButton
            :disabled="isBusy"
            @click="exportBackup"
          >
            <Download
              :size="16"
              aria-hidden="true"
            />Exportar respaldo
          </ActionButton><ActionButton
            :disabled="isBusy"
            @click="importNotes"
          >
            <Upload
              :size="16"
              aria-hidden="true"
            />Importar notas
          </ActionButton><ActionButton
            :aria-expanded="isCreatingFolder"
            @click="isCreatingFolder = !isCreatingFolder"
          >
            <FolderPlus
              :size="16"
              aria-hidden="true"
            />Carpeta
          </ActionButton><ActionButton
            variant="primary"
            @click="createNote()"
          >
            <Plus
              :size="16"
              aria-hidden="true"
            />Nueva nota
          </ActionButton>
        </template>
      </ListToolbar>
      <!-- Agregar una carpeta, en un modal de captura como el resto de altas. -->
      <FormModal
        :is-open="isCreatingFolder"
        title="Nueva carpeta"
        description="Elige dónde va y su nombre. Las notas no cambian de lugar."
        test-id="folder-modal"
        @close="closeFolderModal"
      >
        <form
          class="folder-form"
          @submit.prevent
        >
          <p
            v-if="folderError"
            role="alert"
            class="tone-error"
          >
            {{ folderError }}
          </p>
          <CaptureSteps
            v-model="folderStep"
            :steps="folderSteps"
            :review-items="folderReview"
            :validate="validateFolder"
            complete-label="Crear carpeta"
            @complete="createFolder"
          >
            <template #step-folder>
              <SelectField
                id="folder-parent"
                v-model="parentFolder"
                label="Dentro de"
                :options="parentOptions"
              />
              <label class="field">Nombre de carpeta<input
                v-model="folderName"
                maxlength="120"
                placeholder="Ej. 2026"
                autofocus
              ></label>
            </template>
            <template #footer-start>
              <ActionButton @click="closeFolderModal">
                Cancelar
              </ActionButton>
            </template>
          </CaptureSteps>
        </form>
      </FormModal>
      <div class="directory-body">
        <NotesFolderIndex
          :folders="notesState.folders"
          :notes="notesState.notes"
          :selected-view="view"
          @select="view = $event"
          @delete-folder="deleteFolder"
          @drop-note="moveNote"
          @open-folder-menu="openFolderMenu"
          @open-view-menu="openViewMenu"
        />
        <div class="directory-content notes-stage">
          <p class="directory-route">
            <span>Raíz / <strong>{{ viewTitle }}</strong></span><span>{{ visibleNotes.length }} documento(s)</span>
          </p>
          <NotesFileList
            :notes="visibleNotes"
            :empty-message="emptyMessage"
            :can-create="view !== 'archive'"
            @open="activeNoteId = $event"
            @toggle-pin="noteId => changeNote(noteId, note => { note.isPinned = !note.isPinned }, findNote(noteId)?.isPinned ? 'Nota desanclada' : 'Nota anclada')"
            @toggle-archive="noteId => changeNote(noteId, note => { note.isArchived = !note.isArchived }, findNote(noteId)?.isArchived ? 'Nota restaurada' : 'Nota archivada')"
            @remove="deleteNote"
            @create="createNote()"
          />
          <p class="field-help drag-hint">
            Arrastra un documento a una carpeta del índice para moverlo, o cambia su Ubicación al abrirlo.
          </p>
        </div>
      </div>
    </template>
    <ContextMenu
      :is-open="Boolean(indexMenu)"
      :x="indexMenu?.x ?? 0"
      :y="indexMenu?.y ?? 0"
      :title="indexMenu?.title ?? ''"
      :items="indexMenu?.items ?? []"
      @close="indexMenu = null"
    />
    <NoteQuickTaskModal
      :is-open="quickTaskFolder !== null"
      :folder-path="quickTaskFolder ?? ''"
      @close="quickTaskFolder = null"
    />
    <ConfirmDialog
      :is-open="folderPendingRemoval !== null"
      title="Quitar carpeta"
      hold-label="Mantén para quitar"
      @close="folderPendingRemoval = null"
      @confirm="confirmFolderRemoval"
    >
      <p>Se quitará la carpeta {{ (folderPendingRemoval ?? '').replaceAll('/', ' / ') }}. Sus notas pasan a General; ninguna se elimina.</p>
    </ConfirmDialog>
  </section>
</template>
<style scoped>
.notes-page { display: grid; gap: var(--spaceMedium); container-type: inline-size; }
.notes-page h1 { margin: 4px 0 0; }
.folder-form { display: grid; gap: var(--spaceMedium); }
.notes-page .toolbar-panel { margin-bottom: 0; }
.directory-body { display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); gap: var(--spaceMedium); align-items: start; }
.directory-content { display: grid; gap: 10px; min-width: 0; container-type: inline-size; }
.directory-route, .route-strip { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin: 0; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--mutedTextColor); }
.directory-route strong { color: var(--textColor); }
.drag-hint { margin: 0; }
.document-header { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--spaceMedium); padding-bottom: var(--spaceMedium); border-bottom: 1px solid var(--borderColor); }
.document-header h1 { overflow-wrap: anywhere; }
.route-strip { padding: 8px 12px; border: 2px solid var(--borderColor); background: var(--subtleColor); margin-bottom: var(--spaceMedium); border-radius: var(--radiusNested); }
@container (max-width: 980px) {
}
@container (max-width: 680px) {
  .directory-body { grid-template-columns: minmax(0, 1fr); }
}
</style>
