import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { fs } from '@/service/adminApp/client'
import type {
  SatCredentialInfo,
  SatDownloadJob,
  SatPasswordCredentialInfo,
  SatPortalInput,
  SatPortalSessionState
} from '@/service/adminApp/fiscalService'
import DateTimePicker from '@/components/ui/DateTimePicker/DateTimePicker.vue'

interface Props {
  clientId: number
  clientLabel: string
  year: number
  month: number
}
interface Emits {
  (event: 'imported', counts: { imported: number; duplicate: number; rejected: number }): void
}

type AuthenticationMethod = 'efirma' | 'password'
type PortalWorkspaceView = 'current' | 'history'
type QueryDirection = 'ambas' | 'emitida' | 'recibida'
type PortalHistoryStatus = 'pending' | 'completed' | 'attention'

interface PortalQueryHistoryItem {
  id: string
  clientId: number
  direction: 'ambas' | 'emitida' | 'recibida'
  startDate: string
  endDate: string
  receivedMonth?: string
  status: PortalHistoryStatus
  message: string
  imported: number
  duplicate: number
  rejected: number
  downloads: number
  createdAt: string
  updatedAt: string
}

const PORTAL_HISTORY_LIMIT = 12

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = ref(false)
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const jobs = ref<SatDownloadJob[]>([])
const authenticationMethod = ref<AuthenticationMethod>('efirma')
const credentialLoading = ref(false)
const credentialInfo = ref<SatCredentialInfo>({ configured: false })
const editingCredentials = ref(false)
const deletingCredential = ref(false)
const savingCredential = ref(false)
const passwordCredentialLoading = ref(false)
const passwordCredential = ref<SatPasswordCredentialInfo | null>(null)
const refreshingJobId = ref<number | null>(null)
const deleteConfirmJobId = ref<number | null>(null)
const deletingJobId = ref<number | null>(null)
const portalHistory = ref<PortalQueryHistoryItem[]>([])
const portalWorkspaceView = ref<PortalWorkspaceView>('current')
const passwordCredentialError = ref('')
const direction = ref<QueryDirection>('ambas')
const startDate = ref('')
const endDate = ref('')
const receivedMonth = ref('')
const certificate = ref<File | null>(null)
const privateKey = ref<File | null>(null)
const password = ref('')
const trackedJobs = new Set<number>()
const notifiedJobs = new Set<number>()
let pollTimer = 0

const portalState = ref<SatPortalSessionState | null>(null)
const portalSessionId = ref('')
const portalStarting = ref(false)
const portalPolling = ref(false)
const portalLoginSubmitting = ref(false)
const portalCaptcha = ref('')
const portalCaptchaModel = computed({
  get: () => portalCaptcha.value,
  set: (value: string) => {
    portalCaptcha.value = String(value || '').toLocaleUpperCase('es-MX')
  }
})
const repeatingPortalHistoryId = ref('')
const portalRecoveryOpen = ref(false)
const portalKeyboardInput = ref<HTMLInputElement | null>(null)
const portalTypedText = ref('')
const notifiedPortalDownloads = new Set<string>()
const hiddenPortalHistoryIds = new Set<string>()
let portalPollTimer = 0
let portalLoginSubmittedAt = 0
let portalInputQueue = Promise.resolve()
let portalTextBuffer = ''
let portalTextTimer: ReturnType<typeof setTimeout> | null = null
let portalScrollTimer: ReturnType<typeof setTimeout> | null = null
let portalScrollDelta = 0

