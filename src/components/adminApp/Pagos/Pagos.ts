import { nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { usePaymentActions } from "@/composables/usePaymentActions";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
import { hasPermission } from "@/service/adminApp/permissionsService";
const router = useRouter();
const pageRef = ref<HTMLElement | null>(null);
const cashCutVisible = ref(false);
const canAddPayment = ref(false);
const paymentTutorialOpen = ref(false);
const paymentTutorialSteps = [
  { target: ".records-hero", eyebrow: "Pagos / inicio", title: "Tu centro de movimientos", body: "Desde esta vista registras cobros, egresos, comprobantes y cortes de caja sin duplicar operaciones." },
  { target: ".records-content .app-data-table__header", eyebrow: "Pagos / búsqueda", title: "Encuentra un movimiento", body: "Busca por cliente, concepto o responsable. Los filtros permiten separar cobros, pagos y periodos." },
  { target: ".records-content .app-data-table__table", eyebrow: "Pagos / registros", title: "Consulta y administra", body: "Cada fila concentra el movimiento y sus acciones para editar, imprimir o eliminar cuando tengas permiso." },
  { target: ".records-actions .p-button-primary", eyebrow: "Pagos / captura", title: "Registra desde un solo lugar", body: "Usa Nuevo pago. El formulario te guiará por relación, importes y confirmación." },
];
const { requestNewPayment } = usePaymentActions();
useBrutalMotion(pageRef, [
  ".records-hero",
  ".records-content",
]);
onMounted(async () => {
  canAddPayment.value = await hasPermission("canAddPagoConcepto");
  await nextTick();
  if (!localStorage.getItem("tourPagosDone")) paymentTutorialOpen.value = true;
});
async function newPayment() {
  if (!canAddPayment.value) return;
  await router.push("/app/pagos/concepto");
  await nextTick();
  requestNewPayment();
}
