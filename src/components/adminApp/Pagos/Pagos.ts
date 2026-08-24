import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { usePaymentActions } from "@/composables/usePaymentActions";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
import { subscribeToPermissions } from "@/service/adminApp/permissionsService";
const router = useRouter();
const pageRef = ref<HTMLElement | null>(null);
const cashCutVisible = ref(false);
const canAddPayment = ref(false);
let stopPermissionSync = () => {};
const paymentTutorialOpen = ref(false);
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
    target: '.records-actions .p-button-primary',
    eyebrow: 'Pagos / captura',
    title: 'Registra desde un solo lugar',
    body: 'Usa Nuevo pago. El formulario te guiará por relación, importes y confirmación.'
  }
]
const { requestNewPayment } = usePaymentActions()
useBrutalMotion(pageRef, ['.records-hero', '.records-content'])
onMounted(async () => {
  stopPermissionSync = subscribeToPermissions(({ effective }) => {
    canAddPayment.value = effective.canAddPagoConcepto === true;
  });
  await nextTick();
  if (!localStorage.getItem("tourPagosDone")) paymentTutorialOpen.value = true;
});
onUnmounted(() => stopPermissionSync());
async function newPayment() {
  if (!canAddPayment.value) return
  await router.push('/app/pagos/concepto')
  await nextTick()
  requestNewPayment()
}
