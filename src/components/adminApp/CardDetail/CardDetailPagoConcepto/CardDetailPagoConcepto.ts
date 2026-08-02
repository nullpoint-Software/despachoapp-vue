interface CardDetailPagoConceptoProps { pago?: Payment; usuario?: Payment }

interface CardDetailPagoConceptoEmits { close: []; save: [payment: Payment] }

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { cs, ps, us, formatFechaHoraFullSQL } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";

interface Payment { [key: string]: any }
const props = withDefaults(defineProps<CardDetailPagoConceptoProps>(), { pago: () => ({}), usuario: () => ({}) });
const emit = defineEmits<CardDetailPagoConceptoEmits>();
const payment = ref<Payment>({ id_cliente: "", asunto: "", id_atendio: localStorage.getItem("userid") || props.usuario.id || "", cobramos: 0, pagamos: 0, ...props.pago });
const selectedDate = ref<Date>(toDate(payment.value.fecha));
const clientes = ref<Payment[]>([]);
const employees = ref<Payment[]>([]);
const clientSearch = ref(String(payment.value.cliente || ""));
const employeeSearch = ref(String(payment.value.atendio || props.usuario.nombre || ""));
const loadingOptions = ref(true);
const loadError = ref("");
const saveError = ref("");
const saving = ref(false);
const errors = ref<Record<string, string>>({});
const subjectSuggestions = [
  "Pago de honorarios del mes de",
  "Cuota IMSS del mes de",
  "Préstamo de",
  "Impresión de",
  "Cita SAT",
  "Impuestos",
  "Declaración mensual",
  "Pago provisional",
  "Trámite ante el SAT",
  "Renovación de e.firma",
];

const normalize = (value: unknown) => String(value || "").trim().toLocaleLowerCase("es-MX");
const clientLabel = (client: Payment) => `${client.nombre || "Sin nombre"}${client.rfc ? ` - ${client.rfc}` : ""}`;
const employeeLabel = (employee: Payment) => `${employee.nombre || "Sin nombre"}${employee.username ? ` - ${employee.username}` : ""}`;
const clientOptions = computed(() => clientes.value.map(clientLabel));
const employeeOptions = computed(() => employees.value.map(employeeLabel));
function findClient(value: string) { const term = normalize(value); return clientes.value.find(item => normalize(clientLabel(item)) === term || normalize(item.nombre) === term || normalize(item.rfc) === term); }
function findEmployee(value: string) { const term = normalize(value); return employees.value.find(item => normalize(employeeLabel(item)) === term || normalize(item.nombre) === term || normalize(item.username) === term); }
function onClientInput(value: string) { payment.value.id_cliente = findClient(value)?.id_cliente || ""; }
function onEmployeeInput(value: string) { payment.value.id_atendio = findEmployee(value)?.id_usuario || ""; }

function toDate(value?: unknown) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
function close() { if (!saving.value) emit("close"); }
function onKeydown(event: KeyboardEvent) { if (event.key === "Escape") close(); }

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  document.body.classList.add("modal-open");
  const [clientResult, employeeResult] = await Promise.allSettled([loadProgressively<Payment>({ pageSize:40, fetchPage:async(page)=>await cs.getClientes(page) as Payment[], onUpdate:(items)=>{ clientes.value=items; } }), us.getUsuarios()]);
  if (employeeResult.status === "fulfilled") employees.value = Array.isArray(employeeResult.value) ? employeeResult.value as Payment[] : [];
  const selectedClient = clientes.value.find(item => String(item.id_cliente) === String(payment.value.id_cliente));
  const selectedEmployee = employees.value.find(item => String(item.id_usuario) === String(payment.value.id_atendio));
  if (selectedClient) clientSearch.value = clientLabel(selectedClient);
  if (selectedEmployee) employeeSearch.value = employeeLabel(selectedEmployee);
  if (!clientes.value.length || !employees.value.length) loadError.value = "No fue posible cargar todos los catálogos. Revisa la conexión e inténtalo de nuevo.";
  loadingOptions.value = false;
});
onBeforeUnmount(() => { document.removeEventListener("keydown", onKeydown); document.body.classList.remove("modal-open"); });

function validate() {
  const next: Record<string, string> = {};
  if (!payment.value.id_cliente) next.cliente = "Selecciona un cliente.";
  if (!String(payment.value.asunto || "").trim()) next.asunto = "Escribe el asunto.";
  if (!payment.value.id_atendio) next.atendio = "Selecciona quién atendió.";
  if (payment.value.cobramos === "" || payment.value.cobramos == null) next.cobramos = "Indica el monto.";
  if (payment.value.pagamos === "" || payment.value.pagamos == null) next.pagamos = "Indica el monto.";
  if (!selectedDate.value) next.fecha = "Selecciona fecha y hora.";
  errors.value = next;
  if (Object.keys(next).length) window.setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0);
  return Object.keys(next).length === 0;
}

async function save() {
  saveError.value = "";
  if (!validate()) return;
  const client = clientes.value.find(item => String(item.id_cliente) === String(payment.value.id_cliente));
  const employee = employees.value.find(item => String(item.id_usuario) === String(payment.value.id_atendio));
  if (!client || !employee) { saveError.value = "La selección ya no es válida. Actualiza los catálogos e inténtalo de nuevo."; return; }
  const payload: Payment = { ...payment.value, cliente: client.nombre, atendio: employee.nombre, cobramos: Number(payment.value.cobramos), pagamos: Number(payment.value.pagamos), fecha: formatFechaHoraFullSQL(selectedDate.value.toISOString()) };
  saving.value = true;
  try {
    if (payload.id) await ps.updatePagoConcepto(payload.id, payload);
    else {
      payload.id = `C-${new Date().toLocaleString("sv-SE").replace("T", "").replace(/[-: ]/g, "")}`;
      payload.isnew = true;
      await ps.addPagoConcepto(payload);
    }
    emit("save", payload);
  } catch (error) {
    console.error("No se pudo guardar el pago", error);
    saveError.value = "No se pudo guardar el pago. Verifica la conexión y vuelve a intentar.";
  } finally { saving.value = false; }
}
