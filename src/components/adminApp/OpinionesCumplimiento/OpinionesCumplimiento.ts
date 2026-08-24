import { computed, nextTick, onMounted, ref } from 'vue'
import AppRegimePicker from '@/components/ui/AppRegimePicker/AppRegimePicker.vue'
import AppFilterModal from '@/components/ui/AppFilterModal/AppFilterModal.vue'
import { cos } from '@/service/adminApp/client'
import type {
  ComplianceRecord,
  ComplianceScheduleConfig,
  ComplianceScheduleFrequency,
  ComplianceStatus,
  ComplianceSummary
} from '@/service/adminApp/cumplimientoService'
import { regimenesFiscales, regimenFiscalLabel } from '@/constants/regimenesFiscales'

const records = ref<ComplianceRecord[]>([])
const selected = ref<ComplianceRecord | null>(null)
const documentClient = ref<ComplianceRecord | null>(null)
const loading = ref(true)
const syncing = ref(false)
const syncingClientId = ref<number | null>(null)
const syncProgress = ref({ processed: 0, total: 0, documents: 0 })
const showGuide = ref(false)
const showThirdParty = ref(false)
const showFilters = ref(false)
const search = ref('')
const statusFilter = ref('todos')
const regimeFilter = ref('todos')
const draftStatusFilter = ref('todos')
const draftRegimeFilter = ref('todos')
const errorMessage = ref('')
const successMessage = ref('')
const opinionsTutorialOpen = ref(false)
const scheduleOpen = ref(false)
const scheduleLoading = ref(false)
const scheduleSaving = ref(false)
const scheduleRunningNow = ref(false)
const scheduleRunRegime = ref('todos')
const scheduleRunMessage = ref('')
type ScheduleTab = 'automatic' | 'instant'
const scheduleTab = ref<ScheduleTab>('automatic')
const scheduleModal = ref<HTMLElement | null>(null)
const schedule = ref<ComplianceScheduleConfig | null>(null)
type ScheduleDraft = Pick<
  ComplianceScheduleConfig,
  'enabled' | 'frequency' | 'runTime' | 'dayOfWeek' | 'regimes'
