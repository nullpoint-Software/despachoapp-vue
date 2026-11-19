<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { HostTrustAction, HostTrustStatus } from '../../../shared/contracts/hostTrust'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import HelpTip from '../../shared/components/HelpTip.vue'
const props = defineProps<{ mode: 'host' | 'client' }>()
const status = ref<HostTrustStatus | null>(null)
const error = ref('')
const isBusy = ref(false)
/**
 * La UI recibe sólo huella/estado; los diálogos nativos controlan transferencia y consentimiento.
 * 7.4: el Host muestra el vencimiento de su certificado (se renueva solo 60 días antes) y de la autoridad (aviso
 * 6 meses antes, con "Renovar la autoridad"); el Cliente puede importar la identidad renovada del mismo Host.
 */
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-MX', { dateStyle: 'long' })
async function runAction(action: HostTrustAction): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; error.value = ''
  try { status.value = await window.contapp.manageHostTrust(action) }
  catch { error.value = 'No se pudo completar. Revisa que la identidad y la huella correspondan al Host, que el certificado esté vigente y que su dirección y puerto sean accesibles. Los datos de confianza anteriores se conservan.' }
  finally { isBusy.value = false }
}
onMounted(() => runAction('status'))
</script>
<template>
  <section
    class="surface-panel host-trust-panel"
    aria-labelledby="host-trust-title"
  >
    <div class="help-title-row">
      <h3 id="host-trust-title">
        Configuración segura del despacho
      </h3>
      <HelpTip
        title="Conexión segura"
        text="Todo lo que viaja entre el Host y los Clientes va cifrado. Cada Cliente reconoce al Host por la huella de su autoridad: compárala en ambas pantallas antes de aceptarla. El certificado del Host se renueva solo antes de vencer."
      />
    </div>
    <!-- Glosario (2026-10-06, pedido del usuario): qué significa cada término de esta tarjeta, en lenguaje llano. -->
    <dl class="trust-glossary">
      <div>
        <dt>Conexión segura</dt>
        <dd>El Host y los Clientes hablan cifrados dentro de la red del despacho: nadie en la red puede leer ni alterar lo que viaja entre ellos.</dd>
      </div>
      <div>
        <dt>Autoridad</dt>
        <dd>El sello propio que crea este Host para firmar su certificado. Su huella (SHA-256) es la "firma" que cada Cliente compara para saber que habla con este Host y no con otro equipo.</dd>
      </div>
      <div>
        <dt>Confianza pública</dt>
        <dd>Archivo con sólo la parte pública de la autoridad, sin claves privadas. Se entrega a cada Cliente para que reconozca a este Host; se genera con "Exportar confianza pública".</dd>
      </div>
      <div>
        <dt>Estado</dt>
        <dd>Lo que Fiscenix comprueba ahora: si la conexión segura está preparada y escuchando, si el certificado sigue vigente y cuándo se renueva solo.</dd>
      </div>
    </dl>
    <p>{{ props.mode === 'host' ? 'Prepara la identidad del Host y entrega su archivo de confianza a cada Cliente. El archivo contiene sólo el certificado público.' : 'Obtén el archivo de confianza directamente del Host. Compara las huellas en ambas pantallas antes de aceptar la importación.' }}</p>
    <InlineNotice
      title="Confianza del Host"
      :tone="error ? 'error' : 'info'"
    >
      <p data-testid="host-trust-status">
        {{ error || status?.message || 'Leyendo identidad...' }}
      </p>
    </InlineNotice>
    <dl
      v-if="status?.identity"
      class="trust-identity"
    >
      <dt>Identidad del Host</dt><dd>{{ status.identity.hostId }}</dd>
      <dt>Huella SHA-256 de la autoridad</dt><dd data-testid="host-trust-fingerprint">
        {{ status.identity.fingerprint }}
      </dd>
      <dt>Autoridad válida hasta</dt><dd>{{ new Date(status.identity.expiresAt).toLocaleDateString('es-MX') }}</dd>
      <template v-if="status.certificates">
        <dt>Certificado del Host</dt><dd data-testid="host-certificate-expiry">
          Vence el {{ formatDate(status.certificates.certificateExpiresAt) }}; se renueva solo 60 días antes.
        </dd>
      </template>
    </dl>
    <InlineNotice
      v-if="status?.certificates?.isAuthorityExpiring"
      title="La autoridad del Host vence pronto"
      tone="warning"
    >
      <p>Vence el {{ formatDate(status.certificates.authorityExpiresAt) }}. Renuévala antes de esa fecha y confirma la huella nueva en cada Cliente.</p>
    </InlineNotice>
    <div class="trust-actions">
      <template v-if="props.mode === 'host'">
        <ActionButton
          :is-loading="isBusy"
          :disabled="status?.isListening"
          @click="runAction('prepare')"
        >
          Preparar conexión segura
        </ActionButton>
        <ActionButton
          :disabled="isBusy || !status?.identity"
          @click="runAction('export')"
        >
          Exportar confianza pública
        </ActionButton>
        <ActionButton
          v-if="status?.isListening"
          variant="danger"
          :disabled="isBusy"
          @click="runAction('rotate')"
        >
          Renovar la autoridad
        </ActionButton>
      </template>
      <template v-else>
        <ActionButton
          :is-loading="isBusy"
          @click="runAction('import')"
        >
          Importar confianza del Host
        </ActionButton>
        <ActionButton
          :disabled="isBusy || !status?.identity"
          @click="runAction('verify')"
        >
          Comprobar conexión segura
        </ActionButton>
        <ActionButton
          v-if="status?.identity"
          :disabled="isBusy"
          @click="runAction('renew')"
        >
          Importar identidad renovada
        </ActionButton>
      </template>
      <ActionButton
        :disabled="isBusy"
        @click="runAction('status')"
      >
        Actualizar estado
      </ActionButton>
    </div>
  </section>
</template>
<style scoped>
.host-trust-panel { min-width: 0; }
.trust-identity { display: grid; gap: 0.5rem; }
.trust-identity dt { font-weight: 700; }
.trust-identity dd { margin: 0 0 0.5rem; overflow-wrap: anywhere; user-select: text; font-variant-numeric: tabular-nums; }
.trust-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.trust-glossary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: var(--spaceMedium); margin: var(--spaceMedium) 0; }
.trust-glossary > div { padding: 10px 12px; border: 2px solid var(--borderColor); background: var(--subtleColor); }
.trust-glossary dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.trust-glossary dd { margin: 6px 0 0; font-size: 13px; color: var(--mutedTextColor); }
</style>
