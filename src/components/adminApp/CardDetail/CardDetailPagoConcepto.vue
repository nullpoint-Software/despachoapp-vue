<template>
  <Teleport to="body">
    <Transition name="modal">
      <div class="modal-overlay" role="presentation" @click.self="close">
        <section class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="payment-title">
          <header class="modal-header">
            <p>REGISTRO / CAJA</p>
            <button type="button" class="modal-close" aria-label="Cerrar" @click="close">×</button>
            <h2 id="payment-title">{{ payment.id ? "Editar pago" : "Nuevo pago" }}</h2>
            <span>Los importes admiten cero. Todos los campos marcados son obligatorios.</span>
          </header>

          <form class="payment-form" @submit.prevent="save">
            <label class="field field--wide">
              <span>01 / Cliente *</span>
              <select v-model="payment.id_cliente" :disabled="loadingOptions">
                <option value="" disabled>{{ loadingOptions ? "Cargando clientes…" : "Selecciona un cliente" }}</option>
                <option v-for="client in clientes" :key="client.id_cliente" :value="client.id_cliente">{{ client.nombre }}</option>
              </select>
              <small v-if="errors.cliente">{{ errors.cliente }}</small>
            </label>

            <label class="field field--wide">
              <span>02 / Asunto *</span>
              <InputText v-model="payment.asunto" placeholder="Ej. Declaración mensual" autocomplete="off" />
              <small v-if="errors.asunto">{{ errors.asunto }}</small>
            </label>

            <label class="field field--wide">
              <span>03 / Atendió *</span>
              <select v-model="payment.id_atendio" :disabled="loadingOptions">
                <option value="" disabled>Selecciona a la persona responsable</option>
                <option v-for="employee in employees" :key="employee.id_usuario" :value="employee.id_usuario">{{ employee.nombre }} · {{ employee.username }}</option>
              </select>
              <small v-if="errors.atendio">{{ errors.atendio }}</small>
            </label>

            <label class="field">
              <span>04 / Cobramos *</span>
              <div class="money"><b>$</b><InputText v-model="payment.cobramos" type="number" step="0.01" min="0" /></div>
              <small v-if="errors.cobramos">{{ errors.cobramos }}</small>
            </label>

            <label class="field">
              <span>05 / Pagamos *</span>
              <div class="money"><b>$</b><InputText v-model="payment.pagamos" type="number" step="0.01" min="0" /></div>
              <small v-if="errors.pagamos">{{ errors.pagamos }}</small>
            </label>

            <div class="field field--wide">
              <span>06 / Fecha y hora *</span>
              <DateTimePicker v-model="selectedDate" />
              <small v-if="errors.fecha">{{ errors.fecha }}</small>
            </div>

            <p v-if="loadError || saveError" class="form-error">{{ saveError || loadError }}</p>
            <footer class="modal-actions field--wide">
              <Button label="Cancelar" icon="pi pi-times" outlined @click="close" />
              <Button :label="saving ? 'Guardando…' : 'Guardar pago'" icon="pi pi-check" class="p-button-primary" type="submit" :disabled="saving || loadingOptions" />
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import InputText from "@/components/ui/AppInput.vue";
import Button from "@/components/ui/AppButton.vue";
import DateTimePicker from "@/components/ui/DateTimePicker.vue";
import { cs, ps, us, formatFechaHoraFullSQL } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";

interface Payment { [key: string]: any }
const props = withDefaults(defineProps<{ pago?: Payment; usuario?: Payment }>(), { pago: () => ({}), usuario: () => ({}) });
const emit = defineEmits<{ close: []; save: [payment: Payment] }>();
const payment = ref<Payment>({ id_cliente: "", asunto: "", id_atendio: localStorage.getItem("userid") || props.usuario.id || "", cobramos: 0, pagamos: 0, ...props.pago });
const selectedDate = ref<Date>(toDate(payment.value.fecha));
const clientes = ref<Payment[]>([]);
const employees = ref<Payment[]>([]);
const loadingOptions = ref(true);
const loadError = ref("");
const saveError = ref("");
const saving = ref(false);
const errors = ref<Record<string, string>>({});

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
  const [clientResult, employeeResult] = await Promise.allSettled([loadProgressively({ pageSize:40, fetchPage:(page)=>cs.getClientes(page), onUpdate:(items)=>{ clientes.value=items; } }), us.getUsuarios()]);
  if (employeeResult.status === "fulfilled") employees.value = Array.isArray(employeeResult.value) ? employeeResult.value : [];
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
</script>

<style scoped>
.modal-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:rgba(8,8,7,.82);backdrop-filter:blur(3px)}.modal-shell{width:min(48rem,100%);max-height:calc(100vh - 2rem);overflow:auto;border:2px solid #0e0e0d;background:var(--br-control);color:#141413;box-shadow:12px 12px 0 var(--br-accent)}.modal-header{position:relative;padding:1.4rem 4.5rem 1.25rem 1.5rem;border-bottom:2px solid #141413;background:#141413;color:var(--br-text)}.modal-header p,.field>span{margin:0 0 .45rem;font:800 .75rem/1.1 "Courier New",monospace;letter-spacing:.09em;text-transform:uppercase}.modal-header h2{margin:0;font:900 clamp(1.8rem,5vw,3.2rem)/.95 Arial,sans-serif;letter-spacing:-.055em;text-transform:uppercase}.modal-header>span{display:block;margin-top:.65rem;color:var(--br-muted);font:600 .82rem/1.3 "Courier New",monospace}.modal-close{position:absolute;right:0;top:0;width:3.75rem;height:3.75rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);background:var(--br-accent);color:#fff;font:400 2rem/1 Arial;cursor:pointer}.payment-form{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:1.5rem}.field{display:flex;min-width:0;flex-direction:column}.field--wide{grid-column:1/-1}.field select{width:100%;min-height:3rem;border:1px solid #56534c;border-radius:0;background:#fff;color:#141413;padding:.7rem .8rem;font:700 .9rem "Courier New",monospace}.field small{margin-top:.35rem;color:#a52319;font:800 .75rem "Courier New",monospace}.money{display:grid;grid-template-columns:3rem 1fr}.money b{display:grid;place-items:center;border:1px solid #56534c;border-right:0;background:#141413;color:#fff}.money :deep(input){width:100%}.form-error{grid-column:1/-1;margin:0;border:1px solid #a52319;background:#f4c6bd;padding:.8rem;color:#761b14;font:800 .8rem/1.3 "Courier New",monospace}.modal-actions{display:flex;justify-content:flex-end;gap:.75rem;padding-top:.5rem;border-top:1px solid #77736b}.modal-enter-active,.modal-leave-active{transition:opacity .18s ease}.modal-enter-active .modal-shell,.modal-leave-active .modal-shell{transition:transform .22s cubic-bezier(.2,.8,.2,1)}.modal-enter-from,.modal-leave-to{opacity:0}.modal-enter-from .modal-shell{transform:translateY(18px) scale(.98)}.modal-leave-to .modal-shell{transform:translateY(8px)}@media(max-width:640px){.payment-form{grid-template-columns:1fr}.field{grid-column:1}.modal-shell{box-shadow:6px 6px 0 var(--br-accent)}}
</style>
