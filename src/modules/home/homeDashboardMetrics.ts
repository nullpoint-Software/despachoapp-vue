import type { Task } from '../../../shared/contracts/tasks'
import type { ClientOpinionSummary, OpinionListStatus } from '../../../shared/contracts/complianceOpinions'
import { formatCents, parseDecimalCents, type MovementFilter, type MovementSummary, type PaymentMethod } from '../../../shared/contracts/movements'
import { paymentMethodLabels } from '../../../shared/presentation/movementLabels'
import { isOverdueTask, isPendingTask } from '../tasks/taskLabels'
import { monthNames } from '../reports/reportLabels'

/**
 * Cálculos puros del tablero de Inicio (CRM, 2026-10-06). No consultan nada ni guardan estado: reciben lo que el
 * Host ya autorizó y devuelven lo que pintan los indicadores y las gráficas. Así se prueban sin Electron.
 */

/** Un mes del periodo que se grafica: rango de fechas del despacho y su etiqueta corta. */
export interface DashboardMonth { monthKey: string; label: string; fullLabel: string; fromDate: string; toDate: string }
/** Una columna del gráfico de ingresos y gastos. Los importes conservan el texto decimal exacto del Host. */
export interface CashFlowPoint { monthKey: string; label: string; fullLabel: string; incomeAmount: string; expenseAmount: string }
/** Una etapa del embudo de tareas. */
export interface PipelineStage { stageKey: 'unassigned' | 'pending' | 'inProgress' | 'completedToday'; label: string; taskCount: number }
/** Tareas abiertas y terminadas hoy de un trabajador, calculadas con las tareas visibles. */
export interface MemberTaskCounts { openTaskCount: number; completedTodayCount: number }
/** Opinión que requiere atención, con la etiqueta de su sello. */
export interface OpinionAttentionItem { client: ClientOpinionSummary; label: string }

const attentionLabels: Partial<Record<OpinionListStatus, string>> = { negative: 'Con pendientes', notLocated: 'No localizado', cancelled: 'Cancelado', notRegistered: 'No inscrito', suspended: 'Suspensión', other: 'Revisar', error: 'Error de consulta' }

/** Último día de un mes (mes 1–12) sin depender de la zona horaria del equipo. */
function lastDayOfMonth(year: number, month: number): number { return new Date(Date.UTC(year, month, 0)).getUTCDate() }

/**
 * Los `monthCount` meses que terminan en el de `today` (día del despacho), del más antiguo al actual.
 * El mes en curso se corta en `today` para que el corte no pida fechas futuras.
 */
export function listRecentMonths(today: string, monthCount: number): DashboardMonth[] {
  const currentYear = Number(today.slice(0, 4)), currentMonth = Number(today.slice(5, 7))
  const months: DashboardMonth[] = []
  for (let offset = monthCount - 1; offset >= 0; offset--) {
    const absoluteMonth = currentYear * 12 + (currentMonth - 1) - offset
    const year = Math.floor(absoluteMonth / 12), month = absoluteMonth % 12 + 1
    const monthKey = year + '-' + String(month).padStart(2, '0')
    const isCurrent = offset === 0
    const name = monthNames[month - 1] ?? ''
    months.push({ monthKey, label: name.slice(0, 3), fullLabel: name + ' ' + year, fromDate: monthKey + '-01', toDate: isCurrent ? today : monthKey + '-' + String(lastDayOfMonth(year, month)).padStart(2, '0') })
  }
  return months
}

/** Filtro de corte para todos los movimientos visibles (clientes y despacho) de un rango; sin cancelados. */
export function createRangeFilter(fromDate: string, toDate: string, movementType: MovementFilter['movementType'] = null): MovementFilter {
  return { scope: 'all', clientId: null, officeCategory: null, fromDate, fromTime: null, toDate, toTime: null, movementType, paymentMethod: null, search: '', includeVoided: false }
}

/** Fecha de negocio `days` días antes de `today` (aritmética en UTC sobre la fecha, sin hora local). */
export function shiftBusinessDate(today: string, days: number): string {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}

/**
 * Embudo de tareas visibles. "Pendiente" no es un estado: es una disponible con responsables (igual que el tablero).
 * Las completadas sólo cuentan las de hoy, porque la lista se pide con `completedSince` = hoy.
 */