const activeStates = new Set(['solicitada', 'procesando', 'descargando'])
const activeJobs = computed(() => jobs.value.filter((job) => activeStates.has(job.estado)))
const waitingJobs = computed(() =>
  jobs.value.filter((job) => job.estado === 'solicitada' || job.estado === 'procesando')
)
const credentialReady = computed(
  () => credentialInfo.value.configured && !credentialInfo.value.expired
)
const credentialAttention = computed(() => {
  if (!credentialInfo.value.configured) return ''
  if (credentialInfo.value.expired)
    return `La e.firma venció el ${credentialDate(credentialInfo.value.validTo)}. Reemplaza el certificado y la llave antes de crear otra solicitud.`
  if (editingCredentials.value)
    return 'La e.firma está en edición. Selecciona el archivo .cer, la llave .key y su contraseña para volver a validarla.'
  return ''
})
const newCredentialComplete = computed(() =>
  Boolean(certificate.value && privateKey.value && password.value)
)
const includesIssued = computed(() => ['ambas', 'emitida'].includes(direction.value))
const includesReceived = computed(() => ['ambas', 'recibida'].includes(direction.value))
const queryReady = computed(
  () =>
    (!includesIssued.value || Boolean(startDate.value && endDate.value)) &&
    (!includesReceived.value || /^\d{4}-\d{2}$/.test(receivedMonth.value))
)
const canSubmit = computed(() =>
  Boolean(
    props.clientId &&
    queryReady.value &&
    authenticationMethod.value === 'efirma' &&
    ((credentialReady.value && !editingCredentials.value) || newCredentialComplete.value) &&
    !submitting.value &&
    !credentialLoading.value
  )
)
const selectedReceivedMonthName = computed(() =>
  new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric'
  }).format(parseDate(`${receivedMonth.value}-01`))
)
const requestScopeLabel = computed(() => {
  if (direction.value === 'recibida')
    return `Recibidas de ${selectedReceivedMonthName.value}; el SAT consulta un mes completo.`
  if (direction.value === 'ambas')
    return `Emitidas del ${dateLabel(startDate.value)} al ${dateLabel(endDate.value)} y recibidas de ${selectedReceivedMonthName.value}.`
  return `Emitidas del ${dateLabel(startDate.value)} al ${dateLabel(endDate.value)}.`
})
const portalPhase = computed(() => portalState.value?.phase || 'idle')
const portalAuthenticated = computed(() => Boolean(portalState.value?.authenticated))
const portalFailureMessage = computed(
  () =>
    portalState.value?.message ||
    portalState.value?.automation.error ||
    'El SAT no completó la consulta automática.'
)
const portalFailureTitle = computed(() => {
  const code = portalState.value?.automation.errorCode || ''
  if (code === 'SAT_RECEIVED_PERIOD_FIELDS_NOT_FOUND')
    return 'No se encontró el selector de recibidas'
  if (code === 'SAT_DATE_FIELDS_NOT_FOUND') return 'No se encontraron las fechas de emitidas'
  if (code === 'SAT_QUERY_LINK_NOT_FOUND') return 'No se encontró la consulta solicitada'
  if (code === 'SAT_SEARCH_CONTROL_NOT_FOUND') return 'No se encontró el botón de búsqueda'
  return 'No se completó la consulta'
})
const portalStatusTitle = computed(
  () =>
    ({
      idle: 'Descarga lista para iniciar',
      loading: 'Preparando acceso SAT',
      login: 'CAPTCHA pendiente',
      portal: 'Iniciando automatización',
      automating: 'Consultando tus CFDI',
      importing: 'Importando descarga',
      complete: 'Descarga terminada',
      manual: 'Recuperación manual',
      error: portalFailureTitle.value
    })[portalPhase.value]
)
const portalStatusDetail = computed(
  () =>
    ({
      idle: 'Selecciona qué consultar y prepara el acceso.',
      loading: 'Creando una sesión aislada para este cliente.',
      login: 'Escribe el código para iniciar sesión.',
      portal: 'La sesión quedó iniciada; comienza la consulta.',
      automating: portalState.value?.automation.stage || 'Navegando por el portal oficial.',
      importing:
        portalState.value?.automation.stage || 'Validando los XML antes de agregarlos a Fiscal.',
      complete:
        portalState.value?.automation.stage || 'Los archivos quedaron integrados al expediente.',
      manual: 'La sesión sigue abierta para completar el paso pendiente.',
      error: portalFailureMessage.value
    })[portalPhase.value]
)
const portalAutomationProgress = computed(() => {
  const automation = portalState.value?.automation
  if (!automation?.totalDirections) return 0
  if (automation.status === 'complete') return 100
  const current = automation.currentDirection ? 0.45 : 0
  return Math.min(
    96,
    Math.round(((automation.completedDirections + current) / automation.totalDirections) * 100)
  )
})

const statusCopy: Record<string, { label: string; detail: string; icon: string }> = {
  solicitada: {
    label: 'Solicitud enviada',
    detail: 'El SAT recibió la petición.',
    icon: 'pi pi-send'
  },
  procesando: {
    label: 'Preparando paquetes',
    detail: 'El SAT está reuniendo los CFDI.',
    icon: 'pi pi-spin pi-spinner'
  },
  descargando: {
    label: 'Importando XML',
    detail: 'Descargando paquetes y procesando comprobantes.',
    icon: 'pi pi-cloud-download'
  },
  completada: {
    label: 'Importación terminada',
    detail: 'Los CFDI ya están disponibles en Fiscal.',
    icon: 'pi pi-check-circle'
  },
  sin_datos: {
    label: 'Sin CFDI',
    detail: 'No se encontraron comprobantes en ese periodo.',
    icon: 'pi pi-info-circle'
  },
  error: {
    label: 'Requiere atención',
    detail: 'La solicitud no pudo completarse.',
    icon: 'pi pi-exclamation-triangle'
  },
  cancelada: {
    label: 'Cancelada',
    detail: 'Las credenciales temporales fueron eliminadas.',
    icon: 'pi pi-ban'
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
function formatDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}
function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}
const startDateModel = computed<Date>({
  get: () => parseDate(startDate.value),
  set: (value) => {
    startDate.value = formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
    if (endDate.value && startDate.value > endDate.value) endDate.value = startDate.value
  }
})
const endDateModel = computed<Date>({
  get: () => parseDate(endDate.value),
  set: (value) => {
    endDate.value = formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
    if (startDate.value && endDate.value < startDate.value) startDate.value = endDate.value
  }
})
const receivedMonthModel = computed<Date>({
  get: () => parseDate(`${receivedMonth.value}-01`),
  set: (value) => {
    receivedMonth.value = `${value.getFullYear()}-${pad(value.getMonth() + 1)}`
  }
})

