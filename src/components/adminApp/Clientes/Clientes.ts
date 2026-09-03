import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAppToast } from '@/composables/useAppToast'
import { subscribeToPermissions } from '@/service/adminApp/permissionsService'
import { cs, pks } from '@/service/adminApp/client'
import { clearSensitiveAccess, hasSensitiveAccess } from '@/service/adminApp/sensitiveAccess'
import type { ColumnDef } from '@/types/ClientesTable'
import { useBrutalMotion } from '@/composables/useBrutalMotion'
import { regimenesFiscales, regimenFiscalLabel } from '@/constants/regimenesFiscales'
const pageRef = ref<HTMLElement | null>(null)
useBrutalMotion(pageRef, ['.clients-hero', '#clientes-table'])
const canAddCliente = ref(false)
const canEditCliente = ref(false)
const canDeleteCliente = ref(false)
let stopPermissionSync = () => {}
const clientTutorialOpen = ref(false)
const clientTutorialSteps = [
  {
    target: '.clients-hero',
    eyebrow: 'Clientes / resumen',
    title: 'Consulta los expedientes',
    body: 'Aquí puedes buscar, filtrar y administrar la información fiscal y de contacto de cada cliente.'
  },
  {
    target: '#search-bar',
    eyebrow: 'Clientes / búsqueda',
    title: 'Encuentra por cualquier dato',
    body: 'Busca por nombre, RFC, régimen, teléfono o correo. Los resultados se actualizan mientras escribes.'
  },
  {
    target: '.app-data-table__header',
    eyebrow: 'Clientes / herramientas',
    title: 'Filtra o agrega',
    body: 'Usa los controles del encabezado para aplicar filtros, limpiar la búsqueda o crear un expediente si tienes permiso.'
  },
  {
    target: '.app-data-table__table',
    eyebrow: 'Clientes / registros',
    title: 'Abre las acciones de cada cliente',
    body: 'Las acciones disponibles permiten editar, administrar documentos y consultar datos protegidos de forma segura.'
  }
]

onMounted(() => {
  stopPermissionSync = subscribeToPermissions(({ effective }) => {
    canAddCliente.value = effective.canAddCliente === true
    canEditCliente.value = effective.canEditCliente === true
    canDeleteCliente.value = effective.canDeleteCliente === true
  })
})
const toast = useAppToast()
const customers = ref<any[]>([])
const totalCustomers = ref(0)
const loadingCustomers = ref(false)
const pageSize = ref(20)
const currentPage = ref(0)
const pageSizeOptions = [10, 20, 50]
let searchTimer: ReturnType<typeof setTimeout> | null = null
let requestSequence = 0
// Definición de columnas base (sin la columna de acciones)
const columns = ref<ColumnDef[]>([
  { field: 'id_cliente', header: 'ID', visible: true },
  { field: 'nombre', header: 'Nombre Cliente', visible: true },
  { field: 'rfc', header: 'RFC', visible: false },
  { field: 'regimen_fiscal', header: 'Régimen Fiscal', visible: true },
  { field: 'fiel', header: 'Contraseña FIEL', visible: false },
  { field: 'ciecf', header: 'Contraseña CLECF', visible: false },
  { field: 'telefono', header: 'Celular', visible: true },
  { field: 'email', header: 'Correo Electrónico', visible: true }
])

// Filtros
const filters = ref({
  global: { value: null, matchMode: 'contains' }
})
type ContactFilter = 'todos' | 'completo' | 'sin_telefono' | 'sin_correo'
const showFilters = ref(false)
const regimeFilter = ref('todos')
const contactFilter = ref<ContactFilter>('todos')
const draftRegimeFilter = ref('todos')
const draftContactFilter = ref<ContactFilter>('todos')
const regimeOptions = [{ label: 'Todos', value: 'todos' }, ...regimenesFiscales]
const contactOptions = [
  { label: 'Todos', value: 'todos' },
  { label: 'Contacto completo', value: 'completo' },
  { label: 'Sin teléfono', value: 'sin_telefono' },
  { label: 'Sin correo', value: 'sin_correo' }
]
const activeFilterCount = computed(
  () => Number(regimeFilter.value !== 'todos') + Number(contactFilter.value !== 'todos')
)
const filterButtonLabel = computed(() =>
  activeFilterCount.value ? `Filtros (${activeFilterCount.value})` : 'Filtros'
)

function openFilters() {
  draftRegimeFilter.value = regimeFilter.value
  draftContactFilter.value = contactFilter.value
  showFilters.value = true
}

function closeFilters() {
  showFilters.value = false
}

