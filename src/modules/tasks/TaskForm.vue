<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { maximumTaskDescriptionLength, maximumTaskTitleLength, type Task, type TaskDraft } from '../../../shared/contracts/tasks'
import TextField from '../../shared/components/TextField.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import DateField from '../../shared/components/DateField.vue'
import { formatBusinessDate } from '../../../shared/presentation/movementLabels'
import CheckField from '../../shared/components/CheckField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'

/**
 * Captura y edición del contenido de una tarea, por pasos (ADR-034: toda alta va por pasos y termina en Revisar):
 * 1. Tarea: título y descripción.
 * 2. Cliente y fecha: cliente opcional, fecha límite y, al crear, asignármela.
 * Sólo valida para orientar; el Host vuelve a validar todo, incluida la escritura sobre el contribuyente elegido.
 * Al crear, quien no puede asignar a otros sólo puede asignarse a sí mismo.
 */
const props = defineProps<{ task: Task | null; clientOptions: { clientId: string; label: string }[]; isBusy: boolean }>()
const emit = defineEmits<{ submit: [value: { draft: TaskDraft; shouldAssignSelf: boolean }]; cancel: [] }>()
const title = ref(''), description = ref(''), clientLabel = ref(''), dueDate = ref(''), shouldAssignSelf = ref(false), error = ref('')
const currentStep = ref(0)
const labels = computed(() => props.clientOptions.map(option => option.label))
const steps = [{ stepId: 'task', title: 'Tarea' }, { stepId: 'assignment', title: 'Cliente y fecha' }]
watch(() => props.task, task => {
  title.value = task?.title ?? ''; description.value = task?.description ?? ''; dueDate.value = task?.dueDate ?? ''
  clientLabel.value = task ? props.clientOptions.find(option => option.clientId === task.clientId)?.label ?? task.clientDisplayName ?? '' : ''
  shouldAssignSelf.value = false; error.value = ''; currentStep.value = 0
}, { immediate: true })

/** Contribuyente elegido; al editar se conserva el actual aunque no esté entre los de escritura. */
function resolveClientId(): string | null | undefined {
  if (!clientLabel.value.trim()) return null
  return props.clientOptions.find(option => option.label === clientLabel.value)?.clientId ?? (props.task && clientLabel.value === props.task.clientDisplayName ? props.task.clientId : undefined)
}
function validateStep(index: number): boolean {
  error.value = ''
  if (index === 0 && (!title.value.trim() || title.value.length > maximumTaskTitleLength)) error.value = 'Escribe un título de hasta ' + maximumTaskTitleLength + ' caracteres.'
  else if (index === 0 && description.value.length > maximumTaskDescriptionLength) error.value = 'La descripción admite hasta ' + maximumTaskDescriptionLength + ' caracteres.'
  else if (index === 1 && resolveClientId() === undefined) error.value = 'Elige un cliente de la lista o deja el campo vacío para una tarea del despacho.'
  return !error.value
}
const reviewItems = computed(() => [
  { label: 'Título', value: title.value.trim() },
  { label: 'Descripción', value: description.value.trim() },
  { label: 'Cliente', value: clientLabel.value.trim() || 'Del despacho' },
  { label: 'Fecha límite', value: dueDate.value ? formatBusinessDate(dueDate.value) : '' },
  ...(props.task ? [] : [{ label: 'Asignarme', value: shouldAssignSelf.value ? 'Sí' : 'No' }])
])
function submit(): void {
  if (![0, 1].every(index => { const isValid = validateStep(index); if (!isValid) currentStep.value = index; return isValid })) return
  emit('submit', { draft: { title: title.value.trim(), description: description.value.trim(), clientId: resolveClientId() ?? null, dueDate: dueDate.value || null }, shouldAssignSelf: shouldAssignSelf.value })
}
</script>
<template>
  <form
    class="task-form"
    data-testid="task-form"
    @submit.prevent
  >
    <!-- El título lo da el FormModal que lo contiene (TasksPage). -->
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
      :is-busy="isBusy"
      :complete-label="task ? 'Guardar cambios' : 'Crear tarea'"
      @complete="submit"
    >
      <template #step-task>
        <TextField
          id="task-title"
          v-model="title"
          label="Título"
        />
        <div class="field">
          <label for="task-description">Descripción</label>
          <textarea
            id="task-description"
            v-model="description"
            rows="4"
            :maxlength="maximumTaskDescriptionLength"
          />
        </div>
      </template>
      <template #step-assignment>
        <AutocompleteField
          id="task-client"
          v-model="clientLabel"
          label="Cliente (opcional)"
          :options="labels"
          :disabled="isBusy"
          help="Vacío para una tarea del despacho. Sólo aparecen clientes con lectura y escritura."
        />
        <DateField
          id="task-due-date"
          v-model="dueDate"
          label="Fecha límite (opcional)"
          placeholder="Sin fecha límite"
          is-clearable
        />
        <CheckField
          v-if="!task"
          id="task-assign-self"
          v-model="shouldAssignSelf"
          label="Asignarme esta tarea"
        />
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isBusy"
          @click="emit('cancel')"
        >
          Cancelar
        </ActionButton>
      </template>
    </CaptureSteps>
  </form>
</template>
<style scoped>
.task-form { display: grid; gap: var(--spaceMedium); }
.task-form textarea { width: 100%; resize: vertical; min-height: 96px; }
</style>
