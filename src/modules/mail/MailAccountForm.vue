<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'
import EmailField from '../../shared/components/EmailField.vue'
import PasswordField from '../../shared/components/PasswordField.vue'
import SelectField from '../../shared/components/SelectField.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { mailProviderPresets, mailProviders, parseMailAccountSettings, type MailAccountSettings, type MailAccountStatus, type MailProvider } from '../../../shared/contracts/mail'

/**
 * Vincular una cuenta de correo en este equipo ([[MAIL]]), por pasos (ADR-034): Proveedor → Cuenta → Revisar.
 * Sin client IDs de OAuth, la conexión es SMTP con contraseña de aplicación; cada proveedor explica cómo generarla.
 * "Probar y vincular" manda la cuenta a Main, que prueba la conexión (`verify()`) y sólo si responde la sella en este
 * equipo. La contraseña se borra del formulario al terminar, salga bien o mal.
 */
const props = defineProps<{ current: MailAccountSettings | null; defaultSenderName: string }>()
const emit = defineEmits<{ saved: [status: MailAccountStatus]; cancel: []; busy: [isBusy: boolean] }>()

const providerHelp: Record<MailProvider, { title: string; steps: string }> = {
  gmail: { title: 'Contraseña de aplicación de Google', steps: 'Activa la verificación en dos pasos en myaccount.google.com → Seguridad. Después entra a "Contraseñas de aplicaciones", crea una para "Fiscenix" y pega aquí las 16 letras. Tu contraseña normal de Google no funciona.' },
  yahoo: { title: 'Contraseña de aplicación de Yahoo', steps: 'En login.yahoo.com → Información de la cuenta → Seguridad de la cuenta, elige "Generar contraseña de aplicación", ponle "Fiscenix" y pega aquí la clave que te muestra.' },
  outlook: { title: 'Contraseña de aplicación de Microsoft', steps: 'Activa la verificación en dos pasos en account.microsoft.com → Seguridad → Opciones de seguridad avanzadas y crea una "Contraseña de aplicación". Microsoft está retirando el acceso SMTP con contraseña en algunas cuentas de Outlook.com: si la prueba falla con una contraseña correcta, usa otra cuenta o el SMTP de tu dominio.' },
  office365: { title: 'Microsoft 365 del despacho', steps: 'El administrador de Microsoft 365 debe permitir "SMTP autenticado" en tu buzón. Con verificación en dos pasos, crea una contraseña de aplicación en Mi cuenta → Información de seguridad; si no, usa la contraseña del buzón.' },
  custom: { title: 'Servidor SMTP de tu proveedor', steps: 'Copia el servidor, el puerto y el tipo de cifrado de la ayuda de tu hosting o proveedor. Fiscenix exige una conexión cifrada: TLS (puerto 465) o STARTTLS (puerto 587).' }
}
const providerOptions = mailProviders.map(provider => ({ provider, label: provider === 'custom' ? 'Otro proveedor (SMTP)' : mailProviderPresets[provider].label }))

const provider = ref<MailProvider>(props.current?.provider ?? 'gmail')
const senderName = ref(props.current?.senderName ?? props.defaultSenderName)
const emailAddress = ref(props.current?.emailAddress ?? '')
const username = ref(props.current?.username ?? '')
const password = ref('')
const host = ref(props.current?.provider === 'custom' ? props.current.host : '')
const port = ref(props.current?.provider === 'custom' ? String(props.current.port) : '587')
const security = ref(props.current?.provider === 'custom' && props.current.isSecure ? 'tls' : 'starttls')
const securityOptions = [{ value: 'starttls', label: 'STARTTLS (normalmente puerto 587)' }, { value: 'tls', label: 'TLS desde el inicio (normalmente puerto 465)' }]
const isUsernameEdited = ref(Boolean(props.current && props.current.username !== props.current.emailAddress))
// El usuario SMTP sigue al correo mientras la persona no lo cambie.
watch(emailAddress, value => { if (!isUsernameEdited.value) username.value = value })
watch(security, value => { if (port.value === '587' || port.value === '465') port.value = value === 'tls' ? '465' : '587' })

const isWorking = ref(false), error = ref(''), currentStep = ref(0)
const steps = [{ stepId: 'provider', title: 'Proveedor' }, { stepId: 'account', title: 'Cuenta' }]