function receivedMonthPeriod(value = receivedMonth.value) {
  const [year, month] = value.split('-').map(Number)
  const safeYear = year || new Date().getFullYear()
  const safeMonth = month || new Date().getMonth() + 1
  return {
    startDate: formatDate(safeYear, safeMonth, 1),
    endDate: formatDate(safeYear, safeMonth, new Date(safeYear, safeMonth, 0).getDate())
  }
}
function toggleQueryDirection(target: Exclude<QueryDirection, 'ambas'>) {
  const issued = includesIssued.value
  const received = includesReceived.value
  const nextIssued = target === 'emitida' ? !issued : issued
  const nextReceived = target === 'recibida' ? !received : received
  if (!nextIssued && !nextReceived) return
  direction.value = nextIssued && nextReceived ? 'ambas' : nextIssued ? 'emitida' : 'recibida'
}
function portalQueryPayload() {
  const received = receivedMonthPeriod()
  return {
    clientId: props.clientId,
    direction: direction.value,
    startDate: includesIssued.value ? startDate.value : received.startDate,
    endDate: includesIssued.value ? endDate.value : received.endDate,
    receivedMonth: receivedMonth.value
  }
}
function selectedDownloadRequests() {
  const requests: Array<{
    clientId: number
    direction: 'emitida' | 'recibida'
    startDate: string
    endDate: string
  }> = []
  if (includesIssued.value)
    requests.push({
      clientId: props.clientId,
      direction: 'emitida',
      startDate: startDate.value,
      endDate: endDate.value
    })
  if (includesReceived.value) {
    const period = receivedMonthPeriod()
    requests.push({
      clientId: props.clientId,
      direction: 'recibida',
      startDate: period.startDate,
      endDate: period.endDate
    })
  }
  return requests
}

function resetPeriod() {
  const current = new Date()
  const selectedMonth =
    props.month > 0
      ? props.month
      : props.year === current.getFullYear()
        ? current.getMonth() + 1
        : 1
  const lastDay = new Date(props.year, selectedMonth, 0).getDate()
  startDate.value = formatDate(props.year, selectedMonth, 1)
  endDate.value = formatDate(props.year, selectedMonth, lastDay)
  receivedMonth.value = `${props.year}-${pad(selectedMonth)}`
}
function dateLabel(value: string) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
function jobCopy(job: SatDownloadJob) {
  return statusCopy[job.estado] || statusCopy.procesando
}
function directionLabel(value: 'ambas' | 'emitida' | 'recibida') {
  if (value === 'ambas') return 'Emitidas y recibidas'
  return value === 'emitida' ? 'Emitidas' : 'Recibidas'
}
function jobDirection(job: SatDownloadJob) {
  return directionLabel(job.direccion)
}
function isGenericAttentionMessage(value?: string | null) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/[_.,:;!¡?¿-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (
    !normalized ||
    normalized === 'requiere atencion' ||
    normalized === 'necesita atencion' ||
    normalized === 'la automatizacion requiere atencion' ||
    normalized === 'la solicitud requiere atencion' ||
    normalized === 'la solicitud no pudo completarse'
  )
}
function jobMessage(job: SatDownloadJob) {
  const detail = [job.ultimo_error, job.mensaje_sat].find(
    (value) => !isGenericAttentionMessage(value)
  )
  if (detail) return String(detail).trim()
  if (job.estado === 'error' && job.codigo_sat)
    return `El SAT devolvió el código ${job.codigo_sat}, pero no agregó una descripción. Consulta el estado otra vez para recuperar el detalle más reciente.`
  if (job.estado === 'error' && job.id_solicitud)
    return `El SAT registró la solicitud ${job.id_solicitud}, pero no explicó por qué se detuvo. Puedes consultar su estado o volver a solicitar el mismo periodo.`
  if (job.estado === 'error')
    return 'El servidor no recibió una descripción del SAT. Consulta el estado otra vez; si continúa igual, valida la vigencia de la e.firma y vuelve a solicitar el periodo.'
  return String(job.mensaje_sat || jobCopy(job).detail).trim()
}
function jobAdvice(job: SatDownloadJob) {
  const detail = `${job.ultimo_error || ''} ${job.mensaje_sat || ''} ${job.codigo_sat || ''}`
    .toLocaleLowerCase('es-MX')
    .trim()
  if (/certific|e\.firma|firma|llave|vigenc|contraseña/.test(detail))
    return 'Revisa que el .cer y la .key correspondan al RFC del expediente y que el certificado siga vigente.'
  if (/429|l[ií]mite|m[aá]ximo|diari/.test(detail))
    return 'El SAT aplicó un límite. Espera antes de repetir la consulta o divide el periodo en rangos menores.'
  if (/408|5\d\d|timeout|tiempo|tempor|disponib|conexi[oó]n/.test(detail))
    return 'El servicio del SAT no estaba disponible. Usa “Consultar estado” y, si no cambia, vuelve a solicitar el mismo periodo.'
  return 'Consulta primero el estado guardado. Si el SAT mantiene el error, usa “Volver a solicitar” sin volver a capturar el periodo.'
}
function jobDateTime(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}
function isPortalRequestTimeout(error: any) {
  return (
    error?.code === 'ECONNABORTED' || /timeout(?: of)? \d+ms exceeded/i.test(error?.message || '')
  )
}
function errorValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(errorValue).filter(Boolean).join(' · ')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return errorValue(record.message || record.error || record.detail || record.mensaje)
  }
  return ''
}
function errorText(error: any, fallback: string) {
  const data = error?.response?.data
  const apiError =
    errorValue(data?.error) ||
    errorValue(data?.message) ||
    errorValue(data?.detail) ||
    errorValue(data?.mensaje_sat)
  const apiCode = errorValue(data?.codigo_sat || data?.code)
  if (apiError)
    return apiCode && !apiError.includes(apiCode) ? `${apiError} · Código ${apiCode}` : apiError
  if (apiCode) return `El SAT devolvió el código ${apiCode} sin una descripción adicional.`
  if (error?.response?.status === 404) {
    return 'El servidor fiscal no tiene cargada esta actualización. Reinicia el backend y vuelve a intentar.'
  }
  if (isPortalRequestTimeout(error)) {
    return 'El SAT está tardando más de lo normal. La sesión sigue activa y volveremos a consultar su avance.'
  }
  return errorValue(error?.message) || fallback
}
function chooseFile(event: Event, field: 'certificate' | 'privateKey') {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  if (field === 'certificate') certificate.value = file
  else privateKey.value = file
}
function resetCredentialInput() {
  certificate.value = null
  privateKey.value = null
  password.value = ''
}
function editCredential() {
  editingCredentials.value = true
  deletingCredential.value = false
  errorMessage.value = ''
}
function cancelCredentialEdit() {
  editingCredentials.value = false
  resetCredentialInput()
}
function credentialDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
}
function shortFingerprint(value?: string) {
  const clean = String(value || '').toUpperCase()
  return clean ? `${clean.slice(0, 8)}…${clean.slice(-8)}` : 'No disponible'
}

