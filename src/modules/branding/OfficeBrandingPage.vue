<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Building2, ImagePlus, Palette, RotateCcw, Trash2, Save } from '@lucide/vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
/**
 * Configuración › Despacho: nombre y logo GLOBAL del despacho. Estructura común (2026-10-10): encabezado de
 * sección con ayuda "?", el formulario en orden de lectura (nombre, logo, Guardar; la contraseña se pide en el diálogo único) y la vista previa.
 * Vista previa (2026-10-13, pedido del usuario): el boleto `TearTicket` de Vue Bits (ADR-025) con el logo y el nombre en el
 * cuerpo y "Fiscenix" en el talón. El talón se puede arrancar; "Volver a armar" lo repone cambiando la `key` del boleto.
 */
import ActionButton from '../../shared/components/ActionButton.vue'
import TearTicket from '../../shared/vueBits/TearTicket.vue'
import TextField from '../../shared/components/TextField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { useOfficeBranding } from './officeBrandingState'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import { sessionUser } from '../workspace/sessionState'
const { branding, refresh, apply } = useOfficeBranding()
const { notify } = useNotifications()
const officeName = ref('')
const logoDataUrl = ref<string | null>(null)
const canEdit = ref(false)
const isBusy = ref(false)
const error = ref('')
/** Vista previa: `ticketKey` vuelve a montar el boleto completo después de arrancar el talón. */
const ticketKey = ref(0), isTicketTorn = ref(false)
function rebuildTicket(): void { ticketKey.value += 1; isTicketTorn.value = false }
async function load(): Promise<void> {
  isBusy.value = true; error.value = ''; canEdit.value = false
  try {
    const installation = await window.contapp.getInstallationInformation()
    await refresh()
    officeName.value = branding.value.officeName; logoDataUrl.value = branding.value.logoDataUrl; canEdit.value = installation.activeMode === 'host'
  } catch { error.value = 'No se pudo leer la identidad del despacho. Revisa la conexión con el Host.' }
  finally { isBusy.value = false }
}
async function chooseLogo(): Promise<void> {
  isBusy.value = true
  try { const value = await window.contapp.chooseOfficeLogo(); if (value) logoDataUrl.value = value }
  catch { notify('No se pudo abrir el logo', 'Elige un PNG o JPEG de hasta 3 MB y 4096 píxeles por lado.', 'error') }
  finally { isBusy.value = false }
}
/**
 * La previsualización es un borrador: sólo guardar modifica la fila GLOBAL y la identidad de la aplicación.
 * Con sesión es zona crítica (ADR-038): el diálogo único pide la contraseña siempre; antes del primer administrador
 * no hay sesión y Main la guarda sin contraseña.
 */
