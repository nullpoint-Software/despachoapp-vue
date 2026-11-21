<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { Columns3, Wallet, IdCard, FileCode, NotebookPen, ArrowRight, BadgeCheck, Landmark, RefreshCw, CalendarDays, CircleCheck } from '@lucide/vue'
import { getOfficeToday } from '../../../shared/contracts/movements'
import type { TeamOverview } from '../../../shared/contracts/teamOverview'
import { formatTaskFolio, isOverdueTask, taskStateLabels, taskStateTones } from '../tasks/taskLabels'
import { formatBusinessDate, formatBusinessDateTime, formatMoney } from '../../../shared/presentation/movementLabels'
import { monthNames } from '../reports/reportLabels'
import ActionButton from '../../shared/components/ActionButton.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import AvatarStack from '../../shared/components/AvatarStack.vue'
import UserAvatar from '../../shared/components/UserAvatar.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import LatticeLoader from '../../shared/vueBits/LatticeLoader.vue'
import TeamOverviewPanel from './TeamOverviewPanel.vue'
import TeamTodayPanel from './TeamTodayPanel.vue'
import TaskPipelineChart from './TaskPipelineChart.vue'
import CashFlowChart from './CashFlowChart.vue'
import IncomeSparkline from './IncomeSparkline.vue'
import PaymentMethodBars from './PaymentMethodBars.vue'
import ComplianceBreakdownBar from './ComplianceBreakdownBar.vue'
import DueWeekStrip from './DueWeekStrip.vue'
import { createHomeDashboard, dashboardSourceLabels, cashFlowMonthCount, type DashboardSource } from './homeDashboardLoader'
import { describePlatform, listSatAutomationAttention, satDownloadTarget } from '../satDownloads/satAutomationPresentation'
import { requestNavigation } from '../../shared/navigation/navigationRequests'
import { buildComplianceBreakdown, buildDueDays, buildPaymentMethodShares, buildTaskPipeline, calculateMonthOverMonthChange, calculatePositivePercent, countTasksByMember, listOpinionAttention, sortUrgentTasks } from './homeDashboardMetrics'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import HelpTip from '../../shared/components/HelpTip.vue'
import { sessionUser, workspaceAccess } from '../workspace/sessionState'

/**
 * Inicio como tablero CRM del despacho (2026-10-06, pedido del usuario: "inicio será un CRM dashboard").
 * Ajuste del mismo día ("agrega más variedad al crm y elimina espacios vacíos, juega con los tamaños"): los bloques
 * son mosaicos de una rejilla **bento** de 12 columnas con tamaños distintos, sin huecos grandes.
 *
 * Mosaicos, en orden de lectura (el orden del DOM es el de la rejilla; `grid-auto-flow: dense` rellena huecos):
 * 1. **Consulta rápida**: título, accesos directos centrados y Actualizar (ancho completo).
 * 2. **Cobrado del mes** (héroe, 6 × 2): cifra grande, variación contra el mes anterior, gastos, neto, neto de hoy
 *    y la tendencia de ingresos de 6 meses. A su lado, 2 × 2 indicadores chicos (clientes, tareas, opiniones, reporte).
 * 3. **Ingresos y gastos** (8 columnas, tan alto como la columna lateral) y, a la derecha, apilados: embudo de
 *    tareas, formas de pago del mes, "vence esta semana" y, si no tengo tareas, "lo más urgente" compacto.
 * 4. **Lo más urgente** (si tengo tareas), **cobros recientes** y **requiere atención** (con el reparto de opiniones
 *    por estado), repartidos según cuáles existan.
 * 5. **Equipo hoy** (administrador) y, debajo, el detalle completo del equipo (`TeamOverviewPanel`).
 *
 * Tamaños: cada mosaico recibe su ancho en 12 columnas (`--wideSpan`), en 6 columnas (`--mediumSpan`) y su alto en
 * filas (`--wideRows`). Se calculan aquí según los permisos y los datos (ver `tileLayout`), así un mosaico vacío se
 * encoge y los vecinos ocupan su lugar. El CSS elige la rejilla por el ancho del tablero (container query).
 *
 * Permisos: cada bloque aparece sólo si `workspaceAccess` lo permite y cada consulta la vuelve a autorizar el Host.
 * Datos: todo es GLOBAL y de sólo lectura; nada se guarda en el equipo (ver `homeDashboardLoader.ts`).
 */
const emit = defineEmits<{ navigate: [page: string] }>()
const today = getOfficeToday()
const dashboard = createHomeDashboard(today)
const { previousMonth, tasks, currentUserId, todaySummary, monthSummary, cashFlow, recentPayments, clients, hasMoreClients, opinions, reports, satSchedules, satPlatform, failedSources, isLoading } = dashboard
const team = ref<TeamOverview | null>(null)
const hasLoadedOnce = ref(false)
const access = workspaceAccess

const previousMonthLabel = monthNames[previousMonth.fiscalMonth - 1] + ' ' + previousMonth.fiscalYear
const currentMonthName = monthNames[Number(today.slice(5, 7)) - 1] ?? ''
/** Días de la franja "Vence esta semana" (hoy incluido). */
const dueDayCount = 7

