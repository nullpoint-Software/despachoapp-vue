<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDownToLine } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import { calculateRfc } from '../../../shared/fiscal/calculateRfc'
import ActionButton from '../../shared/components/ActionButton.vue'
import DateField from '../../shared/components/DateField.vue'
import TextField from '../../shared/components/TextField.vue'

/**
 * Calculadora de RFC (2026-10-17, [[SAT-PORTAL#RFC sin ficha]]): con nombre y fecha propone el RFC de una persona física
 * o moral (`calculateRfc`, algoritmo público del SAT) mientras se escribe. Vive en un modal de Constancias → No
 * clientes (`RfcLookupPanel`, «Calcular RFC», 2026-10-17). «Usar este RFC» lo pasa a la consulta
 * (`use`), donde se verifica con el SAT: la homoclave calculada es la probable, el SAT puede asignar otra a homónimos.
 * No consulta nada ni guarda los datos escritos.
 */
const emit = defineEmits<{ use: [rfc: string] }>()
const today = getOfficeToday()
const kind = ref<'natural' | 'juristic'>('natural')
const name = ref(''), firstLastName = ref(''), secondLastName = ref(''), birthDate = ref('')
const legalName = ref(''), creationDate = ref('')

/** RFC propuesto, o `null` mientras falten datos. */
const proposedRfc = computed(() => {
  try {
    return kind.value === 'natural'
      ? calculateRfc({ kind: 'natural', name: name.value, firstLastName: firstLastName.value, secondLastName: secondLastName.value, birthDate: birthDate.value })
      : calculateRfc({ kind: 'juristic', legalName: legalName.value, creationDate: creationDate.value })
  } catch { return null }
})
</script>

<template>
  <section
    class="rfc-calculator"
    data-testid="rfc-calculator"
    aria-label="Calculadora de RFC"
  >
    <div
      v-sliding-tabs
      class="segmented-tabs"
      role="tablist"
      aria-label="Tipo de persona"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="kind === 'natural'"
        @click="kind = 'natural'"
      >
        Persona física
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="kind === 'juristic'"
        @click="kind = 'juristic'"
      >
        Persona moral
      </button>
    </div>
    <div
      v-if="kind === 'natural'"
      class="rfc-calculator-fields"
    >
      <TextField
        id="rfc-calculator-name"
        v-model="name"
        class="rfc-calculator-wide"
        label="Nombre(s)"
        autocomplete="off"
      />
      <TextField
        id="rfc-calculator-first-last-name"
        v-model="firstLastName"
        label="Apellido paterno"
        autocomplete="off"
      />
      <TextField
        id="rfc-calculator-second-last-name"
        v-model="secondLastName"
        label="Apellido materno (opcional)"
        autocomplete="off"
      />
      <DateField
        id="rfc-calculator-birth-date"
        v-model="birthDate"
        label="Fecha de nacimiento"
        :max="today"
      />
    </div>
    <div
      v-else
      class="rfc-calculator-fields"
    >
      <TextField
        id="rfc-calculator-legal-name"
        v-model="legalName"
        class="rfc-calculator-wide"
        label="Razón social"
        autocomplete="off"
        help="Como en el acta, con o sin el tipo de sociedad (S.A. de C.V.…)."
      />
      <DateField
        id="rfc-calculator-creation-date"
        v-model="creationDate"
        label="Fecha de constitución"
        :max="today"
      />
    </div>
    <div
      class="rfc-calculator-result"
      role="status"
    >
      <template v-if="proposedRfc">
        <output
          class="rfc-calculator-value"
          data-testid="rfc-calculator-value"
        >{{ proposedRfc }}</output>
        <ActionButton @click="emit('use', proposedRfc)">
          <ArrowDownToLine
            :size="15"
            aria-hidden="true"
          /> Usar este RFC
        </ActionButton>
      </template>
      <span
        v-else
        class="field-help"
      >Escribe {{ kind === 'natural' ? 'nombre, apellidos y fecha de nacimiento' : 'la razón social y la fecha de constitución' }} para calcularlo.</span>
    </div>
    <p class="field-help">
      La homoclave (los 3 últimos caracteres) es la más probable: el SAT da otra a personas con el mismo nombre. Verifícalo con el SAT.
    </p>
  </section>
</template>

<style scoped>
.rfc-calculator { display: grid; gap: var(--spaceMedium); min-width: 0; }
.rfc-calculator > .segmented-tabs { justify-self: start; }
/* Dos columnas alineadas arriba: nombre o razón social a lo ancho; apellidos lado a lado; la fecha en la primera. */
.rfc-calculator-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spaceMedium); align-items: start; }
.rfc-calculator-wide { grid-column: 1 / -1; }
@media (max-width: 560px) { .rfc-calculator-fields { grid-template-columns: minmax(0, 1fr); } }
.rfc-calculator-result { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; min-height: 44px; }
.rfc-calculator-value { font-family: var(--monoFontFamily); font-size: 24px; font-weight: 800; letter-spacing: .06em; overflow-wrap: anywhere; }
.rfc-calculator > .field-help { margin: 0; }
</style>
