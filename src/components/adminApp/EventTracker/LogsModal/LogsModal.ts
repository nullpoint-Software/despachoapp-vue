import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ls, us } from '@/service/adminApp/client'
import { loadProgressively } from '@/service/adminApp/progressiveLoader'

type LogId = string | number
type OperationSuffix = 'Added' | 'Updated' | 'Deleted'

interface LogsModalProps {
  visible: boolean
}
interface LogsModalEmits {
  (event: 'close'): void
  (event: 'undo', id: LogId): void
}
interface AuditLog {
  id: LogId
  aggregate_id?: LogId
  userid?: LogId
  type: string
  timestamp: string
  payload?: unknown
  oldpayload?: unknown
  [key: string]: unknown
}
interface AuditUser {
  id_usuario: LogId
  nombre: string
  username: string
}
interface TypeOption {
  label: string
  value: OperationSuffix
}
interface RouteScope {
  title: string
  prefix: string
}

defineProps<LogsModalProps>()
const emit = defineEmits<LogsModalEmits>()
const route = useRoute()
const now = Date.now()
const msDay = 864e5

const logs = ref<AuditLog[]>([])
const users = ref<AuditUser[]>([])
const loading = ref(true)
const loadError = ref('')
const detailsVisible = ref<Record<string, boolean>>({})
const searchId = ref('')
const selectedTypes = ref<OperationSuffix[]>([])
const dropdownOpen = ref(false)
const showAll = ref(true)
const undoingIds = ref(new Set<LogId>())

const typeOptions: TypeOption[] = [
  { label: 'Agregados', value: 'Added' },
  { label: 'Modificados', value: 'Updated' },
  { label: 'Eliminados', value: 'Deleted' }
]

const routeScope = computed<RouteScope>(() => {
  const path = route.fullPath
  if (path.includes('/app/pagos/mensual')) return { title: 'Pago mensual', prefix: 'PagoMensual' }
  if (path.includes('/app/pagos/concepto'))
    return { title: 'Pago por concepto', prefix: 'PagoConcepto' }
  if (path.includes('/app/pagos')) return { title: 'Pagos', prefix: 'Pago' }
  if (path.includes('/app/clientes')) return { title: 'Clientes', prefix: 'Cliente' }
  if (path.includes('/app/tareas')) return { title: 'Tareas', prefix: 'Tarea' }
  return { title: 'Sistema', prefix: '' }
})

const currentPageTitle = computed(() =>
  showAll.value ? 'Todos los módulos' : routeScope.value.title
)
const selectedLabels = computed(() =>
  selectedTypes.value
    .map((value) => typeOptions.find((option) => option.value === value)?.label)
    .filter(Boolean)
)

const filteredLogs = computed(() => {
  const search = searchId.value.trim().toLocaleLowerCase('es')
  return logs.value.filter((log) => {
    if (!showAll.value) {
      if (Date.parse(log.timestamp) < now - 90 * msDay) return false
      if (routeScope.value.prefix && !String(log.type || '').startsWith(routeScope.value.prefix))
        return false
    }

    const suffix = String(log.type || '').match(/Added|Updated|Deleted/)?.[0] as
      OperationSuffix | undefined
    if (!suffix) return false
    if (selectedTypes.value.length && !selectedTypes.value.includes(suffix)) return false

    if (search) {
      const searchable = [log.id, log.aggregate_id, log.type, humanizeType(log.type), getUser(log)]
        .join(' ')
        .toLocaleLowerCase('es')
      if (!searchable.includes(search)) return false
    }
    return true
  })
})

function normalizeLogs(items: AuditLog[]): AuditLog[] {
  return items
    .map((log) => ({
      ...log,
      payload: parsePayload(log.payload),
      oldpayload: parsePayload(log.oldpayload),
      timestamp: new Date(log.timestamp).toISOString()
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return { valor: value }
  }
}

async function loadLogs() {
  loading.value = true
  loadError.value = ''
  try {
    users.value = await us.getUsuarios()
    await loadProgressively<AuditLog>({
      pageSize: 50,
      fetchPage: (page) => ls.getLogs(page),
      onUpdate: (items) => {
        logs.value = normalizeLogs(items)
        loading.value = false
      },
      onBackgroundError: (error) => console.error('No se completó la carga de registros', error)
    })
  } catch (error) {
    loading.value = false
    loadError.value = error instanceof Error ? error.message : 'Revisa la conexión con el servidor.'
  }
}

onMounted(loadLogs)

function toggleType(value: OperationSuffix): void {
  const index = selectedTypes.value.indexOf(value)
  if (index >= 0) selectedTypes.value.splice(index, 1)
  else selectedTypes.value.push(value)
}

function selectAll() {
  selectedTypes.value = []
  dropdownOpen.value = false
}

function clearFilters() {
  searchId.value = ''
  selectedTypes.value = []
}

function toggleDetails(id: LogId): void {
  detailsVisible.value[String(id)] = !detailsVisible.value[String(id)]
}

function closeModal() {
  dropdownOpen.value = false
  emit('close')
}

async function onUndo(id: LogId): Promise<void> {
  const selectedLog = logs.value.find((log) => log.id == id)
  if (!selectedLog || undoingIds.value.has(id)) return
  undoingIds.value.add(id)
  try {
    await ls.revertLog(selectedLog)
    logs.value = logs.value.filter((log) => log.id !== id)
    emit('undo', id)
    window.location.reload()
  } catch (error) {
    console.error(error)
  } finally {
    undoingIds.value.delete(id)
  }
}

function getUser(log: AuditLog): string {
  const user = users.value.find((item) => item.id_usuario == log.userid)
  return user ? `${user.nombre} (${user.username})` : `Usuario ${log.userid || 'desconocido'}`
}

function humanizeType(type: string): string {
  const labels: Record<string, string> = {
    ClienteAdded: 'Cliente agregado',
    ClienteUpdated: 'Cliente modificado',
    ClienteDeleted: 'Cliente eliminado',
    TareaAdded: 'Tarea agregada',
    TareaUpdated: 'Tarea modificada',
    TareaDeleted: 'Tarea eliminada',
    PagoConceptoAdded: 'Pago por concepto agregado',
    PagoConceptoDeleted: 'Pago por concepto eliminado',
    PagoConceptoUpdated: 'Pago por concepto modificado',
    PagoMensualAdded: 'Pago mensual agregado',
    PagoMensualUpdated: 'Pago mensual modificado',
    PagoMensualDeleted: 'Pago mensual eliminado'
  }
  return labels[type] || type || 'Movimiento del sistema'
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp))
}

function operationCode(log: AuditLog): string {
  if (String(log.type).endsWith('Added')) return 'ALT'
  if (String(log.type).endsWith('Updated')) return 'MOD'
  if (String(log.type).endsWith('Deleted')) return 'BAJ'
  return 'SYS'
}

function cardClasses(log: AuditLog): string {
  if (String(log.type).endsWith('Added')) return 'is-added'
  if (String(log.type).endsWith('Updated')) return 'is-updated'
  if (String(log.type).endsWith('Deleted')) return 'is-deleted'
  return 'is-system'
}

function fieldCount(value: unknown): number {
  return value && typeof value === 'object' ? Object.keys(value).length : 0
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Sin valor'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
