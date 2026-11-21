<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LegacyConflict, LegacyDecision, LegacyIssue } from '../../../shared/contracts/legacyMigration'
import ActionButton from '../../shared/components/ActionButton.vue'
import SelectField from '../../shared/components/SelectField.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import TextField from '../../shared/components/TextField.vue'
import { applyToAll, defaultPrimaryLegacyClientId, isDecisionComplete, needsDecision } from './legacyMigrationDecisions'

/**
 * Lista de conflictos o incidencias del asistente de migración (pasos "Conflictos" e "Incidencias"):
 * - Agrupa por tipo; cada grupo muestra cuántos faltan y "Aplicar a todos" (opciones sin datos extra o `primary`).
 * - Las opciones de cada renglón salen de `allowedChoices` del Host (nunca de una lista fija): por ejemplo un pago
 *   cambiado en origen puede ofrecer "Movimiento del despacho" además de conservar o aplicar.
 * - Opciones con datos: `link` elige el destino entre `candidates`, `create` pide el usuario nuevo, `primary` elige el
 *   cliente principal del mismo RFC y `taskState` el estado. Las incidencias informativas sólo se listan.
 * - Para no congelar la ventana con miles de renglones, cada grupo muestra 50 y "Mostrar más".
 * Las decisiones son `v-model` (un `Map` nuevo en cada cambio); el Host las vuelve a validar al ejecutar.
 */
type DecisionItem = LegacyConflict | LegacyIssue
type Choice = LegacyDecision['choice']
const props = defineProps<{ items: DecisionItem[]; listLabel: string }>()
const decisions = defineModel<Map<string, LegacyDecision>>('decisions', { required: true })

const kindLabels: Record<DecisionItem['kind'], string> = {
  userExists: 'Usuario que ya existe en Fiscenix', invalidUsername: 'Usuario no válido o repetido', clientExists: 'Cliente que ya existe (mismo RFC)', duplicateRfc: 'RFC repetido en el archivo',
  changedSinceImport: 'Cambió desde la migración anterior', expenseClient: 'Contribuyente «gastos»',
  invalidAmount: 'Importe no válido', orphanPayment: 'Movimiento sin cliente', unknownTaskState: 'Estado de tarea desconocido', inProgressWithoutAssignee: 'En progreso sin responsable (queda disponible)',
  missingAttendant: 'Sin quien atendió (queda a nombre de quien migra)', deletedAtSource: 'Borrado en la app anterior (no se borra en Fiscenix)', invalidPhoto: 'Foto no válida (el usuario queda sin foto)',
  invalidCiec: 'CIEC no válida (no se guarda)', zeroPayment: 'Importe en cero (se omite)', invalidDate: 'Fecha no válida (se omite)', invalidJson: 'Evento ilegible (se omite)',
  truncatedText: 'Texto recortado al largo que admite Fiscenix', invalidRfc: 'RFC no válido (el cliente se migra sin RFC)',
  cleanedText: 'Texto corregido (caracteres de control, nombre vacío o correo no válido)', tooManyAssignees: 'Más de 10 responsables (se conservan 10)',
}
const choiceLabels: Record<Choice, string> = {
  link: 'Vincular con el existente', create: 'Crear con usuario nuevo', reject: 'Rechazar', keepCurrent: 'Conservar lo de Fiscenix', applyChange: 'Aplicar el cambio',
  officeMovement: 'Movimiento del despacho', regularClient: 'Cliente normal', taskState: 'Elegir estado', primary: 'Elegir el principal',
}
const taskStateOptions = [{ value: 'available', label: 'Disponible' }, { value: 'inProgress', label: 'En progreso' }, { value: 'completed', label: 'Terminada' }]
/**
 * Opciones de "Aplicar a todos": las que no necesitan un dato propio de cada renglón, más `primary`, que `applyToAll`
 * resuelve con un solo principal por RFC.
 */
const bulkableChoices: Choice[] = ['reject', 'keepCurrent', 'applyChange', 'officeMovement', 'regularClient', 'primary']
const pageSize = 50