async function save(): Promise<void> {
  isBusy.value = true; error.value = ''
  try {
    const branding = { officeName: officeName.value, logoDataUrl: logoDataUrl.value }
    const saved = sessionUser.value ? await withSensitiveConfirmation({ operation: 'branding.save', title: 'Guardar identidad del despacho' }, proof => window.contapp.saveOfficeBranding(branding, proof)) : await window.contapp.saveOfficeBranding(branding)
    if (!saved) return
    apply(saved)
    notify('Identidad actualizada', 'El nombre y el logo se guardaron en el Host.', 'success')
  } catch { error.value = 'No se pudo confirmar el guardado. Comprueba el Host y consulta la identidad antes de reintentar.' }
  finally { isBusy.value = false }
}
onMounted(load)
</script>
<template>
  <section>
    <SettingsSectionHeader
      title="Tu despacho, tu identidad."
      description="Una sola imagen para todo el equipo. El Host conserva el nombre y el logo del despacho."
      help-title="Identidad del despacho"
      help-text="El nombre y el logo son datos GLOBALES: se guardan en el Host y cada equipo los muestra en la barra superior y en el título de su ventana. Sólo se editan desde el equipo Host, con permiso de configuración del despacho."
    />
    <InlineNotice
      v-if="error"
      title="Identidad del despacho"
      tone="warning"
    >
      {{ error }}<div class="actions">
        <ActionButton
          :is-loading="isBusy"
          @click="load"
        >
          Reintentar
        </ActionButton>
      </div>
    </InlineNotice>
    <div class="branding-layout">
      <!-- Orden de lectura (2026-10-10): nombre → logo → Guardar (la contraseña se pide en el diálogo, ADR-038). -->
      <form
        class="surface-panel configuration-form"
        @submit.prevent="save"
      >
        <div class="branding-card-heading">
          <h2>
            <Palette
              :size="18"
              aria-hidden="true"
            /> Identidad visual
          </h2>
          <p class="field-help">
            {{ canEdit ? 'Cambia el nombre o el logo; la vista previa muestra cómo se verá antes de guardar.' : 'Identidad compartida del despacho. Se administra desde el Host.' }}
          </p>
        </div>
        <TextField
          id="office-name"
          v-model="officeName"
          label="Nombre del despacho"
          :disabled="!canEdit || isBusy"
          help="Hasta 80 caracteres. Se muestra junto al logo."
        />
        <div class="actions">
          <ActionButton
            :disabled="!canEdit"
            :is-loading="isBusy"
            @click="chooseLogo"
          >
            <ImagePlus
              :size="18"
              aria-hidden="true"
            /> Elegir logo
          </ActionButton>
          <ActionButton
            :disabled="!canEdit || !logoDataUrl || isBusy"
            @click="logoDataUrl = null"
          >
            <Trash2
              :size="18"
              aria-hidden="true"
            /> Quitar logo
          </ActionButton>
        </div>
        <p class="field-help">
          PNG o JPEG · hasta 3 MB. Conservamos su proporción y transparencia.
        </p>
        <div class="form-footer">
          <ActionButton
            variant="primary"
            type="submit"
            :disabled="!canEdit || !officeName.trim()"
            :is-loading="isBusy"
          >
            <Save
              :size="18"
              aria-hidden="true"
            /> Guardar identidad
          </ActionButton>
        </div>
      </form>
      <aside
        class="surface-panel branding-preview"
        aria-label="Vista previa del logo"
      >
        <h2 class="preview-title">
          Vista previa
        </h2>
        <TearTicket
          :key="ticketKey"
          class="identity-ticket"
          :width="460"
          :height="200"
          :stub-size="140"
          aria-label="Arrancar el talón de la vista previa"
          @tear="isTicketTorn = true"
        >
          <div class="ticket-body">
            <div class="logo-preview">
              <img
                v-if="logoDataUrl"
                :src="logoDataUrl"
                alt="Logo del despacho"
              ><Building2
                v-else
                :size="48"
                aria-hidden="true"
              />
            </div>
            <div class="ticket-identity">
              <h2>{{ officeName || 'Tu despacho' }}</h2>
              <p class="field-help">
                Espacio de trabajo
              </p>
            </div>
          </div>
          <template #stub>
            <div class="ticket-stub">
              <strong>Fiscenix</strong><span aria-hidden="true">N.º 0001</span>
            </div>
          </template>
        </TearTicket>
        <ActionButton
          v-if="isTicketTorn"
          class="ticket-rebuild"
          @click="rebuildTicket"
        >
          <RotateCcw
            :size="16"
            aria-hidden="true"
          /> Volver a armar
        </ActionButton>
      </aside>
    </div>
  </section>
</template>
<style scoped>
.branding-card-heading { display: grid; gap: 4px; }
.branding-card-heading h2 { display: inline-flex; align-items: center; gap: 10px; margin: 0; }
/* Contenido del boleto (TearTicket): logo y nombre a la izquierda; el talón lleva la marca de la app, en mayúsculas. */
.identity-ticket { margin: 16px auto 0; text-align: left; }
.ticket-body { display: flex; align-items: center; gap: 16px; height: 100%; padding: 0 24px; box-sizing: border-box; }
.ticket-body .logo-preview { width: 96px; height: 96px; margin: 0; flex-shrink: 0; background: var(--surfaceColor); }
.ticket-identity { min-width: 0; }
.ticket-identity h2 { margin: 0; font-size: 22px; line-height: 1.1; overflow-wrap: anywhere; }
.ticket-identity .field-help { margin: 6px 0 0; }
.ticket-stub { display: flex; flex-direction: column; justify-content: space-between; height: 100%; padding: 28px 20px; box-sizing: border-box; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--mutedTextColor); }
.ticket-stub strong { font-size: 17px; letter-spacing: 0; text-transform: none; color: var(--textColor); }
.ticket-rebuild { margin-top: 16px; }
</style>
