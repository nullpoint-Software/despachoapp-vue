<script setup lang="ts">
import { computed } from 'vue'
import { listPageSizes, type ListPageSize, type PagedList } from '../../../shared/contracts/localPreferences'
import { pageSizeFor, setPageSize } from '../../modules/settings/localPreferencesState'
import SelectField from './SelectField.vue'

/**
 * «Elementos por página» del modal de Filtros (2026-10-17): cuántos renglones o tarjetas muestra la lista antes de
 * paginar. Se guarda al elegir en las preferencias LOCAL de este equipo (`pageSizes`), no espera a «Aplicar filtros».
 */
const props = defineProps<{ id: string; list: PagedList; label?: string }>()
const options = listPageSizes.map(size => ({ value: String(size), label: String(size) }))
const value = computed({
  get: () => String(pageSizeFor(props.list)),
  set: (next: string) => { const size = Number(next) as ListPageSize; if (listPageSizes.includes(size)) void setPageSize(props.list, size) }
})
</script>

<template>
  <SelectField
    :id="id"
    v-model="value"
    :label="label ?? 'Elementos por página'"
    :options="options"
  />
</template>
