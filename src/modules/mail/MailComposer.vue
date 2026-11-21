<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { Paperclip, X } from '@lucide/vue'
import CaptureSteps from '../../shared/components/CaptureSteps.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import MailHtmlEditor from './MailHtmlEditor.vue'
import RecipientChipsField from './RecipientChipsField.vue'
import MailContactsPanel from './MailContactsPanel.vue'
import { readRecentRecipients, rememberRecipients } from './recentRecipients'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { useOfficeBranding } from '../branding/officeBrandingState'
import { sessionUser } from '../workspace/sessionState'
import { documentCategoryLabels, formatDocumentSize } from '../clients/documentLabels'
import { maximumMailAttachmentBytes, maximumMailRecipientCount, type ChosenMailFile, type MailAccountStatus, type MailAttachmentReference, type MailContact } from '../../../shared/contracts/mail'
import { buildMailSubject, defaultMailBodyTemplate, defaultMailSignatureTemplate, fillMailPlaceholders, isMailDocumentEmpty, type MailDocument } from '../../../shared/mail/mailDocument'
import type { ClientDocument } from '../../../shared/contracts/documents'
import type { LocalXmlRecord } from '../../../shared/contracts/localXml'
import type { MailComposerRequest } from './mailComposerState'

/**
 * Redactor de correo a un cliente ([[MAIL]]), por pasos (ADR-034): Destinatarios → Mensaje → Adjuntos → Revisar.
 * - **Asunto:** "{documento} de {cliente}" y, opcional, "para {cliente del cliente}" (`buildMailSubject`).
 * - **Destinatarios:** chips (`RecipientChipsField`, hasta 10), con sugerencias de los correos ya usados (2026-10-20). Empiezan con el correo de la ficha del cliente y el
 *   "correo principal" del despacho (`defaultRecipient`), que se pueden quitar. Los contactos guardados del cliente
 *   (`MailContactsPanel`: sus otros correos y sus clientes) se agregan con un clic.
 * - **Correo genérico** (`clientId` NULL, sección Correo): asunto libre, cuerpo en blanco y sin paso de adjuntos.
 * - **Mensaje:** el cuerpo por defecto y la firma del despacho (Host) con los marcadores ya reemplazados; ambos se
 *   editan aquí sólo para este correo. Si la persona aún no tocó el cuerpo, cambiar el documento lo vuelve a llenar.
 * - **Adjuntos:** expediente (Host), XML y PDF de los CFDI de este equipo con el RFC del cliente, y archivos del equipo
 *   (Main los lee; la vista sólo recibe id, nombre y tamaño). Lo que no se pudo listar (sin permiso) se explica y se omite.
 * Al cerrar sin enviar, Main libera los archivos elegidos.
 */
const props = defineProps<{ request: MailComposerRequest }>()
const emit = defineEmits<{ close: []; busy: [isBusy: boolean] }>()
const { notify } = useNotifications()
const { branding, refresh: refreshBranding } = useOfficeBranding()

const account = ref<MailAccountStatus | null>(null)
const documentLabel = ref(props.request.documentLabel ?? 'Documento')
const recipientName = ref(props.request.recipientName ?? '')
const recipients = ref<string[]>([])
const recipientsField = ref<InstanceType<typeof RecipientChipsField> | null>(null)
// Correos ya usados por esta persona en este equipo: sugerencias de "Correos de destino" (`recentRecipients`).
const recentRecipients = sessionUser.value ? readRecentRecipients(sessionUser.value.userId) : []
const isGeneric = props.request.clientId === null
const customSubject = ref('')
const body = ref<MailDocument>(isGeneric ? { type: 'doc', content: [{ type: 'paragraph' }] } : defaultMailBodyTemplate), signature = ref<MailDocument>(defaultMailSignatureTemplate)
let bodyTemplate: MailDocument = defaultMailBodyTemplate, filledBody = ''
const documents = ref<ClientDocument[]>([]), xmlRecords = ref<LocalXmlRecord[]>([]), chosenFiles = ref<ChosenMailFile[]>([])
const selectedKeys = ref<string[]>([]), listNotices = ref<string[]>([])
const isLoading = ref(true), isSending = ref(false), isChoosing = ref(false), error = ref(''), currentStep = ref(0)

