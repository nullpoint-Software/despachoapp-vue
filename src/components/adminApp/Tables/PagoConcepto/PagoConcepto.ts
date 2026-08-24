import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ps,
  formatFechaSQL,
  formatFechaHoraFullSQL,
  formatFechaHoraFullPagoSQL,
} from "@/service/adminApp/client";
import { useAppToast } from "@/composables/useAppToast";
import { subscribeToPermissions } from "@/service/adminApp/permissionsService";
import { usePaymentActions } from "@/composables/usePaymentActions";

interface ConceptPayment {
  id: string | number
  cliente: string
  asunto: string
  atendio?: string
  id_atendio?: string | number
  cobramos: number | string
  pagamos: number | string
  saldo?: number | string
  fecha: string | Date
  fecha_legible?: string
  isnew?: boolean
  [key: string]: unknown
}

interface PaymentColumn {
  field: string
  header: string
}
interface GlobalFilter {
  value: string | null
  matchMode: 'contains'
}

function queryText(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return value == null ? '' : String(value)
}

const printDialogVisible = ref(false);
const canAddPagoConcepto = ref(false);
const canEditPagoConcepto = ref(false);
const canDeletePagoConcepto = ref(false);
let stopPermissionSync = () => {};
const toast = useAppToast();
const route = useRoute();
const payments = ref<ConceptPayment[]>([]);
const totalPayments = ref(0);
const loadingPayments = ref(false);
const pageSize = ref(20);
const currentPage = ref(0);
const pageSizeOptions = [10, 20, 50];
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let requestSequence = 0;
const { newPaymentRequest } = usePaymentActions();

// Lectura del usuario desde localStorage
const usuario = ref({
  id: localStorage.getItem('userId') || '',
  nombre: localStorage.getItem('fullname') || '',
  username: localStorage.getItem('username') || '',
  foto: localStorage.getItem('userphoto') || ''
})

// Definición de columnas base
const columns = ref<PaymentColumn[]>([
  { field: 'id', header: 'ID' },
  { field: 'asunto', header: 'Concepto' },
  { field: 'cliente', header: 'Cliente' },
  { field: 'atendio', header: 'Atendió' },
  { field: 'pagamos', header: 'Pagamos' },
  { field: 'cobramos', header: 'Cobramos' },
  { field: 'fecha', header: 'Fecha' }
  // { field: "saldo", header: "Saldo" },
])
const actionsColumn = { field: 'actions', header: 'Acciones' }
const tableColumns = computed(() => [...columns.value, actionsColumn])

// Filtros
const filters = ref<{ global: GlobalFilter }>({
  global: { value: null, matchMode: 'contains' }
})
const showFilters = ref(false)
const showDateRangeModal = ref(false)
const movementFilter = ref('todos')
const periodFilter = ref('todos')
const today = new Date()
const initialMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
const dateFrom = ref(new Date(initialMonthStart))
const dateTo = ref(new Date(today))
const draftMovementFilter = ref('todos')
const draftPeriodFilter = ref('todos')
const draftDateFrom = ref(new Date(initialMonthStart))
const draftDateTo = ref(new Date(today))
const movementOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Solo cobros', value: 'cobro' },
  { label: 'Solo pagos', value: 'pago' },
  { label: 'Movimientos mixtos', value: 'mixto' }
]
const periodOptions = [
  { label: 'Todas las fechas', value: 'todos' },
  { label: 'Rango personalizado', value: 'personalizado' }
]
const activeFilterCount = computed(
  () => Number(movementFilter.value !== 'todos') + Number(periodFilter.value !== 'todos')
)
const filterButtonLabel = computed(() =>
  activeFilterCount.value ? `Filtros (${activeFilterCount.value})` : 'Filtros'
)

function openFilters() {
  draftMovementFilter.value = movementFilter.value
  draftPeriodFilter.value = periodFilter.value
  draftDateFrom.value = new Date(dateFrom.value)
  draftDateTo.value = new Date(dateTo.value)
  showFilters.value = true
}

function closeFilters() {
  showFilters.value = false
}

