import { computed, nextTick, reactive, ref, watch } from 'vue'
import { saveAs } from 'file-saver'
import { fs } from '@/service/adminApp/client'

type ReconciliationStatus = 'matched' | 'review' | 'bank_only' | 'report_only'
type ReportMovement = {
  id: string
  date: string
  type: 'credit' | 'debit'
  amount: number
  counterpart: string
  counterpartRfc: string
  uuid: string
  folio: string
  reportName: string
  source: string
}
type BankMovement = {
  id: string
  date: string
  type: 'credit' | 'debit'
  amount: number
  balance: number | null
  description: string
  reference: string
  trackingKey: string
}
type ReconciliationRow = {
  id: string
  status: ReconciliationStatus
  score: number
  reason: string
  bank: BankMovement | null
  reportItems: ReportMovement[]
}
type ReconciliationResult = {
  meta: {
    client: { id: number; name: string; rfc: string }
    period: { year: number; month: number }
    bank: { value: string; label: string; detected: boolean }
    format: string
    reports: Array<{ id: number; nombre: string; direccion: string }>
    statementMovements: number
    reportMovements: number
    skipped: { unpaidPpd: number; nonCashDocument: number; nonBankPayment: number }
    privacy: string
  }
  summary: {
    bankCredits: number
    bankDebits: number
    reportCredits: number
    reportDebits: number
    creditDifference: number
    debitDifference: number
    exactMatches: number
    reviewCount: number
    bankOnlyCount: number
    reportOnlyCount: number
    discrepancies: number
    coverage: number
  }
  rows: ReconciliationRow[]
}

const props = withDefaults(
  defineProps<{
    clientId: number
    clientLabel?: string
    year: number
    month: number
    reports?: Array<Record<string, any>>
  }>(),
  { clientLabel: '', reports: () => [] }
)

const bankOptions = [
  { value: 'auto', label: 'Detectar automáticamente' },
  { value: 'bbva', label: 'BBVA México' },
  { value: 'hsbc', label: 'HSBC México' },
  { value: 'azteca', label: 'Banco Azteca' },
  { value: 'santander', label: 'Santander México' },
  { value: 'banorte', label: 'Banorte' },
  { value: 'banamex', label: 'Banamex' },
  { value: 'generic', label: 'Otro banco / formato genérico' }
]
const filterOptions = [
  { value: 'discrepancies', label: 'Sólo discrepancias' },
  { value: 'all', label: 'Todos los movimientos' },
  { value: 'matched', label: 'Sólo coincidencias' },
  { value: 'review', label: 'Requieren revisión' }
]
const monthNames = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]

const show = ref(false)
const dragging = ref(false)
const loading = ref(false)
const reconciliationTutorialOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const statementFile = ref<File | null>(null)
const errorMessage = ref('')
const result = ref<ReconciliationResult | null>(null)
const draft = reactive({
  bank: 'auto',
  password: '',
  amountTolerance: 1,
  dateWindow: 3,
  filter: 'discrepancies'
})