>
const scheduleDraft = ref<ScheduleDraft>({
  enabled: false,
  frequency: 'weekdays',
  runTime: '07:00',
  dayOfWeek: 1,
  regimes: []
})
const frequencyOptions: { label: string; value: ComplianceScheduleFrequency }[] = [
  { label: 'Todos los días', value: 'daily' },
  { label: 'Lunes a viernes', value: 'weekdays' },
  { label: 'Una vez por semana', value: 'weekly' }
]
const weekdayOptions = [
  { label: 'Domingo', value: 0 },
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 }
]
const opinionsTutorialSteps = [
  {
    target: '.compliance-hero',
    eyebrow: 'Opiniones / consulta',
    title: 'Revisa el cumplimiento',
    body: 'Esta vista conserva la última opinión válida y distingue los errores recientes de un resultado fiscal almacenado.'
  },
  {
    target: '.compliance-note',
    eyebrow: 'Opiniones / modalidades',
    title: 'Elige el tipo de consulta',
    body: 'La consulta pública usa el RFC; la consulta por terceros inicia sesión temporalmente con las credenciales autorizadas.'
  },
  {
    target: '.summary-overview',
    eyebrow: 'Opiniones / resumen',
    title: 'Mide el resultado favorable',
    body: 'El indicador principal muestra qué proporción de los clientes revisados conserva una opinión positiva; los demás estados quedan como contexto operativo.'
  },
  {
    target: '.filter-strip',
    eyebrow: 'Opiniones / filtros',
    title: 'Encuentra un cliente',
    body: 'Busca por nombre o RFC y combina el resultado con filtros de estado y régimen fiscal.'
  },
  {
    target: '.compliance-workspace',
    eyebrow: 'Opiniones / detalle',
    title: 'Abre la evidencia',
    body: 'Selecciona un cliente para consultar vigencia, PDF guardado, respuesta del SAT y acciones recomendadas.'
  }
]
const isAdmin = computed(() => localStorage.getItem('level') === 'Administrador')
const emptySummary: ComplianceSummary = {
  total: 0,
  positiva: 0,
  negativa: 0,
  suspension_actividades: 0,
  inscrito_sin_obligaciones: 0,
  no_inscrito: 0,
  cancelado: 0,
  no_localizado: 0,
  no_publica: 0,
  otro: 0,
  sin_consulta: 0,
  error: 0,
  especial: 0,
  con_documento: 0,
  con_error_reciente: 0
}
const summary = ref<ComplianceSummary>({ ...emptySummary })
const reviewedCount = computed(() => Math.max(0, summary.value.total - summary.value.sin_consulta))
const positiveRate = computed(() =>
  reviewedCount.value ? Math.round((summary.value.positiva / reviewedCount.value) * 100) : 0
)
const statusOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Positiva', value: 'positiva' },
  { label: 'Con pendientes', value: 'negativa' },
  { label: 'Suspensión de actividades', value: 'suspension_actividades' },
  { label: 'Inscrito sin obligaciones', value: 'inscrito_sin_obligaciones' },
  { label: 'No inscrito', value: 'no_inscrito' },
  { label: 'Cancelado', value: 'cancelado' },
  { label: 'No localizado', value: 'no_localizado' },
  { label: 'No pública', value: 'no_publica' },
  { label: 'Sin consultar', value: 'sin_consulta' },
  { label: 'Con error', value: 'error' }
]
const regimeOptions = [{ label: 'Todos', value: 'todos' }, ...regimenesFiscales]
const activeFilterCount = computed(
  () => Number(statusFilter.value !== 'todos') + Number(regimeFilter.value !== 'todos')
)
const filterButtonLabel = computed(() =>
  activeFilterCount.value ? `Filtros (${activeFilterCount.value})` : 'Filtros'
)
const scheduleSummary = computed(() => {
  if (!scheduleDraft.value.enabled) return 'No se crearán nuevas consultas automáticas.'
  const time = scheduleDraft.value.runTime
  if (scheduleDraft.value.frequency === 'daily') return `Todos los días a las ${time}.`
  if (scheduleDraft.value.frequency === 'weekdays') return `De lunes a viernes a las ${time}.`
  const day =
    weekdayOptions.find((option) => option.value === scheduleDraft.value.dayOfWeek)?.label ||
    'Lunes'
  return `Cada ${day.toLocaleLowerCase('es-MX')} a las ${time}.`
})
const scheduleAutomationReason = computed(() => {
  if (scheduleDraft.value.enabled) return ''
  if (schedule.value?.enabled)
    return 'Cambio sin guardar: desactivaste el interruptor de automatización.'
  return 'La automatización está desactivada en la configuración guardada.'
})
const scheduleHasChanges = computed(
  () =>
    Boolean(schedule.value) &&
    (scheduleDraft.value.enabled !== schedule.value?.enabled ||
      scheduleDraft.value.frequency !== schedule.value?.frequency ||
      scheduleDraft.value.runTime !== schedule.value?.runTime ||
      scheduleDraft.value.dayOfWeek !== schedule.value?.dayOfWeek ||
      JSON.stringify(scheduleDraft.value.regimes) !== JSON.stringify(schedule.value?.regimes || []))
)
const scheduleRunClientCount = computed(() =>
  scheduleRunRegime.value === 'todos'
    ? records.value.length
    : records.value.filter((record) => record.regimen_fiscal === scheduleRunRegime.value).length
)
const scheduleLastStatusLabel = computed(
  () =>
    ({
      never: 'SIN EJECUCIONES',
      running: 'EN CURSO',
      success: 'FINALIZADA',
      partial: 'FINALIZADA CON PENDIENTES',
      error: 'NO COMPLETADA'
    })[schedule.value?.lastStatus || 'never']
)
const scheduleLastStatusClass = computed(() => `state-${schedule.value?.lastStatus || 'never'}`)

const filteredRecords = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es-MX')
  return records.value.filter((record) => {
    const matchesStatus = statusFilter.value === 'todos' || record.status === statusFilter.value
    const matchesRegime =
      regimeFilter.value === 'todos' || record.regimen_fiscal === regimeFilter.value
    const matchesTerm =
      !term || `${record.nombre} ${record.rfc}`.toLocaleLowerCase('es-MX').includes(term)
    return matchesStatus && matchesRegime && matchesTerm
  })
})
const regimeOrder = new Map<string, number>(
  regimenesFiscales.map((regime, index) => [regime.value, index])
)
const groupedRecords = computed(() => {
  const groups = new Map<string, ComplianceRecord[]>()
  filteredRecords.value.forEach((record) => {
    const code = record.regimen_fiscal || 'sin_regimen'
    const group = groups.get(code) || []
    group.push(record)
    groups.set(code, group)
  })
  return Array.from(groups, ([code, groupRecords]) => ({
    code,
    label: regimenFiscalLabel(code === 'sin_regimen' ? null : code),
    records: groupRecords
  })).sort((left, right) => {
    const leftOrder = regimeOrder.get(left.code) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = regimeOrder.get(right.code) ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder || left.label.localeCompare(right.label, 'es-MX')
  })
})

