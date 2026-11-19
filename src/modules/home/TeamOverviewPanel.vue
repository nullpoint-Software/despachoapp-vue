<script setup lang="ts">
import CountUp from '../../shared/vueBits/CountUp.vue'
import UserAvatar from '../../shared/components/UserAvatar.vue'
import SpotlightCard from '../../shared/vueBits/SpotlightCard.vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RefreshCw } from '@lucide/vue'
import type { TeamOverview } from '../../../shared/contracts/teamOverview'
import ActionButton from '../../shared/components/ActionButton.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import { formatMoney } from '../../../shared/presentation/movementLabels'
import { readIpcErrorMessage } from '../../shared/ipcErrorMessage'
import { monthNames } from '../reports/reportLabels'
import CashFlowChart from './CashFlowChart.vue'
import type { CashFlowPoint } from './homeDashboardMetrics'

/**
 * Panel de equipo de Inicio para el administrador (decisión del usuario, rediseño 2026-10-02).
 * - **Equipo:** por usuario, tareas abiertas (en curso y vencidas), cobros y gastos que registró hoy y
 *   en el mes, última actividad, equipo y sesiones vigentes.
 * - **Ingresos y gastos:** columnas por mes del ejercicio en curso, como la gráfica de admin del original. Desde el
 *   tablero CRM (2026-10-06) usa el mismo `CashFlowChart` que Inicio: series validadas en Light/Dark, detalle al
 *   pasar o enfocar y tabla accesible con las cifras exactas.
 * El Host calcula todo en cada consulta (`users.manage`, `tasks.read` y `movements.read`).
 */
const overview = ref<TeamOverview | null>(null), isLoading = ref(false), error = ref('')
/** Inicio reutiliza el mismo resumen para el bloque "Equipo hoy" del tablero (sin pedirlo dos veces). */
const emit = defineEmits<{ loaded: [overview: TeamOverview] }>()
let isMounted = true
const activeMembers = computed(() => overview.value?.members.filter(member => member.isActive) ?? [])
const totals = computed(() => {
  const members = activeMembers.value
  return { openTasks: members.reduce((sum, member) => sum + member.openTaskCount, 0), overdueTasks: members.reduce((sum, member) => sum + member.overdueTaskCount, 0),
    activeNow: members.filter(member => member.activeSessionCount > 0).length }
})
/** Los 12 meses del ejercicio en el formato del gráfico compartido. */
const yearPoints = computed<CashFlowPoint[]>(() => {
  const year = overview.value?.today.slice(0, 4) ?? ''
  return (overview.value?.monthlyTotals ?? []).map(month => {
    const name = monthNames[month.month - 1] ?? ''
    return { monthKey: year + '-' + String(month.month).padStart(2, '0'), label: name.slice(0, 3), fullLabel: name + ' ' + year, incomeAmount: month.income, expenseAmount: month.expense }
  })
})
const yearTotals = computed(() => {
  const months = overview.value?.monthlyTotals ?? []
  const income = months.reduce((sum, month) => sum + Number(month.income), 0), expense = months.reduce((sum, month) => sum + Number(month.expense), 0)
  return { income: income.toFixed(2), expense: expense.toFixed(2), net: (income - expense).toFixed(2), isNegative: income < expense }
})

