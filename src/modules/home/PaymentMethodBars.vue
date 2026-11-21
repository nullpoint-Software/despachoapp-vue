<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import type { PaymentMethodShare } from './homeDashboardMetrics'

/**
 * "Cobros por forma de pago" del mes (tablero de Inicio, bento 2026-10-06), con el corte mensual que ya consulta el
 * tablero (`MovementSummary.byPaymentMethod`); no hay consultas nuevas.
 *
 * Decisiones (skill dataviz):
 * - Es magnitud por categoría, no parte de un todo con muchas piezas: barras horizontales de una sola serie en el
 *   acento (DESIGN.md no admite un segundo acento ni una paleta categórica), escaladas a la forma de pago mayor.
 * - Con ≤ 4 barras cada una lleva su importe exacto y su porcentaje en tinta; nunca en el color de la serie.
 * - HTML (no SVG) para que los rótulos se acomoden solos hasta 480 px. La lista tiene nombre accesible.
 */
const props = defineProps<{ shares: PaymentMethodShare[] }>()
const maximumAmount = computed(() => Math.max(1, ...props.shares.map(share => Number(share.incomeAmount))))
</script>

<template>
  <ol
    class="payment-method-bars"
    aria-label="Cobros del mes por forma de pago"
  >
    <li
      v-for="share in shares"
      :key="share.paymentMethod"
    >
      <span class="method-heading">
        <span class="method-label">{{ share.label }}</span>
        <span class="method-amount">{{ formatMoney(share.incomeAmount) }} <span class="method-share">· {{ share.sharePercent }} %</span></span>
      </span>
      <span
        class="method-track"
        aria-hidden="true"
      >
        <span
          class="method-bar"
          :style="{ width: Math.max(2, Number(share.incomeAmount) / maximumAmount * 100) + '%' }"
        />
      </span>
    </li>
  </ol>
</template>

<style scoped>
.payment-method-bars { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.payment-method-bars li { display: grid; gap: 4px; min-width: 0; }
.method-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 8px; }
.method-label { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.method-amount { font-family: var(--monoFontFamily); font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--textColor); }
.method-share { font-weight: 400; color: var(--mutedTextColor); }
/* Riel en hilo con la barra encima: la parte vacía se lee como "lo que le falta para igualar a la mayor". */
.method-track { display: block; height: 12px; background: var(--subtleColor); border-bottom: 1px solid var(--hairlineColor); }
.method-bar { display: block; height: 100%; background: var(--accentColor); }
@media (prefers-reduced-motion: no-preference) { .method-bar { transition: width var(--durationFast) var(--easeSmoothOut); } }
</style>