const reconciliationTutorialStorageKey = computed(() =>
  result.value ? 'tourBankReconciliationResultsDone' : 'tourBankReconciliationSetupDone'
)
const reconciliationTutorialTitle = computed(() =>
  result.value ? 'Cómo leer la conciliación' : 'Cómo preparar la conciliación'
)
const reconciliationTutorialSteps = computed(() =>
  result.value
    ? [
        {
          target: '.reconciliation-kpis',
          eyebrow: 'Banco / resumen',
          title: 'Empieza por la cobertura',
          body: 'La cobertura indica qué proporción de los movimientos pudo relacionarse. Coincidencias y discrepancias resumen el trabajo pendiente.'
        },
        {
          target: '.reconciliation-money',
          eyebrow: 'Banco / importes',
          title: 'Compara ingresos y egresos',
          body: 'Revisa los totales del banco, los reportes fiscales y la diferencia calculada para abonos y cargos.'
        },
        {
          target: '.reconciliation-toolbar',
          eyebrow: 'Banco / filtro',
          title: 'Prioriza lo que necesita atención',
          body: 'Muestra sólo discrepancias, coincidencias o movimientos que requieren revisión.'
        },
        {
          target: '.reconciliation-table-wrap',
          eyebrow: 'Banco / detalle',
          title: 'Entiende cada relación',
          body: 'Cada fila explica el movimiento bancario, el motivo del resultado y los CFDI encontrados en los reportes.'
        },
        {
          target: '.bank-reconciliation-footer',
          eyebrow: 'Banco / salida',
          title: 'Exporta los hallazgos',
          body: 'Descarga un CSV con las discrepancias para documentar o dar seguimiento a la revisión.'
        }
      ]
    : [
        {
          target: '.reconciliation-readiness',
          eyebrow: 'Banco / preparación',
          title: 'Completa los tres requisitos',
          body: 'Necesitas un mes específico, al menos un reporte mensual y el estado de cuenta del mismo periodo.'
        },
        {
          target: '.reconciliation-config',
          eyebrow: 'Banco / criterios',
          title: 'Ajusta cómo se buscan coincidencias',
          body: 'Puedes detectar el banco automáticamente y definir la tolerancia de importe y la ventana permitida entre fechas.'
        },
        {
          target: '.statement-dropzone',
          eyebrow: 'Banco / archivo',
          title: 'Carga el estado de cuenta',
          body: 'Selecciona un PDF digital, XML, CSV o TXT. Si el PDF tiene contraseña, escríbela en el campo anterior.'
        },
        {
          target: '.reconciliation-privacy',
          eyebrow: 'Banco / privacidad',
          title: 'El archivo no queda almacenado',
          body: 'El servidor procesa el estado de cuenta en memoria y descarta tanto el archivo como su contraseña.'
        },
        {
          target: '.bank-reconciliation-footer',
          eyebrow: 'Banco / comparación',
          title: 'Extrae y compara',
          body: 'El botón se habilita cuando el periodo, los reportes y el archivo están listos.'
        }
      ]
)

function openReconciliationTutorial(): void {
  reconciliationTutorialOpen.value = true
}

const monthlyReports = computed(() =>
  props.reports.filter(
    (report) =>
      report.tipo === 'mensual' &&
      Number(report.ejercicio) === Number(props.year) &&
      Number(report.mes) === Number(props.month)
  )
)
const periodLabel = computed(() =>
  props.month > 0
    ? `${monthNames[props.month - 1]} ${props.year}`
    : `Selecciona un mes de ${props.year}`
)
const canRun = computed(
  () =>
    !!props.clientId &&
    props.month > 0 &&
    !!monthlyReports.value.length &&
    !!statementFile.value &&
    !loading.value
)
const visibleRows = computed(() => {
  const rows = result.value?.rows || []
  if (draft.filter === 'all') return rows
  if (draft.filter === 'matched') return rows.filter((row) => row.status === 'matched')
  if (draft.filter === 'review') return rows.filter((row) => row.status === 'review')
  return rows.filter((row) => row.status !== 'matched')
})

const money = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2
  }).format(Number(value || 0))
const dateLabel = (value?: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Sin fecha'
}
const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const statusLabel = (status: ReconciliationStatus) =>
  ({
    matched: 'Coincide',
    review: 'Revisar',
    bank_only: 'Sólo banco',
    report_only: 'Sólo reporte'
  })[status]
const movementLabel = (type: 'credit' | 'debit') => (type === 'credit' ? 'Abono' : 'Cargo')
const reportTotal = (row: ReconciliationRow) =>
  row.reportItems.reduce((total, item) => total + Number(item.amount || 0), 0)