// Tareas: todas las visibles para el embudo, la semana y el indicador; "mías" para lo más urgente.
const openTasks = computed(() => (tasks.value ?? []).filter(task => task.state !== 'completed'))
const overdueCount = computed(() => openTasks.value.filter(task => isOverdueTask(task, today)).length)
const myUrgentTasks = computed(() => sortUrgentTasks((tasks.value ?? []).filter(task => task.assignees.some(assignee => assignee.userId === currentUserId.value)), today))
const pipelineStages = computed(() => buildTaskPipeline(tasks.value ?? []))
const taskCountsByMember = computed(() => tasks.value ? countTasksByMember(tasks.value) : null)
const dueDays = computed(() => buildDueDays(tasks.value ?? [], today, dueDayCount))
const dueThisWeekCount = computed(() => dueDays.value.reduce((total, day) => total + day.taskCount, 0))

// Dinero: variación del mes, formas de pago y neto negativo.
const monthChange = computed(() => cashFlow.value ? calculateMonthOverMonthChange(cashFlow.value) : null)
const paymentShares = computed(() => monthSummary.value ? buildPaymentMethodShares(monthSummary.value) : [])
const isMonthNetNegative = computed(() => Boolean(monthSummary.value?.netAmount.startsWith('-')))
/** Texto accesible de la variación: la flecha y el signo ya la dicen a la vista; el lector la oye en palabras. */
const monthChangeDescription = computed(() => {
  const change = monthChange.value
  if (!change) return ''
  const amount = Math.abs(change.changePercent) + ' %'
  return change.changePercent === 0 ? 'Igual que en ' + change.previousMonthLabel : amount + (change.changePercent > 0 ? ' más que en ' : ' menos que en ') + change.previousMonthLabel
})

// Clientes, opiniones y reportes.
const activeClients = computed(() => (clients.value ?? []).filter(client => client.isActive))
const opinionAttention = computed(() => listOpinionAttention(opinions.value ?? []))
const complianceSegments = computed(() => buildComplianceBreakdown(opinions.value ?? []))
const notQueriedCount = computed(() => (opinions.value ?? []).filter(client => client.status === 'notQueried').length)
const reportedClientIds = computed(() => new Set((reports.value ?? []).filter(report => report.reportType === 'monthly' && report.fiscalMonth === previousMonth.fiscalMonth).map(report => report.clientId)))
const pendingReportClients = computed(() => activeClients.value.filter(client => !reportedClientIds.value.has(client.clientId)))
/** El avance de reportes necesita la lista de clientes para saber cuántos faltan. */
const canShowReports = computed(() => access.value.canReadReports && access.value.canReadClients)

/** Descargas automáticas del SAT que requieren atención (e.firma, equipo sin conexión, SAT caído o última falla). */
const satAttention = computed(() => listSatAutomationAttention(satSchedules.value ?? [], new Date()))
const satPlatformState = computed(() => satPlatform.value ? describePlatform(satPlatform.value, new Date()) : null)
function openSatDownload(clientId: string, clientDisplayName: string): void { requestNavigation(satDownloadTarget(clientId, clientDisplayName)) }

function hasFailed(source: DashboardSource): boolean { return failedSources.value.includes(source) }

/** Indicador chico del tablero: `page` es la sección a la que lleva, o `null` si la sesión no puede abrirla. */
interface DashboardIndicator { key: string; label: string; value: string; detail: string; page: string | null; isAlert: boolean }
const indicators = computed<DashboardIndicator[]>(() => {
  const list: DashboardIndicator[] = []
  const pending = (isReady: boolean, source: DashboardSource): string => hasFailed(source) ? 'Sin datos' : isReady ? '' : 'Consultando…'
  if (access.value.canReadClients) {
    const isReady = clients.value !== null
    list.push({ key: 'clients', label: 'Clientes activos', value: isReady ? activeClients.value.length + (hasMoreClients.value ? '+' : '') : '—', page: 'clients', isAlert: false,
      detail: pending(isReady, 'clients') || (clients.value!.length - activeClients.value.length) + ' inactivo(s) · ' + clients.value!.length + ' asignado(s)' })
  }
  if (access.value.canReadTasks) {
    const isReady = tasks.value !== null
    const mineCount = openTasks.value.filter(task => task.assignees.some(assignee => assignee.userId === currentUserId.value)).length
    list.push({ key: 'tasks', label: 'Tareas abiertas', value: isReady ? String(openTasks.value.length) : '—', page: 'tasks', isAlert: overdueCount.value > 0,
      detail: pending(isReady, 'tasks') || (overdueCount.value ? overdueCount.value + ' vencida(s)' : 'Ninguna vencida') + ' · ' + mineCount + ' mía(s)' })
  }
  if (access.value.canReadOpinions) {
    const isReady = opinions.value !== null
    list.push({ key: 'opinions', label: 'Opiniones por atender', value: isReady ? String(opinionAttention.value.length) : '—', page: 'compliance', isAlert: opinionAttention.value.length > 0,
      detail: pending(isReady, 'opinions') || calculatePositivePercent(opinions.value!) + '% positivas vigentes · ' + notQueriedCount.value + ' sin consultar' })
  }
  if (canShowReports.value) {
    const isReady = reports.value !== null && clients.value !== null
    list.push({ key: 'reports', label: 'Reporte ' + previousMonthLabel, value: isReady ? (activeClients.value.length - pendingReportClients.value.length) + ' / ' + activeClients.value.length : '—',
      page: access.value.canUseXml ? 'fiscal' : null, isAlert: false,
      detail: pending(isReady, hasFailed('reports') ? 'reports' : 'clients') || pendingReportClients.value.length + ' cliente(s) pendiente(s)' })
  }
  return list
})

