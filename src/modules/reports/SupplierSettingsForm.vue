<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { creditKinds, importKinds, operationTypesByThirdParty, supplierRegions, thirdPartyTypes, type DiotSupplier, type DiotSupplierSettings, type OperationType, type ThirdPartyType } from '../../../shared/contracts/fiscalReports'
import ActionButton from '../../shared/components/ActionButton.vue'
import CheckField from '../../shared/components/CheckField.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import TextField from '../../shared/components/TextField.vue'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { creditKindLabels, importKindLabels, operationTypeLabels, regionLabels, thirdPartyTypeLabels } from './reportLabels'

/**
 * Ajustes DIOT de un proveedor del cliente (Host, por cliente y RFC), como el diálogo del original.
 * El tipo de operación se filtra por tipo de tercero (instructivo SAT 2025). Los datos del extranjero
 * sólo aparecen para el tercero 05 y la jurisdicción sólo con país ZZZ. Guardar envía la revisión vigente.
 */
const props = defineProps<{ clientId: string; supplier: DiotSupplier }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const draft = ref<DiotSupplierSettings>(copy(props.supplier)), isSaving = ref(false), error = ref('')
function copy(supplier: DiotSupplier): DiotSupplierSettings {
  return { thirdPartyType: supplier.thirdPartyType, operationType: supplier.operationType, foreignTaxId: supplier.foreignTaxId, countryCode: supplier.countryCode, jurisdiction: supplier.jurisdiction,
    region: supplier.region, importKind: supplier.importKind, creditKind: supplier.creditKind, creditProportion: supplier.creditProportion, hasFiscalEffect: supplier.hasFiscalEffect }
}
const thirdPartyOptions = thirdPartyTypes.map(value => ({ value, label: thirdPartyTypeLabels[value] }))
const operationOptions = computed(() => operationTypesByThirdParty[draft.value.thirdPartyType].map(value => ({ value, label: operationTypeLabels[value] })))
const regionOptions = supplierRegions.map(value => ({ value, label: regionLabels[value] }))
const importOptions = importKinds.map(value => ({ value, label: importKindLabels[value] }))
const creditOptions = creditKinds.map(value => ({ value, label: creditKindLabels[value] }))
// Cambiar de tipo de tercero deja la primera operación válida, como el filtro del original.
watch(() => draft.value.thirdPartyType, type => { if (!operationTypesByThirdParty[type].includes(draft.value.operationType)) draft.value.operationType = operationTypesByThirdParty[type][0]! })
const percentage = computed({
  get: () => String(Math.round(Number(draft.value.creditProportion) * 10000) / 100),
  set: value => { const number = Number(value.replace(',', '.')); draft.value.creditProportion = Number.isFinite(number) ? Math.min(1, Math.max(0, number / 100)).toFixed(4) : draft.value.creditProportion }
})

async function save(): Promise<void> {
  if (isSaving.value) return
  isSaving.value = true; error.value = ''
  try {
    await window.contapp.manageFiscalReports({ action: 'saveSupplier', clientId: props.clientId, rfc: props.supplier.rfc, revision: props.supplier.revision, settings: { ...draft.value } })
    emit('saved')
  } catch (caught) { error.value = readIpcErrorMessage(caught, 'No se guardaron los ajustes. Si otro equipo los cambió, cierra y vuelve a abrir.') }
  finally { isSaving.value = false }
}
</script>
<template>
  <form
    class="supplier-form"
    data-testid="supplier-form"
    @submit.prevent="save"
  >
    <InlineNotice
      v-if="error"
      title="Ajustes no guardados"
      tone="error"
    >
      <p>{{ error }}</p>
    </InlineNotice>
    <p class="field-help">
      {{ supplier.rfc }} · Se aplican a todas las DIOT de este cliente con este proveedor.
    </p>
    <div class="supplier-grid">
      <SelectField
        id="supplier-third-party"
        :model-value="draft.thirdPartyType"
        label="Tipo de tercero"
        :options="thirdPartyOptions"
        :disabled="isSaving"
        @update:model-value="draft.thirdPartyType = $event as ThirdPartyType"
      />
      <SelectField
        id="supplier-operation"
        :model-value="draft.operationType"
        label="Tipo de operación"
        :options="operationOptions"
        :disabled="isSaving"
        @update:model-value="draft.operationType = $event as OperationType"
      />
      <SelectField
        id="supplier-region"
        :model-value="draft.region"
        label="Región"
        :options="regionOptions"
        :disabled="isSaving"
        @update:model-value="draft.region = $event as DiotSupplierSettings['region']"
      />
      <SelectField
        id="supplier-import"
        :model-value="draft.importKind"
        label="Importación"
        :options="importOptions"
        :disabled="isSaving"
        @update:model-value="draft.importKind = $event as DiotSupplierSettings['importKind']"
      />
      <SelectField
        id="supplier-credit"
        :model-value="draft.creditKind"
        label="Acreditamiento del IVA"
        :options="creditOptions"
        :disabled="isSaving"
        @update:model-value="draft.creditKind = $event as DiotSupplierSettings['creditKind']"
      />
      <TextField
        v-if="draft.creditKind === 'proportional'"
        id="supplier-proportion"
        v-model="percentage"
        label="Proporción acreditable (%)"
        :disabled="isSaving"
      />
      <template v-if="draft.thirdPartyType === '05'">
        <TextField
          id="supplier-foreign-id"
          v-model="draft.foreignTaxId"
          label="Número de identificación fiscal"
          :disabled="isSaving"
        />
        <TextField
          id="supplier-country"
          v-model="draft.countryCode"
          label="País de residencia (clave SAT de 3 letras)"
          help="Por ejemplo USA. ZZZ si no está en el catálogo."
          :disabled="isSaving"
        />
        <TextField
          v-if="draft.countryCode.toUpperCase() === 'ZZZ'"
          id="supplier-jurisdiction"
          v-model="draft.jurisdiction"
          label="Jurisdicción fiscal"
          :disabled="isSaving"
        />
      </template>
    </div>
    <CheckField
      id="supplier-fiscal-effect"
      v-model="draft.hasFiscalEffect"
      label="Se dio efectos fiscales a los comprobantes de este proveedor"
      :disabled="isSaving"
    />
    <div class="actions form-footer">
      <ActionButton
        variant="primary"
        type="submit"
        :is-loading="isSaving"
      >
        Guardar para este proveedor
      </ActionButton>
      <ActionButton
        :disabled="isSaving"
        @click="emit('cancel')"
      >
        Cancelar
      </ActionButton>
    </div>
  </form>
</template>
<style scoped>
.supplier-form { display: grid; gap: var(--spaceMedium); }
.supplier-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--spaceMedium); align-items: end; }
</style>