function resetDraftFilters() {
  draftRegimeFilter.value = 'todos'
  draftContactFilter.value = 'todos'
}

function applyFilters() {
  regimeFilter.value = draftRegimeFilter.value
  contactFilter.value = draftContactFilter.value
  currentPage.value = 0
  showFilters.value = false
  void loadCustomersPage()
}

const clearFilter = () => {
  filters.value.global.value = null
  regimeFilter.value = 'todos'
  contactFilter.value = 'todos'
  resetDraftFilters()
  currentPage.value = 0
  void loadCustomersPage()
}
const pageCount = computed(() => Math.max(1, Math.ceil(totalCustomers.value / pageSize.value)))
const pagerLabel = computed(() => {
  if (!totalCustomers.value) return loadingCustomers.value ? 'Cargando registros' : '0 registros'
  const start = currentPage.value * pageSize.value + 1
  const end = Math.min(totalCustomers.value, start + customers.value.length - 1)
  return `${start}-${end} de ${totalCustomers.value} registros`
})

async function loadCustomersPage() {
  const sequence = ++requestSequence
  loadingCustomers.value = true
  try {
    const allCustomers: any[] = []
    const batchSize = 200
    let offset = 0
    while (true) {
      const batch = await cs.getClientes({ limit: batchSize, offset })
      if (sequence !== requestSequence) return
      if (!Array.isArray(batch)) break
      allCustomers.push(...batch)
      if (batch.length < batchSize) break
      offset += batchSize
    }

    const term = String(filters.value.global.value || '')
      .trim()
      .toLocaleLowerCase('es-MX')
    const filtered = allCustomers.filter((customer) => {
      const phone = String(customer.telefono || '').trim()
      const email = String(customer.email || customer.correo || '').trim()
      const matchesSearch =
        !term ||
        [
          customer.id_cliente,
          customer.nombre,
          customer.rfc,
          customer.regimen_fiscal,
          phone,
          email
        ].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase('es-MX')
            .includes(term)
        )
      const matchesRegime =
        regimeFilter.value === 'todos' || customer.regimen_fiscal === regimeFilter.value
      const matchesContact =
        contactFilter.value === 'todos' ||
        (contactFilter.value === 'completo' && Boolean(phone && email)) ||
        (contactFilter.value === 'sin_telefono' && !phone) ||
        (contactFilter.value === 'sin_correo' && !email)
      return matchesSearch && matchesRegime && matchesContact
    })

    totalCustomers.value = filtered.length
    const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize.value) - 1)
    if (currentPage.value > lastPage) currentPage.value = lastPage
    const start = currentPage.value * pageSize.value
    customers.value = filtered.slice(start, start + pageSize.value)
  } catch (_error) {
    toast.add({
      severity: 'error',
      summary: 'Sin conexión',
      detail: 'No se pudieron cargar los clientes.',
      life: 3500
    })
  } finally {
    if (sequence === requestSequence) loadingCustomers.value = false
  }
}

function previousPage() {
  if (currentPage.value === 0) return
  currentPage.value -= 1
  void loadCustomersPage()
}

function nextPage() {
  if (currentPage.value >= pageCount.value - 1) return
  currentPage.value += 1
  void loadCustomersPage()
}

// Función para copiar al portapapeles
const copyToClipboard = async (text: string, confidential?: boolean) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      severity: 'info',
      summary: 'Copiado',
      detail: confidential ? 'Dato protegido' : text,
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
  stopPermissionSync()
  window.removeEventListener('resize', handleResize)
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(async () => {
  await loadCustomersPage()
  await refreshPasskeyAvailability()
  if (!localStorage.getItem('tourClientesDone')) clientTutorialOpen.value = true
})

watch(
  () => filters.value.global.value,
  () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      currentPage.value = 0
      void loadCustomersPage()
    }, 300)
  }
)

watch(pageSize, () => {
  currentPage.value = 0
  void loadCustomersPage()
})

// Variables para el Card de agregar/editar clientes
const cardVisible = ref(false)
const savingCustomer = ref(false)
const selectedCustomer = ref({})
const selectedDocumentClient = ref<any | null>(null)

const openDocuments = (customer: any) => {
  selectedDocumentClient.value = { ...customer }
}

const closeCustomerCard = () => {
  if (!savingCustomer.value) cardVisible.value = false
}

