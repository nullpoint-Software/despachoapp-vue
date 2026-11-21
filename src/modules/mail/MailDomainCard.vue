<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, ExternalLink, RefreshCw, ShieldCheck } from '@lucide/vue'
import SettingsCard from '../settings/SettingsCard.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { useNotifications } from '../../shared/notifications/notificationStore'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import type { MailDomainRecordKind, MailDomainReport } from '../../../shared/contracts/mailDomain'

/**
 * Asistente de dominio del correo (2026-10-20, [[MAIL]]): explica por qué los correos pueden caer en spam y guía a
 * publicar SPF, DKIM y DMARC en el DNS del dominio del remitente.
 * - "Revisar dominio" pide a Main el informe (Main consulta el DNS con el dominio de la cuenta vinculada).
 * - SPF y DMARC: Main arma el registro sugerido y lo copia al portapapeles; la persona lo pega en su proveedor de DNS.
 * - DKIM: la llave la genera el proveedor (Google o Microsoft); el botón abre su consola y luego se vuelve a revisar.
 * No guarda nada: el informe vive sólo en esta vista.
 */
const { notify } = useNotifications()
const report = ref<MailDomainReport | null>(null)
const isChecking = ref(false), error = ref('')
const recordLabels: Record<MailDomainRecordKind, string> = { spf: 'SPF', dmarc: 'DMARC' }

const isSpfReady = computed(() => Boolean(report.value?.spf.record && report.value.spf.isProviderIncluded))
/** DMARC listo: publicado y, con DKIM, ya en `quarantine` o `reject` (con `none` sólo informa). */
const isDmarcReady = computed(() => Boolean(report.value?.dmarc.record && (!report.value.dkim.isFound || report.value.dmarc.policy !== 'none')))
const isDomainReady = computed(() => isSpfReady.value && Boolean(report.value?.dkim.isFound) && isDmarcReady.value)

