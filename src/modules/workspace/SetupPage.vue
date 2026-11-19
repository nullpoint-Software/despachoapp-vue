<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import InstallationPage from '../installation/InstallationPage.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import ThemeToggle from '../../shared/components/ThemeToggle.vue'
import ApplicationVersion from '../../shared/components/ApplicationVersion.vue'
import ApplicationLogo from '../../shared/components/ApplicationLogo.vue'
import { evaluatePhase, isDeviceReady } from './sessionState'

/**
 * Instalación del equipo, a pantalla completa y sin menú: se hace una sola vez. Host prepara la base,
 * crea el administrador y la conexión segura; Cliente se vincula con la clave USB. En cuanto el
 * equipo queda listo se pasa al inicio de sesión. Desde el inicio de sesión también se abre para
 * revisar la conexión (`isReviewing`); en ese caso no se sale sola.
 */
const props = defineProps<{ isReviewing?: boolean }>()
const emit = defineEmits<{ back: [] }>()
let timer: ReturnType<typeof setTimeout> | undefined
let isDisposed = false
async function watchReadiness(): Promise<void> {
  if (!props.isReviewing && await isDeviceReady() && !isDisposed) { await evaluatePhase(); return }
  if (!isDisposed) timer = setTimeout(() => { void watchReadiness() }, 2000)
}
onMounted(() => { timer = setTimeout(() => { void watchReadiness() }, 2000) })
onBeforeUnmount(() => { isDisposed = true; clearTimeout(timer) })
</script>

<template>
  <div
    class="setup-screen"
    data-testid="setup-page"
  >
    <header class="application-header">
      <!-- Aún no hay despacho: la instalación muestra la marca de la app (ADR-042). -->
      <div class="brand-identity">
        <div><ApplicationLogo /><span class="brand-caption">INSTALACIÓN DEL EQUIPO</span></div>
      </div>
      <div class="header-actions">
        <ActionButton
          v-if="isReviewing"
          @click="emit('back')"
        >
          <ArrowLeft
            :size="16"
            aria-hidden="true"
          /> Volver al inicio de sesión
        </ActionButton>
        <ThemeToggle />
      </div>
    </header>
    <main
      id="main-content"
      tabindex="-1"
    >
      <div class="page-content">
        <InstallationPage context="setup" />
      </div>
    </main>
    <footer><ApplicationVersion /><span>Fiscenix / Instalación del equipo</span></footer>
  </div>
</template>

<style scoped>
.setup-screen { height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; background: var(--canvasColor); }
</style>
