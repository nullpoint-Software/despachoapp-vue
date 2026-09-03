import { nextTick, onMounted, ref } from 'vue'
import { useBrutalMotion } from '@/composables/useBrutalMotion'
const pageRef = ref<HTMLElement | null>(null)
const cashCutVisible = ref(false)
const paymentTutorialOpen = ref(false)
const paymentTutorialSteps = [
  {
    target: '.records-hero',
    eyebrow: 'Pagos / inicio',
    title: 'Tu centro de movimientos',
    body: 'Desde esta vista registras cobros, egresos, comprobantes y cortes de caja sin duplicar operaciones.'
  },
  {
    target: '.records-content .app-data-table__header',
    eyebrow: 'Pagos / búsqueda',
    title: 'Encuentra un movimiento',
    body: 'Busca por cliente, concepto o responsable. Los filtros permiten separar cobros, pagos y periodos.'
  },
  {
    target: '.records-content .app-data-table__table',
    eyebrow: 'Pagos / registros',
    title: 'Consulta y administra',
    body: 'Cada fila concentra el movimiento y sus acciones para editar, imprimir o eliminar cuando tengas permiso.'
  },
  {
    target: '.records-table__primary',
    eyebrow: 'Pagos / captura',
    title: 'Registra desde un solo lugar',
    body: 'Usa Nuevo pago. El formulario te guiará por relación, importes y confirmación.'
  }
]
useBrutalMotion(pageRef, ['.records-hero', '.records-content'])
onMounted(async () => {
  await nextTick()
  if (!localStorage.getItem('tourPagosDone')) paymentTutorialOpen.value = true
})
