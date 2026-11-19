import { ref } from 'vue'
import type { WorkspaceAccess } from '../../../shared/contracts/workspace'
import type { Task } from '../../../shared/contracts/tasks'
import type { Movement, MovementSummary } from '../../../shared/contracts/movements'
import type { AssignedClient } from '../../../shared/contracts/clients'
import type { ClientOpinionSummary } from '../../../shared/contracts/complianceOpinions'
import type { FiscalReportSummary } from '../../../shared/contracts/fiscalReports'
import type { SatPlatformStatus, SatScheduleSummary } from '../../../shared/contracts/satDownloadSchedules'
import { createRangeFilter, listRecentMonths, shiftBusinessDate, type CashFlowPoint } from './homeDashboardMetrics'

/**
 * Consultas del tablero de Inicio (CRM, 2026-10-06). Sólo usa APIs que ya existían en `window.contapp`; no hay
 * canales nuevos ni caché: cada carga vuelve a pedir al Host, que autoriza cada consulta con la sesión.
 *
 * Orden de las consultas:
 * - Cada fuente se pide sólo si `workspaceAccess` la permite; lo demás queda oculto en la vista.
 * - Main atiende **una operación a la vez** en `movements:operate`, `clients:operate` y `tasks:operate`
 *   (rechaza la segunda con "unavailable"), así que las consultas de un mismo canal van en serie y los
 *   canales distintos en paralelo.
 * - Un fallo en una fuente no tumba las demás: queda en `failedSources` y su bloque muestra el aviso.
 */
export type DashboardSource = 'tasks' | 'movements' | 'clients' | 'opinions' | 'reports' | 'satAutomation'
export const dashboardSourceLabels: Record<DashboardSource, string> = { tasks: 'las tareas', movements: 'los cobros y gastos', clients: 'los clientes', opinions: 'las opiniones', reports: 'los reportes', satAutomation: 'las descargas automáticas del SAT' }
/** Meses del gráfico de ingresos y gastos. */
export const cashFlowMonthCount = 6
/** Días hacia atrás para los cobros recientes y cuántos se muestran. */
const recentPaymentDays = 30, recentPaymentCount = 5
/** Tope de páginas de clientes (50 por página en el Host) para contar los activos sin recorrer sin fin. */
const maximumClientPages = 20

