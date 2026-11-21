<script setup lang="ts">
import { ref } from 'vue'
import { Camera, KeyRound, LogOut } from '@lucide/vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { sessionExpiresAt, sessionUser, signOut } from '../workspace/sessionState'
import UserPhotoPicker from '../../shared/components/UserPhotoPicker.vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
import SettingsCard from '../settings/SettingsCard.vue'
import PasswordChangeCard from './PasswordChangeCard.vue'

/**
 * Configuración > Mi sesión. El inicio de sesión ocurre en la pantalla de acceso; aquí sólo se
 * consulta el límite y se cierran las sesiones propias. El token vive únicamente en Main.
 * Foto de perfil (2026-10-04): cada persona elige la suya; se ve en tareas, pagos e Inicio.
 * Estructura común (2026-10-10): encabezado de sección y tres tarjetas en orden de lectura: estado de la sesión,
 * foto de perfil, cambiar contraseña (`PasswordChangeCard`, 2026-10-17) y, al final, cerrar sesión (la acción que saca
 * a la persona del despacho).
 */
const isBusy = ref(false)
const error = ref('')
async function close(shouldCloseAll: boolean): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''
  try { await signOut(shouldCloseAll) }
  catch { error.value = 'Sesión cerrada en este equipo. No se pudo confirmar el cierre en el Host; las sesiones remotas conservan su caducidad.' }
  finally { isBusy.value = false }
}
</script>
<template>
  <section class="session-panel">
    <SettingsSectionHeader
      title="Mi sesión"
      description="Tu cuenta en este equipo: hasta cuándo dura la sesión, tu foto y cómo salir."
    />
    <div class="session-cards">
      <SettingsCard
        title="Estado de la sesión"
        :icon="KeyRound"
        description="El Host lleva la cuenta de cada sesión; este equipo no guarda tu contraseña."
        help-title="Límite de sesión"
        help-text="La sesión tiene una hora límite y además caduca tras 30 minutos sin actividad. Al vencer, Fiscenix vuelve a la pantalla de acceso sin perder lo guardado en el Host."
      >
        <InlineNotice
          title="Acceso al despacho"
          :tone="error ? 'error' : 'success'"
        >
          <p
            data-testid="session-status"
            :data-state="sessionUser ? 'authenticated' : 'signedOut'"
          >
            {{ error || (sessionUser ? 'Sesión de ' + sessionUser.displayName : 'Sin sesión.') }}
          </p>
          <p v-if="sessionExpiresAt">
            Límite de sesión: {{ new Date(sessionExpiresAt).toLocaleString('es-MX') }}. Caduca antes tras 30 minutos de inactividad.
          </p>
        </InlineNotice>
      </SettingsCard>
      <SettingsCard
        v-if="sessionUser"
        title="Foto de perfil"
        :icon="Camera"
        description="Se ve en tareas, pagos, Inicio y la barra superior de todos los equipos."
      >
        <UserPhotoPicker
          :user-id="sessionUser.userId"
          :display-name="sessionUser.displayName"
        />
      </SettingsCard>
      <PasswordChangeCard v-if="sessionUser" />
      <SettingsCard
        title="Cerrar sesión"
        :icon="LogOut"
        description="Cerrar todas tus sesiones también las cierra en los demás equipos. Reiniciar Fiscenix requiere volver a entrar."
      >
        <div class="actions">
          <ActionButton
            :disabled="isBusy"
            @click="close(false)"
          >
            <LogOut
              :size="16"
              aria-hidden="true"
            /> Cerrar sesión
          </ActionButton>
          <ActionButton
            :disabled="isBusy"
            @click="close(true)"
          >
            Cerrar todas mis sesiones
          </ActionButton>
        </div>
      </SettingsCard>
    </div>
  </section>
</template>
<style scoped>
.session-cards { display: grid; gap: var(--spaceMedium); }
.session-cards :deep(.inline-notice) { margin: 0; }
</style>
