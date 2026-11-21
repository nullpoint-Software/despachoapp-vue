<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search } from '@lucide/vue'
import type { LegacyEventFilter, LegacyEventRecord } from '../../../shared/contracts/legacyMigration'
import ActionButton from '../../shared/components/ActionButton.vue'
import DataTable from '../../shared/components/DataTable.vue'
import DateField from '../../shared/components/DateField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import TextField from '../../shared/components/TextField.vue'

/**
 * Eventos heredados (bitácora `events` de la app anterior, guardada append-only en el Host): tabla de sólo lectura con
 * filtros por fecha, usuario heredado (su número en la app anterior) y tipo. Sólo existe en Respaldos del equipo Host;
 * el Host vuelve a exigir `migration.run`. Los payloads no se muestran aquí (pueden ser largos); ya llegan depurados.
 * Páginas del Host con "Cargar más" (`offset`).
 */
const fromDate = ref(''), toDate = ref(''), legacyUserId = ref(''), eventType = ref('')
const events = ref<LegacyEventRecord[]>([])
/** Filtro de la última búsqueda: "Cargar más" pagina esa misma consulta aunque los campos ya se hayan editado. */
let appliedFilter: Omit<LegacyEventFilter, 'offset'> = { fromDate: null, toDate: null, legacyUserId: null, type: null }
const hasMore = ref(false), isLoading = ref(false), error = ref('')
const formatInstant = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const columns = [{ key: 'occurredAt', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'type', label: 'Tipo' }, { key: 'aggregate', label: 'Registro' }]
const rows = computed(() => events.value.map(event => ({ rowId: event.legacyEventId, values: { occurredAt: formatInstant(event.occurredAt), user: event.userDisplayName ?? 'Sin usuario', type: event.type, aggregate: event.aggregateId ?? '—' } })))

async function load(isNextPage = false): Promise<void> {
  if (isLoading.value) return
  isLoading.value = true; error.value = ''
  try {
    if (!isNextPage) appliedFilter = { fromDate: fromDate.value || null, toDate: toDate.value || null, legacyUserId: legacyUserId.value.trim() || null, type: eventType.value.trim() || null }
    const filter: LegacyEventFilter = { ...appliedFilter, offset: isNextPage ? events.value.length : 0 }
    const result = await window.contapp.runLegacyMigration({ action: 'listEvents', filter })
    if (result.status !== 'events') throw new Error('Unexpected legacy migration result')
    events.value = isNextPage ? [...events.value, ...result.events] : result.events
    hasMore.value = result.hasMore
  } catch { error.value = 'No se pudieron consultar los eventos heredados. Revisa la conexión con el Host.' }
  finally { isLoading.value = false }
}
onMounted(() => { void load() })
</script>

<template>
  <section
    class="legacy-events"
    aria-labelledby="legacy-events-title"
  >
    <h3 id="legacy-events-title">
      Eventos de la app anterior
    </h3>
    <form
      class="legacy-events-filters"
      @submit.prevent="load()"
    >
      <DateField
        id="legacy-events-from"
        v-model="fromDate"
        label="Desde"
        is-clearable
      />
      <DateField
        id="legacy-events-to"
        v-model="toDate"
        label="Hasta"
        is-clearable
      />
      <TextField
        id="legacy-events-user"
        v-model="legacyUserId"
        label="Usuario (número en la app anterior)"
        autocomplete="off"
      />
      <TextField
        id="legacy-events-type"
        v-model="eventType"
        label="Tipo"
        autocomplete="off"
      />
      <ActionButton
        type="submit"
        :is-loading="isLoading"
      >
        <Search
          :size="16"
          aria-hidden="true"
        /> Buscar eventos
      </ActionButton>
    </form>
    <InlineNotice
      v-if="error"
      title="Eventos no disponibles"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <DataTable
      caption="Eventos heredados"
      :columns="columns"
      :rows="rows"
    />
    <ActionButton
      v-if="hasMore"
      :is-loading="isLoading"
      @click="load(true)"
    >
      Cargar más
    </ActionButton>
  </section>
</template>

<style scoped>
.legacy-events { display: grid; gap: var(--spaceMedium); }
.legacy-events h3 { margin: 0; font-size: 15px; font-weight: 600; }
.legacy-events-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); gap: var(--spaceSmall); align-items: end; }
</style>