function portalHistoryStorageKey(clientId = props.clientId) {
  return `despachoapp:sat-portal-history:v1:${clientId}`
}
function isPortalHistoryItem(value: unknown): value is PortalQueryHistoryItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PortalQueryHistoryItem>
  return (
    typeof item.id === 'string' &&
    Number(item.clientId) === Number(props.clientId) &&
    ['ambas', 'emitida', 'recibida'].includes(String(item.direction)) &&
    ['pending', 'completed', 'attention'].includes(String(item.status)) &&
    typeof item.startDate === 'string' &&
    typeof item.endDate === 'string'
  )
}
function loadPortalHistory() {
  if (!props.clientId) {
    portalHistory.value = []
    return
  }
  try {
    const stored = JSON.parse(localStorage.getItem(portalHistoryStorageKey()) || '[]')
    portalHistory.value = (Array.isArray(stored) ? stored : [])
      .filter(isPortalHistoryItem)
      .slice(0, PORTAL_HISTORY_LIMIT)
  } catch {
    portalHistory.value = []
  }
}
function persistPortalHistory() {
  if (!props.clientId) return
  try {
    localStorage.setItem(
      portalHistoryStorageKey(),
      JSON.stringify(portalHistory.value.slice(0, PORTAL_HISTORY_LIMIT))
    )
  } catch {
    // El historial es auxiliar; una cuota local llena no debe bloquear la descarga.
  }
}
function portalHistoryStatusFromState(state: SatPortalSessionState): PortalHistoryStatus {
  if (state.phase === 'complete') return 'completed'
  if (state.phase === 'error' || state.phase === 'manual') return 'attention'
  return 'pending'
}
function portalHistoryMessageFromState(state: SatPortalSessionState) {
  return String(
    state.message ||
      state.automation.error ||
      state.automation.stage ||
      (state.phase === 'complete'
        ? 'La consulta terminó.'
        : 'La consulta quedó registrada y puede volver a abrirse.')
  ).trim()
}
function rememberPortalState(state: SatPortalSessionState) {
  if (hiddenPortalHistoryIds.has(state.id)) return
  const existing = portalHistory.value.find((item) => item.id === state.id)
  const counts = state.downloads.reduce(
    (total, download) => ({
      imported: total.imported + Number(download.imported || 0),
      duplicate: total.duplicate + Number(download.duplicate || 0),
      rejected: total.rejected + Number(download.rejected || 0)
    }),
    { imported: 0, duplicate: 0, rejected: 0 }
  )
  const status = portalHistoryStatusFromState(state)
  const message = portalHistoryMessageFromState(state)
  const unchanged =
    existing &&
    existing.status === status &&
    existing.message === message &&
    existing.imported === counts.imported &&
    existing.duplicate === counts.duplicate &&
    existing.rejected === counts.rejected &&
    existing.downloads === state.downloads.length
  if (unchanged) return

  const now = new Date().toISOString()
  const next: PortalQueryHistoryItem = {
    id: state.id,
    clientId: Number(state.clientId),
    direction: state.query.direction,
    startDate: state.query.startDate,
    endDate: state.query.endDate,
    receivedMonth: state.query.receivedMonth || state.query.startDate.slice(0, 7),
    status,
    message,
    imported: counts.imported,
    duplicate: counts.duplicate,
    rejected: counts.rejected,
    downloads: state.downloads.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  portalHistory.value = [next, ...portalHistory.value.filter((item) => item.id !== state.id)].slice(
    0,
    PORTAL_HISTORY_LIMIT
  )
  persistPortalHistory()
}
function markPortalSessionClosed(sessionId: string) {
  const existing = portalHistory.value.find((item) => item.id === sessionId)
  if (!existing || existing.status !== 'pending') return
  const closed: PortalQueryHistoryItem = {
    ...existing,
    status: 'attention',
    message:
      'La sesión temporal terminó antes de completar la consulta. Puedes abrir una nueva con el mismo periodo.',
    updatedAt: new Date().toISOString()
  }
  portalHistory.value = [
    closed,
    ...portalHistory.value.filter((item) => item.id !== sessionId)
  ].slice(0, PORTAL_HISTORY_LIMIT)
  persistPortalHistory()
}
function portalHistoryStatusLabel(status: PortalHistoryStatus) {
  if (status === 'completed') return 'Terminada'
  return status === 'attention' ? 'Requiere atención' : 'En proceso'
}
function portalHistoryIcon(status: PortalHistoryStatus) {
  if (status === 'completed') return 'pi pi-check-circle'
  return status === 'attention' ? 'pi pi-exclamation-triangle' : 'pi pi-clock'
}
function portalHistoryPeriodLabel(item: PortalQueryHistoryItem) {
  const receivedLabel = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric'
  }).format(parseDate(`${item.receivedMonth || item.startDate.slice(0, 7)}-01`))
  if (item.direction === 'recibida') return `Recibidas · ${receivedLabel}`
  const emitted = `Emitidas · ${dateLabel(item.startDate)} — ${dateLabel(item.endDate)}`
  return item.direction === 'ambas' ? `${emitted} · Recibidas · ${receivedLabel}` : emitted
}
function removePortalHistoryItem(id: string) {
  hiddenPortalHistoryIds.add(id)
  portalHistory.value = portalHistory.value.filter((item) => item.id !== id)
  persistPortalHistory()
}
async function repeatPortalQuery(item: PortalQueryHistoryItem) {
  if (portalStarting.value || repeatingPortalHistoryId.value) return
  if (!passwordCredential.value?.configured) {
    errorMessage.value =
      'El expediente ya no tiene disponible la Contraseña SAT. Actualiza sus datos fiscales antes de volver a consultar.'
    return
  }

  repeatingPortalHistoryId.value = item.id
  direction.value = item.direction
  startDate.value = item.startDate
  endDate.value = item.endDate
  receivedMonth.value = item.receivedMonth || item.startDate.slice(0, 7)
  portalWorkspaceView.value = 'current'
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await nextTick()
    if (portalSessionId.value === item.id) {
      await refreshPortal()
      successMessage.value = 'Consultamos el estado más reciente de esta sesión.'
      return
    }
    await startPortalSession()
    if (portalSessionId.value)
      successMessage.value =
        'La consulta anterior quedó cargada. Resuelve el nuevo CAPTCHA para volver a ejecutarla.'
  } finally {
    repeatingPortalHistoryId.value = ''
  }
}
async function loadCredential() {
  if (!props.clientId) return
  credentialLoading.value = true
  try {
    credentialInfo.value = await fs.getSatCredential(props.clientId)
    editingCredentials.value =
      !credentialInfo.value.configured || Boolean(credentialInfo.value.expired)
  } catch (error: any) {
    credentialInfo.value = { configured: false }
    editingCredentials.value = true
    if (authenticationMethod.value === 'efirma')
      errorMessage.value = errorText(error, 'No se pudo consultar la e.firma guardada.')
  } finally {
    credentialLoading.value = false
  }
}