const openCard = (customer: any) => {
  if (savingCustomer.value) return
  if (!customer && !canAddCliente.value) return
  if (customer) {
    selectedCustomer.value = { ...customer }
  } else {
    selectedCustomer.value = {
      id_cliente: '',
      nombre: '',
      rfc: '',
      regimen_fiscal: '',
      fiel: '',
      ciecf: '',
      telefono: '',
      email: ''
    }
  }
  cardVisible.value = true
}

const saveCustomer = async (customer: any) => {
  if (!customer || savingCustomer.value) return

  const customerId = customer.id_cliente
  const isEditing = customerId !== '' && customerId !== null && customerId !== undefined
  savingCustomer.value = true

  try {
    if (isEditing) {
      await cs.editCliente(customer)
    } else {
      await cs.addCliente(customer)
      currentPage.value = 0
    }

    await loadCustomersPage()
    toast.add({
      severity: 'success',
      summary: isEditing ? 'Actualizado' : 'Agregado',
      detail: isEditing ? 'Cliente actualizado correctamente' : 'Cliente agregado correctamente',
      life: 2000
    })
    cardVisible.value = false
  } catch (_error) {
    toast.add({
      severity: 'error',
      summary: 'No guardado',
      detail: 'Revisa la conexión e inténtalo de nuevo.',
      life: 3500
    })
  } finally {
    savingCustomer.value = false
  }
}