/**
 * Tamaño de un mosaico bento: columnas en la rejilla de 12 (ancha), en la de 6 (media) y filas en la ancha.
 * En la rejilla de una columna (≤ 559 px) todos ocupan el ancho completo y una fila.
 */
interface TileSpan { wideSpan: number; mediumSpan: number; wideRows?: number }
function toTileStyle(span: TileSpan): Record<string, string> {
  return { '--wideSpan': String(span.wideSpan), '--mediumSpan': String(span.mediumSpan), '--wideRows': String(span.wideRows ?? 1) }
}
/** "Lo más urgente" sin tareas mías (o consultando) pasa a mosaico compacto en la columna lateral. */
const isUrgentCompact = computed(() => access.value.canReadTasks && myUrgentTasks.value.length === 0)
const canShowAttention = computed(() => access.value.canReadOpinions || canShowReports.value || access.value.canDownloadSat)

/**
 * Reparto de tamaños según qué mosaicos existen, para que la rejilla no deje huecos grandes:
 * - Indicadores chicos: con héroe llenan las 6 columnas de su derecha en 2 × 2 (con 3, el último ocupa la fila);
 *   sin héroe se reparten las 12 columnas. En la rejilla media van de 2 en 2 y el último impar ocupa la fila.
 * - Columna lateral de la gráfica: el alto de "Ingresos y gastos" es el número de mosaicos laterales, así la gráfica
 *   se estira hasta donde llega la columna y no queda papel vacío debajo de ninguna de las dos.
 * - Fila inferior: urgente + cobros a la par (6 + 6) y "requiere atención" a todo el ancho; si falta alguno, los
 *   dos que quedan se reparten 5 + 7 (o 6 + 6) y uno solo ocupa las 12 columnas.
 */
const tileLayout = computed(() => {
  const hasHero = access.value.canReadMovements, canReadTasks = access.value.canReadTasks
  const kpiCount = indicators.value.length
  const kpis = indicators.value.map((indicator, index): TileSpan => ({
    wideSpan: hasHero ? (kpiCount === 4 || (kpiCount === 3 && index < 2) ? 3 : 6) : 12 / kpiCount,
    mediumSpan: kpiCount % 2 === 1 && index === kpiCount - 1 ? 6 : 3
  }))
  const hero: TileSpan = { wideSpan: kpiCount ? 6 : 12, mediumSpan: 6, wideRows: kpiCount >= 2 ? 2 : 1 }
  const sideTileCount = (canReadTasks ? 2 : 0) + (hasHero ? 1 : 0) + (isUrgentCompact.value ? 1 : 0)
  const sideWideSpan = hasHero ? 4 : 12 / Math.max(1, sideTileCount)
  const cashFlow: TileSpan = { wideSpan: 8, mediumSpan: 6, wideRows: Math.max(1, sideTileCount) }
  const pipeline: TileSpan = { wideSpan: sideWideSpan, mediumSpan: hasHero ? 3 : 6 }
  const paymentMethods: TileSpan = { wideSpan: 4, mediumSpan: canReadTasks ? 3 : 6 }
  const dueWeek: TileSpan = { wideSpan: sideWideSpan, mediumSpan: 6 }
  const urgentCompact: TileSpan = { wideSpan: sideWideSpan, mediumSpan: 6 }
  const hasUrgentFull = canReadTasks && !isUrgentCompact.value, hasPayments = hasHero, hasAttention = canShowAttention.value
  const bottomCount = Number(hasUrgentFull) + Number(hasPayments) + Number(hasAttention)
  const pairSpans = hasUrgentFull && hasPayments ? [6, 6] : [5, 7]
  const bottomSpans = bottomCount === 3 ? [6, 6, 12] : bottomCount === 2 ? pairSpans : [12]
  const bottomOrder = [hasUrgentFull ? 'urgent' : null, hasPayments ? 'payments' : null, hasAttention ? 'attention' : null].filter(key => key !== null)
  const bottomSpan = (key: string): TileSpan => ({ wideSpan: bottomSpans[bottomOrder.indexOf(key)] ?? 12, mediumSpan: 6 })
  return { kpis, hero, cashFlow, pipeline, paymentMethods, dueWeek, urgentCompact, urgent: bottomSpan('urgent'), payments: bottomSpan('payments'), attention: bottomSpan('attention'), team: { wideSpan: 12, mediumSpan: 6 } }
})

const failureMessage = computed(() => failedSources.value.map(source => dashboardSourceLabels[source]).join(', '))
const hasAnySection = computed(() => access.value.canReadTasks || access.value.canReadMovements || access.value.canReadClients || access.value.canReadOpinions || access.value.canReadReports || access.value.canDownloadSat)

