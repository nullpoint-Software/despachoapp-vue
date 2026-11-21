<script setup lang="ts">
import { computed } from 'vue'
import SearchSelectField from '../../shared/components/SearchSelectField.vue'
import { findTaxRegime } from '../../../shared/fiscal/taxRegimes'
import { taxRegimeOptions } from './clientPresentation'

/**
 * Régimen fiscal desde el catálogo c_RegimenFiscal incluido en la app (ADR-032), con el selector con búsqueda común
 * (2026-10-04, igual que el de clientes): se escribe el código o unas palabras y se elige.
 * - Con RFC capturado sólo se ofrecen los regímenes de su tipo de persona (12 = moral, 13 = física).
 * - Los regímenes con fin de vigencia no se ofrecen, salvo el que la ficha ya tenga.
 * - Una ficha anterior al catálogo puede traer un régimen escrito a mano; se muestra como aviso hasta elegir uno.
 */
const props = defineProps<{ rfc: string; error?: string; disabled?: boolean }>()
const value = defineModel<string>({ default: '' })
const personType = computed(() => props.rfc.length === 12 ? 'moral' : props.rfc.length === 13 ? 'física' : null)
const legacyValue = computed(() => value.value && !findTaxRegime(value.value) ? value.value : '')
const options = computed(() => taxRegimeOptions({ personType: personType.value, keepCode: value.value }))
</script>
<template>
  <div class="regime-picker">
    <p
      v-if="legacyValue"
      class="regime-legacy"
    >
      Capturado antes como “{{ legacyValue }}”. Elige el régimen del catálogo.
    </p>
    <SearchSelectField
      id="client-tax-regime"
      v-model="value"
      label="Régimen fiscal"
      placeholder="Código o nombre del régimen"
      :options="options"
      :disabled="disabled"
      :error="error"
      :help="personType ? 'Regímenes para persona ' + personType + ', según el RFC.' : 'Captura el RFC para ver sólo los regímenes de su tipo de persona.'"
    />
  </div>
</template>
<style scoped>
.regime-picker { display: grid; gap: 8px; min-width: 0; }
.regime-legacy { margin: 0; padding: 8px 12px; border: 2px solid var(--warningColor); background: var(--warningFill, var(--subtleColor)); color: var(--warningText, var(--textColor)); font-size: 13px; }
</style>