const groups = computed(() => {
  const byKind = new Map<DecisionItem['kind'], DecisionItem[]>()
  for (const item of props.items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item])
  return [...byKind.entries()].map(([kind, items]) => {
    const isInformational = !items.some(needsDecision)
    const bulkChoices = bulkableChoices.filter(choice => items.some(item => item.allowedChoices.includes(choice)))
    return { kind, items, isInformational, bulkChoices }
  })
})
const visibleCounts = ref<Record<string, number>>({})
const bulkChoiceByKind = ref<Record<string, Choice>>({})
const visibleItems = (kind: string, items: DecisionItem[]) => items.slice(0, visibleCounts.value[kind] ?? pageSize)
const isDecided = (item: DecisionItem) => isDecisionComplete(item, decisions.value.get(item.key))
const pendingCount = (items: DecisionItem[]) => items.filter(item => needsDecision(item) && !isDecided(item)).length
const isInformationalItem = (item: DecisionItem) => !needsDecision(item)
/** RFC repetido: los miembros del grupo son los conflictos `duplicateRfc` con el mismo RFC (`currentLabel`). */
function primaryOptions(item: DecisionItem): { value: string; label: string }[] {
  if (!('currentLabel' in item)) return []
  return props.items.filter(other => other.kind === 'duplicateRfc' && 'currentLabel' in other && other.currentLabel === item.currentLabel).map(other => ({ value: other.legacyId, label: other.legacyLabel }))
}

function setDecision(decision: LegacyDecision): void { decisions.value = new Map(decisions.value).set(decision.key, decision) }
/** Al elegir una opción con datos se propone un valor razonable: el primer candidato, el propio renglón o "Disponible". */
function choose(item: DecisionItem, choice: Choice): void {
  const key = item.key
  if (choice === 'link') { const target = 'candidates' in item ? item.candidates[0] : undefined; if (target) setDecision({ key, choice, targetId: target.targetId }); return }
  if (choice === 'create') { setDecision({ key, choice }); return }
  // Mismo principal que el resto de su RFC: elegir el propio renglón por omisión haría que el Host rechace el grupo.
  if (choice === 'primary') { setDecision({ key, choice, legacyClientId: defaultPrimaryLegacyClientId(props.items, decisions.value, item) }); return }
  if (choice === 'taskState') { setDecision({ key, choice, state: 'available' }); return }
  setDecision({ key, choice } as LegacyDecision)
}
function applyGroup(items: DecisionItem[], kind: string, fallback: Choice | undefined): void {
  const choice = bulkChoiceByKind.value[kind] ?? fallback
  if (choice) decisions.value = applyToAll(decisions.value, items, { key: '', choice } as LegacyDecision)
}
const decisionOf = (item: DecisionItem) => decisions.value.get(item.key)
</script>

