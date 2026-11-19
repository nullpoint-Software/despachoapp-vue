<script setup lang="ts">
import { computed, ref } from 'vue'
import { SlidersHorizontal, Monitor, Palette, ShieldCheck, UserRound, DatabaseBackup, Mail } from '@lucide/vue'
import SettingsPage from './SettingsPage.vue'
import InstallationPage from '../installation/InstallationPage.vue'
import OfficeBrandingPage from '../branding/OfficeBrandingPage.vue'
import AccessPanel from '../access/AccessPanel.vue'
import BackupPanel from '../backups/BackupPanel.vue'
import MailSettingsPage from '../mail/MailSettingsPage.vue'
import SessionPanel from '../installation/SessionPanel.vue'
import { deviceMode, sessionUser, workspaceAccess } from '../workspace/sessionState'

/**
 * Configuración, al pie del menú como "Ajustes" en el sistema original. Reúne lo que antes estaba
 * repartido: preferencias del equipo, la instalación (que se hizo una vez y aquí se modifica),
 * identidad del despacho, usuarios y accesos, y la sesión propia. La "Referencia visual" se retiró el 2026-10-04 (ya no se necesita).
 * Las secciones administrativas sólo aparecen si el Host concede el permiso; el Host lo vuelve a exigir.
 * "Respaldos" (7.2) sólo existe en el equipo Host: la carpeta y la clave son de ese equipo.
 * "Correo" (2026-10-17, [[MAIL]]): la cuenta propia en este equipo (`mail.send`) y las plantillas del despacho.
 *
 * Estructura común de las secciones (2026-10-10, [[changes/SETTINGS-STRUCTURE-HELP]]): cada sección empieza con
 * `SettingsSectionHeader` (título, ayuda "?", una línea y, si es larga, el índice "En esta sección"); los ajustes
 * van en `SettingsCard` (icono + título + una línea + controles) y lo avanzado o riesgoso al final en un
 * `SettingsGroup` separado. Cada sección arma su propio encabezado; esta página sólo elige cuál se ve.
 */
type ConfigurationSection = 'preferences' | 'device' | 'office' | 'mail' | 'access' | 'backups' | 'session'
const props = withDefaults(defineProps<{ initialSection?: ConfigurationSection }>(), { initialSection: 'preferences' })
const sections = computed(() => [
  { key: 'preferences' as const, title: 'Preferencias', icon: SlidersHorizontal, isVisible: true },
  { key: 'device' as const, title: 'Este equipo', icon: Monitor, isVisible: true },
  { key: 'office' as const, title: 'Despacho', icon: Palette, isVisible: workspaceAccess.value.canManageOffice },
  { key: 'mail' as const, title: 'Correo', icon: Mail, isVisible: workspaceAccess.value.canSendMail || workspaceAccess.value.canManageOffice },
  { key: 'access' as const, title: 'Usuarios y accesos', icon: ShieldCheck, isVisible: workspaceAccess.value.canManageAccess },
  { key: 'backups' as const, title: 'Respaldos', icon: DatabaseBackup, isVisible: workspaceAccess.value.canManageBackups && deviceMode.value === 'host' },
  { key: 'session' as const, title: 'Mi sesión', icon: UserRound, isVisible: true }
].filter(section => section.isVisible))
const selected = ref<ConfigurationSection>(props.initialSection)
const current = computed(() => sections.value.some(section => section.key === selected.value) ? selected.value : 'preferences')
</script>

<template>
  <div
    class="configuration-page"
    data-testid="configuration-page"
  >
    <nav
      v-sliding-tabs
      class="configuration-tabs segmented-tabs"
      aria-label="Secciones de configuración"
    >
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="configuration-tab"
        :aria-current="current === section.key ? 'page' : undefined"
        @click="selected = section.key"
      >
        <component
          :is="section.icon"
          :size="17"
          aria-hidden="true"
        /> {{ section.title }}
      </button>
    </nav>
    <!-- Cada pestaña entra con la misma revelación breve que las páginas (v-motion, movimiento reducido). -->
    <div
      :key="current"
      v-motion="'reveal'"
      class="configuration-panel"
    >
      <SettingsPage v-if="current === 'preferences'" />
      <InstallationPage
        v-else-if="current === 'device'"
        context="settings"
      />
      <OfficeBrandingPage v-else-if="current === 'office'" />
      <MailSettingsPage v-else-if="current === 'mail'" />
      <AccessPanel
        v-else-if="current === 'access'"
        :key="sessionUser?.userId"
      />
      <BackupPanel
        v-else-if="current === 'backups'"
        @open-section="selected = $event"
      />
      <SessionPanel v-else />
    </div>
  </div>
</template>

<style scoped>
/* Pestañas centradas en la página (2026-10-06, pedido del usuario: botones centrados); al envolver, cada renglón también se centra. */
.configuration-tabs { display: flex; justify-content: center; width: fit-content; max-width: 100%; margin: 0 auto var(--spaceLarge); }
.configuration-tab { display: inline-flex; align-items: center; gap: 8px; }
</style>