// Variables para confirmación de eliminación
const confirmDialogVisible = ref(false)
const candidateToDelete: any = ref(null)
const openConfirmDialog = (customer: any) => {
  candidateToDelete.value = { ...customer }
  confirmDialogVisible.value = true
}
const confirmDelete = async () => {
  if (candidateToDelete.value) {
    try {
      await cs.deleteCliente(candidateToDelete.value.id_cliente)
      if (customers.value.length === 1 && currentPage.value > 0) currentPage.value -= 1
      await loadCustomersPage()
      toast.add({
        severity: 'warn',
        summary: 'Eliminado',
        detail: 'Cliente eliminado correctamente',
        life: 2000
      })
    } catch (_error) {
      toast.add({
        severity: 'error',
        summary: 'No eliminado',
        detail: 'No se pudo eliminar el cliente.',
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

const revealed = ref<Record<string, Record<string, boolean>>>({})
const revealedValues = ref<Record<string, Record<string, string>>>({})
const revealTimers = new Map<string, ReturnType<typeof setTimeout>>()
type ProtectedClientField = 'rfc' | 'fiel' | 'ciecf'
onUnmounted(() => {
  revealTimers.forEach((timer) => clearTimeout(timer))
  revealTimers.clear()
})
const credentialDialogVisible = ref(false)
const credentialTarget = ref<{ row: any; field: ProtectedClientField } | null>(null)
const verificationPassword = ref('')
const verificationError = ref('')
const verificationBusy = ref(false)
const passkeyBusy = ref(false)
const passkeySupported = ref(false)
const hasRegisteredPasskeys = ref(false)
const passkeyPasswordFallbackRequested = ref(false)
const canUsePasskeyReveal = computed(() => passkeySupported.value && hasRegisteredPasskeys.value)

function isFieldVisible(row: any, field: string) {
  return revealed.value[row.id_cliente]?.[field] ?? false
}

function setFieldVisibility(row: any, field: string, visible: boolean) {
  if (!revealed.value[row.id_cliente]) revealed.value[row.id_cliente] = {}
  revealed.value[row.id_cliente][field] = visible
}

function clearsValueWhenHidden(field: string) {
  return field === 'fiel' || field === 'ciecf'
}

function closeCredentialDialog() {
  if (verificationBusy.value || passkeyBusy.value) return
  credentialDialogVisible.value = false
  credentialTarget.value = null
  verificationPassword.value = ''
  verificationError.value = ''
}

function openPasswordCredentialDialog() {
  verificationPassword.value = ''
  credentialDialogVisible.value = true
}

function usePasswordInstead() {
  passkeyPasswordFallbackRequested.value = true
  pks.cancelAuthentication()
  passkeyBusy.value = false
  verificationError.value = ''
  openPasswordCredentialDialog()
}

async function refreshPasskeyAvailability() {
  passkeySupported.value = pks.supportsPasskeys()
  if (!passkeySupported.value) {
    hasRegisteredPasskeys.value = false
    return
  }
  try {
    hasRegisteredPasskeys.value = (await pks.getPasskeys()).length > 0
  } catch (_error) {
    hasRegisteredPasskeys.value = false
  }
}

function showRevealedCredential(target: { row: any; field: ProtectedClientField }, value: string) {
  const rowKey = String(target.row.id_cliente)
  if (!revealedValues.value[rowKey]) revealedValues.value[rowKey] = {}
  revealedValues.value[rowKey][target.field] = value
  target.row[target.field] = value
  setFieldVisibility(target.row, target.field, true)

  const timerKey = `${rowKey}:${target.field}`
  const previousTimer = revealTimers.get(timerKey)
  if (previousTimer) clearTimeout(previousTimer)
  revealTimers.set(
    timerKey,
    setTimeout(() => {
      setFieldVisibility(target.row, target.field, false)
      delete revealedValues.value[rowKey]?.[target.field]
      if (clearsValueWhenHidden(target.field)) target.row[target.field] = null
      revealTimers.delete(timerKey)
    }, 20000)
  )
}

async function revealWithActiveAccess(target: { row: any; field: ProtectedClientField }) {
  verificationBusy.value = true
  verificationError.value = ''
  try {
    const response = await cs.revelarCredencial(target.row.id_cliente, target.field, '')
    showRevealedCredential(target, response.value)
    toast.add({
      severity: 'success',
      summary: 'Acceso protegido activo',
      detail: 'No volveremos a pedir tu contraseña durante 10 minutos.',
      life: 3000
    })
  } catch (error: any) {
    if (error?.response?.data?.code === 'SENSITIVE_ACCESS_EXPIRED') {
      clearSensitiveAccess()
      verificationBusy.value = false
      if (canUsePasskeyReveal.value) void verifyAndRevealWithPasskey()
      else openPasswordCredentialDialog()
      return
    }
    toast.add({
      severity: 'error',
      summary: 'No se pudo mostrar',
      detail: error?.response?.data?.error || 'No fue posible consultar la credencial.',
      life: 3500
    })
  } finally {
    verificationBusy.value = false
  }
}

async function verifyAndReveal() {
  const target = credentialTarget.value
  if (!target || !verificationPassword.value) return
  verificationBusy.value = true
  verificationError.value = ''
  try {
    const response = await cs.revelarCredencial(
      target.row.id_cliente,
      target.field,
      verificationPassword.value
    )
    showRevealedCredential(target, response.value)

    verificationBusy.value = false
    closeCredentialDialog()
    toast.add({
      severity: 'success',
      summary: 'Identidad verificada',
      detail: 'La credencial se ocultará en 20 segundos.',
      life: 3000
    })
  } catch (error: any) {
    verificationError.value =
      error?.response?.data?.error || 'No fue posible verificar tu identidad.'
    verificationBusy.value = false
    verificationPassword.value = ''
  }
}

async function verifyAndRevealWithPasskey() {
  const target = credentialTarget.value
  if (!target || !canUsePasskeyReveal.value) {
    openPasswordCredentialDialog()
    return
  }
  passkeyBusy.value = true
  passkeyPasswordFallbackRequested.value = false
  verificationError.value = ''
  try {
    const assertion = await pks.authenticate()
    const response = await cs.revelarCredencial(target.row.id_cliente, target.field, '', assertion)
    showRevealedCredential(target, response.value)
    passkeyBusy.value = false
    closeCredentialDialog()
    toast.add({
      severity: 'success',
      summary: 'Identidad verificada',
      detail: 'La credencial se ocultará en 20 segundos.',
      life: 3000
    })
  } catch (error: any) {
    if (passkeyPasswordFallbackRequested.value) {
      passkeyBusy.value = false
      return
    }
    verificationError.value =
      error?.response?.data?.error ||
      'No fue posible verificar tu passkey. Puedes usar tu contraseña.'
    passkeyBusy.value = false
    openPasswordCredentialDialog()
  }
}

function handleCellClick(row: any, field: string, col: ColumnDef) {
  const isVisible = col.visible ?? true
  if (isVisible) {
    copyToClipboard(row[field])
    return
  }
  if (isFieldVisible(row, field)) {
    copyToClipboard(revealedValues.value[row.id_cliente]?.[field] || row[field], true)
    setFieldVisibility(row, field, false)
    if (clearsValueWhenHidden(field)) row[field] = null
    const timerKey = `${row.id_cliente}:${field}`
    const timer = revealTimers.get(timerKey)
    if (timer) clearTimeout(timer)
    revealTimers.delete(timerKey)
    return
  }
  credentialTarget.value = { row, field: field as ProtectedClientField }
  verificationError.value = ''
  if (hasSensitiveAccess()) {
    void revealWithActiveAccess(credentialTarget.value)
    return
  }
  if (canUsePasskeyReveal.value) {
    void verifyAndRevealWithPasskey()
    return
  }
  openPasswordCredentialDialog()
}