/** Datos de conexión: los del preajuste o, en "Otro", los capturados. La validación final es la del contrato. */
const settings = computed(() => {
  const preset = provider.value === 'custom' ? { host: host.value.trim(), port: Number(port.value), isSecure: security.value === 'tls' } : mailProviderPresets[provider.value]
  return { provider: provider.value, senderName: senderName.value, emailAddress: emailAddress.value, host: preset.host, port: preset.port, isSecure: preset.isSecure, username: username.value.trim() }
})
function validateAccount(): string {
  if (!senderName.value.trim()) return 'Escribe el nombre que verán tus clientes como remitente.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.value)) return 'Escribe el correo de la cuenta.'
  if (!password.value) return 'Pega la contraseña de aplicación.'
  if (provider.value === 'custom' && (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host.value.trim()) || !/^\d{1,5}$/.test(port.value) || Number(port.value) > 65535)) return 'Revisa el servidor SMTP y el puerto.'
  try { parseMailAccountSettings(settings.value) } catch { return 'Revisa los datos de la cuenta.' }
  return ''
}
function validateStep(index: number): boolean { error.value = index === 1 ? validateAccount() : ''; return !error.value }
const reviewItems = computed(() => [
  { label: 'Proveedor', value: providerOptions.find(option => option.provider === provider.value)?.label ?? '' },
  { label: 'Remitente', value: senderName.value.trim() + ' <' + emailAddress.value + '>' },
  { label: 'Usuario SMTP', value: username.value },
  { label: 'Servidor', value: settings.value.host + ':' + settings.value.port + (settings.value.isSecure ? ' · TLS' : ' · STARTTLS') },
  { label: 'Contraseña', value: 'Se guarda cifrada sólo en este equipo' }
])

async function save(): Promise<void> {
  if (isWorking.value) return
  error.value = validateAccount()
  if (error.value) { currentStep.value = 1; return }
  isWorking.value = true; emit('busy', true)
  try {
    const result = await window.contapp.manageMailAccount({ action: 'save', account: settings.value, password: password.value })
    emit('saved', result.account)
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo vincular la cuenta.'); currentStep.value = 1 }
  finally { password.value = ''; isWorking.value = false; emit('busy', false) }
}
</script>

<template>
  <form
    class="mail-account-form"
    data-testid="mail-account-form"
    @submit.prevent
  >
    <InlineNotice
      v-if="error"
      title="Cuenta no vinculada"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <CaptureSteps
      v-model="currentStep"
      :steps="steps"
      :review-items="reviewItems"
      :validate="validateStep"
      :is-busy="isWorking"
      complete-label="Probar y vincular"
      @complete="save"
    >
      <template #step-provider>
        <fieldset class="mail-providers">
          <legend>¿Dónde está tu correo?</legend>
          <label
            v-for="option in providerOptions"
            :key="option.provider"
            class="choice-card"
          >
            <input
              v-model="provider"
              type="radio"
              name="mail-provider"
              :value="option.provider"
            >
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <InlineNotice
          :title="providerHelp[provider].title"
          tone="info"
        >
          <p>{{ providerHelp[provider].steps }}</p>
        </InlineNotice>
      </template>
      <template #step-account>
        <div class="mail-account-grid">
          <TextField
            id="mail-sender-name"
            v-model="senderName"
            label="Nombre del remitente"
            help="Lo que verá tu cliente en su bandeja, por ejemplo el nombre del despacho."
          />
          <EmailField
            id="mail-address"
            v-model="emailAddress"
            label="Correo"
          />
          <TextField
            id="mail-username"
            v-model="username"
            label="Usuario SMTP"
            autocomplete="off"
            help="Casi siempre es el mismo correo."
            @update:model-value="isUsernameEdited = true"
          />
          <PasswordField
            id="mail-password"
            v-model="password"
            label="Contraseña de aplicación"
            :help="providerHelp[provider].title + ': ver el paso anterior.'"
          />
        </div>
        <div
          v-if="provider === 'custom'"
          class="mail-account-grid"
        >
          <TextField
            id="mail-host"
            v-model="host"
            label="Servidor SMTP"
            autocomplete="off"
            help="Por ejemplo smtp.midominio.com"
          />
          <TextField
            id="mail-port"
            v-model="port"
            label="Puerto"
            autocomplete="off"
          />
          <SelectField
            id="mail-security"
            v-model="security"
            label="Cifrado"
            :options="securityOptions"
          />
        </div>
        <p class="field-help">
          La contraseña se guarda cifrada con la protección de Windows sólo en este equipo y para tu usuario de Fiscenix. No viaja al Host ni a otros equipos.
        </p>
      </template>
      <template #footer-start>
        <ActionButton
          :disabled="isWorking"
          @click="emit('cancel')"
        >
          Cancelar
        </ActionButton>
      </template>
    </CaptureSteps>
    <LatticeLoader
      v-if="isWorking"
      label="Probando la conexión con el servidor de correo"
    />
  </form>
</template>

<style scoped>
.mail-account-form { display: grid; gap: var(--spaceMedium); }
.mail-providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 8px; margin: 0; padding: 0; border: 0; }
.mail-providers legend { margin-bottom: 8px; font-weight: 600; }
.mail-account-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--spaceMedium); align-items: start; }
</style>