const keyOf = (reference: MailAttachmentReference) => reference.kind + ':' + (reference.kind === 'document' ? reference.documentId : reference.kind === 'file' ? reference.attachmentId : reference.uuid)
const subject = computed(() => isGeneric ? customSubject.value.replace(/\s+/g, ' ').trim() : buildMailSubject({ documentLabel: documentLabel.value, clientName: props.request.clientName, recipientName: recipientName.value }))

/** Agrega los correos de un contacto; uno de un cliente del cliente también llena "Para" si estaba vacío. */
function addContact(contact: MailContact): void {
  recipients.value = [...new Set([...recipients.value, ...contact.emailAddresses])].slice(0, maximumMailRecipientCount)
  if (!contact.isClientAddress && !recipientName.value.trim()) recipientName.value = contact.displayName
}

/** Marcador `{usuario}`: el nombre del usuario de la sesión, quien envía el correo (2026-10-18). */
function senderName(): string { return sessionUser.value?.displayName ?? '' }

function fillBody(): void {
  if (isGeneric) return
  body.value = fillMailPlaceholders(bodyTemplate, { cliente: props.request.clientName, documento: documentLabel.value.trim(), despacho: branding.value.officeName, usuario: senderName() })
  filledBody = JSON.stringify(body.value)
}
watch(documentLabel, () => { if (JSON.stringify(body.value) === filledBody) fillBody() })

/** Lo de cada fuente se lee por separado: una que falla (sin permiso, sin Host) no impide usar las demás. */
async function load(): Promise<void> {
  isLoading.value = true
  await refreshBranding().catch(() => undefined)
  const clientId = props.request.clientId
  const [accountResult, templateResult, clientResult] = await Promise.allSettled([
    window.contapp.manageMailAccount({ action: 'read' }), window.contapp.manageMail({ action: 'readTemplates' }), clientId ? window.contapp.manageClients({ action: 'get', clientId }) : Promise.resolve(null)])
  account.value = accountResult.status === 'fulfilled' ? accountResult.value.account : null
  if (accountResult.status === 'rejected') error.value = readIpcErrorMessage(accountResult.reason, 'No se pudo leer tu cuenta de correo.')
  if (templateResult.status === 'fulfilled' && templateResult.value.status === 'templates') { bodyTemplate = templateResult.value.templates.body; signature.value = fillMailPlaceholders(templateResult.value.templates.signature, { despacho: branding.value.officeName, usuario: senderName() }) }
  else signature.value = fillMailPlaceholders(defaultMailSignatureTemplate, { despacho: branding.value.officeName, usuario: senderName() })
  fillBody()
  const profile = clientResult.status === 'fulfilled' ? clientResult.value?.profile ?? null : null
  const defaultRecipient = templateResult.status === 'fulfilled' && templateResult.value.status === 'templates' ? templateResult.value.templates.defaultRecipient : null
  recipients.value = [...new Set([profile?.emailAddress?.toLowerCase(), defaultRecipient].filter((address): address is string => Boolean(address)))]
  if (!clientId) { isLoading.value = false; return }
  const notices: string[] = []
  try {
    const listed = await window.contapp.manageDocuments({ action: 'list', clientId, beforeCursor: null })
    if (listed.status === 'listed') documents.value = listed.list.documents.filter(document => document.hasStoredFile)
  } catch { notices.push('Expediente: no se pudo consultar (se necesita permiso para consultar documentos).') }
  if (profile?.rfc) {
    try { xmlRecords.value = (await window.contapp.listLocalXml({ view: 'active', rfc: profile.rfc, period: null, search: '' })).records.slice(0, 50) }
    catch { notices.push('CFDI de este equipo: no se pudo abrir la biblioteca XML (se necesita permiso para usar los XML).') }
  } else notices.push('CFDI de este equipo: la ficha del cliente no tiene RFC.')
  listNotices.value = notices
  selectedKeys.value = (props.request.attachments ?? []).map(item => keyOf(item.reference))
  isLoading.value = false
}

