<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { FileUp, ScanSearch } from '@lucide/vue'
import { legacyMigrationConfirmationWord, type LegacyBlocker, type LegacyDecision, type LegacyMigrationPreview, type LegacyRunSummary } from '../../../shared/contracts/legacyMigration'
import ActionButton from '../../shared/components/ActionButton.vue'
import CaptureSteps, { type ReviewItem } from '../../shared/components/CaptureSteps.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import SelectField from '../../shared/components/SelectField.vue'
import TextField from '../../shared/components/TextField.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import { withSensitiveConfirmation } from '../../shared/security/confirmSensitive'
import LegacyDecisionList from './LegacyDecisionList.vue'
import LegacyMigrationResult from './LegacyMigrationResult.vue'
import { carryOverDecisions, decisionItems, inconsistentRfcGroups, pendingKeys } from './legacyMigrationDecisions'
import { describeLegacyFailure, type LegacyFailureView } from './legacyMigrationErrors'
import { completeLegacyLocalStep, type LegacyLocalStepResult } from './legacyLocalStep'

/**
 * Asistente "Migrar desde la app anterior" (8.1), por pasos con `CaptureSteps`:
 * 1. `source`: elegir la exportación SQL (diálogo de Main) y escribir la palabra clave → "Analizar". Main lee, comprueba
 *    y compara con el Host; un bloqueo local (archivo ilegible, esquema, palabra incorrecta) no contacta al Host.
 * 2. `summary`: conteos por entidad, bloqueos (con bloqueos "Continuar" queda desactivado), lo ignorado y los roles
 *    con que nacen los usuarios nuevos.
 * 3. `conflicts` y 4. `issues`: decisiones (`LegacyDecisionList`); no se avanza con pendientes.
 * 5. Revisar: conteos, aviso de respaldo previo y la palabra `MIGRAR`; "Migrar" pide la contraseña de la sesión
 *    (`withSensitiveConfirmation`, operación crítica `migration.run`).
 * Tras `executed` se fusionan las notas en este equipo y el resultado sustituye al stepper.
 * Las decisiones y la palabra clave sólo viven en memoria de este componente; se sueltan al cerrarlo.
 */
const emit = defineEmits<{ openAccess: []; openBackupSettings: []; busyChange: [isBusy: boolean] }>()
const steps = [
  { stepId: 'source', title: 'Archivo y clave' }, { stepId: 'summary', title: 'Resumen' },
  { stepId: 'conflicts', title: 'Conflictos' }, { stepId: 'issues', title: 'Incidencias' },
]
const stepIndex = { source: 0, summary: 1, conflicts: 2, issues: 3 } as const
const currentStep = ref(0)
const dumpPath = ref(''), legacyWord = ref(''), confirmation = ref('')
const preview = ref<LegacyMigrationPreview | null>(null)
const localCounts = ref({ ciec: 0, notes: 0 })
const decisions = ref(new Map<string, LegacyDecision>())
const administratorRoleId = ref(''), employeeRoleId = ref('')
const isAnalyzing = ref(false), isExecuting = ref(false)
const sourceFailure = ref<LegacyFailureView | null>(null), executeFailure = ref<LegacyFailureView | null>(null)
const result = ref<{ summary: LegacyRunSummary; localStep: LegacyLocalStepResult } | null>(null)
onBeforeUnmount(() => { legacyWord.value = '' })