function openDateRangeModal() {
  showDateRangeModal.value = true
}
function closeDateRangeModal() {
  showDateRangeModal.value = false
}
function applyDateRange(from: Date | string, to: Date | string): void {
  draftDateFrom.value = new Date(from)
  draftDateTo.value = new Date(to)
  showDateRangeModal.value = false
}
function formatFilterDate(value: Date | string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function resetDraftFilters() {
  draftMovementFilter.value = 'todos'
  draftPeriodFilter.value = 'todos'
  draftDateFrom.value = new Date(initialMonthStart)
  draftDateTo.value = new Date(today)
}

function applyFilters() {
  if (draftPeriodFilter.value === 'personalizado' && draftDateFrom.value > draftDateTo.value) {
    toast.add({
      severity: 'warn',
      summary: 'Periodo inválido',
      detail: 'La fecha inicial debe ser anterior a la fecha final.',
      life: 3000
    })
    return
  }
  movementFilter.value = draftMovementFilter.value
  periodFilter.value = draftPeriodFilter.value
  dateFrom.value = new Date(draftDateFrom.value)
  dateTo.value = new Date(draftDateTo.value)
  currentPage.value = 0
  showFilters.value = false
  void loadPaymentsPage()
}

const clearFilter = () => {
  filters.value.global.value = null
  movementFilter.value = 'todos'
  periodFilter.value = 'todos'
  resetDraftFilters()
  currentPage.value = 0
  void loadPaymentsPage()
}
const pageCount = computed(() => Math.max(1, Math.ceil(totalPayments.value / pageSize.value)))
const pagerLabel = computed(() => {
  if (!totalPayments.value) return loadingPayments.value ? 'Cargando registros' : '0 registros'
  const start = currentPage.value * pageSize.value + 1
  const end = Math.min(totalPayments.value, start + payments.value.length - 1)
  return `${start}-${end} de ${totalPayments.value} registros`
})

const normalizePaymentPage = (items: ConceptPayment[]): ConceptPayment[] =>
  items.map((item) => ({
    ...item,
    fecha_legible: formatFechaHoraFullPagoSQL(String(item.fecha))
  }))

function paymentDate(value: Date | string): Date {
  if (value instanceof Date) return value
  return new Date(String(value || '').replace(' ', 'T'))
}

async function loadPaymentsPage() {
  const sequence = ++requestSequence
  loadingPayments.value = true
  try {
    const allPayments: ConceptPayment[] = []
    const batchSize = 200
    let offset = 0
    while (true) {
      const batch = await ps.getPagoConcepto({ limit: batchSize, offset })
      if (sequence !== requestSequence) return
      if (!Array.isArray(batch)) break
      allPayments.push(...batch)
      if (batch.length < batchSize) break
      offset += batchSize
    }

    const normalized = normalizePaymentPage(allPayments)
    const term = String(filters.value.global.value || '')
      .trim()
      .toLocaleLowerCase('es-MX')
    const from = new Date(dateFrom.value)
    const to = new Date(dateTo.value)
    const filtered = normalized.filter((payment) => {
      const cobramos = Number(payment.cobramos) || 0
      const pagamos = Number(payment.pagamos) || 0
      const matchesMovement =
        movementFilter.value === 'todos' ||
        (movementFilter.value === 'cobro' && cobramos > 0 && pagamos === 0) ||
        (movementFilter.value === 'pago' && pagamos > 0 && cobramos === 0) ||
        (movementFilter.value === 'mixto' && cobramos > 0 && pagamos > 0)
      const date = paymentDate(payment.fecha)
      const matchesPeriod =
        periodFilter.value === 'todos' ||
        (!Number.isNaN(date.getTime()) && date >= from && date <= to)
      const matchesSearch =
        !term ||
        [payment.id, payment.asunto, payment.cliente, payment.atendio, payment.fecha_legible].some(
          (value) =>
            String(value ?? '')
              .toLocaleLowerCase('es-MX')
              .includes(term)
        )
      return matchesMovement && matchesPeriod && matchesSearch
    })

    totalPayments.value = filtered.length
    const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize.value) - 1)
    if (currentPage.value > lastPage) currentPage.value = lastPage
    const start = currentPage.value * pageSize.value
    payments.value = filtered.slice(start, start + pageSize.value)
  } catch (error) {
    console.error('No se pudieron cargar los pagos', error)
    toast.add({
      severity: 'error',
      summary: 'Sin conexión',
      detail: 'No se pudieron cargar los pagos.',
      life: 3500
    })
  } finally {
    if (sequence === requestSequence) loadingPayments.value = false
  }
}

function previousPage() {
  if (currentPage.value === 0) return
  currentPage.value -= 1
  void loadPaymentsPage()
}

