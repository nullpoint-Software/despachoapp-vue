<script setup lang="ts">
import { ref } from 'vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import SelectField from '../../shared/components/SelectField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const props = defineProps<{ mode: 'host' | 'client' }>()
const emit = defineEmits<{ linked: [] }>()
const message = ref('')
const maximumDeviceCount = ref('1')
const capacityOptions = Array.from({ length: 10 }, (value, index) => ({ value: String(index + 1), label: index === 0 ? '1 PC' : String(index + 1) + ' PCs' }))
const isBusy = ref(false), hasError = ref(false)
/**
 * Main gestiona el archivo y sus secretos; la vista sólo recibe éxito o cancelación.
 * Crear la clave administra equipos: zona crítica (ADR-038), el diálogo único pide la contraseña siempre.
 */
async function run(): Promise<void> {
  if (isBusy.value) return
  isBusy.value = true; message.value = ''; hasError.value = false
  try {
    const success = props.mode === 'host'
      ? await withSensitiveConfirmation({ operation: 'devices.link', title: 'Confirmar clave de vinculación' }, proof => window.contapp.manageLinkFile('export', proof, Number(maximumDeviceCount.value)))
      : await window.contapp.manageLinkFile('import')
    if (success) {
      message.value = props.mode === 'host' ? 'Archivo guardado. Puedes usarlo en hasta ' + maximumDeviceCount.value + ' PCs durante 24 horas. En cada Cliente elige Vincular con USB.' : 'Equipo vinculado. Ya puedes iniciar sesión.'
      if (props.mode === 'client') emit('linked')
    }
  } catch { hasError.value = true; message.value = props.mode === 'host' ? 'No se pudo generar el archivo. Comprueba tu sesión, contraseña y permiso para administrar equipos.' : 'No se pudo vincular. Mantén el Host abierto y usa un archivo vigente de tu despacho. Si se interrumpió, reintenta con el mismo archivo.' }
  finally { isBusy.value = false }
}
</script>
<template>
  <section class="surface-panel">
    <h3>{{ mode === 'host' ? 'Conectar otro equipo (USB)' : 'Vincular con USB' }}</h3>
    <p v-if="mode === 'host'">
      Elige cuántas PCs podrá vincular esta clave y guárdala en una memoria USB. Vence en 24 horas. Crear otra cierra los cupos restantes de la anterior; los equipos ya vinculados conservan su acceso.
    </p>
    <p v-else>
      Abre el archivo que generó el administrador en el Host. Fiscenix encuentra la conexión y autoriza este equipo en un solo paso.
    </p>
    <form
      class="configuration-form"
      @submit.prevent="run"
    >
      <SelectField
        v-if="mode === 'host'"
        id="link-capacity"
        v-model="maximumDeviceCount"
        label="PCs que puede vincular esta clave"
        :options="capacityOptions"
        :disabled="isBusy"
      />
      <ActionButton
        type="submit"
        variant="primary"
        :is-loading="isBusy"
      >
        {{ mode === 'host' ? 'Guardar clave en USB' : 'Abrir archivo de vinculación' }}
      </ActionButton>
    </form>
    <InlineNotice
      v-if="message"
      :tone="hasError ? 'error' : 'success'"
      title="Vinculación"
    >
      {{ message }}
    </InlineNotice>
    <p
      v-if="mode === 'host'"
      class="field-help"
    >
      Entrega el archivo sólo a quien autorices. Después de vincularse, cada persona entra con su propia cuenta.
    </p>
  </section>
</template>
