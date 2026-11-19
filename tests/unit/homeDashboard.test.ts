import { describe, expect, it } from 'vitest'
import type { Task } from '../../shared/contracts/tasks'
import type { ClientOpinionSummary } from '../../shared/contracts/complianceOpinions'
import { buildComplianceBreakdown, buildDueDays, buildPaymentMethodShares, buildTaskPipeline, calculateAxisTicks, calculateMonthOverMonthChange, calculatePositivePercent, countTasksByMember, listOpinionAttention, listRecentMonths, shiftBusinessDate, sortUrgentTasks, subtractAmounts } from '../../src/modules/home/homeDashboardMetrics'

// Cálculos puros del tablero CRM de Inicio (2026-10-06): sin Electron ni Host.
const noActions = { canEdit: false, canMove: false, canComplete: false, canAssign: false, canTake: false, canRelease: false }
const firstUser = { userId: 'user-a', displayName: 'Ana' }, secondUser = { userId: 'user-b', displayName: 'Beto' }
function createTask(overrides: Partial<Task>): Task {
  return { taskId: 'task-' + Math.random(), folio: 1, title: 'Tarea', description: '', clientId: null, clientDisplayName: null, state: 'available', dueDate: null, assignees: [], revision: 0,
    createdByDisplayName: 'Admin', createdAt: '2026-10-01T00:00:00.000Z', updatedByDisplayName: null, updatedAt: null, completedAt: null, actions: noActions, ...overrides }
}
function createOpinion(overrides: Partial<ClientOpinionSummary>): ClientOpinionSummary {
  return { clientId: 'client-' + Math.random(), clientDisplayName: 'Cliente', rfc: null, taxRegime: '601', additionalTaxRegimes: [], status: 'notQueried', isValid: false, latest: null, lastErrorMessage: null, lastErrorAt: null, ...overrides }
}

describe('home dashboard metrics', () => {
  it('lists the last months ending today, crossing the year and cutting the current month at today', () => {
    const months = listRecentMonths('2026-02-14', 3)
    expect(months.map(month => [month.monthKey, month.fromDate, month.toDate])).toEqual([['2025-12', '2025-12-01', '2025-12-31'], ['2026-01', '2026-01-01', '2026-01-31'], ['2026-02', '2026-02-01', '2026-02-14']])
    expect(months[0]!.label).toBe('dic')
    expect(shiftBusinessDate('2026-03-01', 1)).toBe('2026-02-28')
  })

  it('builds the task pipeline with pending as available tasks that already have assignees', () => {
    const stages = buildTaskPipeline([createTask({}), createTask({ assignees: [firstUser] }), createTask({ state: 'inProgress' }), createTask({ state: 'completed' }), createTask({ state: 'completed' })])
    expect(stages.map(stage => stage.taskCount)).toEqual([1, 1, 1, 2])
  })

  it('sorts urgent tasks overdue first, then by due date, and counts tasks per assignee', () => {
    const late = createTask({ title: 'Vencida', dueDate: '2026-01-01' }), soon = createTask({ title: 'Pronto', dueDate: '2026-12-01' }), undated = createTask({ title: 'Sin fecha' })
    expect(sortUrgentTasks([undated, soon, late, createTask({ state: 'completed' })], '2026-10-06').map(task => task.title)).toEqual(['Vencida', 'Pronto', 'Sin fecha'])
    const counts = countTasksByMember([createTask({ assignees: [firstUser, secondUser] }), createTask({ state: 'completed', assignees: [firstUser] })])
    expect(counts.get('user-a')).toEqual({ openTaskCount: 1, completedTodayCount: 1 })
    expect(counts.get('user-b')).toEqual({ openTaskCount: 1, completedTodayCount: 0 })
  })

  it('flags opinions with problems and expired positives, ignoring clients never queried', () => {
    const opinions = [createOpinion({ status: 'negative' }), createOpinion({ status: 'positive', isValid: false }), createOpinion({ status: 'positive', isValid: true }), createOpinion({})]
    expect(listOpinionAttention(opinions).map(item => item.label)).toEqual(['Con pendientes', 'Vencida'])
    expect(calculatePositivePercent(opinions)).toBe(33)
    expect(calculatePositivePercent([])).toBe(0)
  })

  it('rounds the amount axis and subtracts exact decimal amounts', () => {
    expect(calculateAxisTicks(9300, 4)).toEqual([0, 2500, 5000, 7500, 10000])
    expect(calculateAxisTicks(0, 4)).toEqual([0, .25, .5, .75, 1])
    expect(subtractAmounts('0.30', '0.35')).toBe('-0.05')
  })

  // Mosaicos del bento (2026-10-06): variación del mes, formas de pago, reparto de opiniones y semana de vencimientos.
  it('compares the current month income against the previous one and skips a zero base', () => {
    const point = (monthKey: string, incomeAmount: string) => ({ monthKey, label: monthKey, fullLabel: 'mes ' + monthKey, incomeAmount, expenseAmount: '0.00' })
    expect(calculateMonthOverMonthChange([point('08', '100.00'), point('09', '80.00'), point('10', '100.00')])).toEqual({ changePercent: 25, previousMonthLabel: 'mes 09' })
    expect(calculateMonthOverMonthChange([point('09', '200.00'), point('10', '50.00')])?.changePercent).toBe(-75)
    expect(calculateMonthOverMonthChange([point('09', '0.00'), point('10', '50.00')])).toBeNull()
    expect(calculateMonthOverMonthChange([point('10', '50.00')])).toBeNull()
  })

  it('ranks payment methods by income only, with their share of the month', () => {
    const totals = (paymentMethod: 'cash' | 'transfer' | 'card', incomeAmount: string) => ({ paymentMethod, incomeAmount, expenseAmount: '999.00', netAmount: '0.00', movementCount: 1 })
    const shares = buildPaymentMethodShares({ byPaymentMethod: [totals('cash', '250.00'), totals('transfer', '750.00'), totals('card', '0.00')] })
    expect(shares.map(share => [share.label, share.sharePercent])).toEqual([['Transferencia', 75], ['Efectivo', 25]])
  })

  it('splits opinions into valid, expired, problem and not queried with the attention rule', () => {
    const opinions = [createOpinion({ status: 'positive', isValid: true }), createOpinion({ status: 'positive', isValid: false }), createOpinion({ status: 'negative' }), createOpinion({ status: 'error' }), createOpinion({})]
    expect(buildComplianceBreakdown(opinions).map(segment => segment.clientCount)).toEqual([1, 1, 2, 1])
    expect(listOpinionAttention(opinions)).toHaveLength(3)
  })

  it('counts open tasks due on each of the next days, starting today', () => {
    const days = buildDueDays([createTask({ dueDate: '2026-10-06' }), createTask({ dueDate: '2026-10-08' }), createTask({ dueDate: '2026-10-08', state: 'completed' }), createTask({ dueDate: '2026-10-20' })], '2026-10-06', 7)
    expect(days.map(day => day.taskCount)).toEqual([1, 0, 1, 0, 0, 0, 0])
    expect(days[0]).toMatchObject({ weekdayName: 'martes', weekdayLabel: 'mar', dayNumber: 6, isToday: true })
    expect(days[6]!.businessDate).toBe('2026-10-12')
  })
})
