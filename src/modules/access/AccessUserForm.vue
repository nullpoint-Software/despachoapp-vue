<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { permissionKeys, type AccessUser, type AccessRole, type AccessRequest, type PermissionKey } from '../../../shared/contracts/access'
import { permissionLabels } from './permissionLabels'
import TextField from '../../shared/components/TextField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import PasswordSuggestion from '../../shared/components/PasswordSuggestion.vue'

/**
 * Alta y edición de un usuario por pasos (ADR-034). Al crear: Cuenta → Contraseña → Revisar (la cuenta nace sin
 * roles). Al editar: Cuenta (nombre, estado y contraseña opcional) → Roles → Excepciones → Revisar.
 * La contraseña nunca aparece en la revisión y se borra después de enviar. El Host vuelve a validar todo.
 */
const props = defineProps<{ user: AccessUser | null; roles: AccessRole[]; revision: number; isBusy: boolean }>()
const emit = defineEmits<{ save: [request: AccessRequest]; cancel: [] }>()
const username = ref(''), displayName = ref(''), password = ref(''), error = ref('')
const isActive = ref(true), roleIds = ref<string[]>([])
const currentStep = ref(0)
// Derivado del catálogo: agregar permisos no requiere mantener otra lista en el formulario.
const effects = ref(Object.fromEntries(permissionKeys.map(permissionKey => [permissionKey, ''])) as Record<PermissionKey, string>)
const options = [{ value: '', label: 'Heredar de roles' }, { value: 'allow', label: 'Permitir' }, { value: 'deny', label: 'Denegar' }]
const steps = computed(() => props.user
  ? [{ stepId: 'account', title: 'Cuenta' }, { stepId: 'roles', title: 'Roles' }, { stepId: 'overrides', title: 'Excepciones' }]
  : [{ stepId: 'account', title: 'Cuenta' }, { stepId: 'password', title: 'Contraseña' }])
/** Reinicia el borrador al elegir usuario; borra la contraseña después de enviar o salir. */
watch(() => props.user, user => {
  username.value = user?.username ?? ''; displayName.value = user?.displayName ?? ''; password.value = ''; error.value = ''; currentStep.value = 0
  isActive.value = user?.isActive ?? true; roleIds.value = [...(user?.roleIds ?? [])]
  for (const key of permissionKeys) effects.value[key] = user?.overrides.find(item => item.permissionKey === key)?.effect ?? ''
}, { immediate: true })
function validateStep(index: number): boolean {
  error.value = ''
  const stepId = steps.value[index]?.stepId
  if (stepId === 'account' && !props.user && !username.value.trim()) error.value = 'Escribe el nombre de usuario.'
  else if (stepId === 'account' && !displayName.value.trim()) error.value = 'Escribe el nombre para mostrar.'
  const needsPassword = stepId === 'password' || (stepId === 'account' && props.user && password.value)
  if (!error.value && needsPassword && (password.value.length < 8 || password.value.length > 128)) error.value = 'La contraseña debe tener de 8 a 128 caracteres.'
  return !error.value
}
const reviewItems = computed(() => props.user
  ? [
      { label: 'Usuario', value: username.value },
      { label: 'Nombre para mostrar', value: displayName.value.trim() },
      { label: 'Estado', value: isActive.value ? 'Activo' : 'Inactivo' },
      { label: 'Contraseña', value: password.value ? 'Se cambiará' : 'Sin cambio' },
      { label: 'Roles', value: props.roles.filter(role => roleIds.value.includes(role.roleId)).map(role => role.displayName).join(', ') || 'Ninguno' },
      { label: 'Excepciones', value: permissionKeys.filter(key => effects.value[key]).map(key => permissionLabels[key] + ': ' + (effects.value[key] === 'allow' ? 'permitir' : 'denegar')).join('; ') || 'Ninguna' }
    ]
  : [
      { label: 'Usuario', value: username.value.trim() },
      { label: 'Nombre para mostrar', value: displayName.value.trim() },
      { label: 'Contraseña', value: 'Capturada (no se muestra)' },
      { label: 'Roles', value: 'Se asignan después de guardar' }
    ])
function submit(): void {
  for (let index = 0; index < steps.value.length; index++) if (!validateStep(index)) { currentStep.value = index; return }
  if (props.user) emit('save', { action: 'updateUser', revision: props.revision, userId: props.user.userId, displayName: displayName.value, isActive: isActive.value, password: password.value, roleIds: [...roleIds.value], overrides: permissionKeys.flatMap(permissionKey => effects.value[permissionKey] ? [{ permissionKey, effect: effects.value[permissionKey] as 'allow' | 'deny' }] : []) })
  else emit('save', { action: 'createUser', revision: props.revision, username: username.value, displayName: displayName.value, password: password.value })
  password.value = ''
}
onBeforeUnmount(() => { password.value = '' })
</script>
<template>
  <form
    class="access-form"
    data-testid="access-user-form"
    @submit.prevent
  >
    <!-- El título lo da el FormModal de AccessPanel. -->
    <InlineNotice
      v-if="error"
      title="Revisa el usuario"
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
      complete-label="Guardar usuario"
      @complete="submit"
    >
      <template #step-account>
        <TextField
          id="access-username"
          v-model="username"
          label="Nombre de usuario"
          :disabled="isBusy || Boolean(user)"
        />
        <TextField
          id="access-display-name"
          v-model="displayName"
          label="Nombre para mostrar"
          :disabled="isBusy"
        />
        <template v-if="user">
          <label class="check-field"><input
            v-model="isActive"
            type="checkbox"
            :disabled="isBusy"
          > Usuario activo</label>
          <TextField
            id="access-password"
            v-model="password"
            label="Nueva contraseña (opcional)"
            type="password"
            help="De 8 a 128 caracteres. Se borra después de enviar."
            :disabled="isBusy"
          />
        </template>
      </template>
      <template #step-password>
        <TextField
          id="access-password"
          v-model="password"
          label="Contraseña inicial"
          type="password"
          help="De 8 a 128 caracteres. Se borra después de enviar."
          :disabled="isBusy"
        />
        <PasswordSuggestion
          :disabled="isBusy"
          @use="value => password = value"
        />
      </template>
      <template #step-roles>
        <fieldset :disabled="isBusy">
          <legend>Roles del usuario</legend>
          <label
            v-for="role in roles"
            :key="role.roleId"
            class="access-choice"
          ><input
            v-model="roleIds"
            type="checkbox"
            :value="role.roleId"
          > {{ role.displayName }}</label>
          <p
            v-if="!roles.length"
            class="field-help"
          >
            No hay roles creados.
          </p>
        </fieldset>
      </template>
      <template #step-overrides>
        <fieldset :disabled="isBusy">
          <legend>Excepciones individuales</legend>
          <p class="field-help">
            Denegar prevalece sobre los roles. Heredar elimina la excepción.
          </p>
          <SelectField
            v-for="key in permissionKeys"
            :id="'override-' + key"
            :key="key"
            v-model="effects[key]"
            :label="permissionLabels[key]"
            :options="options"
            :disabled="isBusy"
          />
        </fieldset>
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
fieldset { min-width: 0; display: grid; gap: .75rem; margin: 0; border: 2px solid var(--borderColor); padding: 1rem; }
legend { padding: 0 6px; font-weight: 700; }
.access-choice { display: flex; align-items: center; gap: .5rem; min-height: 40px; overflow-wrap: anywhere; }
</style>
