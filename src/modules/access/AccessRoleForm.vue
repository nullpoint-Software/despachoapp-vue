<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { permissionKeys, type PermissionKey, type AccessRole, type AccessRequest } from '../../../shared/contracts/access'
import { permissionLabels } from './permissionLabels'
import TextField from '../../shared/components/TextField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'

/**
 * Alta y edición de un rol por pasos (ADR-034): Rol (nombre) → Permisos → Revisar.
 * Editar un rol afecta a sus miembros; se envían sólo capacidades seleccionadas explícitamente.
 */
const props = defineProps<{ role: AccessRole | null; revision: number; isBusy: boolean }>()
const emit = defineEmits<{ save: [request: AccessRequest]; cancel: [] }>()
const displayName = ref(''), permissions = ref<PermissionKey[]>([]), error = ref('')
const currentStep = ref(0)
const steps = [{ stepId: 'role', title: 'Rol' }, { stepId: 'permissions', title: 'Permisos' }]
watch(() => props.role, role => { displayName.value = role?.displayName ?? ''; permissions.value = [...(role?.permissions ?? [])]; error.value = ''; currentStep.value = 0 }, { immediate: true })
function validateStep(index: number): boolean {
  error.value = index === 0 && !displayName.value.trim() ? 'Escribe el nombre del rol.' : ''
  return !error.value
}
const reviewItems = computed(() => [
  { label: 'Nombre del rol', value: displayName.value.trim() },
  { label: 'Permisos', value: permissions.value.map(key => permissionLabels[key]).join(', ') || 'Ninguno' }
])
function submit(): void {
  if (!validateStep(0)) { currentStep.value = 0; return }
  emit('save', { action: 'saveRole', revision: props.revision, roleId: props.role?.roleId ?? null, displayName: displayName.value, permissions: [...permissions.value] })
}
</script>
<template>
  <form
    class="access-form"
    data-testid="access-role-form"
    @submit.prevent
  >
    <!-- El título lo da el FormModal de AccessPanel. -->
    <InlineNotice
      v-if="error"
      title="Revisa el rol"
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
      complete-label="Guardar rol"
      @complete="submit"
    >
      <template #step-role>
        <TextField
          id="access-role-name"
          v-model="displayName"
          label="Nombre del rol"
          :disabled="isBusy"
        />
        <p class="field-help">
          Los cambios se aplican a todos los usuarios que tengan este rol.
        </p>
      </template>
      <template #step-permissions>
        <div class="access-permissions">
          <label
            v-for="key in permissionKeys"
            :key="key"
            class="access-choice"
          ><input
            v-model="permissions"
            type="checkbox"
            :value="key"
            :disabled="isBusy"
          > {{ permissionLabels[key] }}</label>
        </div>
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isBusy"
          @click="emit('cancel')"
        >
          Cancelar edición
        </ActionButton>
      </template>
    </CaptureSteps>
  </form>
</template>
<style scoped>
.access-form { display: grid; gap: var(--spaceMedium); }
.access-permissions { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 2px 16px; max-height: min(50dvh, 420px); overflow-y: auto; }
.access-choice { display: flex; align-items: center; gap: .5rem; min-height: 40px; }
</style>