/** Adjuntos elegidos con nombre y tamaño conocido (los PDF de CFDI se generan al enviar: tamaño desconocido). */
const selectedAttachments = computed(() => selectedKeys.value.map(key => {
  const [kind, id] = key.split(':') as [MailAttachmentReference['kind'], string]
  const preset = props.request.attachments?.find(item => keyOf(item.reference) === key)
  if (kind === 'document') { const document = documents.value.find(item => item.documentId === id); return { key, reference: { kind, documentId: id } as MailAttachmentReference, label: document?.displayName ?? preset?.label ?? 'Documento del expediente', sizeBytes: document?.sizeBytes ?? 0 } }
  if (kind === 'file') { const file = chosenFiles.value.find(item => item.attachmentId === id); return { key, reference: { kind, attachmentId: id } as MailAttachmentReference, label: file?.fileName ?? 'Archivo', sizeBytes: file?.sizeBytes ?? 0 } }
  const record = xmlRecords.value.find(item => item.uuid === id)
  return { key, reference: { kind, uuid: id } as MailAttachmentReference, label: preset?.label ?? (id.toUpperCase() + (kind === 'xml' ? '.xml' : '.pdf')), sizeBytes: kind === 'xml' ? record?.sizeBytes ?? 0 : 0 }
}))
const knownBytes = computed(() => selectedAttachments.value.reduce((total, item) => total + item.sizeBytes, 0))
function toggle(key: string, isSelected: boolean): void { selectedKeys.value = isSelected ? [...new Set([...selectedKeys.value, key])] : selectedKeys.value.filter(item => item !== key) }