export function buildTaskPipeline(tasks: readonly Task[]): PipelineStage[] {
  const unassigned = tasks.filter(task => task.state === 'available' && !isPendingTask(task)).length
  return [
    { stageKey: 'unassigned', label: 'Sin responsable', taskCount: unassigned },
    { stageKey: 'pending', label: 'Pendientes', taskCount: tasks.filter(isPendingTask).length },
    { stageKey: 'inProgress', label: 'En progreso', taskCount: tasks.filter(task => task.state === 'inProgress').length },
    { stageKey: 'completedToday', label: 'Completadas hoy', taskCount: tasks.filter(task => task.state === 'completed').length }
  ]
}

/** Abiertas de un usuario: vencidas primero y luego por fecha límite (sin fecha al final). */
export function sortUrgentTasks(tasks: readonly Task[], today: string): Task[] {
  return tasks.filter(task => task.state !== 'completed')
    .sort((first, second) => Number(isOverdueTask(second, today)) - Number(isOverdueTask(first, today)) || (first.dueDate ?? '9999').localeCompare(second.dueDate ?? '9999'))
}

/** Cuenta, por responsable, las tareas visibles abiertas y las terminadas hoy (una tarea compartida cuenta para cada uno). */
export function countTasksByMember(tasks: readonly Task[]): Map<string, MemberTaskCounts> {
  const counts = new Map<string, MemberTaskCounts>()
  for (const task of tasks) {
    for (const assignee of task.assignees) {
      const current = counts.get(assignee.userId) ?? { openTaskCount: 0, completedTodayCount: 0 }
      if (task.state === 'completed') current.completedTodayCount++; else current.openTaskCount++
      counts.set(assignee.userId, current)
    }
  }
  return counts
}

/**
 * Opiniones que requieren atención: resultados con problemas y positivas que ya vencieron (30 días).
 * Las de clientes sin consultar se cuentan aparte; no son un problema del cliente.
 */
export function listOpinionAttention(opinions: readonly ClientOpinionSummary[]): OpinionAttentionItem[] {
  const items: OpinionAttentionItem[] = []
  for (const client of opinions) {
    const label = attentionLabels[client.status]
    if (label) items.push({ client, label })
    else if (client.status === 'positive' && !client.isValid) items.push({ client, label: 'Vencida' })
  }
  return items
}

/** Porcentaje de positivas vigentes entre los clientes consultados (0 si no hay consultados). */
export function calculatePositivePercent(opinions: readonly ClientOpinionSummary[]): number {
  const reviewedCount = opinions.filter(client => client.status !== 'notQueried').length
  return reviewedCount ? Math.round(opinions.filter(client => client.isValid).length / reviewedCount * 100) : 0
}

/**
 * Tope "redondo" del eje de importes y sus marcas: 1, 2, 2.5 o 5 por potencia de 10, con `tickCount` divisiones.
 * Sin datos devuelve un eje de 0 a 1 para no dividir entre cero.
 */
export function calculateAxisTicks(maximumValue: number, tickCount: number): number[] {
  if (!(maximumValue > 0)) return Array.from({ length: tickCount + 1 }, (slot, index) => index / tickCount)
  const rawStep = maximumValue / tickCount, magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = ([1, 2, 2.5, 5, 10].find(multiplier => multiplier * magnitude >= rawStep) ?? 10) * magnitude
  return Array.from({ length: tickCount + 1 }, (slot, index) => index * step)
}

/** Neto exacto (ingresos − gastos) sobre el texto decimal del Host, en centavos enteros: sin errores de coma flotante. */
export function subtractAmounts(incomeAmount: string, expenseAmount: string): string {
  return formatCents(parseDecimalCents(incomeAmount) - parseDecimalCents(expenseAmount))
}

/** Cambio del ingreso del mes en curso contra el mes anterior de la serie. */
export interface MonthOverMonthChange { changePercent: number; previousMonthLabel: string }

/**
 * Variación porcentual (entera) del ingreso del último mes de la serie contra el penúltimo, en centavos exactos.
 * Devuelve `null` si no hay dos meses o si el mes anterior no tuvo ingresos (no hay base para un porcentaje).
 * Ojo: el mes en curso va cortado en hoy, así que compara "lo que va del mes" contra el mes anterior completo.
 */
export function calculateMonthOverMonthChange(points: readonly CashFlowPoint[]): MonthOverMonthChange | null {
  const current = points[points.length - 1], previous = points[points.length - 2]
  if (!current || !previous) return null
  const previousCents = parseDecimalCents(previous.incomeAmount)
  if (previousCents <= 0n) return null
  const differenceCents = parseDecimalCents(current.incomeAmount) - previousCents
  return { changePercent: Math.round(Number(differenceCents * 1000n / previousCents) / 10), previousMonthLabel: previous.fullLabel }
}