const pending = computed(() => preview.value ? pendingKeys(preview.value, decisions.value) : [])
const pendingKeySet = computed(() => new Set(pending.value))
/** Paso "Conflictos": los conflictos y, debajo, los pagos de clientes rechazados (`decisionItems`, Ruling 19). */
const conflictItems = computed(() => {
  if (!preview.value) return []
  const { conflicts, dependents } = decisionItems(preview.value, decisions.value)
  return [...conflicts, ...dependents]
})
const pendingConflictCount = computed(() => conflictItems.value.filter(item => pendingKeySet.value.has(item.key)).length)
/** Lo que se envía: sólo las decisiones que siguen aplicando (p. ej. no la de un pago cuyo cliente ya no se rechaza). */
const decisionsToSend = computed(() => preview.value ? [...carryOverDecisions(decisions.value, preview.value).values()] : [])
/** RFC repetidos cuyos miembros no apuntan a un mismo principal: el Host los rechazaría, así que el paso no avanza. */
const inconsistentRfcs = computed(() => preview.value ? inconsistentRfcGroups(preview.value, decisions.value) : [])
const pendingIssueCount = computed(() => preview.value?.issues.filter(issue => pendingKeySet.value.has(issue.key)).length ?? 0)
const isBlocked = computed(() => Boolean(preview.value && (preview.value.blockers.length > 0 || !preview.value.analysisId)))
const roleOptions = computed(() => preview.value?.roles.map(role => ({ value: role.roleId, label: role.displayName })) ?? [])

/** Cada paso de datos sólo deja avanzar cuando está listo; "Continuar" se desactiva mientras no lo está. */
function validateStep(index: number): boolean {
  if (index === stepIndex.source) return Boolean(preview.value) && !isAnalyzing.value
  if (index === stepIndex.summary) return !isBlocked.value && Boolean(administratorRoleId.value)
  if (index === stepIndex.conflicts) return pendingConflictCount.value === 0 && inconsistentRfcs.value.length === 0
  if (index === stepIndex.issues) return pendingIssueCount.value === 0
  return true
}
const canContinue = computed(() => validateStep(currentStep.value))

const entityRows = [
  { key: 'users', label: 'Usuarios' }, { key: 'clients', label: 'Clientes' }, { key: 'tasks', label: 'Tareas' },
  { key: 'movements', label: 'Movimientos' }, { key: 'events', label: 'Eventos' },
] as const
function describeBlocker(blocker: LegacyBlocker): string {
  if (blocker.kind === 'noKnownTables') return 'El archivo no tiene ninguna tabla de la app anterior (usuarios, clientes, tareas, pagos…). Revisa que sea la exportación de su base.'
  if (blocker.kind === 'passwordCheckFailed') return 'La palabra clave no abre ' + blocker.failedCount + ' contraseña(s) del archivo. Revisa la palabra o que el archivo no esté dañado.'
  if (blocker.kind === 'schemaMismatch') return 'La tabla «' + blocker.table + '» no tiene las columnas de la app anterior.'
  return 'Línea ' + blocker.lineNumber + (blocker.table ? ', tabla «' + blocker.table + '»' : '') + ': ' + blocker.message
}
const describeCounts = (counts: LegacyMigrationPreview['counts'][keyof LegacyMigrationPreview['counts']]) =>
  counts.create + ' crear · ' + counts.link + ' vincular · ' + counts.skip + ' omitir · ' + counts.reject + ' rechazar · ' + counts.update + ' actualizar'
const reviewItems = computed<ReviewItem[]>(() => {
  if (!preview.value) return []
  const counts = preview.value.counts
  return [
    { label: 'Archivo', value: dumpPath.value },
    ...entityRows.map(row => ({ label: row.label, value: describeCounts(counts[row.key]) })),
    { label: 'En este equipo', value: localCounts.value.ciec + ' CIEC y ' + localCounts.value.notes + ' notas' },
    { label: 'Decisiones', value: String(decisionsToSend.value.length) },
    { label: 'Respaldo previo', value: 'Se hace y se verifica antes de cambiar nada' },
  ]
})

