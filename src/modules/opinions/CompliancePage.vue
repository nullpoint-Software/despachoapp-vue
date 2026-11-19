<script setup lang="ts">
import { ref } from 'vue'
import OpinionsPanel from './OpinionsPanel.vue'
import OpinionSchedulePanel from './OpinionSchedulePanel.vue'
import TaxCertificatesPanel from './TaxCertificatesPanel.vue'
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Sección "Cumplimiento" del menú (antes una pestaña de Fiscal), como `/app/cumplimiento` del original.
 * El menú sólo la muestra con `opinions.read`; el Host vuelve a verificar cada operación.
 * Pestañas (2026-10-17, pedido del usuario: la CSF en su propia sección, como la opinión):
 * - **Opiniones:** arriba, las consultas programadas (7.1); abajo, el panorama, la lista y el detalle (6.4).
 * - **Constancias:** las CSF de cada cliente y «Obtener CSF con RFC y CIEC» (`TaxCertificatesPanel`).
 *   Incluye «No clientes» (2026-10-17): calculadora de RFC, Validación de RFC y CSF de personas sin ficha.
 * Con `v-show` cada pestaña conserva su estado (por ejemplo, un captcha a medio escribir).
 */
const tab = ref<'opinions' | 'certificates'>('opinions')
</script>
<template>
  <div
    class="compliance-page"
    data-testid="compliance-page"
  >
    <div class="help-title-row">
      <h1>Cumplimiento fiscal</h1>
      <HelpTip
        title="Resultados de la opinión"
        text="Fiscenix consulta la opinión 32-D en la página pública del SAT y la clasifica: Positiva, Con pendientes, Suspensión, Sin obligaciones o No inscrito, entre otras. Una positiva vale 30 días naturales desde su emisión. «No pública» significa que el cliente debe autorizar en el SAT que su opinión se publique. En Constancias están las constancias de situación fiscal de cada cliente."
      />
    </div>
    <p class="lede">
      Opiniones de cumplimiento y constancias de situación fiscal de tus clientes.
    </p>
    <div
      v-sliding-tabs
      class="segmented-tabs"
      role="tablist"
      aria-label="Cumplimiento"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'opinions'"
        @click="tab = 'opinions'"
      >
        Opiniones
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'certificates'"
        @click="tab = 'certificates'"
      >
        Constancias
      </button>
    </div>
    <div
      v-show="tab === 'opinions'"
      class="compliance-tab"
    >
      <OpinionSchedulePanel />
      <OpinionsPanel />
    </div>
    <TaxCertificatesPanel v-show="tab === 'certificates'" />
  </div>
</template>

<style scoped>
/* La pestaña conserva el flujo de la página: los paneles traen sus propios márgenes. */
.compliance-tab { min-width: 0; }
</style>
