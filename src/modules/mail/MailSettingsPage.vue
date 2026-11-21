<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from 'vue'
import { AtSign, FileText, Image as ImageIcon, Inbox, PenLine, PlugZap, RefreshCw } from '@lucide/vue'
import EmailField from '../../shared/components/EmailField.vue'
import TextField from '../../shared/components/TextField.vue'
import SettingsSectionHeader from '../settings/SettingsSectionHeader.vue'
import SettingsCard from '../settings/SettingsCard.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import FormModal from '../../shared/components/FormModal.vue'
import ConfirmDialog from '../../shared/components/ConfirmDialog.vue'
import MailAccountForm from './MailAccountForm.vue'
import MailDomainCard from './MailDomainCard.vue'
import MailHtmlEditor from './MailHtmlEditor.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useOfficeBranding } from '../branding/officeBrandingState'
import { workspaceAccess } from '../workspace/sessionState'
import { mailProviderPresets, type MailAccountStatus, type MailTemplateKind, type MailTemplates } from '../../../shared/contracts/mail'
import { renderMailText, type MailDocument } from '../../../shared/mail/mailDocument'

/**
 * Configuración › Correo ([[MAIL]]). Dos cosas con dueños distintos:
 * - **Tu cuenta en este equipo** (LOCAL por usuario + equipo): vincular por pasos, probar la conexión y desvincular.
 *   La contraseña de aplicación se sella en Main y nunca vuelve a la vista.
 * - **Entrega y spam** (`MailDomainCard`): revisa SPF, DKIM y DMARC del dominio de tu cuenta.
 * - **Plantillas del despacho** (GLOBAL, Host): cuerpo por defecto y firma de la empresa. Las edita quien administra el
 *   despacho (`office.manage`); el resto las ve y las usa al redactar.
 */
const { notify } = useNotifications()
const { branding, refresh: refreshBranding } = useOfficeBranding()
const account = ref<MailAccountStatus>({ account: null, savedAt: null })
const templates = ref<MailTemplates | null>(null)
const isLoading = ref(false), isTesting = ref(false), isSaving = ref(false), isAccountFormOpen = ref(false), isAccountFormBusy = ref(false), isUnlinkOpen = ref(false)
const error = ref('')
const editingKind = ref<MailTemplateKind | null>(null), draft = ref<MailDocument | null>(null)
const templateTitles: Record<MailTemplateKind, string> = { body: 'Cuerpo por defecto', signature: 'Firma de la empresa' }

const providerLabel = computed(() => { const provider = account.value.account?.provider; return !provider ? '' : provider === 'custom' ? 'SMTP ' + account.value.account!.host : mailProviderPresets[provider].label })
const savedAtLabel = computed(() => account.value.savedAt ? new Date(account.value.savedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '')
/** Resumen en texto de una plantilla para la tarjeta (las primeras líneas). */
function summarize(document: MailDocument): string { const text = renderMailText(document, null).trim(); return text.length > 180 ? text.slice(0, 180) + '…' : text || 'Vacía' }

async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  // Por separado: quien sólo administra el despacho (sin `mail.send`) edita plantillas aunque no pueda tener cuenta.
  const [accountResult, templateResult] = await Promise.allSettled([window.contapp.manageMailAccount({ action: 'read' }), window.contapp.manageMail({ action: 'readTemplates' })])
  if (accountResult.status === 'fulfilled') account.value = accountResult.value.account
  else if (workspaceAccess.value.canSendMail) error.value = readIpcErrorMessage(accountResult.reason, 'No se pudo leer tu cuenta de correo de este equipo.')
  if (templateResult.status === 'fulfilled' && templateResult.value.status === 'templates') { templates.value = templateResult.value.templates; defaultRecipientDraft.value = templateResult.value.templates.defaultRecipient ?? ''; logoUrlDraft.value = templateResult.value.templates.logoUrl ?? '' }
  else if (templateResult.status === 'rejected') error.value = readIpcErrorMessage(templateResult.reason, 'No se pudieron leer las plantillas del Host. Revisa la conexión.')
  isLoading.value = false
  void refreshBranding().catch(() => undefined)
}
async function testConnection(): Promise<void> {
  isTesting.value = true
  try { await window.contapp.manageMailAccount({ action: 'test' }); notify('Conexión correcta', 'El servidor de correo aceptó tu cuenta.', 'success') }
  catch (caught) { notify('La conexión falló', readIpcErrorMessage(caught, 'No se pudo conectar con el servidor de correo.'), 'error') }
  finally { isTesting.value = false }
}
async function unlink(): Promise<void> {
  isTesting.value = true
  try { account.value = (await window.contapp.manageMailAccount({ action: 'delete' })).account; notify('Cuenta desvinculada', 'Se borró de este equipo. Para enviar correos, vincula una de nuevo.', 'success') }
  catch (caught) { notify('No se desvinculó', readIpcErrorMessage(caught, 'No se pudo borrar la cuenta de este equipo.'), 'error') }
  finally { isTesting.value = false; isUnlinkOpen.value = false }
}
function accountSaved(status: MailAccountStatus): void {
  account.value = status; isAccountFormOpen.value = false
  notify('Cuenta vinculada', 'La conexión funcionó y la cuenta quedó guardada en este equipo.', 'success')
}
function openTemplate(kind: MailTemplateKind): void { if (templates.value) { editingKind.value = kind; draft.value = templates.value[kind] } }
/**
 * Correo principal del despacho (2026-10-18, GLOBAL): el redactor lo agrega a todos los correos y se puede quitar en
 * cada uno. Vacío lo quita. Lo guarda quien administra el despacho.
 */