async function openDialog() {
  errorMessage.value = ''
  result.value = null
  statementFile.value = null
  draft.password = ''
  draft.filter = 'discrepancies'
  show.value = true
  await nextTick()
  if (!localStorage.getItem('tourBankReconciliationSetupDone'))
    reconciliationTutorialOpen.value = true
}
function closeDialog() {
  draft.password = ''
  reconciliationTutorialOpen.value = false
  show.value = false
}
function resetComparison() {
  reconciliationTutorialOpen.value = false
  result.value = null
  statementFile.value = null
  errorMessage.value = ''
  draft.password = ''
}
function selectFile(file?: File | null) {
  errorMessage.value = ''
  if (!file) return
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || ''
  if (!['pdf', 'xml', 'csv', 'txt'].includes(extension)) {
    errorMessage.value = 'Usa un archivo PDF digital, XML, CSV o TXT.'
    return
  }
  if (file.size > 15 * 1024 * 1024) {
    errorMessage.value = 'El archivo supera el límite de 15 MB.'
    return
  }
  statementFile.value = file
}
function openFilePicker() {
  fileInput.value?.click()
}
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectFile(input.files?.[0])
  input.value = ''
}
function dropFile(event: DragEvent) {
  dragging.value = false
  selectFile(event.dataTransfer?.files?.[0])
}
async function runComparison() {
  errorMessage.value = ''
  if (!props.clientId) {
    errorMessage.value = 'Selecciona un cliente en los filtros fiscales.'
    return
  }
  if (!props.month) {
    errorMessage.value = 'Selecciona un mes específico para conciliar.'
    return
  }
  if (!monthlyReports.value.length) {
    errorMessage.value = 'Guarda primero el reporte mensual de ingresos o egresos de este periodo.'
    return
  }
  if (!statementFile.value) {
    errorMessage.value = 'Selecciona el estado de cuenta del cliente.'
    return
  }
  loading.value = true
  try {
    result.value = await fs.reconcileBankStatement({
      clienteId: props.clientId,
      year: props.year,
      month: props.month,
      bank: draft.bank,
      password: draft.password,
      amountTolerance: Number(draft.amountTolerance),
      dateWindow: Number(draft.dateWindow),
      file: statementFile.value
    })
    draft.password = ''
    draft.filter = 'discrepancies'
    await nextTick()
    if (!localStorage.getItem('tourBankReconciliationResultsDone')) {
      reconciliationTutorialOpen.value = true
    }
  } catch (error: any) {
    errorMessage.value =
      error.response?.data?.error || 'No se pudo extraer y comparar el estado de cuenta.'
  } finally {
    loading.value = false
  }
}

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
function exportFindings() {
  if (!result.value) return
  const rows = result.value.rows
    .filter((row) => row.status !== 'matched')
    .map((row) => [
      statusLabel(row.status),
      row.reason,
      row.bank ? dateLabel(row.bank.date) : '',
      row.bank ? movementLabel(row.bank.type) : '',
      row.bank?.description || '',
      row.bank?.trackingKey || row.bank?.reference || '',
      row.bank?.amount ?? '',
      row.reportItems.map((item) => dateLabel(item.date)).join(' | '),
      row.reportItems.map((item) => item.counterpart).join(' | '),
      row.reportItems.map((item) => item.counterpartRfc).join(' | '),
      row.reportItems.map((item) => item.uuid).join(' | '),
      reportTotal(row),
      row.reportItems.map((item) => item.reportName).join(' | ')
    ])
  const headers = [
    'Estado',
    'Explicación',
    'Fecha banco',
    'Tipo banco',
    'Concepto banco',
    'Referencia bancaria',
    'Importe banco',
    'Fecha reporte',
    'Contraparte',
    'RFC',
    'UUID',
    'Importe reporte',
    'Reporte'
  ]
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  saveAs(
    new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }),
    `Discrepancias_${result.value.meta.client.rfc || props.clientId}_${props.year}_${String(props.month).padStart(2, '0')}.csv`
  )
}

watch(
  () => [props.clientId, props.year, props.month],
  () => {
    if (!show.value) return
    resetComparison()
  }
)