async function chooseFiles(): Promise<void> {
  isChoosing.value = true
  try {
    const result = await window.contapp.manageMail({ action: 'chooseFiles' })
    if (result.status === 'files') { chosenFiles.value = [...chosenFiles.value, ...result.files]; selectedKeys.value = [...selectedKeys.value, ...result.files.map(file => 'file:' + file.attachmentId)] }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo adjuntar el archivo.') }
  finally { isChoosing.value = false }
}
function removeFile(attachmentId: string): void {
  chosenFiles.value = chosenFiles.value.filter(file => file.attachmentId !== attachmentId); toggle('file:' + attachmentId, false)
  void window.contapp.manageMail({ action: 'releaseFiles', attachmentIds: [attachmentId] }).catch(() => undefined)
}

const steps = [{ stepId: 'recipients', title: 'Destinatarios' }, { stepId: 'message', title: 'Mensaje' }, ...(isGeneric ? [] : [{ stepId: 'attachments', title: 'Adjuntos' }])]
function validateRecipients(): string {
  // Lo que quedó escrito sin chip también cuenta; si no es un correo válido, el campo lo explica.
  if (recipientsField.value && !recipientsField.value.commit()) return 'Revisa los correos de destino: alguno no es válido.'
  if (isGeneric ? !subject.value : !documentLabel.value.trim()) return isGeneric ? 'Escribe el asunto.' : 'Escribe qué documento envías (por ejemplo, "Factura").'
  if (!recipients.value.length) return 'Escribe al menos un correo de destino.'
  return ''
}
function validateStep(index: number): boolean {
  error.value = index === 0 ? validateRecipients() : index === 1 && isMailDocumentEmpty(body.value) ? 'Escribe el mensaje.' : index === 2 && knownBytes.value > maximumMailAttachmentBytes ? 'Los adjuntos suman más de 18 MB. Quita alguno.' : ''
  return !error.value
}
const reviewItems = computed(() => [
  { label: 'De', value: account.value?.account ? account.value.account.senderName + ' <' + account.value.account.emailAddress + '>' : 'Sin cuenta vinculada' },
  { label: 'Para', value: recipients.value.join(', ') },
  { label: 'Asunto', value: subject.value },
  ...isGeneric ? [] : [{ label: 'Adjuntos', value: selectedAttachments.value.length ? selectedAttachments.value.map(item => item.label).join(', ') + (knownBytes.value ? ' · ' + formatDocumentSize(knownBytes.value) : '') : 'Ninguno' }]
])

async function send(): Promise<void> {
  if (isSending.value) return
  for (const [index] of steps.entries()) if (!validateStep(index)) { currentStep.value = index; return }
  isSending.value = true; emit('busy', true)
  try {
    const result = await window.contapp.manageMail({ action: 'send', clientId: props.request.clientId, recipients: [...recipients.value], subject: subject.value, body: toRaw(body.value), signature: isMailDocumentEmpty(signature.value) ? null : toRaw(signature.value), attachments: selectedAttachments.value.map(item => item.reference) })
    if (result.status === 'sent') {
      if (sessionUser.value) rememberRecipients(sessionUser.value.userId, recipients.value)
      chosenFiles.value = []
      notify('Correo enviado', subject.value + ' · ' + result.acceptedCount + (result.acceptedCount === 1 ? ' destinatario' : ' destinatarios') + ', ' + result.attachmentCount + ' adjunto(s).', 'success')
      emit('close')
    }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se envió el correo.') }
  finally { isSending.value = false; emit('busy', false) }
}
onMounted(() => { void load() })
// Los archivos elegidos y no enviados se borran de la memoria de Main al cerrar.
onBeforeUnmount(() => { if (chosenFiles.value.length) void window.contapp.manageMail({ action: 'releaseFiles', attachmentIds: chosenFiles.value.map(file => file.attachmentId) }).catch(() => undefined) })
</script>

<template>
  <form
    class="mail-composer"
    data-testid="mail-composer"
    @submit.prevent
  >
    <LatticeLoader
      v-if="isLoading"
      label="Preparando el correo"
    />
    <template v-else>
      <InlineNotice
        v-if="!account?.account"
        title="Falta vincular tu cuenta"
        tone="warning"
      >
        <p>Vincula tu cuenta de correo en Configuración → Correo; después vuelve a abrir el redactor.</p>
      </InlineNotice>
      <InlineNotice
        v-if="error"
        title="Correo no enviado"
        tone="error"
      >
        <p>{{ error }}</p>
      </InlineNotice>
      <CaptureSteps
        v-model="currentStep"
        :steps="steps"
        :review-items="reviewItems"
        :validate="validateStep"
        :is-busy="isSending"
        :can-complete="Boolean(account?.account)"
        complete-label="Enviar correo"
        @complete="send"
      >
        <template #step-recipients>
          <TextField
            v-if="isGeneric"
            id="mail-subject"
            v-model="customSubject"
            label="Asunto"
          />
          <div
            v-else
            class="mail-composer-grid"
          >
            <TextField
              id="mail-document-label"
              v-model="documentLabel"
              label="Documento"
              help="Va al inicio del asunto: Factura, Constancia, Opinión de cumplimiento…"
            />
            <TextField
              id="mail-recipient-name"
              v-model="recipientName"
              label="Para (cliente del cliente, opcional)"
              help="Por ejemplo, a quién se emitió la factura."
            />
          </div>
          <RecipientChipsField
            id="mail-recipients"
            ref="recipientsField"
            v-model="recipients"
            label="Correos de destino"
            :maximum="maximumMailRecipientCount"
            :suggestions="recentRecipients"
            :help="isGeneric ? 'Escribe un correo y presiona Intro o coma para agregar otro.' : 'Empieza con el correo de la ficha del cliente y el correo principal del despacho; quita o agrega los que necesites.'"
          />
          <MailContactsPanel
            v-if="request.clientId"
            :client-id="request.clientId"
            :draft-addresses="recipients"
            @add="addContact"
          />
          <p
            v-if="!isGeneric"
            class="mail-subject-preview"
          >
            <span>Asunto</span><strong data-testid="mail-subject">{{ subject }}</strong>
          </p>
        </template>
        <template #step-message>
          <MailHtmlEditor
            v-model="body"
            label="Cuerpo del correo"
            :logo-data-url="branding.logoDataUrl"
            :is-disabled="isSending"
          />
          <MailHtmlEditor
            v-model="signature"
            label="Firma"
            purpose="signature"
            :logo-data-url="branding.logoDataUrl"
            :is-disabled="isSending"
          />
        </template>
        <template #step-attachments>
          <InlineNotice
            v-for="notice in listNotices"
            :key="notice"
            title="Fuente no disponible"
            tone="info"
          >
            <p>{{ notice }}</p>
          </InlineNotice>
          <fieldset
            v-if="documents.length"
            class="mail-attachment-group"
          >
            <legend>Expediente del cliente</legend>
            <label
              v-for="document in documents"
              :key="document.documentId"
              class="choice-card"
            >
              <input
                type="checkbox"
                :checked="selectedKeys.includes('document:' + document.documentId)"
                @change="toggle('document:' + document.documentId, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ document.displayName }} <small>{{ documentCategoryLabels[document.category] }} · {{ formatDocumentSize(document.sizeBytes) }}</small></span>
            </label>
          </fieldset>
          <fieldset
            v-if="xmlRecords.length"
            class="mail-attachment-group"
          >
            <legend>CFDI de este equipo</legend>
            <div
              v-for="record in xmlRecords"
              :key="record.uuid"
              class="mail-cfdi-row"
            >
              <span class="mail-cfdi-name">{{ record.issuedAt.slice(0, 10) }} · {{ record.receiverName || record.receiverRfc }} · ${{ record.total }}</span>
              <label class="check-field"><input
                type="checkbox"
                :aria-label="'XML ' + record.uuid.toUpperCase()"
                :checked="selectedKeys.includes('xml:' + record.uuid)"
                @change="toggle('xml:' + record.uuid, ($event.target as HTMLInputElement).checked)"
              >XML</label>
              <label class="check-field"><input
                type="checkbox"
                :aria-label="'PDF ' + record.uuid.toUpperCase()"
                :checked="selectedKeys.includes('cfdiPdf:' + record.uuid)"
                @change="toggle('cfdiPdf:' + record.uuid, ($event.target as HTMLInputElement).checked)"
              >PDF</label>
            </div>
          </fieldset>
          <div class="mail-attachment-group">
            <ActionButton
              :is-loading="isChoosing"
              @click="chooseFiles"
            >
              <Paperclip
                :size="16"
                aria-hidden="true"
              /> Adjuntar archivos del equipo
            </ActionButton>
            <ul
              v-if="chosenFiles.length"
              class="mail-chosen-files"
            >
              <li
                v-for="file in chosenFiles"
                :key="file.attachmentId"
              >
                <span>{{ file.fileName }} · {{ formatDocumentSize(file.sizeBytes) }}</span>
                <button
                  type="button"
                  class="icon-button"
                  :aria-label="'Quitar ' + file.fileName"
                  @click="removeFile(file.attachmentId)"
                >
                  <X
                    :size="16"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
          </div>
          <p class="field-help">
            {{ selectedAttachments.length }} adjunto(s){{ knownBytes ? ' · ' + formatDocumentSize(knownBytes) : '' }}. Límite: 18 MB en total.
          </p>
        </template>
        <template #footer-start>
          <ActionButton
            :disabled="isSending"
            @click="emit('close')"
          >
            Cancelar
          </ActionButton>
        </template>
      </CaptureSteps>
      <LatticeLoader
        v-if="isSending"
        label="Enviando el correo"
      />
    </template>
  </form>
</template>

<style scoped>
.mail-composer { display: grid; gap: var(--spaceMedium); }
.mail-composer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--spaceMedium); align-items: start; }
.mail-subject-preview { display: grid; gap: 4px; margin: 0; padding: 10px 14px; border: 2px solid var(--borderColor); }
.mail-subject-preview span { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.mail-attachment-group { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
.mail-attachment-group legend { margin-bottom: 8px; font-weight: 600; }
.mail-attachment-group small { color: var(--mutedTextColor); }
.mail-cfdi-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--hairlineColor); }
.mail-cfdi-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.mail-chosen-files { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.mail-chosen-files li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 8px; border: 2px solid var(--hairlineColor); }
</style>
