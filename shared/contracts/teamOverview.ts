import { pairingRecord, pairingText } from './pairing'
import { parseHostId } from './discovery'

/**
 * Panel de equipo de Inicio (rediseño 2026-10-02, decisión del usuario): información de todos los
 * usuarios para el administrador. Es GLOBAL y de sólo lectura; el Host la calcula en cada consulta.
 * - Exige `users.manage`, `tasks.read` y `movements.read` (capacidad `canViewTeam`).
 * - "Hoy" y "este mes" son los del despacho (`getOfficeToday` del Host), no los del equipo que consulta.
 * - Los importes salen de movimientos activos (no cancelados) que registró cada usuario.
 * - La última actividad sale de sus sesiones; el equipo es el de la sesión más reciente.
 */
export const teamOverviewChannel = 'team:overview'
export type TeamOverviewRequest = { action: 'overview' }
export interface TeamMember {
  userId: string; displayName: string; username: string; isActive: boolean; roleNames: string[]
  openTaskCount: number; inProgressTaskCount: number; overdueTaskCount: number
  todayIncome: string; todayExpense: string; monthIncome: string; monthExpense: string; monthMovementCount: number
  lastActivityAt: string | null; lastDeviceAlias: string | null; activeSessionCount: number
}
/** Totales por mes del ejercicio en curso (1–12), para la gráfica de ingresos y costos. */
export interface MonthlyTotal { month: number; income: string; expense: string }
export interface TeamOverview { today: string; members: TeamMember[]; monthlyTotals: MonthlyTotal[] }
export type TeamOverviewResult = { status: 'overview'; overview: TeamOverview }

const amountPattern = /^\d{1,15}\.\d{2}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
function exactKeys(data: Record<string, unknown>, keys: readonly string[]): void { if (Object.keys(data).sort().join() !== [...keys].sort().join()) throw new Error('Invalid team data') }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid team count'); return Number(value) }
function amount(value: unknown): string { if (typeof value !== 'string' || !amountPattern.test(value)) throw new Error('Invalid team amount'); return value }
function timestamp(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid team timestamp')
  return value
}

export function parseTeamOverviewRequest(value: unknown): TeamOverviewRequest {
  const data = pairingRecord(value); exactKeys(data, ['action'])
  if (data.action !== 'overview') throw new Error('Invalid team request')
  return { action: 'overview' }
}
export function parseTeamOverviewResult(value: unknown): TeamOverviewResult {
  const data = pairingRecord(value); exactKeys(data, ['status', 'overview'])
  if (data.status !== 'overview') throw new Error('Invalid team result')
  const overview = pairingRecord(data.overview); exactKeys(overview, ['today', 'members', 'monthlyTotals'])
  if (typeof overview.today !== 'string' || !datePattern.test(overview.today)) throw new Error('Invalid team date')
  if (!Array.isArray(overview.members) || overview.members.length > 1000 || !Array.isArray(overview.monthlyTotals) || overview.monthlyTotals.length !== 12) throw new Error('Invalid team data')
  return { status: 'overview', overview: {
    today: overview.today,
    members: overview.members.map(item => {
      const member = pairingRecord(item)
      exactKeys(member, ['userId', 'displayName', 'username', 'isActive', 'roleNames', 'openTaskCount', 'inProgressTaskCount', 'overdueTaskCount', 'todayIncome', 'todayExpense', 'monthIncome', 'monthExpense', 'monthMovementCount', 'lastActivityAt', 'lastDeviceAlias', 'activeSessionCount'])
      if (typeof member.isActive !== 'boolean' || !Array.isArray(member.roleNames) || member.roleNames.length > 50) throw new Error('Invalid team member')
      return { userId: parseHostId(member.userId), displayName: pairingText(member.displayName, 100), username: pairingText(member.username, 64), isActive: member.isActive,
        roleNames: member.roleNames.map(name => pairingText(name, 100)), openTaskCount: count(member.openTaskCount), inProgressTaskCount: count(member.inProgressTaskCount), overdueTaskCount: count(member.overdueTaskCount),
        todayIncome: amount(member.todayIncome), todayExpense: amount(member.todayExpense), monthIncome: amount(member.monthIncome), monthExpense: amount(member.monthExpense), monthMovementCount: count(member.monthMovementCount),
        lastActivityAt: timestamp(member.lastActivityAt), lastDeviceAlias: member.lastDeviceAlias === null ? null : pairingText(member.lastDeviceAlias, 100), activeSessionCount: count(member.activeSessionCount) }
    }),
    monthlyTotals: overview.monthlyTotals.map((item, index) => {
      const total = pairingRecord(item); exactKeys(total, ['month', 'income', 'expense'])
      if (total.month !== index + 1) throw new Error('Invalid team month')
      return { month: index + 1, income: amount(total.income), expense: amount(total.expense) }
    })
  } }
}