<template>
  <div
    class="legacy-decisions"
    :aria-label="listLabel"
    role="group"
  >
    <p
      v-if="!items.length"
      class="field-help"
    >
      No hay nada que decidir en este paso.
    </p>
    <section
      v-for="group in groups"
      :key="group.kind"
      class="legacy-decision-group"
      :data-kind="group.kind"
    >
      <header class="legacy-decision-group-header">
        <h3>{{ kindLabels[group.kind] }} · {{ group.items.length }}</h3>
        <StatusBadge
          v-if="!group.isInformational"
          :tone="pendingCount(group.items) ? 'warning' : 'success'"
        >
          {{ pendingCount(group.items) ? pendingCount(group.items) + ' pendientes' : 'Resuelto' }}
        </StatusBadge>
        <StatusBadge
          v-else
          tone="info"
        >
          Informativo
        </StatusBadge>
      </header>
      <div
        v-if="group.bulkChoices.length"
        class="legacy-bulk"
      >
        <SelectField
          :id="'legacy-bulk-' + group.kind"
          :model-value="bulkChoiceByKind[group.kind] ?? group.bulkChoices[0]"
          :label="'Opción para todos: ' + kindLabels[group.kind]"
          :options="group.bulkChoices.map(choice => ({ value: choice, label: choiceLabels[choice] }))"
          @update:model-value="bulkChoiceByKind[group.kind] = $event as Choice"
        />
        <ActionButton
          :aria-label="'Aplicar a todos: ' + kindLabels[group.kind]"
          @click="applyGroup(group.items, group.kind, group.bulkChoices[0])"
        >
          Aplicar a todos
        </ActionButton>
      </div>
      <ul class="legacy-decision-items">
        <li
          v-for="item in visibleItems(group.kind, group.items)"
          :key="item.key"
          :data-decided="isInformationalItem(item) || isDecided(item)"
        >
          <div class="legacy-decision-labels">
            <span class="legacy-side"><span class="legacy-side-label">App anterior</span>{{ item.legacyLabel }}</span>
            <span
              v-if="'currentLabel' in item && item.currentLabel && item.kind !== 'duplicateRfc'"
              class="legacy-side"
            ><span class="legacy-side-label">Fiscenix</span>{{ item.currentLabel }}</span>
          </div>
          <fieldset
            v-if="!isInformationalItem(item)"
            class="legacy-choices"
          >
            <legend class="sr-only">
              Qué hacer con {{ item.legacyLabel }}
            </legend>
            <label
              v-for="choice in item.allowedChoices"
              :key="choice"
              class="choice-card"
            >
              <input
                type="radio"
                :name="'legacy-choice-' + item.key"
                :value="choice"
                :checked="decisionOf(item)?.choice === choice"
                :disabled="choice === 'link' && !('candidates' in item && item.candidates.length)"
                @change="choose(item, choice)"
              >
              <span>{{ choiceLabels[choice] }}</span>
            </label>
          </fieldset>
          <SelectField
            v-if="decisionOf(item)?.choice === 'link' && 'candidates' in item && item.candidates.length > 1"
            :id="'legacy-target-' + item.key"
            :model-value="(decisionOf(item) as { targetId: string }).targetId"
            :label="'Vincular ' + item.legacyLabel + ' con'"
            :options="item.candidates.map(candidate => ({ value: candidate.targetId, label: candidate.label }))"
            @update:model-value="setDecision({ key: item.key, choice: 'link', targetId: $event })"
          />
          <TextField
            v-if="decisionOf(item)?.choice === 'create'"
            :id="'legacy-username-' + item.key"
            :model-value="(decisionOf(item) as { username?: string }).username ?? ''"
            :label="'Usuario nuevo para ' + item.legacyLabel"
            help="De 3 a 64 caracteres: letras sin acentos, números, punto o guion. Debe ser distinto de los usuarios de Fiscenix."
            autocomplete="off"
            @update:model-value="setDecision({ key: item.key, choice: 'create', username: $event.trim() })"
          />
          <SelectField
            v-if="decisionOf(item)?.choice === 'primary'"
            :id="'legacy-primary-' + item.key"
            :model-value="(decisionOf(item) as { legacyClientId: string }).legacyClientId"
            :label="'Cliente principal del RFC ' + ('currentLabel' in item ? item.currentLabel : '')"
            :options="primaryOptions(item)"
            @update:model-value="setDecision({ key: item.key, choice: 'primary', legacyClientId: $event })"
          />
          <SelectField
            v-if="decisionOf(item)?.choice === 'taskState'"
            :id="'legacy-state-' + item.key"
            :model-value="(decisionOf(item) as { state: string }).state"
            :label="'Estado para ' + item.legacyLabel"
            :options="taskStateOptions"
            @update:model-value="setDecision({ key: item.key, choice: 'taskState', state: $event as 'available' | 'inProgress' | 'completed' })"
          />
        </li>
      </ul>
      <ActionButton
        v-if="group.items.length > (visibleCounts[group.kind] ?? pageSize)"
        @click="visibleCounts[group.kind] = (visibleCounts[group.kind] ?? pageSize) + pageSize"
      >
        Mostrar más ({{ group.items.length - (visibleCounts[group.kind] ?? pageSize) }} restantes)
      </ActionButton>
    </section>
  </div>
</template>

<style scoped>
.legacy-decisions { display: grid; gap: var(--spaceMedium); }
.legacy-decision-group { display: grid; gap: 10px; padding: 14px; border: 2px solid var(--borderColor); background: var(--surfaceColor); }
.legacy-decision-group-header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.legacy-decision-group-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
.legacy-bulk { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding-bottom: 10px; border-bottom: 1px solid var(--hairlineColor); }
.legacy-bulk > .field { flex: 1 1 14rem; }
.legacy-decision-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.legacy-decision-items li { display: grid; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--hairlineColor); }
.legacy-decision-items li:last-child { padding-bottom: 0; border-bottom: 0; }
/* Heredado y Fiscenix lado a lado; en angosto se apilan. */
.legacy-decision-labels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 8px; }
.legacy-side { display: grid; gap: 2px; overflow-wrap: anywhere; }
.legacy-side-label { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.legacy-choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.legacy-choices .choice-card { flex: 1 1 11rem; }
</style>