function clearFilters() {
  search.value = ''
  statusFilter.value = 'todos'
  regimeFilter.value = 'todos'
  draftStatusFilter.value = 'todos'
  draftRegimeFilter.value = 'todos'
  showFilters.value = false
}

function openFilters() {
  draftStatusFilter.value = statusFilter.value
  draftRegimeFilter.value = regimeFilter.value
  showFilters.value = true
}

function closeFilters() {
  showFilters.value = false
}

function resetDraftFilters() {
  draftStatusFilter.value = 'todos'
  draftRegimeFilter.value = 'todos'
}

function applyFilters() {
  statusFilter.value = draftStatusFilter.value
  regimeFilter.value = draftRegimeFilter.value
  showFilters.value = false
}

function errorText(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { error?: string } } }
  return candidate?.response?.data?.error || fallback
}

function applySchedule(config: ComplianceScheduleConfig) {
  schedule.value = config
  scheduleDraft.value = {
    enabled: config.enabled,
    frequency: config.frequency,
    runTime: config.runTime,
    dayOfWeek: config.dayOfWeek,
    regimes: [...config.regimes]
  }
}

async function openSchedule() {
  scheduleOpen.value = true
  scheduleLoading.value = true
  errorMessage.value = ''
  scheduleRunMessage.value = ''
  scheduleTab.value = 'automatic'
  await nextTick()
  scheduleModal.value?.focus()
  try {
    applySchedule(await cos.getProgramacion())
  } catch (error) {
    scheduleOpen.value = false
    errorMessage.value = errorText(error, 'No se pudo cargar la programación de Opiniones.')
  } finally {
    scheduleLoading.value = false
  }
}

function closeSchedule() {
  if (scheduleSaving.value || scheduleRunningNow.value) return
  scheduleOpen.value = false
}

async function saveSchedule() {
  scheduleSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await cos.guardarProgramacion(scheduleDraft.value)
    applySchedule(result.config)
    successMessage.value = result.message
    scheduleOpen.value = false
  } catch (error) {
    errorMessage.value = errorText(error, 'No se pudo guardar la programación de Opiniones.')
  } finally {
    scheduleSaving.value = false
  }
}

async function runScheduleNow() {
  scheduleRunningNow.value = true
  errorMessage.value = ''
  scheduleRunMessage.value = ''
  try {
    const regimes = scheduleRunRegime.value === 'todos' ? [] : [scheduleRunRegime.value]
    const response = await cos.ejecutarProgramacionAhora(regimes)
    applySchedule(response.config)
    scheduleRunMessage.value = response.result.message
    await loadOpinions()
  } catch (error) {
    errorMessage.value = errorText(error, 'No se pudo ejecutar la consulta inmediata de Opiniones.')
  } finally {
    scheduleRunningNow.value = false
  }
}

async function loadOpinions(preserveSelection = true) {
  loading.value = true
  errorMessage.value = ''
  const selectedId = preserveSelection ? selected.value?.id_cliente : null
  try {
    const data = await cos.getOpiniones()
    records.value = Array.isArray(data.records) ? data.records : []
    summary.value = { ...emptySummary, ...(data.summary || {}) }
    selected.value =
      records.value.find((item) => item.id_cliente === selectedId) || records.value[0] || null
  } catch (error) {
    errorMessage.value = errorText(error, 'No se pudieron cargar las opiniones de cumplimiento.')
  } finally {
    loading.value = false
  }
}

function openThirdPartyQuery() {
  showThirdParty.value = true
}

async function completeThirdParty(message: string) {
  showThirdParty.value = false
  successMessage.value = message
  await loadOpinions()
}