export function createHomeDashboard(today: string) {
  const previousMonth = (() => { const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7)); return month === 1 ? { fiscalYear: year - 1, fiscalMonth: 12 } : { fiscalYear: year, fiscalMonth: month - 1 } })()
  const tasks = ref<Task[] | null>(null), currentUserId = ref<string | null>(null)
  const todaySummary = ref<MovementSummary | null>(null), monthSummary = ref<MovementSummary | null>(null)
  const cashFlow = ref<CashFlowPoint[] | null>(null), recentPayments = ref<Movement[] | null>(null)
  const clients = ref<AssignedClient[] | null>(null), hasMoreClients = ref(false)
  const opinions = ref<ClientOpinionSummary[] | null>(null), reports = ref<FiscalReportSummary[] | null>(null)
  /** Descargas automáticas del SAT (2026-10-11): programaciones de mis clientes y estado del corta-circuitos. */
  const satSchedules = ref<SatScheduleSummary[] | null>(null), satPlatform = ref<SatPlatformStatus | null>(null)
  const failedSources = ref<DashboardSource[]>([]), isLoading = ref(false)
  let isActive = true, loadSequence = 0

  /** Ejecuta una fuente y registra su fallo sin interrumpir las otras; ignora respuestas de cargas anteriores. */
  async function runSource(source: DashboardSource, sequence: number, job: () => Promise<void>): Promise<void> {
    try { await job() } catch { if (isActive && sequence === loadSequence) failedSources.value = [...failedSources.value, source] }
  }
  const isCurrent = (sequence: number): boolean => isActive && sequence === loadSequence

  /** Todas las tareas visibles; las completadas sólo de hoy. `currentUserId` permite separar "mis tareas". */
  async function loadTasks(sequence: number): Promise<void> {
    const result = await window.contapp.manageTasks({ action: 'list', filter: { scope: 'all', clientId: null, completedSince: today } })
    if (isCurrent(sequence) && result.status === 'listed') { tasks.value = result.tasks; currentUserId.value = result.currentUserId }
  }

  /** Corte de hoy, cortes de los últimos meses y cobros recientes, en serie por el canal de movimientos. */
  async function loadMovements(sequence: number): Promise<void> {
    const todayResult = await window.contapp.manageMovements({ action: 'summarize', filter: createRangeFilter(today, today) })
    if (!isCurrent(sequence)) return
    if (todayResult.status === 'summarized') todaySummary.value = todayResult.summary
    const points: CashFlowPoint[] = []
    let currentMonthSummary: MovementSummary | null = null
    for (const month of listRecentMonths(today, cashFlowMonthCount)) {
      const result = await window.contapp.manageMovements({ action: 'summarize', filter: createRangeFilter(month.fromDate, month.toDate) })
      if (!isCurrent(sequence)) return
      if (result.status !== 'summarized') continue
      points.push({ monthKey: month.monthKey, label: month.label, fullLabel: month.fullLabel, incomeAmount: result.summary.incomeAmount, expenseAmount: result.summary.expenseAmount })
      currentMonthSummary = result.summary
    }
    cashFlow.value = points; monthSummary.value = currentMonthSummary
    const listed = await window.contapp.manageMovements({ action: 'list', filter: createRangeFilter(shiftBusinessDate(today, recentPaymentDays), today, 'income'), beforeCursor: null })
    if (isCurrent(sequence) && listed.status === 'listed') recentPayments.value = listed.movements.slice(0, recentPaymentCount)
  }

  /** Clientes asignados, página por página (el canal no admite consultas simultáneas). */
  async function loadClients(sequence: number): Promise<void> {
    const collected: AssignedClient[] = []
    let afterClientId: string | null = null, pageCount = 0
    do {
      const result = await window.contapp.manageClients({ action: 'list', afterClientId })
      if (!isCurrent(sequence)) return
      collected.push(...result.clients); afterClientId = result.nextClientId; pageCount++
    } while (afterClientId && pageCount < maximumClientPages)
    clients.value = collected; hasMoreClients.value = afterClientId !== null
  }

  async function loadOpinions(sequence: number): Promise<void> {
    const result = await window.contapp.manageOpinions({ action: 'list' })
    if (isCurrent(sequence) && result.status === 'listed') opinions.value = result.clients
  }

  /** Reportes del ejercicio del mes anterior, para saber qué clientes ya tienen su reporte mensual. */
  async function loadReports(sequence: number): Promise<void> {
    const result = await window.contapp.manageFiscalReports({ action: 'list', clientId: null, fiscalYear: previousMonth.fiscalYear })
    if (isCurrent(sequence) && result.status === 'listed') reports.value = result.reports
  }

  async function loadSatAutomation(sequence: number): Promise<void> {
    const result = await window.contapp.manageSatDownloads({ action: 'listAutomation' })
    if (isCurrent(sequence) && result.status === 'automation') { satSchedules.value = result.schedules; satPlatform.value = result.platform }
  }

  async function load(access: WorkspaceAccess): Promise<void> {
    const sequence = ++loadSequence
    isLoading.value = true; failedSources.value = []
    await Promise.all([
      access.canReadTasks ? runSource('tasks', sequence, () => loadTasks(sequence)) : null,
      access.canReadMovements ? runSource('movements', sequence, () => loadMovements(sequence)) : null,
      access.canReadClients ? runSource('clients', sequence, () => loadClients(sequence)) : null,
      access.canReadOpinions ? runSource('opinions', sequence, () => loadOpinions(sequence)) : null,
      access.canReadReports ? runSource('reports', sequence, () => loadReports(sequence)) : null,
      access.canDownloadSat ? runSource('satAutomation', sequence, () => loadSatAutomation(sequence)) : null
    ])
    if (isCurrent(sequence)) isLoading.value = false
  }

  /** Al salir de Inicio se descartan las respuestas pendientes y se sueltan los datos (no hay caché). */
  function dispose(): void {
    isActive = false
    tasks.value = null; todaySummary.value = null; monthSummary.value = null; cashFlow.value = null; recentPayments.value = null
    clients.value = null; opinions.value = null; reports.value = null; satSchedules.value = null; satPlatform.value = null
  }

  return { previousMonth, tasks, currentUserId, todaySummary, monthSummary, cashFlow, recentPayments, clients, hasMoreClients, opinions, reports, satSchedules, satPlatform, failedSources, isLoading, load, dispose }
}