async function loadPasswordCredential() {
  if (!props.clientId) return
  passwordCredentialLoading.value = true
  passwordCredentialError.value = ''
  try {
    passwordCredential.value = await fs.getSatPasswordCredential(props.clientId)
  } catch (error: any) {
    passwordCredential.value = null
    passwordCredentialError.value = errorText(
      error,
      'No se pudo verificar la Contraseña SAT del cliente.'
    )
  } finally {
    passwordCredentialLoading.value = false
  }
}

async function storeCredential() {
  if (!newCredentialComplete.value)
    throw new Error('Selecciona el .cer, la .key y escribe su contraseña.')
  credentialInfo.value = await fs.saveSatCredential({
    clientId: props.clientId,
    certificate: certificate.value!,
    privateKey: privateKey.value!,
    password: password.value
  })
  editingCredentials.value = false
  resetCredentialInput()
}
async function saveOnlyCredential() {
  if (!newCredentialComplete.value) return
  savingCredential.value = true
  errorMessage.value = ''
  try {
    await storeCredential()
    successMessage.value = 'La e.firma quedó validada y guardada para las próximas descargas.'
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo guardar la e.firma.')
  } finally {
    savingCredential.value = false
  }
}
async function removeCredential() {
  if (!deletingCredential.value) {
    deletingCredential.value = true
    return
  }
  try {
    credentialInfo.value = await fs.deleteSatCredential(props.clientId)
    editingCredentials.value = true
    deletingCredential.value = false
    successMessage.value =
      'La e.firma guardada fue eliminada. Las solicitudes activas conservan su copia temporal cifrada.'
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo eliminar la e.firma guardada.')
  }
}