function resetAnalysis(): void { preview.value = null; executeFailure.value = null; confirmation.value = '' }
async function chooseDump(): Promise<void> {
  sourceFailure.value = null
  try {
    const chosen = await window.contapp.runLegacyMigration({ action: 'chooseDump' })
    if (chosen.status === 'dump' && chosen.dumpPath) { dumpPath.value = chosen.dumpPath; resetAnalysis() }
  } catch (caught) { sourceFailure.value = describeLegacyFailure(caught, 'No se pudo abrir el selector de archivos') }
}
/** Roles propuestos: el que se llama "Administrador" (o el primero) y, para empleados, uno que diga "emplead" o ninguno. */
function proposeRoles(roles: LegacyMigrationPreview['roles']): void {
  if (!roles.some(role => role.roleId === administratorRoleId.value)) administratorRoleId.value = (roles.find(role => /administrador/i.test(role.displayName)) ?? roles[0])?.roleId ?? ''
  if (!roles.some(role => role.roleId === employeeRoleId.value)) employeeRoleId.value = roles.find(role => /emplead/i.test(role.displayName))?.roleId ?? ''
}
/**
 * Analiza (o vuelve a analizar) con el archivo y la palabra actuales. Al volver a analizar se conservan las decisiones
 * que siguen aplicando (`carryOverDecisions`) y se va al primer paso con algo pendiente.
 */
async function analyze(isReanalysis = false): Promise<void> {
  if (!dumpPath.value || !legacyWord.value.trim() || isAnalyzing.value) return
  isAnalyzing.value = true; sourceFailure.value = null; executeFailure.value = null
  try {
    const analyzed = await window.contapp.runLegacyMigration({ action: 'analyze', dumpPath: dumpPath.value, legacyWord: legacyWord.value.trim() })
    if (analyzed.status !== 'analyzed') throw new Error('Unexpected legacy migration result')
    preview.value = analyzed.preview; localCounts.value = analyzed.localCounts
    decisions.value = isReanalysis ? carryOverDecisions(decisions.value, analyzed.preview) : new Map()
    proposeRoles(analyzed.preview.roles)
    if (!isReanalysis || isBlocked.value) currentStep.value = stepIndex.summary
    else currentStep.value = pendingConflictCount.value ? stepIndex.conflicts : pendingIssueCount.value ? stepIndex.issues : steps.length
  } catch (caught) {
    sourceFailure.value = describeLegacyFailure(caught, 'No se pudo analizar el archivo')
    if (isReanalysis) { preview.value = null; currentStep.value = stepIndex.source }
  } finally { isAnalyzing.value = false }
}
async function execute(): Promise<void> {
  const current = preview.value
  if (!current || isExecuting.value || confirmation.value !== legacyMigrationConfirmationWord || pending.value.length || inconsistentRfcs.value.length) return
  isExecuting.value = true; executeFailure.value = null; emit('busyChange', true)
  try {
    // Copias planas: los proxies reactivos de Vue no se pueden clonar al cruzar contextBridge.
    const request = { action: 'execute' as const, analysisId: current.analysisId, signature: current.signature, decisions: decisionsToSend.value.map(decision => ({ ...decision })), roles: { administratorRoleId: administratorRoleId.value, employeeRoleId: employeeRoleId.value || null }, confirmation: confirmation.value }
    const executed = await withSensitiveConfirmation({ operation: 'migration.run', title: 'Migrar datos de la app anterior', description: 'Se hará un respaldo verificado y después se migrará todo en una sola transacción.' }, proof => window.contapp.runLegacyMigration(request, proof))
    if (!executed) return
    if (executed.status !== 'executed') throw new Error('Unexpected legacy migration result')
    result.value = { summary: executed.summary, localStep: await completeLegacyLocalStep(executed.local, executed.notes) }
    // Ya no hará falta volver a analizar: la palabra clave se suelta en cuanto hay resultado.
    legacyWord.value = ''
  } catch (caught) {
    executeFailure.value = describeLegacyFailure(caught)
    if (executeFailure.value.action === 'conflicts') currentStep.value = pendingIssueCount.value && !pendingConflictCount.value ? stepIndex.issues : stepIndex.conflicts
  } finally { isExecuting.value = false; emit('busyChange', false) }
}
</script>