function formatActivity(value: string | null): string {
  if (!value) return 'Sin sesiones'
  const minutes = Math.round((Date.now() - Date.parse(value)) / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return 'Hace ' + minutes + ' min'
  if (minutes < 1440) return 'Hace ' + Math.round(minutes / 60) + ' h'
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}
async function load(): Promise<void> {
  isLoading.value = true; error.value = ''
  try { const result = await window.contapp.readTeamOverview({ action: 'overview' }); if (isMounted) { overview.value = result.overview; emit('loaded', result.overview) } }
  catch (caught) { if (isMounted) error.value = readIpcErrorMessage(caught, 'No se pudo consultar el panel del equipo.') }
  finally { isLoading.value = false }
}
onMounted(() => { void load() })
onBeforeUnmount(() => { isMounted = false; overview.value = null })
</script>
<template>
  <section
    class="team-overview home-panel surface-panel"
    aria-labelledby="team-overview-title"
    data-testid="team-overview"
  >
    <div class="section-heading">
      <div>
        <h2 id="team-overview-title">
          Actividad del equipo
        </h2>
      </div>
      <ActionButton
        :is-loading="isLoading"
        @click="load"
      >
        <RefreshCw
          :size="16"
          aria-hidden="true"
        /> Actualizar
      </ActionButton>
    </div>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-else-if="overview">
      <dl class="team-metrics">
        <SpotlightCard><dt>Usuarios activos</dt><dd><CountUp :value="activeMembers.length" /></dd></SpotlightCard>
        <SpotlightCard><dt>Con sesión abierta</dt><dd><CountUp :value="totals.activeNow" /></dd></SpotlightCard>
        <SpotlightCard><dt>Tareas abiertas</dt><dd><CountUp :value="totals.openTasks" /></dd></SpotlightCard>
        <SpotlightCard>
          <dt>Vencidas</dt><dd :class="{ 'is-alert': totals.overdueTasks }">
            <CountUp :value="totals.overdueTasks" />
          </dd>
        </SpotlightCard>
      </dl>
      <div
        class="table-region team-table"
        tabindex="0"
        aria-label="Actividad por usuario"
      >
        <table aria-label="Equipo">
          <thead>
            <tr>
              <th>Usuario</th><th>Tareas</th><th class="numeric">
                Hoy
              </th><th class="numeric">
                Este mes
              </th><th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in overview.members"
              :key="member.userId"
              :class="{ 'is-inactive': !member.isActive }"
            >
              <td>
                <div class="team-person">
                  <UserAvatar
                    :user-id="member.userId"
                    :display-name="member.displayName"
                    is-decorative
                  />
                  <div>
                    <strong>{{ member.displayName }}</strong>
                    <span class="field-help team-meta">{{ member.username }}{{ member.roleNames.length ? ' · ' + member.roleNames.join(', ') : '' }}{{ member.isActive ? '' : ' · Inactivo' }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="team-tasks">
                  <strong>{{ member.openTaskCount }}</strong> abiertas
                  <StatusBadge
                    v-if="member.overdueTaskCount"
                    tone="error"
                  >{{ member.overdueTaskCount }} vencida(s)</StatusBadge>
                </span>
                <span class="field-help team-meta">{{ member.inProgressTaskCount }} en curso</span>
              </td>
              <td class="numeric">
                {{ formatMoney(member.todayIncome) }}<span class="field-help team-meta">Gastos {{ formatMoney(member.todayExpense) }}</span>
              </td>
              <td class="numeric">
                {{ formatMoney(member.monthIncome) }}<span class="field-help team-meta">Gastos {{ formatMoney(member.monthExpense) }} · {{ member.monthMovementCount }} mov.</span>
              </td>
              <td>
                <span class="team-activity">
                  <span
                    class="team-dot"
                    :class="{ 'is-online': member.activeSessionCount > 0 }"
                    aria-hidden="true"
                  />{{ formatActivity(member.lastActivityAt) }}
                </span>
                <span class="field-help team-meta">{{ member.lastDeviceAlias ?? '—' }}{{ member.activeSessionCount ? ' · ' + member.activeSessionCount + ' sesión(es) vigente(s)' : '' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="team-chart">
        <div class="team-chart-heading">
          <div>
            <h3>Ingresos y gastos {{ overview.today.slice(0, 4) }}</h3>
          </div>
          <dl class="team-chart-totals">
            <div><dt>Ingresos</dt><dd>{{ formatMoney(yearTotals.income) }}</dd></div>
            <div><dt>Gastos</dt><dd>{{ formatMoney(yearTotals.expense) }}</dd></div>
            <div>
              <dt>Neto</dt><dd :class="{ 'is-alert': yearTotals.isNegative }">
                {{ formatMoney(yearTotals.net) }}
              </dd>
            </div>
          </dl>
        </div>
        <CashFlowChart
          :points="yearPoints"
          :accessible-title="'Ingresos y gastos por mes del ejercicio ' + overview.today.slice(0, 4)"
          accessible-description="Columnas agrupadas por mes: ingresos y gastos de todos los clientes y usuarios, sin movimientos cancelados."
        />
      </div>
    </template>
    <p
      v-else-if="isLoading"
      class="field-help"
    >
      Consultando al Host…
    </p>
  </section>
</template>
<style scoped>
.team-overview { grid-column: 1 / -1; }
.team-overview h2, .team-overview h3 { margin: 0; }
.team-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--spaceMedium); margin: 0; }
.team-metrics div { display: grid; gap: 4px; padding: 14px 16px; border: 2px solid var(--borderColor); background: var(--surfaceColor); box-shadow: var(--buttonShadow); }
.team-metrics dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.team-metrics dd { margin: 0; font-size: 32px; line-height: 1.15; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.is-alert { color: var(--errorColor); }
.team-table { margin: 0; }
.team-table table { min-width: 640px; }
.team-table td:first-child { min-width: 11rem; }
.team-table td:nth-child(2), .team-table td:nth-child(5) { white-space: nowrap; }
.team-meta { display: block; font-size: 12px; }
.team-person { display: flex; align-items: center; gap: 10px; }
.team-tasks, .team-activity { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.team-dot { width: 8px; height: 8px; border-radius: 0; background: var(--strongBorderColor); }
.team-dot.is-online { background: var(--successColor); }
tr.is-inactive td { color: var(--mutedTextColor); }
.team-chart { display: grid; gap: var(--spaceMedium); padding-top: var(--spaceMedium); border-top: 1px solid var(--borderColor); }
.team-chart-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--spaceMedium); align-items: flex-end; }
.team-chart-totals { display: flex; flex-wrap: wrap; gap: var(--spaceLarge); margin: 0; }
.team-chart-totals dt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mutedTextColor); }
.team-chart-totals dd { margin: 2px 0 0; font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