async function load(): Promise<void> { await dashboard.load(access.value); hasLoadedOnce.value = true }

/** Los bloques entran escalonados; las cifras nunca se animan (15-DESIGN-GUIDELINES). */
const homeElement = ref<HTMLElement | null>(null)
const panelEntrance = new StaggeredEntrance({ selector: '.home-reveal', distancePixels: 12, staggerSeconds: .04 })
onMounted(() => { void panelEntrance.play(() => homeElement.value); void load() })
onBeforeUnmount(() => { panelEntrance.dispose(); dashboard.dispose(); team.value = null })
</script>

<template>
  <section
    ref="homeElement"
    class="home-dashboard"
    data-testid="home-page"
  >
    <header>
      <div class="help-title-row">
        <h1>Hola, {{ sessionUser?.displayName ?? 'bienvenido' }}</h1>
        <HelpTip
          title="Qué muestra Inicio"
          text="Un tablero del despacho: cobrado del mes, tareas que vencen, opiniones por atender, pagos recientes y el trabajo del equipo. Cada bloque aparece sólo si tienes permiso para verlo; sus cifras vienen del Host y se renuevan con Actualizar."
        />
      </div>
      <p class="lede">
        Resumen del {{ formatBusinessDate(today) }} en el despacho.
      </p>
    </header>

    <div
      v-if="hasAnySection"
      class="home-bento"
    >
      <!-- 1. Consulta rápida: título, accesos directos centrados y Actualizar. -->
      <section
        class="surface-panel home-toolbar bento-full home-reveal"
        aria-labelledby="home-summary-title"
        data-testid="home-summary"
      >
        <h2 id="home-summary-title">
          Consulta rápida
        </h2>
        <nav
          class="home-shortcuts"
          aria-label="Accesos directos"
        >
          <ActionButton
            v-if="access.canReadTasks"
            @click="emit('navigate', 'tasks')"
          >
            <Columns3
              :size="17"
              aria-hidden="true"
            /> Tareas
          </ActionButton>
          <ActionButton
            v-if="access.canReadClients"
            @click="emit('navigate', 'clients')"
          >
            <IdCard
              :size="17"
              aria-hidden="true"
            /> Clientes
          </ActionButton>
          <ActionButton
            v-if="access.canReadMovements"
            @click="emit('navigate', 'payments')"
          >
            <Wallet
              :size="17"
              aria-hidden="true"
            /> Pagos
          </ActionButton>
          <ActionButton
            v-if="access.canUseXml"
            @click="emit('navigate', 'fiscal')"
          >
            <FileCode
              :size="17"
              aria-hidden="true"
            /> Fiscal
          </ActionButton>
          <ActionButton
            v-if="access.canReadOpinions"
            @click="emit('navigate', 'compliance')"
          >
            <BadgeCheck
              :size="17"
              aria-hidden="true"
            /> Cumplimiento
          </ActionButton>
          <ActionButton
            v-if="access.canReadReports"
            @click="emit('navigate', 'reconciliation')"
          >
            <Landmark
              :size="17"
              aria-hidden="true"
            /> Conciliación
          </ActionButton>
          <ActionButton
            v-if="access.canUseNotes"
            @click="emit('navigate', 'notes')"
          >
            <NotebookPen
              :size="17"
              aria-hidden="true"
            /> Notas
          </ActionButton>
        </nav>
        <ActionButton
          class="home-refresh"
          :is-loading="isLoading"
          aria-label="Actualizar consulta rápida"
          @click="load"
        >
          <RefreshCw
            :size="16"
            aria-hidden="true"
          />
        </ActionButton>
        <InlineNotice
          v-if="failedSources.length"
          class="home-toolbar-notice"
          tone="error"
          title="Consulta incompleta"
        >
          No se pudo consultar {{ failureMessage }}. Lo demás está al día.
        </InlineNotice>
        <LatticeLoader
          v-if="isLoading && !hasLoadedOnce"
          class="home-toolbar-notice"
          label="Consultando el despacho"
          :show-timer="false"
        />
      </section>

      <!-- 2a. Héroe: cobrado del mes, variación, gastos, neto y tendencia de 6 meses. -->
      <section
        v-if="access.canReadMovements"
        class="surface-panel home-panel home-hero bento-tile home-reveal"
        :class="{ 'is-alert': isMonthNetNegative }"
        :style="toTileStyle(tileLayout.hero)"
        aria-labelledby="home-hero-title"
        data-testid="home-payments"
      >
        <div class="section-heading">
          <h2 id="home-hero-title">
            Cobrado en {{ currentMonthName }}
          </h2>
          <button
            type="button"
            class="home-link"
            @click="emit('navigate', 'payments')"
          >
            Ir a Pagos <ArrowRight
              :size="14"
              aria-hidden="true"
            />
          </button>
        </div>
        <InlineNotice
          v-if="hasFailed('movements')"
          tone="error"
          title="Sin movimientos"
        >
          No se pudieron consultar los cobros y gastos.
        </InlineNotice>
        <template v-else-if="monthSummary">
          <p class="hero-figure">
            <strong>{{ formatMoney(monthSummary.incomeAmount) }}</strong>
            <span
              v-if="monthChange"
              class="hero-delta"
              :class="monthChange.changePercent > 0 ? 'is-up' : monthChange.changePercent < 0 ? 'is-down' : 'is-flat'"
            >
              <span aria-hidden="true">{{ monthChange.changePercent > 0 ? '▲' : monthChange.changePercent < 0 ? '▼' : '=' }} {{ Math.abs(monthChange.changePercent) }} % vs {{ monthChange.previousMonthLabel }}</span>
              <span class="sr-only">{{ monthChangeDescription }}</span>
            </span>
          </p>
          <dl class="hero-facts">
            <div>
              <dt>Gastos</dt>
              <dd>{{ formatMoney(monthSummary.expenseAmount) }}</dd>
            </div>
            <div>
              <dt>Neto del mes</dt>
              <dd :class="{ 'tone-error': isMonthNetNegative }">
                {{ formatMoney(monthSummary.netAmount) }}
              </dd>
            </div>
            <div v-if="todaySummary">
              <dt>Neto de hoy</dt>
              <dd :class="{ 'tone-error': todaySummary.netAmount.startsWith('-') }">
                {{ formatMoney(todaySummary.netAmount) }}
              </dd>
            </div>
          </dl>
          <IncomeSparkline
            v-if="cashFlow && cashFlow.length > 1"
            :points="cashFlow"
          />
        </template>
        <p
          v-else
          class="field-help"
        >
          Consultando…
        </p>
      </section>

      <!-- 2b. Indicadores chicos: cada uno lleva a su sección. -->
      <component
        :is="indicator.page ? 'button' : 'div'"
        v-for="(indicator, index) in indicators"
        :key="indicator.key"
        :type="indicator.page ? 'button' : undefined"
        class="home-kpi bento-tile home-reveal"
        :class="{ 'is-alert': indicator.isAlert, 'is-static': !indicator.page }"
        :style="toTileStyle(tileLayout.kpis[index]!)"
        @click="indicator.page && emit('navigate', indicator.page)"
      >
        <span class="home-kpi-label">{{ indicator.label }}</span>
        <span class="home-kpi-body">
          <strong>{{ indicator.value }}</strong>
          <span class="home-kpi-detail">{{ indicator.detail }}</span>
        </span>
      </component>

      <!-- 3a. Ingresos y gastos: ancho y tan alto como la columna lateral. -->
      <section
        v-if="access.canReadMovements"
        class="surface-panel home-panel bento-cash-flow bento-tile home-reveal"
        :style="toTileStyle(tileLayout.cashFlow)"
        aria-labelledby="home-cash-flow-title"
        data-testid="home-cash-flow"
      >
        <div class="section-heading">
          <h2 id="home-cash-flow-title">
            Ingresos y gastos
          </h2>
          <span class="field-help">Últimos {{ cashFlowMonthCount }} meses</span>
        </div>
        <InlineNotice
          v-if="hasFailed('movements')"
          tone="error"
          title="Sin movimientos"
        >
          No se pudieron consultar los cobros y gastos.
        </InlineNotice>
        <CashFlowChart
          v-else-if="cashFlow"
          :points="cashFlow"
          :accessible-title="'Ingresos y gastos de los últimos ' + cashFlowMonthCount + ' meses'"
          accessible-description="Columnas agrupadas por mes: ingresos y gastos de los movimientos visibles, sin cancelados."
        />
        <p
          v-else
          class="field-help"
        >
          Consultando…
        </p>
      </section>

      <!-- 3b. Columna lateral: embudo de tareas visibles por etapa. -->
      <section
        v-if="access.canReadTasks"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.pipeline)"
        aria-labelledby="home-pipeline-title"
        data-testid="home-pipeline"
      >
        <div class="section-heading">
          <h2 id="home-pipeline-title">
            Embudo de tareas
          </h2>
          <button
            type="button"
            class="home-link"
            @click="emit('navigate', 'tasks')"
          >
            Ir a Tareas <ArrowRight
              :size="14"
              aria-hidden="true"
            />
          </button>
        </div>
        <InlineNotice
          v-if="hasFailed('tasks')"
          tone="error"
          title="Sin tareas"
        >
          No se pudieron consultar las tareas.
        </InlineNotice>
        <TaskPipelineChart
          v-else-if="tasks"
          :stages="pipelineStages"
        />
        <p
          v-else
          class="field-help"
        >
          Consultando…
        </p>
      </section>

      <!-- 3c. Columna lateral: cobros del mes por forma de pago (corte mensual ya consultado). -->
      <section
        v-if="access.canReadMovements"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.paymentMethods)"
        aria-labelledby="home-payment-methods-title"
        data-testid="home-payment-methods"
      >
        <div class="section-heading">
          <h2 id="home-payment-methods-title">
            Formas de pago
          </h2>
          <span class="field-help">Cobros de {{ currentMonthName }}</span>
        </div>
        <PaymentMethodBars
          v-if="paymentShares.length"
          :shares="paymentShares"
        />
        <p
          v-else
          class="field-help"
        >
          {{ hasFailed('movements') ? 'No se pudieron consultar los cobros.' : monthSummary ? 'Sin cobros este mes.' : 'Consultando…' }}
        </p>
      </section>

      <!-- 3d. Columna lateral: tareas abiertas visibles que vencen en los próximos 7 días. -->
      <section
        v-if="access.canReadTasks"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.dueWeek)"
        aria-labelledby="home-due-week-title"
        data-testid="home-due-week"
      >
        <div class="section-heading">
          <h2 id="home-due-week-title">
            Vence esta semana
          </h2>
          <span class="field-help">{{ tasks ? dueThisWeekCount + ' tarea(s)' + (overdueCount ? ' · ' + overdueCount + ' ya vencida(s)' : '') : '' }}</span>
        </div>
        <DueWeekStrip
          v-if="tasks"
          :days="dueDays"
        />
        <p
          v-else
          class="field-help"
        >
          {{ hasFailed('tasks') ? 'No se pudieron consultar las tareas.' : 'Consultando…' }}
        </p>
      </section>

      <!-- 3e / 4a. Lo más urgente: mis tareas abiertas, vencidas primero. Sin tareas mías es un mosaico compacto. -->
      <section
        v-if="access.canReadTasks"
        class="surface-panel home-panel bento-tile home-reveal"
        :class="{ 'home-urgent-compact': isUrgentCompact }"
        :style="toTileStyle(isUrgentCompact ? tileLayout.urgentCompact : tileLayout.urgent)"
        aria-labelledby="home-tasks-title"
        data-testid="home-urgent"
      >
        <div class="section-heading">
          <h2 id="home-tasks-title">
            Lo más urgente
          </h2>
          <span class="field-help">Mis tareas</span>
        </div>
        <ul
          v-if="myUrgentTasks.length"
          class="home-list"
        >
          <li
            v-for="task in myUrgentTasks.slice(0, 5)"
            :key="task.taskId"
          >
            <AvatarStack
              v-if="task.assignees.length"
              :users="task.assignees"
            />
            <div class="home-item">
              <strong>{{ task.title }}</strong>
              <span class="field-help">{{ formatTaskFolio(task.folio) }} · {{ task.clientDisplayName ?? 'Despacho' }}<template v-if="task.dueDate"> · <CalendarDays
                :size="12"
                aria-hidden="true"
              /> {{ formatBusinessDate(task.dueDate) }}</template></span>
            </div>
            <StatusBadge
              v-if="isOverdueTask(task, today)"
              tone="error"
            >
              Vencida
            </StatusBadge>
            <StatusBadge
              v-else
              :tone="taskStateTones[task.state]"
            >
              {{ taskStateLabels[task.state] }}
            </StatusBadge>
          </li>
        </ul>
        <p
          v-else-if="tasks && !hasFailed('tasks')"
          class="home-all-clear"
        >
          <CircleCheck
            :size="20"
            aria-hidden="true"
          />
          <span><strong>Todo al día.</strong> No tienes tareas abiertas.</span>
        </p>
        <p
          v-else
          class="field-help"
        >
          {{ hasFailed('tasks') ? 'No se pudieron consultar tus tareas.' : 'Consultando…' }}
        </p>
      </section>

      <!-- 4b. Cobros recientes, con la foto de quien atendió. -->
      <section
        v-if="access.canReadMovements"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.payments)"
        aria-labelledby="home-recent-payments-title"
        data-testid="home-recent-payments"
      >
        <div class="section-heading">
          <h2 id="home-recent-payments-title">
            Cobros recientes
          </h2>
          <button
            type="button"
            class="home-link"
            @click="emit('navigate', 'payments')"
          >
            Ir a Pagos <ArrowRight
              :size="14"
              aria-hidden="true"
            />
          </button>
        </div>
        <ul
          v-if="recentPayments && recentPayments.length"
          class="home-list"
        >
          <li
            v-for="payment in recentPayments"
            :key="payment.movementId"
          >
            <UserAvatar
              :user-id="payment.createdByUserId"
              :display-name="payment.createdByDisplayName"
              size="small"
              is-decorative
            />
            <div class="home-item">
              <strong>{{ payment.clientDisplayName }}</strong>
              <span class="field-help">{{ formatBusinessDateTime(payment.movementDate, payment.movementTime) }} · Atendió {{ payment.createdByDisplayName }}</span>
            </div>
            <span class="home-amount">{{ formatMoney(payment.amount) }}</span>
          </li>
        </ul>
        <p
          v-else
          class="field-help"
        >
          {{ hasFailed('movements') ? 'No se pudieron consultar los cobros.' : recentPayments ? 'Sin cobros en los últimos 30 días.' : 'Consultando…' }}
        </p>
      </section>

      <!-- 4c. Requiere atención: reparto de opiniones, opiniones con problemas o vencidas y reportes pendientes. -->
      <section
        v-if="canShowAttention"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.attention)"
        aria-labelledby="home-attention-title"
      >
        <div class="section-heading">
          <h2 id="home-attention-title">
            Requiere atención
          </h2>
        </div>
        <div class="home-attention">
          <div
            v-if="access.canReadOpinions"
            class="home-attention-column"
            data-testid="home-opinions"
          >
            <p class="home-subtitle">
              Opiniones de cumplimiento
            </p>
            <ComplianceBreakdownBar
              v-if="opinions && opinions.length"
              :segments="complianceSegments"
            />
            <ul
              v-if="opinionAttention.length"
              class="home-list"
              aria-label="Opiniones con problemas o vencidas"
            >
              <li
                v-for="item in opinionAttention.slice(0, 5)"
                :key="item.client.clientId"
              >
                <div class="home-item">
                  <strong>{{ item.client.clientDisplayName }}</strong><span class="field-help">{{ item.client.rfc ?? 'Sin RFC' }}</span>
                </div>
                <StatusBadge :tone="item.label === 'Vencida' ? 'warning' : 'error'">
                  {{ item.label }}
                </StatusBadge>
              </li>
            </ul>
            <p
              v-else
              class="field-help"
            >
              {{ hasFailed('opinions') ? 'No se pudieron consultar las opiniones.' : opinions ? 'Ninguna opinión requiere atención.' : 'Consultando…' }}
            </p>
          </div>
          <div
            v-if="canShowReports"
            class="home-attention-column"
            data-testid="home-reports"
          >
            <p class="home-subtitle">
              Clientes con reporte mensual · {{ previousMonthLabel }}
            </p>
            <ul
              v-if="reports && clients && pendingReportClients.length"
              class="home-list"
            >
              <li
                v-for="client in pendingReportClients.slice(0, 5)"
                :key="client.clientId"
              >
                <div class="home-item">
                  <strong>{{ client.displayName }}</strong><span class="field-help">Sin reporte mensual</span>
                </div>
                <StatusBadge tone="warning">
                  Pendiente
                </StatusBadge>
              </li>
            </ul>
            <p
              v-else
              class="field-help"
            >
              {{ hasFailed('reports') || hasFailed('clients') ? 'No se pudieron consultar los reportes.' : reports && clients ? 'Todos los clientes tienen su reporte.' : 'Consultando…' }}
            </p>
          </div>
          <!-- Descargas automáticas del SAT (2026-10-11): pausa del SAT y programaciones con problemas; clic = Fiscal del cliente. -->
          <div
            v-if="access.canDownloadSat"
            class="home-attention-column"
            data-testid="home-sat-automation"
          >
            <p class="home-subtitle">
              Descargas automáticas del SAT
            </p>
            <StatusBadge
              v-if="satPlatformState?.isPaused"
              :tone="satPlatformState.tone"
            >
              {{ satPlatformState.label }}
            </StatusBadge>
            <ul
              v-if="satAttention.length"
              class="home-list"
              aria-label="Descargas automáticas con problemas"
            >
              <li
                v-for="item in satAttention.slice(0, 5)"
                :key="item.clientId"
              >
                <button
                  type="button"
                  class="home-item home-item-button"
                  @click="openSatDownload(item.clientId, item.clientDisplayName)"
                >
                  <strong>{{ item.clientDisplayName }}</strong><span class="field-help">{{ item.detail }}</span>
                </button>
                <StatusBadge :tone="item.tone">
                  {{ item.label }}
                </StatusBadge>
              </li>
            </ul>
            <p
              v-else
              class="field-help"
            >
              {{ hasFailed('satAutomation') ? 'No se pudieron consultar las descargas automáticas.' : satSchedules ? 'Ninguna descarga automática requiere atención.' : 'Consultando…' }}
            </p>
          </div>
        </div>
      </section>

      <!-- 5. Equipo hoy (administrador): comparte la consulta del panel de equipo de abajo. -->
      <section
        v-if="access.canViewTeam && team"
        class="surface-panel home-panel bento-tile home-reveal"
        :style="toTileStyle(tileLayout.team)"
        aria-labelledby="home-team-title"
        data-testid="home-team-today"
      >
        <div class="section-heading">
          <h2 id="home-team-title">
            Equipo hoy
          </h2>
          <span class="field-help">Tareas abiertas y terminadas hoy</span>
        </div>
        <TeamTodayPanel
          :members="team.members"
          :task-counts-by-member="taskCountsByMember"
        />
      </section>
    </div>

    <TeamOverviewPanel
      v-if="access.canViewTeam"
      class="home-reveal"
      @loaded="team = $event"
    />
    <p
      v-if="!hasAnySection"
      class="field-help"
    >
      Tu cuenta todavía no tiene secciones del despacho. Pide a un administrador que te asigne un rol.
    </p>
  </section>