function nextPage() {
  if (currentPage.value >= pageCount.value - 1) return
  currentPage.value += 1
  void loadPaymentsPage()
}

// Clase para las filas
const rowClass = (_data: ConceptPayment, index: number): string =>
  index % 2 === 0 ? 'bg-white hover:bg-gray-100' : 'bg-gray-50 hover:bg-gray-100'

// Copiar al portapapeles
const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      severity: 'info',
      summary: 'Copiado',
      detail: text,
      life: 2000
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'No se pudo copiar',
      life: 2000
    })
  }
}

// Detección de dispositivo móvil
const isMobile = ref(window.innerWidth <= 640)
const handleResize = () => {
  isMobile.value = window.innerWidth <= 640
}
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => {
  stopPermissionSync();
  window.removeEventListener("resize", handleResize);
  if (searchTimer) clearTimeout(searchTimer);
});

onMounted(async () => {
  const searchParam = route.query.search

  if (searchParam) {
    filters.value.global.value = queryText(searchParam)
  }
  await loadPaymentsPage();
  stopPermissionSync = subscribeToPermissions(({ effective }) => {
    canAddPagoConcepto.value = effective.canAddPagoConcepto === true;
    canEditPagoConcepto.value = effective.canEditPagoConcepto === true;
    canDeletePagoConcepto.value = effective.canDeletePagoConcepto === true;
  });
});
watch(
  () => route.query.search,
  (newSearch) => {
    filters.value.global.value = queryText(newSearch)
  }
)
watch(
  () => filters.value.global.value,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      currentPage.value = 0
      void loadPaymentsPage()
    }, 300)
  }
)
watch(pageSize, () => {
  currentPage.value = 0
  void loadPaymentsPage()
})

// Lógica para el Card y eliminación (igual que antes)
const cardVisible = ref(false)
const selectedPayment = ref<Partial<ConceptPayment>>({})
const openCard = (payment: ConceptPayment | null): void => {
  if (payment) {
    selectedPayment.value = { ...payment }
  } else {
    selectedPayment.value = {
      id: '',
      cliente: '',
      asunto: '',
      id_atendio: usuario.value.id,
      cobramos: 0,
      pagamos: 0,
      fecha: '',
      saldo: ''
    }
  }
  cardVisible.value = true
}
watch(newPaymentRequest, () => {
  if (canAddPagoConcepto.value) openCard(null)
})
const savePayment = async (payment: ConceptPayment): Promise<void> => {
  if (payment.id) {
    const index = payments.value.findIndex((p) => p.id === payment.id)
    if (index !== -1) {
      await loadPaymentsPage()
      toast.add({
        severity: 'success',
        summary: 'Actualizado',
        detail: 'Pago concepto actualizado correctamente',
        life: 2000
      })
    }
  }
  if (payment.isnew) {
    currentPage.value = 0
    await loadPaymentsPage()
    toast.add({
      severity: 'success',
      summary: 'Agregado',
      detail: 'Pago concepto agregado correctamente',
      life: 2000
    })
    printDialogVisible.value = true
  }
  cardVisible.value = false
}

const confirmDialogVisible = ref(false)
const candidateToDelete = ref<ConceptPayment | null>(null)
const openConfirmDialog = (payment: ConceptPayment): void => {
  candidateToDelete.value = { ...payment }
  confirmDialogVisible.value = true
}
const confirmDelete = async () => {
  if (candidateToDelete.value) {
    try {
      await ps.deletePagoConcepto(Number(candidateToDelete.value.id))
      if (payments.value.length === 1 && currentPage.value > 0) currentPage.value -= 1
      await loadPaymentsPage()
      toast.add({
        severity: 'warn',
        summary: 'Eliminado',
        detail: 'Pago concepto eliminado correctamente',
        life: 2000
      })
    } catch (error) {
      console.error('No se pudo eliminar el pago', error)
      toast.add({
        severity: 'error',
        summary: 'No eliminado',
        detail: 'No se pudo eliminar el pago.',
        life: 3500
      })
    }
  }
  confirmDialogVisible.value = false
  candidateToDelete.value = null
}
const cancelDelete = () => {
  confirmDialogVisible.value = false
  candidateToDelete.value = null
}

// --------- Impresión ---------
const printVisible = ref(false)
const paymentToPrint = ref<Partial<ConceptPayment>>({})
const openPrint = (payment: ConceptPayment): void => {
  paymentToPrint.value = { ...payment }
  printVisible.value = true
}
