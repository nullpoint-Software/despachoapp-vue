<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import type { AccessSnapshot, AccessUser, AccessRole, AccessRequest } from '../../../shared/contracts/access'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import FormModal from '../../shared/components/FormModal.vue'
import AccessUserForm from './AccessUserForm.vue'
import AccessRoleForm from './AccessRoleForm.vue'
import UserAvatar from '../../shared/components/UserAvatar.vue'
import UserPhotoPicker from '../../shared/components/UserPhotoPicker.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { Camera, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserPlus, UsersRound } from '@lucide/vue'
import SwipeRow, { type SwipeAction } from '../../shared/vueBits/SwipeRow.vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
import SettingsCard from '../settings/SettingsCard.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
/**
 * Configuración › Usuarios y accesos (estructura del 2026-10-10): encabezado común con la ayuda de roles y
 * permisos, la tarjeta "Consulta de accesos" y, ya leídos, dos tarjetas con lista deslizable (2026-10-13, como
 * Clientes): Usuarios (foto, nombre, usuario y estado) y Roles (rol y número de capacidades). Las acciones se revelan
 * arrastrando el renglón o con su ⋯ ("Acciones de <usuario|rol>"): Foto y Editar para usuarios; Editar y Eliminar
 * para roles. Activar o desactivar una cuenta sigue en su formulario de edición. Los nombres accesibles de las
 * acciones ("Editar usuario …", "Editar rol …", "Eliminar rol …", "Foto de …") se conservan.
 */
const { notify } = useNotifications()
const snapshot = ref<AccessSnapshot | null>(null), isBusy = ref(false), error = ref('')
const editor = ref<'user' | 'role' | null>(null), user = ref<AccessUser | null>(null), role = ref<AccessRole | null>(null)
/** Foto de perfil de otra persona (2026-10-04): el Host exige users.manage, igual que la ContaApp anterior. */
const photoTarget = ref<AccessUser | null>(null)
let isMounted = true
/**
 * Sin sondeos que sobrescriban borradores: Host compara revisión; un fallo exige recargar antes de editar.
 * Todo cambio es zona crítica (ADR-038): el diálogo único pide la contraseña siempre; cancelarlo deja el formulario
 * abierto. El DTO debe seguir siendo plano: contextBridge rechaza proxies reactivos de Vue.
 */