/** Ingreso del mes por forma de pago, con su porcentaje del total cobrado. */
export interface PaymentMethodShare { paymentMethod: PaymentMethod; label: string; incomeAmount: string; sharePercent: number }

/**
 * Formas de pago con cobros en el corte, de mayor a menor ingreso. Sólo cuenta ingresos (los gastos no son "cobros").
 * Los porcentajes se redondean por separado: pueden sumar 99 o 101, y la cifra exacta va junto a cada barra.
 */
export function buildPaymentMethodShares(summary: Pick<MovementSummary, 'byPaymentMethod'>): PaymentMethodShare[] {
  const items = summary.byPaymentMethod.map(item => ({ item, cents: parseDecimalCents(item.incomeAmount) })).filter(entry => entry.cents > 0n)
  const totalCents = items.reduce((total, entry) => total + entry.cents, 0n)
  return items.sort((first, second) => (second.cents > first.cents ? 1 : second.cents < first.cents ? -1 : 0))
    .map(entry => ({ paymentMethod: entry.item.paymentMethod, label: paymentMethodLabels[entry.item.paymentMethod], incomeAmount: entry.item.incomeAmount,
      sharePercent: totalCents > 0n ? Math.round(Number(entry.cents * 1000n / totalCents) / 10) : 0 }))
}

/** Segmento de la barra de cumplimiento: estado agrupado, su tono de sello y cuántos clientes caen en él. */
export interface ComplianceSegment { segmentKey: 'valid' | 'expired' | 'problem' | 'notQueried'; label: string; tone: 'success' | 'warning' | 'error' | 'neutral'; clientCount: number }

/**
 * Reparto de la cartera por estado de la opinión de cumplimiento, en el orden de lectura bueno → malo → sin dato:
 * positivas vigentes, positivas vencidas, con problemas (cualquier otro resultado) y sin consultar.
 * Usa la misma regla que `listOpinionAttention`, así que vencidas + con problemas = "opiniones por atender".
 */
export function buildComplianceBreakdown(opinions: readonly ClientOpinionSummary[]): ComplianceSegment[] {
  const countWhere = (predicate: (client: ClientOpinionSummary) => boolean): number => opinions.filter(predicate).length
  return [
    { segmentKey: 'valid', label: 'Positivas vigentes', tone: 'success', clientCount: countWhere(client => client.status === 'positive' && client.isValid) },
    { segmentKey: 'expired', label: 'Vencidas', tone: 'warning', clientCount: countWhere(client => client.status === 'positive' && !client.isValid) },
    { segmentKey: 'problem', label: 'Con problemas', tone: 'error', clientCount: countWhere(client => client.status !== 'positive' && client.status !== 'notQueried') },
    { segmentKey: 'notQueried', label: 'Sin consultar', tone: 'neutral', clientCount: countWhere(client => client.status === 'notQueried') }
  ]
}

/** Un día de la franja "Vence esta semana". */
export interface DueDay { businessDate: string; weekdayLabel: string; weekdayName: string; dayNumber: number; taskCount: number; isToday: boolean }
const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Los `dayCount` días que empiezan hoy, con cuántas tareas abiertas vencen cada día. El día de la semana se
 * calcula en UTC sobre la fecha de negocio (sin hora local) para no correrse por la zona horaria del equipo.
 */
export function buildDueDays(tasks: readonly Task[], today: string, dayCount: number): DueDay[] {
  const openDueDates = tasks.filter(task => task.state !== 'completed' && task.dueDate !== null).map(task => task.dueDate)
  return Array.from({ length: dayCount }, (slot, index) => {
    const businessDate = shiftBusinessDate(today, -index)
    const [year, month, day] = businessDate.split('-').map(Number) as [number, number, number]
    const weekdayName = weekdayNames[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? ''
    return { businessDate, weekdayLabel: weekdayName.slice(0, 3), weekdayName, dayNumber: day, taskCount: openDueDates.filter(dueDate => dueDate === businessDate).length, isToday: index === 0 }
  })
}

const compactCurrencyFormat =new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1 })
/** Importe compacto para ejes ("$12.5 k"); las cifras exactas van en la tabla y en el detalle. */
export function formatCompactMoney(amount: number): string { return compactCurrencyFormat.format(amount) }