function processPortalDownloads(state: SatPortalSessionState) {
  for (const download of state.downloads) {
    if (download.status === 'importing' || notifiedPortalDownloads.has(download.id)) continue
    notifiedPortalDownloads.add(download.id)
    if (download.status === 'completed') {
      successMessage.value = `Descarga importada: ${download.message}`
      emit('imported', {
        imported: download.imported,
        duplicate: download.duplicate,
        rejected: download.rejected
      })
    } else if (download.status === 'error') {
      errorMessage.value = download.message
    }
  }
}

function setPortalState(state: SatPortalSessionState) {
  portalState.value = state
  if (state.phase !== 'manual') portalRecoveryOpen.value = false
  processPortalDownloads(state)
  rememberPortalState(state)
  if (portalLoginSubmitting.value && state.phase !== 'login') portalLoginSubmitting.value = false
}

function startPortalPolling() {
  window.clearInterval(portalPollTimer)
  portalPollTimer = window.setInterval(refreshPortal, 1400)
}

async function closePortalSession(reset = true) {
  window.clearInterval(portalPollTimer)
  const sessionId = portalSessionId.value
  markPortalSessionClosed(sessionId)
  portalSessionId.value = ''
  portalLoginSubmitting.value = false
  portalCaptcha.value = ''
  portalRecoveryOpen.value = false
  if (reset) portalState.value = null
  if (sessionId) await fs.closeSatPortalSession(sessionId).catch(() => {})
}

async function startPortalSession() {
  if (!passwordCredential.value?.configured || !queryReady.value || portalStarting.value) return
  portalStarting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  await closePortalSession()
  try {
    const state = await fs.startSatPortalSession(portalQueryPayload())
    portalSessionId.value = state.id
    setPortalState(state)
    startPortalPolling()
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo preparar el acceso al portal del SAT.')
  } finally {
    portalStarting.value = false
  }
}

async function refreshPortal() {
  if (
    !portalSessionId.value ||
    portalPolling.value ||
    !open.value ||
    authenticationMethod.value !== 'password'
  )
    return
  portalPolling.value = true
  try {
    const state = await fs.getSatPortalSession(portalSessionId.value)
    setPortalState(state)
    if (
      portalLoginSubmitting.value &&
      state.phase === 'login' &&
      Date.now() - portalLoginSubmittedAt > 7000
    ) {
      portalLoginSubmitting.value = false
      portalCaptcha.value = ''
      errorMessage.value =
        'El SAT no aceptó el acceso. Revisa el nuevo CAPTCHA o actualiza la Contraseña del cliente.'
    }
  } catch (error: any) {
    if (isPortalRequestTimeout(error)) return
    errorMessage.value = errorText(error, 'No se pudo actualizar la vista del SAT.')
    window.clearInterval(portalPollTimer)
  } finally {
    portalPolling.value = false
  }
}

async function retryPortal() {
  if (!portalSessionId.value || portalStarting.value) return
  portalStarting.value = true
  errorMessage.value = ''
  portalCaptcha.value = ''
  try {
    setPortalState(await fs.reloadSatPortalSession(portalSessionId.value))
    startPortalPolling()
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo volver a abrir el portal del SAT.')
  } finally {
    portalStarting.value = false
  }
}

async function openPortalRecovery() {
  if (!portalSessionId.value || portalStarting.value) return
  portalStarting.value = true
  errorMessage.value = ''
  try {
    const state = await fs.enableSatPortalManual(portalSessionId.value)
    setPortalState(state)
    portalRecoveryOpen.value = true
    startPortalPolling()
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo abrir la recuperación manual del SAT.')
  } finally {
    portalStarting.value = false
  }
}

async function submitPortalLogin() {
  const captcha = portalCaptcha.value.trim().toLocaleUpperCase('es-MX')
  if (!portalSessionId.value || !captcha || portalLoginSubmitting.value) return
  portalLoginSubmitting.value = true
  portalLoginSubmittedAt = Date.now()
  errorMessage.value = ''
  try {
    const state = await fs.loginSatPortalSession(portalSessionId.value, captcha)
    portalCaptcha.value = ''
    setPortalState(state)
  } catch (error: any) {
    portalLoginSubmitting.value = false
    if (isPortalRequestTimeout(error)) {
      successMessage.value =
        'El SAT sigue validando el acceso. Conservamos la sesión y consultaremos el resultado automáticamente.'
      startPortalPolling()
      return
    }
    portalCaptcha.value = ''
    errorMessage.value = errorText(error, 'No se pudo iniciar sesión en el SAT.')
  }
}