const defaultRecipientDraft = ref(''), isSavingDefaultRecipient = ref(false)
async function saveDefaultRecipient(): Promise<void> {
  isSavingDefaultRecipient.value = true
  try {
    const value = defaultRecipientDraft.value.trim()
    const result = await window.contapp.manageMail({ action: 'saveDefaultRecipient', defaultRecipient: value || null })
    if (result.status === 'templates') { templates.value = result.templates; defaultRecipientDraft.value = result.templates.defaultRecipient ?? '' }
    notify('Correo principal guardado', value ? value + ' se agregará a todos los correos.' : 'Los correos ya no llevan un destinatario predeterminado.', 'success')
  } catch (caught) { notify('Correo principal no guardado', readIpcErrorMessage(caught, 'Revisa el correo y tu permiso de administrar el despacho.'), 'error') }
  finally { isSavingDefaultRecipient.value = false }
}
/**
 * URL pública del logo de los correos (2026-10-19, GLOBAL): con ella el logo se enlaza y no llega como adjunto. Debe
 * ser `https://` y abrir la imagen directamente (por ejemplo, la del sitio web del despacho). Vacía la quita.
 */
const logoUrlDraft = ref(''), isSavingLogoUrl = ref(false)
const logoUrlError = computed(() => { const value = logoUrlDraft.value.trim(); return value && !/^https:\/\/[^\s<>"'()\\]+$/i.test(value) ? 'Escribe una dirección que empiece con https:// (sin espacios).' : '' })
async function saveLogoUrl(): Promise<void> {
  if (logoUrlError.value) return
  isSavingLogoUrl.value = true
  try {
    const value = logoUrlDraft.value.trim()
    const result = await window.contapp.manageMail({ action: 'saveLogoUrl', logoUrl: value || null })
    if (result.status === 'templates') { templates.value = result.templates; logoUrlDraft.value = result.templates.logoUrl ?? '' }
    notify('Logo de los correos guardado', value ? 'Los correos enlazan el logo desde esa dirección; ya no va como adjunto.' : 'Sin URL: el logo del despacho va incrustado en el correo.', 'success')
  } catch (caught) { notify('URL del logo no guardada', readIpcErrorMessage(caught, 'Revisa la dirección y tu permiso de administrar el despacho.'), 'error') }
  finally { isSavingLogoUrl.value = false }
}
async function saveTemplate(): Promise<void> {
  if (!editingKind.value || !draft.value) return
  isSaving.value = true
  try {
    const result = await window.contapp.manageMail({ action: 'saveTemplate', kind: editingKind.value, document: toRaw(draft.value) })
    if (result.status === 'templates') templates.value = result.templates
    notify('Plantilla guardada', templateTitles[editingKind.value] + ' se guardó en el Host para todo el despacho.', 'success')
    editingKind.value = null
  } catch (caught) { notify('Plantilla no guardada', readIpcErrorMessage(caught, 'No se pudo guardar la plantilla.'), 'error') }
  finally { isSaving.value = false }
}
onMounted(load)
</script>

<template>
  <section data-testid="mail-settings">
    <SettingsSectionHeader
      title="Correo a clientes"
      description="Tu cuenta para enviar desde este equipo y las plantillas del despacho."
      help-title="Cómo funciona el correo"
      help-text="Cada persona vincula su propia cuenta (Gmail, Yahoo, Outlook o SMTP) en su equipo; la contraseña de aplicación queda cifrada ahí y nunca va al Host. El cuerpo por defecto y la firma son del despacho: los guarda el Host y los usa todo el equipo."
    />
    <InlineNotice
      v-if="error"
      title="Correo no disponible"
      tone="warning"
    >
      <p>{{ error }}</p>
      <div class="actions">
        <ActionButton
          :is-loading="isLoading"
          @click="load"
        >
          Reintentar
        </ActionButton>
      </div>
    </InlineNotice>
    <div class="mail-settings-grid">
      <SettingsCard
        v-if="workspaceAccess.canSendMail"
        title="Tu cuenta en este equipo"
        :icon="AtSign"
        description="La cuenta con la que salen tus correos. Es tuya y de este equipo: otra persona o equipo vincula la suya."
        data-testid="mail-account-card"
      >
        <dl
          v-if="account.account"
          class="mail-account-facts"
        >
          <div><dt>Remitente</dt><dd>{{ account.account.senderName }} &lt;{{ account.account.emailAddress }}&gt;</dd></div>
          <div><dt>Proveedor</dt><dd>{{ providerLabel }}</dd></div>
          <div><dt>Vinculada</dt><dd>{{ savedAtLabel }}</dd></div>
        </dl>
        <p
          v-else
          class="field-help"
        >
          {{ isLoading ? 'Consultando…' : 'Sin cuenta vinculada. Vincula una para enviar correos a tus clientes.' }}
        </p>
        <div class="actions">
          <ActionButton
            :variant="account.account ? 'secondary' : 'primary'"
            :disabled="isLoading || isTesting"
            @click="isAccountFormOpen = true"
          >
            <PlugZap
              :size="16"
              aria-hidden="true"
            /> {{ account.account ? 'Cambiar cuenta' : 'Vincular cuenta' }}
          </ActionButton>
          <ActionButton
            v-if="account.account"
            :is-loading="isTesting"
            @click="testConnection"
          >
            <RefreshCw
              :size="16"
              aria-hidden="true"
            /> Probar conexión
          </ActionButton>
          <ActionButton
            v-if="account.account"
            variant="danger"
            :disabled="isTesting"
            @click="isUnlinkOpen = true"
          >
            Desvincular
          </ActionButton>
        </div>
      </SettingsCard>
      <MailDomainCard v-if="workspaceAccess.canSendMail && account.account" />
      <SettingsCard
        v-for="kind in (['body', 'signature'] as const)"
        :key="kind"
        :title="templateTitles[kind]"
        :icon="kind === 'body' ? FileText : PenLine"
        :description="kind === 'body' ? 'El texto con el que empieza cada correo. {cliente}, {documento}, {despacho} y {usuario} se reemplazan al redactar.' : 'Va debajo de cada correo; puede llevar el logo del despacho y {usuario}, el nombre de quien envía.'"
        :data-testid="'mail-template-' + kind"
      >
        <p class="mail-template-summary">
          {{ templates ? summarize(templates[kind]) : 'Consultando…' }}
        </p>
        <div class="actions">
          <ActionButton
            :disabled="!templates"
            @click="openTemplate(kind)"
          >
            {{ templates?.canEdit ? 'Editar' : 'Ver' }}
          </ActionButton>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Correo principal del despacho"
        :icon="Inbox"
        description="Opcional. Se agrega como destinatario en todos los correos; en cada correo se puede quitar."
        data-testid="mail-default-recipient"
      >
        <form
          v-if="templates?.canEdit"
          class="mail-default-recipient-form"
          @submit.prevent="saveDefaultRecipient"
        >
          <EmailField
            id="mail-default-recipient"
            v-model="defaultRecipientDraft"
            label="Correo principal"
            help="Déjalo vacío para no agregar ninguno."
          />
          <div class="actions">
            <ActionButton
              type="submit"
              variant="primary"
              :is-loading="isSavingDefaultRecipient"
            >
              Guardar correo principal
            </ActionButton>
          </div>
        </form>
        <p
          v-else
          class="mail-template-summary"
        >
          {{ templates?.defaultRecipient || 'Sin correo principal.' }}
        </p>
      </SettingsCard>
      <SettingsCard
        title="Logo en los correos"
        :icon="ImageIcon"
        description="Opcional. Con una dirección pública del logo, los correos la enlazan y el logo ya no llega como archivo adjunto. Sin ella, va incrustado."
        data-testid="mail-logo-url"
      >
        <form
          v-if="templates?.canEdit"
          class="mail-default-recipient-form"
          novalidate
          @submit.prevent="saveLogoUrl"
        >
          <TextField
            id="mail-logo-url"
            v-model="logoUrlDraft"
            label="URL del logo"
            autocomplete="off"
            :error="logoUrlError"
            help="Por ejemplo https://www.tudespacho.mx/logo.png. Debe abrir la imagen directamente. Vacía para incrustar el logo."
          />
          <div class="actions">
            <ActionButton
              type="submit"
              variant="primary"
              :is-loading="isSavingLogoUrl"
              :disabled="Boolean(logoUrlError)"
            >
              Guardar URL del logo
            </ActionButton>
          </div>
        </form>
        <p
          v-else
          class="mail-template-summary"
        >
          {{ templates?.logoUrl || 'Sin URL: el logo va incrustado.' }}
        </p>
        <!-- Sin URL el logo viaja dentro del correo y Outlook o algunos celulares lo muestran como archivo adjunto. -->
        <InlineNotice
          v-if="templates && !templates.logoUrl"
          title="El logo llegará como archivo"
          tone="warning"
        >
          <p>Sin una URL pública, Outlook y algunos celulares muestran el logo como archivo adjunto. Sube el logo a tu sitio web y guarda aquí su dirección. En una firma con estilo, el logo debe estar escrito como {logo}; una imagen pegada dentro del HTML no se puede enlazar.</p>
        </InlineNotice>
      </SettingsCard>
    </div>
    <FormModal
      :is-open="isAccountFormOpen"
      :title="account.account ? 'Cambiar cuenta de correo' : 'Vincular cuenta de correo'"
      description="Fiscenix prueba la conexión antes de guardarla."
      :is-busy="isAccountFormBusy"
      test-id="mail-account-modal"
      @close="isAccountFormOpen = false"
    >
      <MailAccountForm
        v-if="isAccountFormOpen"
        :current="account.account"
        :default-sender-name="branding.officeName"
        @saved="accountSaved"
        @cancel="isAccountFormOpen = false"
        @busy="isAccountFormBusy = $event"
      />
    </FormModal>
    <FormModal
      :is-open="Boolean(editingKind)"
      :title="editingKind ? templateTitles[editingKind] : ''"
      :description="templates?.canEdit ? 'Se guarda en el Host para todo el despacho.' : 'Sólo quien administra el despacho puede cambiarla.'"
      :is-busy="isSaving"
      test-id="mail-template-modal"
      @close="editingKind = null"
    >
      <form
        v-if="editingKind && draft"
        class="mail-template-form"
        @submit.prevent="saveTemplate"
      >
        <MailHtmlEditor
          v-model="draft"
          :label="templateTitles[editingKind]"
          :purpose="editingKind === 'signature' ? 'signature' : 'body'"
          :logo-data-url="branding.logoDataUrl"
          :is-template="true"
          :is-disabled="!templates?.canEdit || isSaving"
        />
        <div class="actions form-footer">
          <ActionButton
            v-if="templates?.canEdit"
            type="submit"
            variant="primary"
            :is-loading="isSaving"
          >
            Guardar plantilla
          </ActionButton>
          <ActionButton
            :disabled="isSaving"
            @click="editingKind = null"
          >
            {{ templates?.canEdit ? 'Cancelar' : 'Cerrar' }}
          </ActionButton>
        </div>
      </form>
    </FormModal>
    <ConfirmDialog
      :is-open="isUnlinkOpen"
      title="Desvincular cuenta de correo"
      :is-loading="isTesting"
      confirm-label="Desvincular"
      @close="isUnlinkOpen = false"
      @confirm="unlink"
    >
      <p>Se borra la cuenta y su contraseña de este equipo. Tus correos ya enviados no cambian.</p>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.mail-settings-grid { columns: 2 340px; column-gap: var(--spaceLarge); }
.mail-settings-grid > * { break-inside: avoid; margin-bottom: var(--spaceLarge); }
.mail-account-facts { display: grid; gap: 6px; margin: 0 0 var(--spaceMedium); }
.mail-account-facts div { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; }
.mail-account-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); align-self: center; }
.mail-account-facts dd { margin: 0; overflow-wrap: anywhere; }
.mail-template-summary { margin: 0 0 var(--spaceMedium); white-space: pre-line; color: var(--mutedTextColor); font-size: 13px; }
.mail-template-form, .mail-default-recipient-form { display: grid; gap: var(--spaceMedium); }
</style>
