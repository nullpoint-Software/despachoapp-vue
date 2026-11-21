<script setup lang="ts">
import ReconciliationPanel from './ReconciliationPanel.vue'
import HelpTip from '../../shared/components/HelpTip.vue'

/**
 * Sección "Conciliación" del menú (antes una pestaña de Fiscal; en el original, un modal de Fiscal).
 * El menú sólo la muestra con `reports.read`; conciliar y revisar exigen `bank.reconcile` en el Host.
 */
</script>
<template>
  <div
    class="reconciliation-page"
    data-testid="reconciliation-page"
  >
    <div class="help-title-row">
      <h1>Conciliación bancaria</h1>
      <HelpTip
        title="Cómo se concilia"
        text="Elige cliente y mes y abre el estado de cuenta (PDF con texto, CSV, TXT o XML): se lee en este equipo sin guardarse. Cada renglón queda como Coincide, Revisar, Sólo banco o Sólo CFDI frente a los CFDI y pagos del mes; tu revisión se guarda en el Host."
      />
    </div>
    <p class="lede">
      Detecta abonos, cargos y diferencias entre el estado de cuenta y los CFDI reportados del mes.
    </p>
    <ReconciliationPanel />
  </div>
</template>