</template>

<style scoped>
/* El tablero es un contenedor: la rejilla bento elige 12, 6 o 1 columnas según el ancho real (con o sin menú). */
.home-dashboard { display: grid; gap: var(--spaceLarge); min-width: 0; container: home / inline-size; }
.home-dashboard > header > .lede { margin-bottom: 0; }

/*
 * Rejilla bento. Cada mosaico trae su tamaño en variables (ver `tileLayout`):
 * - ancha (≥ 960 px de tablero): 12 columnas, `--wideSpan` columnas y `--wideRows` filas;
 * - media (560–959 px): 6 columnas, `--mediumSpan` columnas y una fila;
 * - angosta (< 560 px): una columna, todo apilado.
 * `dense` deja que un mosaico chico rellene un hueco anterior (p. ej. "lo más urgente" compacto bajo la columna lateral).
 */
.home-bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-flow: row dense; gap: var(--spaceMedium); min-width: 0; }
.bento-tile { grid-column: span var(--wideSpan, 12); grid-row: span var(--wideRows, 1); min-width: 0; }
.bento-full { grid-column: 1 / -1; }
@container home (max-width: 959px) {
  .home-bento { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .bento-tile { grid-column: span var(--mediumSpan, 6); grid-row: auto; }
}
@container home (max-width: 559px) {
  .home-bento { grid-template-columns: minmax(0, 1fr); }
  .bento-tile { grid-column: 1 / -1; }
}

/* Consulta rápida: título a la izquierda, accesos centrados y Actualizar a la derecha; en angosto, accesos abajo. */
.home-toolbar { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: 'title shortcuts refresh' 'notice notice notice'; align-items: center; gap: var(--spaceMedium); row-gap: 0; }
.home-toolbar h2 { grid-area: title; margin: 0; font-size: 18px; }
.home-refresh { grid-area: refresh; }
.home-shortcuts { grid-area: shortcuts; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.home-toolbar-notice { grid-area: notice; margin-top: var(--spaceMedium); }
@container home (max-width: 959px) {
  .home-toolbar { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'title refresh' 'shortcuts shortcuts' 'notice notice'; row-gap: var(--spaceMedium); }
  .home-toolbar-notice { margin-top: 0; }
}

/* Héroe: la cifra del mes en grande (una sola por vista), variación con flecha y signo, y datos en mono. */
.home-hero { align-content: space-between; }
.home-hero.is-alert { border-color: var(--errorColor); }
.hero-figure { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; margin: 0; }
.hero-figure strong { font-size: clamp(36px, 5cqi, 56px); line-height: 1; font-weight: 800; letter-spacing: -.035em; overflow-wrap: anywhere; }
.hero-delta { font-family: var(--monoFontFamily); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--mutedTextColor); }
.hero-delta.is-up { color: var(--successColor); }
.hero-delta.is-down { color: var(--errorColor); }
.hero-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr)); gap: 8px 16px; margin: 0; padding: 12px 0; border-block: 1px solid var(--hairlineColor); }
.hero-facts dt { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.hero-facts dd { margin: 2px 0 0; font-family: var(--monoFontFamily); font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tone-error { color: var(--errorColor); }

/* Indicadores chicos: marco de 2 px, rótulo arriba y cifra abajo (gramática común de métricas, ADR-034). */
.home-kpi { display: grid; align-content: space-between; gap: 12px; min-width: 0; padding: 14px 16px; border: 2px solid var(--borderColor); background: var(--surfaceColor); color: var(--textColor); box-shadow: var(--cardShadow); font: inherit; text-align: left; cursor: pointer; transition-property: transform, box-shadow; transition-duration: var(--durationQuick, 150ms); }
.home-kpi:not(.is-static):hover { background: var(--hoverColor); }
.home-kpi:not(.is-static):active { transform: translate(3px, 3px); box-shadow: none; }
.home-kpi:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.home-kpi.is-static { cursor: default; }
.home-kpi.is-alert { border-color: var(--errorColor); }
.home-kpi-label { font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.home-kpi-body { display: grid; gap: 4px; }
.home-kpi strong { font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -.03em; overflow-wrap: anywhere; }
.home-kpi-detail { font-size: 12px; color: var(--mutedTextColor); overflow-wrap: anywhere; }

/* Ingresos y gastos: la gráfica ocupa todo el alto que sobra en el mosaico (mínimo 260 px). */
.bento-cash-flow { --chartMinimumHeight: 260px; grid-template-rows: auto minmax(0, 1fr); align-content: stretch; }

/* "Lo más urgente" sin tareas: aviso positivo compacto, no una tarjeta grande vacía. */
.home-all-clear { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 13px; color: var(--mutedTextColor); }
.home-all-clear svg { flex: none; color: var(--successColor); }
.home-all-clear strong { color: var(--textColor); }

.home-attention { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: var(--spaceLarge); }
.home-attention-column { display: grid; gap: 10px; align-content: start; min-width: 0; }
.home-link { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--accentColor); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.home-link:hover { text-decoration: underline; }
.home-link:focus-visible { outline: 3px solid var(--focusColor); outline-offset: 2px; }
.home-subtitle { margin: 0; font-family: var(--monoFontFamily); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.home-list { list-style: none; margin: 0; padding: 0; }
.home-list li { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--hairlineColor); }
.home-list li:last-child { border-bottom: 0; }
.home-item { display: grid; gap: 2px; flex: 1; min-width: 10rem; overflow-wrap: anywhere; }
.home-item-button { border: none; background: none; padding: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.home-item-button:hover strong, .home-item-button:focus-visible strong { text-decoration: underline; }
.home-item .field-help { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 0; }
.home-amount { font-family: var(--monoFontFamily); font-weight: 800; font-variant-numeric: tabular-nums; }
</style>
