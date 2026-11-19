<script setup lang="ts">
import DateField from './DateField.vue'
import TimeField from './TimeField.vue'

/**
 * Fecha y hora de negocio juntas (2026-10-10, pedido del usuario: "selectores de fecha como en pagos, que tengan hora").
 * No es un control nuevo: agrupa el `DateField` (calendario propio) y el `TimeField` (hora nativa de 24 h) de la app
 * lado a lado bajo una sola leyenda, para que el pago, los filtros de Pagos y el corte de caja capturen igual.
 * - `v-model:date` es `aaaa-mm-dd` y `v-model:time` es `HH:MM`, los mismos formatos que validan los contratos.
 * - La hora puede quedar vacía cuando quien lo usa la trata como opcional (filtros: vacío = día completo).
 * - `dateId`/`timeId` son explícitos para conservar los identificadores que usan las pruebas y las etiquetas.
 * En contenedores angostos los dos campos se apilan.
 */
defineProps<{ dateId: string; timeId: string; label: string; dateLabel?: string; timeLabel?: string; help?: string; error?: string; disabled?: boolean; min?: string; max?: string; isDateClearable?: boolean }>()
const date = defineModel<string>('date', { default: '' })
const time = defineModel<string>('time', { default: '' })
</script>
<template>
  <fieldset
    class="date-time-field"
    :aria-describedby="error || help ? dateId + '-group-help' : undefined"
  >
    <legend>{{ label }}</legend>
    <div class="date-time-row">
      <DateField
        :id="dateId"
        v-model="date"
        :label="dateLabel ?? 'Fecha'"
        :min="min"
        :max="max"
        :disabled="disabled"
        :is-clearable="isDateClearable"
      />
      <TimeField
        :id="timeId"
        v-model="time"
        :label="timeLabel ?? 'Hora'"
        :disabled="disabled"
      />
    </div>
    <p
      v-if="error || help"
      :id="dateId + '-group-help'"
      class="field-help"
      :class="{ 'tone-error': error }"
    >
      {{ error || help }}
    </p>
  </fieldset>
</template>
<style scoped>
.date-time-field { display: grid; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; container-type: inline-size; }
.date-time-field legend { padding: 0; margin-bottom: 6px; font-weight: 700; font-size: 14px; }
/* La fecha ocupa más que la hora: "04 oct 2026" contra "14:30". */
.date-time-row { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--spaceMedium); align-items: start; }
@container (max-width: 300px) { .date-time-row { grid-template-columns: minmax(0, 1fr); } }
</style>