<template>
  <div
    class="legacy-wizard"
    data-testid="legacy-migration-wizard"
  >
    <LegacyMigrationResult
      v-if="result && preview"
      :summary="result.summary"
      :preview="preview"
      :decisions="decisions"
      :dump-path="dumpPath"
      :local-step="result.localStep"
      @open-access="emit('openAccess')"
    />
    <template v-else>
      <InlineNotice
        v-if="executeFailure && currentStep !== steps.length"
        :title="executeFailure.title"
        tone="error"
      >
        <p>{{ executeFailure.message }}</p>
      </InlineNotice>
      <CaptureSteps
        v-model="currentStep"
        :steps="steps"
        :review-items="reviewItems"
        :validate="validateStep"
        :can-continue="canContinue"
        :can-complete="confirmation === legacyMigrationConfirmationWord && !pending.length && !inconsistentRfcs.length"
        :is-busy="isExecuting || isAnalyzing"
        complete-label="Migrar"
        @complete="execute"
      >
        <template #step-source>
          <p class="field-help">
            Usa la exportación SQL completa de la base de la app anterior y la palabra clave del despacho con que se cifraron sus contraseñas. La palabra no se guarda.
          </p>
          <div class="field">
            <span class="field-label">Exportación SQL</span>
            <div class="legacy-file-row">
              <span
                class="legacy-file-path"
                data-testid="legacy-dump-path"
              >{{ dumpPath || 'Sin elegir' }}</span>
              <ActionButton @click="chooseDump">
                <FileUp
                  :size="16"
                  aria-hidden="true"
                /> Elegir archivo
              </ActionButton>
            </div>
          </div>
          <TextField
            id="legacy-word"
            v-model="legacyWord"
            type="password"
            autocomplete="off"
            label="Palabra clave de la app anterior"
            help="La misma que usaba la app anterior para cifrar contraseñas. Sólo sirve para comprobar el archivo."
            @update:model-value="resetAnalysis"
          />
          <div class="actions">
            <ActionButton
              variant="primary"
              :disabled="!dumpPath || !legacyWord.trim()"
              :is-loading="isAnalyzing"
              @click="analyze()"
            >
              <ScanSearch
                :size="16"
                aria-hidden="true"
              /> Analizar
            </ActionButton>
          </div>
          <LatticeLoader
            v-if="isAnalyzing"
            label="Leyendo el archivo, comprobando la palabra clave y comparando con el Host"
          />
          <InlineNotice
            v-if="sourceFailure"
            :title="sourceFailure.title"
            tone="error"
          >
            <p>{{ sourceFailure.message }}</p>
          </InlineNotice>
        </template>

        <template #step-summary>
          <template v-if="preview">
            <InlineNotice
              v-if="isBlocked"
              title="No se puede migrar este archivo"
              tone="error"
            >
              <ul
                class="legacy-blockers"
                data-testid="legacy-blockers"
              >
                <li
                  v-for="(blocker, index) in preview.blockers"
                  :key="index"
                >
                  {{ describeBlocker(blocker) }}
                </li>
              </ul>
              <p>No se contactó al Host ni se cambió nada. Vuelve al paso anterior para corregir el archivo o la palabra.</p>
            </InlineNotice>
            <template v-else>
              <dl class="legacy-counts">
                <div
                  v-for="row in entityRows"
                  :key="row.key"
                >
                  <dt>{{ row.label }}</dt>
                  <dd>{{ describeCounts(preview.counts[row.key]) }}</dd>
                </div>
                <div>
                  <dt>En este equipo</dt>
                  <dd>{{ localCounts.ciec }} CIEC y {{ localCounts.notes }} notas (no viajan al Host)</dd>
                </div>
              </dl>
              <p
                v-if="preview.ignoredTables.length"
                class="field-help"
              >
                Tablas ignoradas: {{ preview.ignoredTables.join(', ') }}.
              </p>
              <p class="field-help">
                Campos que no se migran: {{ Object.entries(preview.discardedFieldCounts).filter(([, total]) => total > 0).map(([field, total]) => field + ' (' + total + ')').join(', ') || 'ninguno' }}. Las contraseñas heredadas y la e.firma nunca se guardan.
              </p>
              <div class="legacy-roles">
                <SelectField
                  id="legacy-administrator-role"
                  v-model="administratorRoleId"
                  label="Rol de los administradores heredados"
                  :options="roleOptions"
                />
                <SelectField
                  id="legacy-employee-role"
                  v-model="employeeRoleId"
                  label="Rol de los empleados heredados"
                  :options="[{ value: '', label: 'Sin rol (se asigna después)' }, ...roleOptions]"
                />
              </div>
            </template>
          </template>
        </template>

        <template #step-conflicts>
          <p class="field-help">
            {{ pendingConflictCount ? 'Faltan ' + pendingConflictCount + ' conflicto(s) por decidir.' : 'Todos los conflictos tienen decisión.' }}
          </p>
          <InlineNotice
            v-if="inconsistentRfcs.length"
            title="Un RFC repetido necesita un solo principal"
            tone="warning"
          >
            <p>En {{ inconsistentRfcs.join(', ') }} los clientes que no se rechazan deben elegir el mismo principal, y ese principal no puede rechazarse.</p>
          </InlineNotice>
          <LegacyDecisionList
            v-if="preview"
            v-model:decisions="decisions"
            :items="conflictItems"
            list-label="Conflictos"
          />
        </template>

        <template #step-issues>
          <p class="field-help">
            {{ pendingIssueCount ? 'Faltan ' + pendingIssueCount + ' incidencia(s) por decidir.' : 'No hay incidencias pendientes. Las informativas sólo quedan en el reporte.' }}
          </p>
          <LegacyDecisionList
            v-if="preview"
            v-model:decisions="decisions"
            :items="preview.issues"
            list-label="Incidencias"
          />
        </template>

        <template #review-extra>
          <div class="legacy-confirm">
            <InlineNotice
              title="Antes de migrar se hace un respaldo"
              tone="warning"
            >
              <p>El Host respalda y verifica la base; si el respaldo falla no se cambia nada. Después todo se migra en una sola transacción.</p>
            </InlineNotice>
            <InlineNotice
              v-if="executeFailure"
              :title="executeFailure.title"
              tone="error"
            >
              <p>{{ executeFailure.message }}</p>
              <div class="actions">
                <ActionButton
                  v-if="executeFailure.action === 'reanalyze'"
                  :is-loading="isAnalyzing"
                  @click="analyze(true)"
                >
                  Volver a analizar
                </ActionButton>
                <ActionButton
                  v-if="executeFailure.action === 'backupSettings'"
                  @click="emit('openBackupSettings')"
                >
                  Ir a la configuración de respaldos
                </ActionButton>
              </div>
            </InlineNotice>
            <TextField
              id="legacy-confirmation"
              v-model="confirmation"
              autocomplete="off"
              :label="'Escribe ' + legacyMigrationConfirmationWord + ' para confirmar'"
              help="Al pulsar «Migrar» se pide tu contraseña."
            />
          </div>
        </template>
      </CaptureSteps>
    </template>
  </div>
</template>

<style scoped>
.legacy-wizard { display: grid; gap: var(--spaceMedium); }
.legacy-wizard > :deep(.inline-notice) { margin: 0; }
.legacy-file-row { display: flex; flex-wrap: wrap; gap: var(--spaceSmall); align-items: center; justify-content: space-between; padding: 10px 12px; border: 2px solid var(--borderColor); }
.legacy-file-path { font-family: var(--monoFontFamily); font-size: 13px; overflow-wrap: anywhere; }
.legacy-blockers { margin: 0 0 8px; padding-left: 18px; }
.legacy-counts { display: grid; margin: 0; border: 2px solid var(--borderColor); }
.legacy-counts div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 3fr); gap: 12px; padding: 10px 14px; }
.legacy-counts div + div { border-top: 1px solid var(--hairlineColor); }
.legacy-counts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); align-self: center; }
.legacy-counts dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.legacy-roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: var(--spaceMedium); }
.legacy-confirm { display: grid; gap: var(--spaceMedium); margin-top: var(--spaceMedium); }
</style>
