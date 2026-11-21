<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import type { ClientIdentity, ClientResult, ClientRequest } from '../../../shared/contracts/clients'
import ActionButton from '../../shared/components/ActionButton.vue'
import AutocompleteField from '../../shared/components/AutocompleteField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
/**
 * Accesos de un cliente, dentro del modal de captura de ClientsPage (pulido 2026-10-04: toda acción de agregar usa el
 * modal de "Nuevo pago"). Arriba quién tiene acceso; abajo el formulario para dar, cambiar o retirar acceso, que
 * pide la contraseña del usuario antes de enviarse. El Host vuelve a verificar permisos, usuario y revisión.
 */
const props = defineProps<{ client: ClientIdentity }>()
const emit = defineEmits<{ close: [] }>()
const state = ref<ClientResult | null>(null), isBusy = ref(false), error = ref(''), userLabel = ref(''), access = ref('readOnly')
let isMounted = true
/** Por pasos (ADR-034): Acceso (usuario y tipo) → Revisar; al aplicar se pide la contraseña. */
const assignmentStep = ref(0)
const assignmentSteps = [{ stepId: 'access', title: 'Acceso' }]
const assignmentReview = computed(() => [{ label: 'Cliente', value: props.client.displayName }, { label: 'Usuario', value: userLabel.value }, { label: 'Tipo de acceso', value: accessOptions.find(option => option.value === access.value)?.label ?? '' }])
function validateAssignment(): boolean {
  const index = userOptions.value.indexOf(userLabel.value)
  const user = state.value?.users?.[index]
  error.value = !user || (!user.isActive && access.value !== 'remove') ? 'Selecciona un usuario de la lista. A un usuario inactivo sólo puedes retirarle acceso.' : ''
  return !error.value
}
const userOptions = computed(() => (state.value?.users ?? []).map(user => `${user.displayName} · ${user.username}${user.isActive ? '' : ' (inactivo)'}`))
const accessOptions = [{ value: 'readOnly', label: 'Solo lectura' }, { value: 'readWrite', label: 'Lectura y escritura' }, { value: 'remove', label: 'Retirar acceso' }]
function name(userId: string): string { const user = state.value?.users?.find(item => item.userId === userId); return user ? `${user.displayName} · ${user.username}` : 'Usuario no disponible' }
/**
 * Recarga tras confirmar, nunca reenvía la escritura ante respuesta perdida. DTO plano para Electron.
 * Asignar es zona crítica (ADR-038): el diálogo único pide la contraseña siempre; cancelarlo conserva lo capturado.
 */
async function run(request: ClientRequest): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''
  try {
    const result = request.action === 'assign'
      ? await withSensitiveConfirmation({ operation: 'clients.assign', title: 'Confirmar asignación', description: `${userLabel.value} · ${accessOptions.find(option => option.value === access.value)?.label ?? ''} · ${props.client.displayName}` }, proof => window.contapp.manageClients(request, proof))
      : await window.contapp.manageClients(request)
    if (!result) return
    const current = request.action === 'assign' ? await window.contapp.manageClients({ action: 'inspectAssignments', clientId: props.client.clientId }) : result
    // Sólo una asignación confirmada limpia el borrador; consultar la lista no borra lo que se está capturando.
    if (isMounted) { state.value = current; if (request.action === 'assign') { userLabel.value = ''; assignmentStep.value = 0 } }
  } catch { if (isMounted) { state.value = null; error.value = 'No se pudo confirmar el acceso. Actualiza antes de reintentar: pudo cambiar la revisión, el usuario o tus permisos.' } }
  finally { isBusy.value = false }
}
function propose(): void {
  const index = userOptions.value.indexOf(userLabel.value)
  const user = state.value?.users?.[index]
  if (!user || !state.value?.assignmentTarget || (!user.isActive && access.value !== 'remove')) { error.value = 'Selecciona un usuario de la lista. A un usuario inactivo sólo puedes retirarle acceso.'; return }
  void run({ action: 'assign', clientId: props.client.clientId, revision: state.value.assignmentTarget.revision, userId: user.userId, access: access.value === 'remove' ? null : access.value === 'readWrite' ? 'readWrite' : 'readOnly' })
}
onMounted(() => { void run({ action: 'inspectAssignments', clientId: props.client.clientId }) })
onBeforeUnmount(() => { isMounted = false; state.value = null })
</script>
<template>
  <section
    class="client-assignments"
    data-testid="client-assignments"
  >
    <InlineNotice
      v-if="error"
      title="Asignación no confirmada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <div
      v-if="state"
      class="assignment-current"
    >
      <h3>Con acceso</h3>
      <ul class="assignment-list">
        <li
          v-for="item in state.assignments"
          :key="item.userId"
        >
          {{ name(item.userId) }} — {{ item.access === 'readWrite' ? 'Lectura y escritura' : 'Solo lectura' }}
        </li>
      </ul>
      <p
        v-if="!state.assignments.length"
        class="field-help"
      >
        Sin usuarios asignados.
      </p>
    </div>
    <form
      v-if="state"
      class="assignment-form"
      @submit.prevent
    >
      <CaptureSteps
        v-model="assignmentStep"
        :steps="assignmentSteps"
        :review-items="assignmentReview"
        :validate="validateAssignment"
        :is-busy="isBusy"
        complete-label="Aplicar asignación"
        @complete="propose"
      >
        <template #step-access>
          <AutocompleteField
            id="assignment-user"
            v-model="userLabel"
            label="Usuario para asignar"
            :options="userOptions"
            :disabled="isBusy"
          />
          <SelectField
            id="assignment-access"
            v-model="access"
            label="Tipo de acceso"
            :options="accessOptions"
            :disabled="isBusy"
          />
          <p class="field-help">
            La asignación se combina con los permisos del usuario. Solo lectura impide editar la ficha.
          </p>
        </template>
        <template #footer-start>
          <ActionButton
            :disabled="isBusy"
            @click="emit('close')"
          >
            Cerrar
          </ActionButton>
        </template>
      </CaptureSteps>
    </form>
  </section>
</template>
<style scoped>
.client-assignments { display: grid; gap: var(--spaceLarge); }
.assignment-current { display: grid; gap: 8px; }
.assignment-current h3 { font-size: 14px; }
.assignment-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; overflow-wrap: anywhere; }
.assignment-list li { padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--surfaceColor); font-size: 14px; font-weight: 600; }
.assignment-form { display: grid; gap: var(--spaceMedium); }
</style>