function queuePortalInput(input: SatPortalInput) {
  if (!portalSessionId.value || !portalAuthenticated.value || !portalRecoveryOpen.value) return
  const sessionId = portalSessionId.value
  portalInputQueue = portalInputQueue
    .then(async () => {
      const state = await fs.sendSatPortalInput(sessionId, input)
      if (portalSessionId.value === sessionId) setPortalState(state)
    })
    .catch((error) => {
      if (portalSessionId.value === sessionId)
        errorMessage.value = errorText(error, 'No se pudo interactuar con el portal del SAT.')
    })
}

function clickPortalViewport(event: MouseEvent) {
  if (!portalState.value?.image || !portalAuthenticated.value) return
  const image = (event.currentTarget as HTMLElement).querySelector('img')
  if (!image) return
  const rect = image.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    return
  queuePortalInput({
    type: 'click',
    x: ((event.clientX - rect.left) * portalState.value.width) / rect.width,
    y: ((event.clientY - rect.top) * portalState.value.height) / rect.height
  })
  portalKeyboardInput.value?.focus()
}

function scrollPortalViewport(event: WheelEvent) {
  if (!portalState.value?.image || !portalAuthenticated.value) return
  portalScrollDelta += event.deltaY
  if (portalScrollTimer) return
  portalScrollTimer = setTimeout(() => {
    queuePortalInput({ type: 'scroll', deltaY: portalScrollDelta })
    portalScrollDelta = 0
    portalScrollTimer = null
  }, 80)
}

function flushPortalText() {
  if (!portalTextBuffer) return
  const text = portalTextBuffer
  portalTextBuffer = ''
  queuePortalInput({ type: 'text', text })
}
function sendPortalTypedText() {
  portalTextBuffer += portalTypedText.value
  portalTypedText.value = ''
  if (portalTextTimer) clearTimeout(portalTextTimer)
  portalTextTimer = setTimeout(flushPortalText, 110)
}
function sendPortalKey(event: KeyboardEvent) {
  const allowed = new Set([
    'Enter',
    'Tab',
    'Backspace',
    'Delete',
    'Escape',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    ' '
  ])
  if (!allowed.has(event.key)) return
  event.preventDefault()
  if (portalTextTimer) clearTimeout(portalTextTimer)
  flushPortalText()
  queuePortalInput({ type: 'key', key: event.key === ' ' ? 'Space' : event.key })
}

function selectAuthenticationMethod(method: AuthenticationMethod) {
  if (authenticationMethod.value === method) return
  authenticationMethod.value = method
  errorMessage.value = ''
  successMessage.value = ''
  if (method === 'efirma') {
    void closePortalSession()
    return
  }
  loadPortalHistory()
  portalWorkspaceView.value = 'current'
  if (!passwordCredential.value && !passwordCredentialLoading.value) void loadPasswordCredential()
}

function notifyCompleted(items: SatDownloadJob[]) {
  for (const job of items) {
    if (
      job.estado !== 'completada' ||
      !trackedJobs.has(Number(job.id)) ||
      notifiedJobs.has(Number(job.id))
    )
      continue
    notifiedJobs.add(Number(job.id))
    emit('imported', {
      imported: Number(job.importados || 0),
      duplicate: Number(job.duplicados || 0),
      rejected: Number(job.rechazados || 0)
    })
  }
}

async function loadJobs(silent = false) {
  if (!props.clientId) return
  if (!silent) loading.value = true
  try {
    const result = await fs.getSatDownloads(props.clientId)
    jobs.value = result
    notifyCompleted(result)
    if (authenticationMethod.value === 'efirma') errorMessage.value = ''
  } catch (error: any) {
    if (!silent)
      errorMessage.value = errorText(error, 'No se pudo consultar el avance de las descargas.')
  } finally {
    loading.value = false
  }
}

function canRetryJob(job: SatDownloadJob) {
  return ['error', 'cancelada', 'sin_datos'].includes(job.estado)
}

async function refreshJob(job: SatDownloadJob) {
  const jobId = Number(job.id)
  if (!jobId || refreshingJobId.value !== null) return
  refreshingJobId.value = jobId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const current = await fs.refreshSatDownload(jobId, props.clientId)
    if (!current) {
      errorMessage.value =
        'La solicitud ya no aparece en el historial del servidor. Puedes volver a solicitar el mismo periodo.'
      return
    }
    jobs.value = jobs.value.map((item) => (Number(item.id) === jobId ? current : item))
    notifyCompleted([current])
    if (current.estado === 'error') {
      errorMessage.value = jobMessage(current)
      return
    }
    successMessage.value = `Solicitud #${current.id} actualizada: ${jobCopy(current).label}.`
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo volver a consultar esta solicitud.')
  } finally {
    refreshingJobId.value = null
  }
}