async function syncAll() {
  syncing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  syncProgress.value = { processed: 0, total: records.value.length, documents: 0 }
  try {
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const response = await cos.sincronizar({ offset, limit: 8 })
      syncProgress.value = {
        processed: response.processed,
        total: response.total,
        documents: syncProgress.value.documents + response.documents
      }
      if (response.processed <= offset && response.hasMore)
        throw new Error('La consulta masiva no avanzó.')
      offset = response.processed
      hasMore = response.hasMore
    }
    successMessage.value = `Consulta masiva terminada: ${syncProgress.value.processed} clientes revisados y ${syncProgress.value.documents} PDF actualizados.`
    await loadOpinions()
  } catch (error) {
    errorMessage.value = errorText(error, 'No fue posible completar la consulta al SAT.')
  } finally {
    syncing.value = false
  }
}

async function syncClient(clientId: number) {
  syncingClientId.value = clientId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await cos.sincronizar({ clientIds: [clientId] })
    successMessage.value = 'La opinión del cliente se actualizó.'
    await loadOpinions()
  } catch (error) {
    errorMessage.value = errorText(error, 'No fue posible actualizar este cliente.')
  } finally {
    syncingClientId.value = null
  }
}

function statusLabel(status: ComplianceStatus) {
  return {
    positiva: 'Positiva',
    negativa: 'Con pendientes',
    suspension_actividades: 'Suspensión de actividades',
    inscrito_sin_obligaciones: 'Inscrito sin obligaciones',
    no_inscrito: 'No inscrito',
    cancelado: 'Cancelado',
    no_localizado: 'No localizado',
    no_publica: 'No pública',
    otro: 'Otro resultado',
    sin_consulta: 'Sin consultar',
    error: 'Error de consulta'
  }[status]
}
function statusClass(status: ComplianceStatus) {
  return `status-${status}`
}
function statusIcon(status: ComplianceStatus) {
  return {
    positiva: 'pi pi-check-circle',
    negativa: 'pi pi-exclamation-triangle',
    suspension_actividades: 'pi pi-pause-circle',
    inscrito_sin_obligaciones: 'pi pi-minus-circle',
    no_inscrito: 'pi pi-user-minus',
    cancelado: 'pi pi-ban',
    no_localizado: 'pi pi-map-marker',
    no_publica: 'pi pi-lock',
    otro: 'pi pi-info-circle',
    sin_consulta: 'pi pi-clock',
    error: 'pi pi-times-circle'
  }[status]
}
function statusDescription(status: ComplianceStatus) {
  return {
    suspension_actividades: 'El SAT identifica al contribuyente con suspensión de actividades.',
    inscrito_sin_obligaciones:
      'El RFC está inscrito, pero actualmente no tiene obligaciones fiscales registradas.',
    no_inscrito: 'El RFC consultado no aparece inscrito ante el SAT.',
    cancelado: 'El RFC aparece con estatus cancelado.',
    no_localizado: 'El SAT reporta un problema de localización del contribuyente.',
    otro: 'El SAT devolvió un resultado distinto. Revisa el mensaje original.',
    sin_consulta: 'Todavía no se ha consultado este RFC.',
    error: 'La consulta no pudo completarse y todavía no existe una opinión válida almacenada.',
    negativa: 'La opinión contiene obligaciones o situaciones que requieren atención.',
    no_publica: 'El contribuyente no autorizó que el SAT muestre públicamente el resultado.',
    positiva: 'El SAT emitió una opinión positiva a la fecha indicada.'
  }[status]
}
function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date
      )
}
function formatDateTime(value: string | null) {
  if (!value) return 'Nunca'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
function vigenciaLabel(record: ComplianceRecord) {
  if (record.vigente_hasta) return formatDate(record.vigente_hasta)
  if (!record.fecha_consulta) return 'Sin consultar'
  if (record.status !== 'positiva') return 'No aplica'
  return 'Sin fecha de emisión'
}
function issueSubtitle(record: ComplianceRecord) {
  if (record.status === 'positiva')
    return 'La opinión positiva tiene una vigencia general de 30 días naturales desde su emisión.'
  if (record.status === 'no_publica')
    return 'El SAT no permite ver el detalle mientras la opinión sea privada.'
  return 'Las causas confirmadas se distinguen de las que aún deben revisarse.'
}

onMounted(async () => {
  await loadOpinions(false)
  if (!localStorage.getItem('tourOpinionesDone')) opinionsTutorialOpen.value = true
})
