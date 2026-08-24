import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const passwordCredentialError = ref('')
const direction = ref<'ambas' | 'emitida' | 'recibida'>('ambas')
const startDate = ref('')
const endDate = ref('')
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
const portalRecoveryOpen = ref(false)
const portalKeyboardInput = ref<HTMLInputElement | null>(null)
const portalTypedText = ref('')
const notifiedPortalDownloads = new Set<string>()
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
const newCredentialComplete = computed(() =>
  Boolean(certificate.value && privateKey.value && password.value)
)
const canSubmit = computed(() =>
  Boolean(
    props.clientId &&
    startDate.value &&
    endDate.value &&
    authenticationMethod.value === 'efirma' &&
    ((credentialReady.value && !editingCredentials.value) || newCredentialComplete.value) &&
    !submitting.value &&
    !credentialLoading.value
  )
)
const receivedOnly = computed(() => direction.value === 'recibida')
const selectedMonthName = computed(() =>
  new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric'
  }).format(parseDate(startDate.value))
)
const requestScopeLabel = computed(() => {
  if (direction.value === 'recibida')
    return `El SAT consultará todas las recibidas de ${selectedMonthName.value}.`
  if (direction.value === 'ambas')
    return `Emitidas por rango; recibidas por el mes de ${selectedMonthName.value}.`
  return 'El SAT consultará las emitidas dentro del rango seleccionado.'
})
const portalPhase = computed(() => portalState.value?.phase || 'idle')
const portalAuthenticated = computed(() => Boolean(portalState.value?.authenticated))
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
      error: 'La automatización requiere atención'
    })[portalPhase.value]
)
const portalStatusDetail = computed(
  () =>
    ({
      idle: 'Selecciona el periodo y prepara el acceso.',
      loading: 'Creando una sesión aislada para este cliente.',
      login: 'Escribe el código para continuar.',
      portal: 'El servidor tomó el control después del CAPTCHA.',
      automating: portalState.value?.automation.stage || 'Navegando por el portal oficial.',
      importing:
        portalState.value?.automation.stage || 'Validando los XML antes de agregarlos a Fiscal.',
      complete:
        portalState.value?.automation.stage || 'Los archivos quedaron integrados al expediente.',
      manual: 'Interactúa con el portal sólo para resolver el paso que cambió el SAT.',
      error: portalState.value?.message || 'El SAT cambió un paso o no respondió.'
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

const directionOptions = [
  { label: 'Emitidas y recibidas', value: 'ambas' },
  { label: 'Sólo emitidas', value: 'emitida' },
  { label: 'Sólo recibidas', value: 'recibida' }
]

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
function setReceivedMonth(value: Date) {
  const year = value.getFullYear()
  const month = value.getMonth() + 1
  startDate.value = formatDate(year, month, 1)
  endDate.value = formatDate(year, month, new Date(year, month, 0).getDate())
}
const startDateModel = computed<Date>({
  get: () => parseDate(startDate.value),
  set: (value) => {
    if (receivedOnly.value) {
      setReceivedMonth(value)
      return
    }
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
}
function dateLabel(value: string) {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
function jobCopy(job: SatDownloadJob) {
  return statusCopy[job.estado] || statusCopy.procesando
}
function jobDirection(job: SatDownloadJob) {
  return job.direccion === 'emitida' ? 'Emitidas' : 'Recibidas'
}
function isPortalRequestTimeout(error: any) {
  return (
    error?.code === 'ECONNABORTED' || /timeout(?: of)? \d+ms exceeded/i.test(error?.message || '')
  )
}
function errorText(error: any, fallback: string) {
  const apiError = error?.response?.data?.error
  if (apiError) return apiError
  if (error?.response?.status === 404) {
    return 'El servidor fiscal no tiene cargada esta actualización. Reinicia el backend y vuelve a intentar.'
  }
  if (isPortalRequestTimeout(error)) {
    return 'El SAT está tardando más de lo normal. La sesión sigue activa y volveremos a consultar su avance.'
  }
  return error?.message || fallback
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
  if (portalLoginSubmitting.value && state.phase !== 'login') portalLoginSubmitting.value = false
}

function startPortalPolling() {
  window.clearInterval(portalPollTimer)
  portalPollTimer = window.setInterval(refreshPortal, 1400)
}

async function closePortalSession(reset = true) {
  window.clearInterval(portalPollTimer)
  const sessionId = portalSessionId.value
  portalSessionId.value = ''
  portalLoginSubmitting.value = false
  portalCaptcha.value = ''
  portalRecoveryOpen.value = false
  if (reset) portalState.value = null
  if (sessionId) await fs.closeSatPortalSession(sessionId).catch(() => {})
}

async function startPortalSession() {
  if (!passwordCredential.value?.configured || portalStarting.value) return
  portalStarting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  await closePortalSession()
  try {
    const state = await fs.startSatPortalSession({
      clientId: props.clientId,
      direction: direction.value,
      startDate: startDate.value,
      endDate: endDate.value
    })
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
  if (method === 'efirma') void closePortalSession()
  else if (!passwordCredential.value && !passwordCredentialLoading.value)
    void loadPasswordCredential()
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

function startPolling() {
  window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    if (open.value && activeJobs.value.length) loadJobs(true)
  }, 20_000)
}

async function showModal() {
  if (!props.clientId) return
  resetPeriod()
  authenticationMethod.value = 'efirma'
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
    const result = await fs.createSatDownloads({
      clientId: props.clientId,
      direction: direction.value,
      startDate: startDate.value,
      endDate: endDate.value
    })
    result.jobs.forEach((job) => trackedJobs.add(Number(job.id)))
    jobs.value = [
      ...result.jobs,
      ...jobs.value.filter((item) => !result.jobs.some((job) => Number(job.id) === Number(item.id)))
    ]
    const partial = result.errors?.length
      ? ` ${result.errors.map((item) => item.error).join(' ')}`
      : ''
    successMessage.value = `${result.jobs.length === 1 ? 'Solicitud creada' : 'Solicitudes creadas'}. Puedes cerrar esta ventana; el servidor continuará automáticamente.${partial}`
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

watch(direction, (value) => {
  if (value === 'recibida') setReceivedMonth(parseDate(startDate.value))
})
watch(
  () => [props.year, props.month],
  () => {
    if (open.value) resetPeriod()
  }
)
watch(
  () => props.clientId,
  () => {
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