async function deleteJob(job: SatDownloadJob) {
  const jobId = Number(job.id)
  if (!jobId || activeStates.has(job.estado) || deletingJobId.value !== null) return
  if (deleteConfirmJobId.value !== jobId) {
    deleteConfirmJobId.value = jobId
    return
  }

  deletingJobId.value = jobId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await fs.deleteSatDownloadHistory(jobId, props.clientId)
    jobs.value = jobs.value.filter((item) => Number(item.id) !== jobId)
    trackedJobs.delete(jobId)
    notifiedJobs.delete(jobId)
    successMessage.value = `La solicitud #${jobId} se eliminó del historial.`
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo eliminar la solicitud del historial.')
  } finally {
    deletingJobId.value = null
    deleteConfirmJobId.value = null
  }
}

async function retryJob(job: SatDownloadJob) {
  if (submitting.value) return
  if (!credentialReady.value || editingCredentials.value) {
    editingCredentials.value = true
    errorMessage.value =
      'Antes de volver a solicitar, valida o reemplaza la e.firma de este expediente.'
    return
  }
  const nextStart = String(job.fecha_inicial || '').slice(0, 10)
  const nextEnd = String(job.fecha_final || '').slice(0, 10)
  if (!nextStart || !nextEnd) {
    errorMessage.value = 'La solicitud anterior no conserva un periodo válido para repetirla.'
    return
  }
  direction.value = job.direccion
  if (job.direccion === 'recibida') receivedMonth.value = nextStart.slice(0, 7)
  else {
    startDate.value = nextStart
    endDate.value = nextEnd
  }
  errorMessage.value = ''
  successMessage.value = ''
  await nextTick()
  await submit()
}
function startPolling() {
  window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    if (open.value && activeJobs.value.length) loadJobs(true)
  }, 20_000)
}

async function showModal() {
  if (!props.clientId) return
  resetPeriod()
  loadPortalHistory()
  authenticationMethod.value = 'efirma'
  portalWorkspaceView.value = 'current'
  errorMessage.value = ''
  successMessage.value = ''
  open.value = true
  await Promise.all([loadJobs(), loadCredential(), loadPasswordCredential()])
  startPolling()
}
function closeModal() {
  open.value = false
  resetCredentialInput()
  deletingCredential.value = false
  deletingJobId.value = null
  deleteConfirmJobId.value = null
  window.clearInterval(pollTimer)
  void closePortalSession()
}

async function submit() {
  if (!canSubmit.value) return
  errorMessage.value = ''
  successMessage.value = ''
  submitting.value = true
  try {
    if (!credentialReady.value || editingCredentials.value) await storeCredential()
    const createdJobs: SatDownloadJob[] = []
    const requestErrors: string[] = []
    for (const request of selectedDownloadRequests()) {
      try {
        const result = await fs.createSatDownloads(request)
        createdJobs.push(...result.jobs)
        requestErrors.push(...(result.errors || []).map((item) => item.error))
      } catch (error: any) {
        requestErrors.push(
          errorText(
            error,
            `No se pudo crear la solicitud de CFDI ${request.direction === 'emitida' ? 'emitidos' : 'recibidos'}.`
          )
        )
      }
    }
    if (!createdJobs.length) throw new Error(requestErrors.join(' '))
    createdJobs.forEach((job) => trackedJobs.add(Number(job.id)))
    jobs.value = [
      ...createdJobs,
      ...jobs.value.filter((item) => !createdJobs.some((job) => Number(job.id) === Number(item.id)))
    ]
    successMessage.value = `${createdJobs.length === 1 ? 'Solicitud creada' : 'Solicitudes creadas'}. Puedes cerrar esta ventana; el servidor continuará automáticamente.`
    errorMessage.value = requestErrors.join(' ')
    resetCredentialInput()
    startPolling()
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo iniciar la descarga masiva.')
  } finally {
    submitting.value = false
  }
}

async function cancelJob(job: SatDownloadJob) {
  try {
    const updated = await fs.cancelSatDownload(Number(job.id))
    jobs.value = jobs.value.map((item) => (Number(item.id) === Number(updated.id) ? updated : item))
  } catch (error: any) {
    errorMessage.value = errorText(error, 'No se pudo cancelar la solicitud.')
  }
}

watch(
  () => [props.year, props.month],
  () => {
    if (open.value) resetPeriod()
  }
)
watch(
  () => props.clientId,
  () => {
    portalHistory.value = []
    repeatingPortalHistoryId.value = ''
    deleteConfirmJobId.value = null
    deletingJobId.value = null
    portalWorkspaceView.value = 'current'
    hiddenPortalHistoryIds.clear()
    jobs.value = []
    credentialInfo.value = { configured: false }
    passwordCredential.value = null
    passwordCredentialError.value = ''
    editingCredentials.value = false
    resetCredentialInput()
    notifiedJobs.clear()
    trackedJobs.clear()
    notifiedPortalDownloads.clear()
    void closePortalSession()
    if (open.value) {
      resetPeriod()
      loadPortalHistory()
      Promise.all([loadJobs(), loadCredential(), loadPasswordCredential()])
    }
  }
)
onBeforeUnmount(() => {
  window.clearInterval(pollTimer)
  window.clearInterval(portalPollTimer)
  if (portalTextTimer) clearTimeout(portalTextTimer)
  if (portalScrollTimer) clearTimeout(portalScrollTimer)
  void closePortalSession(false)
})
