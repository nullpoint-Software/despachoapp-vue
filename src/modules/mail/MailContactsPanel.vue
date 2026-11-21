<script setup lang="ts">
import { onMounted, ref, toRaw } from 'vue'
import { Pencil, Plus, Trash2, UserPlus } from '@lucide/vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import TextField from '../../shared/components/TextField.vue'
import CheckField from '../../shared/components/CheckField.vue'
import RecipientChipsField from './RecipientChipsField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import type { MailContact } from '../../../shared/contracts/mail'

/**
 * Contactos de correo del cliente (2026-10-18, pedido del usuario: "a veces los correos no se envían a los clientes sino
 * a los clientes de los clientes… guardarlos con nombre y correos… lo mismo para los clientes, a veces tienen más de un
 * correo"). GLOBAL en el Host, por cliente:
 * - **Correos del cliente** (`isClientAddress`): direcciones del propio cliente además de la de su ficha.
 * - **Clientes del cliente**: nombre y uno o varios correos (por ejemplo, a quien se emite una factura).
 * "Agregar" pone sus correos como destinatarios (y, para un cliente del cliente, su nombre en "Para"). Guardar, editar y
 * borrar requieren acceso de edición al cliente; el Host lo verifica. `draftAddresses` prellena un contacto nuevo con los
 * destinatarios que la persona ya escribió.
 */
const props = defineProps<{ clientId: string; draftAddresses: string[] }>()
const emit = defineEmits<{ add: [contact: MailContact] }>()
const contacts = ref<MailContact[]>([]), canEdit = ref(false), error = ref(''), isBusy = ref(false)
const form = ref<{ contactId: string | null; displayName: string; emailAddresses: string[]; isClientAddress: boolean } | null>(null)

async function run(request: Parameters<typeof window.contapp.manageMail>[0]): Promise<void> {
  isBusy.value = true; error.value = ''
  try {
    const result = await window.contapp.manageMail(request)
    if (result.status === 'contacts') { contacts.value = result.contacts.contacts; canEdit.value = result.contacts.canEdit }
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudieron consultar los contactos del cliente.'); throw caught }
  finally { isBusy.value = false }
}
function startNew(): void { form.value = { contactId: null, displayName: '', emailAddresses: [...props.draftAddresses], isClientAddress: false } }
function startEdit(contact: MailContact): void { form.value = { contactId: contact.contactId, displayName: contact.displayName, emailAddresses: [...contact.emailAddresses], isClientAddress: contact.isClientAddress } }
async function save(): Promise<void> {
  const current = form.value
  if (!current) return
  if (!current.displayName.trim() || !current.emailAddresses.length) { error.value = 'Escribe el nombre y al menos un correo del contacto.'; return }
  try { await run({ action: 'saveContact', clientId: props.clientId, contactId: current.contactId, displayName: current.displayName, emailAddresses: [...toRaw(current.emailAddresses)], isClientAddress: current.isClientAddress }); form.value = null }
  catch { /* El aviso ya está en `error`; el formulario conserva lo escrito. */ }
}
async function remove(contact: MailContact): Promise<void> { await run({ action: 'deleteContact', clientId: props.clientId, contactId: contact.contactId }).catch(() => undefined) }
onMounted(() => { void run({ action: 'listContacts', clientId: props.clientId }).catch(() => undefined) })
</script>

<template>
  <section
    class="mail-contacts"
    aria-label="Contactos de correo del cliente"
    data-testid="mail-contacts"
  >
    <div class="mail-contacts-header">
      <strong>Contactos guardados</strong>
      <ActionButton
        v-if="canEdit && !form"
        :disabled="isBusy"
        @click="startNew"
      >
        <UserPlus
          :size="16"
          aria-hidden="true"
        /> Guardar contacto
      </ActionButton>
    </div>
    <p
      v-if="error"
      class="field-help tone-error"
      role="status"
    >
      {{ error }}
    </p>
    <p
      v-if="!contacts.length && !form"
      class="field-help"
    >
      Sin contactos. Guarda los correos adicionales del cliente o los de sus clientes para agregarlos con un clic.
    </p>
    <ul
      v-if="contacts.length"
      class="mail-contacts-list"
    >
      <li
        v-for="contact in contacts"
        :key="contact.contactId"
      >
        <div class="mail-contact-text">
          <strong>{{ contact.displayName }}</strong>
          <span class="mail-contact-kind">{{ contact.isClientAddress ? 'Correo del cliente' : 'Cliente del cliente' }}</span>
          <span class="mail-contact-addresses">{{ contact.emailAddresses.join(', ') }}</span>
        </div>
        <div class="actions">
          <ActionButton
            :aria-label="'Agregar ' + contact.displayName + ' a los destinatarios'"
            @click="emit('add', contact)"
          >
            <Plus
              :size="16"
              aria-hidden="true"
            /> Agregar
          </ActionButton>
          <button
            v-if="canEdit"
            type="button"
            class="icon-button"
            :aria-label="'Editar ' + contact.displayName"
            :disabled="isBusy"
            @click="startEdit(contact)"
          >
            <Pencil
              :size="16"
              aria-hidden="true"
            />
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="icon-button tone-danger"
            :aria-label="'Borrar ' + contact.displayName"
            :disabled="isBusy"
            @click="remove(contact)"
          >
            <Trash2
              :size="16"
              aria-hidden="true"
            />
          </button>
        </div>
      </li>
    </ul>
    <div
      v-if="form"
      class="mail-contact-form"
    >
      <TextField
        id="mail-contact-name"
        v-model="form.displayName"
        label="Nombre del contacto"
        help="Por ejemplo, el cliente de tu cliente a quien va la factura."
      />
      <RecipientChipsField
        id="mail-contact-addresses"
        v-model="form.emailAddresses"
        label="Correos del contacto"
      />
      <CheckField
        id="mail-contact-is-client"
        v-model="form.isClientAddress"
        label="Son correos del propio cliente"
      />
      <div class="actions">
        <ActionButton
          variant="primary"
          :is-loading="isBusy"
          @click="save"
        >
          Guardar contacto
        </ActionButton>
        <ActionButton
          :disabled="isBusy"
          @click="form = null"
        >
          Cancelar
        </ActionButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mail-contacts { display: grid; gap: 8px; padding: 12px; border: 2px solid var(--hairlineColor); }
.mail-contacts-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.mail-contacts-list { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.mail-contacts-list li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--hairlineColor); }
.mail-contact-text { display: grid; gap: 2px; min-width: 0; }
.mail-contact-kind { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.mail-contact-addresses { font-size: 13px; overflow-wrap: anywhere; }
.mail-contact-form { display: grid; gap: var(--spaceMedium); padding-top: 8px; border-top: 1px solid var(--hairlineColor); }
</style>
