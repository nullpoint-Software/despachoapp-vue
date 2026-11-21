<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import type { DockerRuntimeAction, DockerRuntimeStatus } from '../../../shared/contracts/dockerRuntime'
import SelectField from '../../shared/components/SelectField.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
const status = ref<DockerRuntimeStatus>({ options: [], selected: '', isLocked: false, isBusy: false, message: 'Buscando motores Docker...' })
const runtimeOptions = computed(() => [
  ...(!status.value.selected ? [{ value: '', label: 'Selecciona un motor' }] : []),
  { value: 'desktop', label: 'Docker Desktop' + (status.value.options.includes('desktop') ? ' · detectado' : ' · requiere instalación') },
  ...[...new Set([...status.value.options, status.value.selected])].filter(item => item.startsWith('wsl:')).map(item => ({ value: item, label: 'Docker Engine · ' + item.slice(4) }))
])
const isSearching = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | undefined
async function execute(action: DockerRuntimeAction): Promise<void> {
  if (action === 'detect') isSearching.value = true
  try { status.value = await window.contapp.manageDockerRuntime(action); if (action !== 'status') error.value = '' }
  catch { error.value = 'No se pudo realizar la operación. Revisa el motor y vuelve a intentar.' }
  finally { if (action === 'detect') isSearching.value = false }
}
// Leer estado no inicia WSL repetidamente: detectar e instalar son acciones separadas.
onMounted(() => { void execute('detect'); timer = setInterval(() => { if (!isSearching.value) void execute('status') }, 2000) })
onBeforeUnmount(() => clearInterval(timer))
</script>
<template>
  <div class="docker-runtime-panel">
    <h4>Motor del servidor</h4>
    <p>Docker aloja MySQL y conserva los datos del despacho en este Host. Puedes usar Engine dentro de WSL 2 sin Desktop, o Docker Desktop. Los equipos Cliente no necesitan su propio MySQL.</p>
    <InlineNotice
      title="Docker"
      :tone="error ? 'error' : 'info'"
    >
      <p role="status">
        {{ error || status.message }}
      </p>
      <p v-if="status.isLocked">
        El motor está vinculado a esta base. Cambiarlo requiere migrar sus datos.
      </p>
    </InlineNotice>
    <SelectField
      id="docker-runtime"
      label="Motor elegido"
      :model-value="status.selected"
      :options="runtimeOptions"
      :disabled="status.isLocked || status.isBusy || isSearching"
      @update:model-value="value => value && execute(`select:${value}`)"
    />
    <div class="docker-runtime-actions">
      <ActionButton
        :is-loading="isSearching"
        :disabled="status.isBusy"
        @click="execute('detect')"
      >
        Buscar de nuevo
      </ActionButton>
      <ActionButton
        :disabled="status.isLocked || isSearching"
        :is-loading="status.isBusy"
        @click="execute('install')"
      >
        Instalar Engine en WSL...
      </ActionButton>
      <ActionButton @click="execute('download')">
        Descargar Docker Desktop
      </ActionButton>
    </div>
    <p class="field-help">
      La instalación en WSL pedirá confirmación antes de descargar Ubuntu y Docker. Si WSL 2 no está habilitado, configúralo en Windows primero o elige Desktop.
    </p>
  </div>
</template>
<style scoped>
.docker-runtime-panel { display: grid; gap: 0.8rem; min-width: 0; }
.docker-runtime-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