async function checkDomain(): Promise<void> {
  isChecking.value = true; error.value = ''
  try {
    const result = await window.contapp.manageMailDomain({ action: 'check' })
    if (result.status === 'report') report.value = result.report
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se pudo revisar el dominio del correo.') }
  finally { isChecking.value = false }
}
async function copyRecord(record: MailDomainRecordKind): Promise<void> {
  try { await window.contapp.manageMailDomain({ action: 'copyRecord', record }); notify('Registro ' + recordLabels[record] + ' copiado', 'Pégalo como registro TXT en el DNS de ' + report.value?.domain + '.', 'success') }
  catch (caught) { notify('No se copió', readIpcErrorMessage(caught, 'No se pudo copiar el registro.'), 'error') }
}
async function openDkimConsole(): Promise<void> {
  try { await window.contapp.manageMailDomain({ action: 'openDkimConsole' }) }
  catch (caught) { notify('No se abrió la consola', readIpcErrorMessage(caught, 'No se pudo abrir el navegador.'), 'error') }
}
</script>

<template>
  <SettingsCard
    title="Entrega y spam"
    :icon="ShieldCheck"
    description="Revisa que el dominio de tu correo tenga SPF, DKIM y DMARC. Sin ellos, Gmail y Outlook suelen mandar los correos a spam."
    help-title="Qué son SPF, DKIM y DMARC"
    help-text="Son registros TXT en el DNS de tu dominio. SPF dice qué servidores pueden enviar por él, DKIM firma cada correo y DMARC le dice al destinatario qué hacer si algo no cuadra. Se publican una vez en el proveedor del dominio (GoDaddy, Cloudflare, Google Domains…)."
    data-testid="mail-domain-card"
  >
    <InlineNotice
      v-if="error"
      title="No se pudo revisar"
      tone="warning"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <template v-if="report">
      <p
        v-if="report.isProviderDomain"
        class="field-help"
      >
        Usas un correo de <strong>{{ report.domain }}</strong>: el proveedor ya lo autentica y su DNS no se puede cambiar. Para que tus correos lleguen mejor, usa un correo con el dominio del despacho.
      </p>
      <template v-else>
        <p class="field-help">
          Dominio: <strong>{{ report.domain }}</strong>. {{ isDomainReady ? 'Todo listo.' : 'Los cambios en el DNS pueden tardar desde minutos hasta 48 horas; después, revisa de nuevo.' }}
        </p>
        <ul class="mail-domain-checks">
          <li data-testid="mail-domain-spf">
            <div class="mail-domain-heading">
              <strong>SPF</strong>
              <StatusBadge :tone="isSpfReady ? 'success' : 'warning'">
                {{ isSpfReady ? 'Correcto' : report.spf.record ? 'Incompleto' : 'Falta' }}
              </StatusBadge>
            </div>
            <template v-if="!isSpfReady">
              <p class="field-help">
                Publica este registro TXT en la raíz del dominio (nombre <code>@</code>). Sólo puede haber un registro SPF: si ya existe uno, reemplázalo.
              </p>
              <code class="mail-domain-record">{{ report.spf.suggestedRecord }}</code>
              <div class="actions">
                <ActionButton @click="copyRecord('spf')">
                  <Copy
                    :size="16"
                    aria-hidden="true"
                  /> Copiar SPF
                </ActionButton>
              </div>
            </template>
          </li>
          <li data-testid="mail-domain-dkim">
            <div class="mail-domain-heading">
              <strong>DKIM</strong>
              <StatusBadge :tone="report.dkim.isFound ? 'success' : 'warning'">
                {{ report.dkim.isFound ? 'Correcto' : 'Falta' }}
              </StatusBadge>
            </div>
            <template v-if="!report.dkim.isFound">
              <p
                v-if="report.dkim.consoleUrl"
                class="field-help"
              >
                Tu proveedor genera la llave. En su consola (requiere ser administrador del dominio): genera el registro, publícalo como TXT con el nombre que te indique (por ejemplo <code>{{ report.dkim.selectors[0] }}._domainkey</code>) y pulsa "Iniciar autenticación". Luego revisa de nuevo aquí.
              </p>
              <p
                v-else
                class="field-help"
              >
                Pide a tu proveedor de correo u hosting que active DKIM para {{ report.domain }} y publica el registro que te den.
              </p>
              <div
                v-if="report.dkim.consoleUrl"
                class="actions"
              >
                <ActionButton
                  variant="primary"
                  @click="openDkimConsole"
                >
                  <ExternalLink
                    :size="16"
                    aria-hidden="true"
                  /> Generar DKIM
                </ActionButton>
              </div>
            </template>
          </li>
          <li data-testid="mail-domain-dmarc">
            <div class="mail-domain-heading">
              <strong>DMARC</strong>
              <StatusBadge :tone="isDmarcReady ? 'success' : 'warning'">
                {{ isDmarcReady ? 'Correcto' : report.dmarc.record ? 'Mejorable' : 'Falta' }}
              </StatusBadge>
            </div>
            <template v-if="!isDmarcReady">
              <p class="field-help">
                {{ report.dmarc.record ? 'Ya hay DKIM: cambia la política a quarantine para que los proveedores confíen más en tus correos.' : 'Publica este registro TXT con el nombre _dmarc.' }} Los informes llegan a tu correo.
              </p>
              <code class="mail-domain-record">{{ report.dmarc.suggestedRecord }}</code>
              <div class="actions">
                <ActionButton @click="copyRecord('dmarc')">
                  <Copy
                    :size="16"
                    aria-hidden="true"
                  /> Generar y copiar DMARC
                </ActionButton>
              </div>
            </template>
          </li>
        </ul>
      </template>
    </template>
    <div class="actions">
      <ActionButton
        :variant="report ? 'secondary' : 'primary'"
        :is-loading="isChecking"
        @click="checkDomain"
      >
        <RefreshCw
          :size="16"
          aria-hidden="true"
        /> {{ report ? 'Revisar de nuevo' : 'Revisar dominio' }}
      </ActionButton>
    </div>
  </SettingsCard>
</template>

<style scoped>
.mail-domain-checks { list-style: none; margin: 0 0 var(--spaceMedium); padding: 0; display: grid; gap: var(--spaceMedium); }
.mail-domain-checks li { display: grid; gap: 6px; }
.mail-domain-heading { display: flex; align-items: center; gap: 8px; }
.mail-domain-record { display: block; padding: 8px; font-family: var(--monoFontFamily); font-size: 12px; overflow-wrap: anywhere; border: 1px solid var(--borderColor); }
</style>