async function run(request: AccessRequest): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''
  try {
    const result = request.action === 'list' ? await window.contapp.administerAccess(request)
      : await withSensitiveConfirmation({ operation: 'access.manage', title: 'Confirmar cambio de acceso', description: 'El cambio afecta al acceso al despacho. Desactivar una cuenta o cambiar su contraseña cierra sus sesiones. Los roles asignados no pueden eliminarse.' }, proof => window.contapp.administerAccess(request, proof))
    if (!isMounted || !result) return
    snapshot.value = result; editor.value = null; user.value = null; role.value = null
    if (request.action !== 'list') notify('Acceso actualizado', 'Los cambios se guardaron en el Host.', 'success')
  } catch {
    if (isMounted) { snapshot.value = null; editor.value = null; error.value = 'No se pudo confirmar la operación. Actualiza la lista antes de reintentar. Revisa tu sesión, permisos, nombres únicos y que quede un administrador activo. Si otro equipo modificó el acceso, revisa sus cambios.' }
  } finally { if ('password' in request) request.password = ''; isBusy.value = false }
}
function editUser(value: AccessUser | null): void { user.value = value; editor.value = 'user' }
function editRole(value: AccessRole | null): void { role.value = value; editor.value = 'role' }
function propose(request: AccessRequest): void { void run(request) }
/** Acciones del renglón de usuario; deshabilitadas mientras el Host responde, como los botones anteriores. */
function userActions(item: AccessUser): SwipeAction[] {
  return [
    { actionId: 'photo', label: 'Foto', icon: Camera, isDisabled: isBusy.value, accessibleName: 'Foto de ' + item.username, onSelect: () => { photoTarget.value = item } },
    { actionId: 'edit', label: 'Editar', icon: Pencil, isDisabled: isBusy.value, accessibleName: 'Editar usuario ' + item.username, onSelect: () => { editUser(item) } }
  ]
}
/** Eliminar un rol pasa por `run`, que pide la contraseña con el diálogo único (ADR-038); el Host rechaza roles asignados. */
function roleActions(item: AccessRole): SwipeAction[] {
  return [
    { actionId: 'edit', label: 'Editar', icon: Pencil, isDisabled: isBusy.value, accessibleName: 'Editar rol ' + item.displayName, onSelect: () => { editRole(item) } },
    { actionId: 'delete', label: 'Eliminar', icon: Trash2, tone: 'danger', isDisabled: isBusy.value, accessibleName: 'Eliminar rol ' + item.displayName, onSelect: () => { if (snapshot.value) propose({ action: 'deleteRole', roleId: item.roleId, revision: snapshot.value.revision }) } }
  ]
}
onBeforeUnmount(() => { isMounted = false; snapshot.value = null })
</script>
<template>
  <section
    class="access-panel"
    data-testid="access-panel"
  >
    <SettingsSectionHeader
      title="Usuarios y accesos"
      description="Cuentas, roles y permisos del despacho. Los cambios los aplica el Host."
      help-title="Roles y permisos"
      help-text="Un rol es un conjunto de capacidades (por ejemplo, registrar pagos o administrar equipos). Cada usuario recibe uno o varios roles y el Host revisa sus permisos en cada operación, aunque la pantalla muestre el botón. Guardar un cambio pide tu contraseña."
      :links="snapshot ? [{ targetId: 'access-users', label: 'Usuarios' }, { targetId: 'access-roles', label: 'Roles' }] : []"
    />
    <!-- 1. Consulta: nada se lee del Host hasta pedirlo, para no sobrescribir un borrador con datos de otro equipo. -->
    <SettingsCard
      title="Consulta de accesos"
      :icon="RefreshCw"
      description="Lee las cuentas y los roles vigentes del Host. Requiere permisos de usuarios y roles; debe quedar al menos un administrador activo con los permisos esenciales."
    >
      <div class="actions">
        <ActionButton
          :is-loading="isBusy"
          @click="run({ action: 'list' })"
        >
          Actualizar accesos
        </ActionButton>
      </div>
    </SettingsCard>
    <InlineNotice
      v-if="error"
      title="Acceso no actualizado"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <!-- 2. Usuarios y roles en tarjetas propias, cada una con su lista de renglones deslizables (sin scroll horizontal). -->
    <div
      v-if="snapshot"
      class="access-columns"
    >
      <SettingsCard
        id="access-users"
        class="access-users-card"
        tabindex="-1"
        :title="'Usuarios · ' + snapshot.users.length"
        :icon="UsersRound"
        description="Cuentas que inician sesión en el despacho. Desactivar una cuenta o cambiar su contraseña cierra sus sesiones."
      >
        <template #actions>
          <ActionButton
            :disabled="isBusy"
            @click="editUser(null)"
          >
            <UserPlus
              :size="16"
              aria-hidden="true"
            /> Nuevo usuario
          </ActionButton>
        </template>
        <!-- Renglones deslizables como Clientes: arrastrar o ⋯ revela Foto y Editar. -->
        <ul
          class="access-list"
          aria-label="Usuarios"
          data-testid="access-users-list"
        >
          <li
            v-for="item in snapshot.users"
            :key="item.userId"
          >
            <SwipeRow
              :label="item.username"
              :actions="userActions(item)"
            >
              <div class="access-row">
                <UserAvatar
                  :user-id="item.userId"
                  :display-name="item.displayName"
                  is-decorative
                />
                <span class="access-identity">
                  <strong>{{ item.displayName }}</strong>
                  <span class="access-username">{{ item.username }}</span>
                </span>
                <StatusBadge :tone="item.isActive ? 'success' : 'neutral'">
                  {{ item.isActive ? 'Activo' : 'Inactivo' }}
                </StatusBadge>
              </div>
            </SwipeRow>
          </li>
        </ul>
      </SettingsCard>
      <SettingsCard
        id="access-roles"
        class="access-roles-card"
        tabindex="-1"
        :title="'Roles · ' + snapshot.roles.length"
        :icon="ShieldCheck"
        description="Capacidades que el Host concede a quien tenga cada rol. Un rol asignado no se puede eliminar."
      >
        <template #actions>
          <ActionButton
            :disabled="isBusy"
            @click="editRole(null)"
          >
            <Plus
              :size="16"
              aria-hidden="true"
            /> Nuevo rol
          </ActionButton>
        </template>
        <!-- Renglones deslizables como Clientes: arrastrar o ⋯ revela Editar y Eliminar. -->
        <ul
          class="access-list"
          aria-label="Roles"
          data-testid="access-roles-list"
        >
          <li
            v-for="item in snapshot.roles"
            :key="item.roleId"
          >
            <SwipeRow
              :label="item.displayName"
              :actions="roleActions(item)"
            >
              <div class="access-row">
                <span class="access-identity">
                  <strong>{{ item.displayName }}</strong>
                  <span class="access-username">{{ item.permissions.length }} capacidades</span>
                </span>
              </div>
            </SwipeRow>
          </li>
        </ul>
      </SettingsCard>
      <FormModal
        :is-open="Boolean(photoTarget)"
        title="Foto de perfil"
        :description="photoTarget?.displayName"
        test-id="user-photo-modal"
        @close="photoTarget = null"
      >
        <UserPhotoPicker
          v-if="photoTarget"
          :user-id="photoTarget.userId"
          :display-name="photoTarget.displayName"
        />
      </FormModal>
      <!-- Alta y edición de usuarios y roles en un modal de captura, como el asistente del original. -->
      <FormModal
        :is-open="editor !== null"
        :title="editor === 'role' ? (role ? 'Editar rol' : 'Nuevo rol') : (user ? 'Editar usuario' : 'Nuevo usuario')"
        :description="editor === 'role' ? 'Capacidades que el Host concede a quien tenga este rol.' : 'Identidad, acceso y roles de la cuenta. Guardar pedirá tu contraseña.'"
        :is-busy="isBusy"
        test-id="access-modal"
        @close="editor = null"
      >
        <AccessUserForm
          v-if="editor === 'user'"
          :user="user"
          :roles="snapshot.roles"
          :revision="snapshot.revision"
          :is-busy="isBusy"
          @save="propose"
          @cancel="editor = null"
        />
        <AccessRoleForm
          v-else
          :role="role"
          :revision="snapshot.revision"
          :is-busy="isBusy"
          @save="propose"
          @cancel="editor = null"
        />
      </FormModal>
    </div>
  </section>
</template>
<style scoped>
.access-panel { display: grid; gap: var(--spaceMedium); }
.access-panel > :deep(.settings-section-header) { margin-bottom: var(--spaceSmall); }
/* Usuarios (7 columnas) y roles (5) lado a lado; por el ancho real del contenido se apilan (escalado de Windows). */
.access-columns { container-type: inline-size; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--spaceMedium); align-items: start; }
.access-columns > .access-users-card { grid-column: span 7; }
.access-columns > .access-roles-card { grid-column: span 5; }
.access-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
/* min-width: 0 en todo el renglón: los nombres largos se parten y nunca generan desplazamiento horizontal. */
.access-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.access-identity { display: grid; flex: 1; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.access-identity strong { font-size: 15px; font-weight: 600; }
.access-username { font-family: var(--monoFontFamily); font-size: 13px; color: var(--mutedTextColor); overflow-wrap: anywhere; }
@container (max-width: 980px) {
  .access-columns > .access-users-card, .access-columns > .access-roles-card { grid-column: 1 / -1; }
}
</style>
