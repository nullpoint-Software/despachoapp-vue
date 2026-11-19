<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { maximumTaskTitleLength } from '../../../shared/contracts/tasks'
import { getOfficeToday } from '../../../shared/contracts/movements'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import FormModal from '../../shared/components/FormModal.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import TextField from '../../shared/components/TextField.vue'
import DateField from '../../shared/components/DateField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { formatTaskFolio } from '../tasks/taskLabels'

/**
 * "Nueva tarea…" desde el menú contextual de una carpeta de Notas (2026-10-10): alta rápida de una tarea del despacho
 * (dato GLOBAL del Host) sin salir de Notas. Por pasos, como toda alta (ADR-034): Tarea (título y fecha límite
 * opcional) → Revisar.
 * - Al abrir consulta al Host si la sesión puede crear tareas (`manageTasks` `list`, que devuelve las capacidades y el
 *   usuario actual, igual que el tablero). Sin `tasks.create` se avisa y no se ofrece crear. El Host vuelve a validar
 *   todo al crear.
 * - La tarea se crea sin cliente, sin descripción y asignada a quien la crea (permitido aun sin `tasks.assign`).
 * - El resultado se avisa con el folio en el centro de notificaciones; las notas no cambian.
 */
const props = defineProps<{ isOpen: boolean; folderPath: string }>()
const emit = defineEmits<{ close: [] }>()
const { notify } = useNotifications()
const title = ref(''), dueDate = ref(''), error = ref(''), currentStep = ref(0)
const isChecking = ref(false), isSaving = ref(false), canCreate = ref(false), currentUserId = ref('')
const steps = [{ stepId: 'task', title: 'Tarea' }]
const reviewItems = computed(() => [
  { label: 'Título', value: title.value.trim() },
  { label: 'Fecha límite', value: dueDate.value ? formatBusinessDate(dueDate.value) : 'Sin fecha límite' },
  { label: 'Responsable', value: 'Tú' }
])

watch(() => props.isOpen, async isOpen => {
  if (!isOpen) return
  title.value = ''; dueDate.value = ''; error.value = ''; currentStep.value = 0; canCreate.value = false
  isChecking.value = true
  try {
    const result = await window.contapp.manageTasks({ action: 'list', filter: { scope: 'mine', clientId: null, completedSince: getOfficeToday() } })
    if (result.status === 'listed') { canCreate.value = result.capabilities.canCreate; currentUserId.value = result.currentUserId }
    if (!canCreate.value) error.value = 'Tu usuario no tiene permiso para crear tareas. Pídelo a quien administra el despacho.'
  } catch { error.value = 'No se pudo consultar el despacho. Revisa la conexión con el Host e inténtalo de nuevo.' }
  finally { isChecking.value = false }
})

function validateStep(): boolean {
  error.value = ''
  if (!title.value.trim() || title.value.trim().length > maximumTaskTitleLength) error.value = 'Escribe un título de hasta ' + maximumTaskTitleLength + ' caracteres.'
  return !error.value
}
async function createTask(): Promise<void> {
  if (!canCreate.value || isSaving.value) return
  if (!validateStep()) { currentStep.value = 0; return }
  isSaving.value = true
  try {
    const result = await window.contapp.manageTasks({
      action: 'create',
      draft: { title: title.value.trim(), description: '', clientId: null, dueDate: dueDate.value || null },
      assigneeUserIds: [currentUserId.value]
    })
    if (result.status === 'saved') notify('Tarea creada', formatTaskFolio(result.task.folio) + ' · ' + result.task.title, 'success')
    emit('close')
  } catch { error.value = 'No se creó la tarea. Revisa tus permisos o la conexión con el Host.' }
  finally { isSaving.value = false }
}
</script>
<template>
  <FormModal
    :is-open="isOpen"
    title="Nueva tarea"
    :description="'Desde la carpeta ' + folderPath.replaceAll('/', ' / ') + '. Se te asigna a ti; complétala después en Tareas.'"
    :is-busy="isSaving"
    test-id="note-quick-task-modal"
    @close="emit('close')"
  >
    <form
      class="quick-task-form"
      @submit.prevent
    >
      <InlineNotice
        v-if="error"
        title="Revisa la tarea"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <CaptureSteps
        v-model="currentStep"
        :steps="steps"
        :review-items="reviewItems"
        :validate="validateStep"
        :is-busy="isSaving || isChecking"
        :can-complete="canCreate"
        complete-label="Crear tarea"
        @complete="createTask"
      >
        <template #step-task>
          <TextField
            id="note-quick-task-title"
            v-model="title"
            label="Título de la tarea"
          />
          <DateField
            id="note-quick-task-due-date"
            v-model="dueDate"
            label="Fecha límite (opcional)"
            placeholder="Sin fecha límite"
            is-clearable
          />
        </template>
        <template #footer-start>
          <ActionButton @click="emit('close')">
            Cancelar
          </ActionButton>
        </template>
      </CaptureSteps>
    </form>
  </FormModal>
</template>
<style scoped>
.quick-task-form { display: grid; gap: var(--spaceMedium); }
</style>
