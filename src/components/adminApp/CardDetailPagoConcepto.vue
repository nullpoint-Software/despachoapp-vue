<!-- CardDetailPagoConcepto.vue -->
<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-content relative bg-gray-50">
        <!-- Encabezado -->
        <div
          class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow"
        >
          <div>
            <h3 class="text-2xl font-bold text-black">
              <i class="pi pi-receipt text-3xl text-blue-500"></i>
              {{ pago.id ? "Editar Pago Concepto" : "Agregar Pago Concepto" }}
            </h3>
          </div>
        </div>

        <!-- Formulario -->
        <div class="space-y-4 px-4">
          <!-- Cliente -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Cliente</label>
            <select
              v-model="pago.id_cliente"
              class="p-2 border border-gray-300 rounded text-black"
              placeholder="Seleccione un cliente"
            >
              <option
                v-for="client in clientes"
                :key="client"
                :value="client.id_cliente"
              >
                {{ client.nombre }}
              </option>
            </select>
            <span v-if="errors.cliente" class="text-red-500 text-sm">{{
              errors.cliente
            }}</span>
          </div>

          <!-- Asunto -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Asunto</label>
            <InputText
              v-model="pago.asunto"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el asunto"
            />
            <span v-if="errors.asunto" class="text-red-500 text-sm">{{
              errors.asunto
            }}</span>
          </div>

          <!-- Quien atendio (deshabilitado) -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Quien atendio</label>
            <div class="flex items-center">
              <img
                v-if="getEmployeeImage(pago.id_atendio)"
                :src="getEmployeeImage(pago.id_atendio)"
                alt="Foto"
                class="w-8 h-8 rounded-full mr-2"
              />
              <select
                v-if="employees.length"
                v-model="pago.id_atendio"
                class="text-black p-2 border border-gray-300 rounded w-full"
                placeholder="Nombre del usuario"
              >
                <option
                  v-for="employee in employees"
                  :key="employee"
                  :value="employee.id_usuario"
                >
                  {{ employee.nombre + " (" + employee.username + ")" }}
                </option>
              </select>
            </div>
            <span v-if="errors.atendio" class="text-red-500 text-sm">{{
              errors.atendio
            }}</span>
          </div>

          <!-- Cobramos -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Cobramos</label>
            <div class="flex">
              <span
                class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l"
                >$</span
              >
              <!-- type="number" con step="0.01" impide letras -->
              <InputText
                type="number"
                step="0.01"
                min="0"
                v-model="pago.cobramos"
                class="p-2 border border-gray-300 rounded-r focus:outline-none w-full"
                placeholder="Ingrese el monto cobrado"
              />
            </div>
            <span v-if="errors.cobramos" class="text-red-500 text-sm">{{
              errors.cobramos
            }}</span>
          </div>

          <!-- Pagamos -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Pagamos</label>
            <div class="flex">
              <span
                class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l"
                >$</span
              >
              <InputText
                type="number"
                step="0.01"
                min="0"
                v-model="pago.pagamos"
                class="p-2 border border-gray-300 rounded-r focus:outline-none w-full"
                placeholder="Ingrese el monto pagado"
              />
            </div>
            <span v-if="errors.pagamos" class="text-red-500 text-sm">{{
              errors.pagamos
            }}</span>
          </div>

          <!-- Fecha (con Calendar) -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Fecha</label>
            <Calendar
              v-model="fechaSeleccionada"
              showIcon
              showTime
              showSeconds="true"
              hourFormat="24"
              placeholder="Selecciona la fecha"
              class="w-full border border-gray-300 rounded focus:outline-none"
            />
            <span v-if="errors.fecha" class="text-red-500 text-sm">{{
              errors.fecha
            }}</span>
          </div>

          <!-- Saldo
          <div class="flex flex-col">
            <label class="font-semibold text-black">Saldo</label>
            <div class="flex">
              <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
              <InputText
                type="number"
                step="0.01"
                min="0"
                v-model="pago.saldo"
                class="p-2 border border-gray-300 rounded-r focus:outline-none w-full"
                placeholder="Ingrese el saldo"
              />
            </div>
            <span v-if="errors.saldo" class="text-red-500 text-sm">{{ errors.saldo }}</span>
          </div> -->
        </div>

        <!-- Botones -->
        <div class="flex justify-end space-x-6 mt-6 px-4">
          <Button
            label="Cancelar"
            icon="pi pi-times"
            class="p-button-text"
            @click="close"
          />
          <Button
            label="Guardar"
            icon="pi pi-check"
            class="p-button-primary"
            @click="save"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted, computed } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Calendar from "primevue/calendar";
import { Select } from "primevue";
import defaultProfilePicture from "@/assets/img/user.jpg";
import {
  formatFechaHoraFullSQL,
  formatFechaSQL,
  ps,
  formatFechaHoraFullPagoSQL,
  cs,
  us,
} from "@/service/adminApp/client";
const userpic = ref(localStorage.getItem("userphoto"));
const userid = await localStorage.getItem("userid");
const clientes = await cs.getClientes();
const employees = await us.getUsuarios();
console.log(employees);

const props = defineProps({
  pago: {
    type: Object,
    default: () => ({
      id: "",
      cliente: "",
      asunto: "",
      atendio: "",
      cobramos: "",
      pagamos: "",
      fecha: "",
      saldo: "",
    }),
  },
  usuario: {
    type: Object,
    default: () => ({
      id: "",
      nombre: "",
      foto: "",
    }),
  },
});
const emit = defineEmits(["close", "save"]);

const pago = ref({ ...props.pago });
const errors = ref({
  cliente: "",
  asunto: "",
  atendio: "",
  cobramos: "",
  pagamos: "",
  fecha: "",
  saldo: "",
});

/* 
  Usamos un ref para Calendar, ya que Calendar guarda Date.
  Luego lo convertimos a dd/mm/yyyy en save()
*/
const fechaSeleccionada = ref();
const imagen = new String(pago.value.imagen);
onMounted(async () => {
  if (!pago.value.atendio) {
    //por si es un registro nuevo se ocupa el nombre de user
    pago.value.id_atendio = userid;
  }
  if (!pago.value.fecha) {
    const hoy = new Date();
    pago.value.fecha = await hoy; // dd/mm/yyyy
    fechaSeleccionada.value = formatFechaHoraFullPagoSQL(hoy);
    console.log("current pago: ", pago.value);
  } else {
    fechaSeleccionada.value = new Date(
      formatFechaHoraFullPagoSQL(pago.value.fecha)
    );
    console.log(formatFechaHoraFullPagoSQL(pago.value.fecha));
  }
  console.log(pago.value);

  // Asignar atendio si está vacío
  if (!pago.value.atendio && props.usuario.nombre) {
    pago.value.atendio = props.usuario.nombre;
  }
  // Convertir la cadena a Date para el Calendar
  // fechaSeleccionada.value = new Date();
});

// Cada vez que cambie props.pago, reseteamos
watch(
  () => props.pago,
  (newVal) => {
    pago.value = { ...newVal };
    errors.value = {
      cliente: "",
      asunto: "",
      atendio: "",
      cobramos: "",
      pagamos: "",
      fecha: "",
      saldo: "",
    };
    // fechaSeleccionada.value = aDate(newVal.fecha);
  }
);

function getEmployeeImage(id_atendio) {
  const emp = employees.find((e) => e.id_usuario === id_atendio);
  if (id_atendio == userid) {
    return userpic.value;
  }
  if (emp && emp.imagen && !String(emp.imagen).endsWith("null")) {
    return "data:image/png;base64," + emp.imagen;
  }
  return defaultProfilePicture;
}

/* VALIDACIÓN */
const validate = () => {
  let valid = true;
  errors.value = {
    cliente: "",
    asunto: "",
    atendio: "",
    cobramos: "",
    pagamos: "",
    fecha: "",
    saldo: "",
  };
  if (!pago.value.id_cliente) {
    errors.value.cliente = "El cliente es obligatorio.";
    valid = false;
  }
  if (!pago.value.asunto.trim()) {
    errors.value.asunto = "El asunto es obligatorio.";
    valid = false;
  }
  if (!pago.value.id_atendio) {
    errors.value.atendio = "El campo 'quien atendio' es obligatorio.";
    valid = false;
  }
  if (
    pago.value.cobramos === null ||
    pago.value.cobramos === undefined ||
    pago.value.cobramos === ""
  ) {
    //permitir que sea 0
    errors.value.cobramos = "El monto cobrado es obligatorio.";
    valid = false;
  }
  if (
    pago.value.pagamos === null ||
    pago.value.pagamos === undefined ||
    pago.value.pagamos === ""
  ) {
    //permitir que sea 0
    errors.value.pagamos = "El monto pagado es obligatorio.";
    valid = false;
  }
  if (!pago.value.fecha.trim()) {
    errors.value.fecha = "La fecha es obligatoria.";
    valid = false;
  }
  return valid;
};

const close = () => {
  emit("close");
};

const addDollarPrefix = (value) => {
  // Si está vacío o 0, no le agregamos nada
  if (!value) return value;
  if (typeof value === "string" && !value.startsWith("$")) {
    return "$" + value;
  }
  return value;
};

const save = async () => {
  //   console.log("pago.value.id_atendio", pago.value.id_atendio);
  // console.log("employees", employees);
  const selectedCliente = clientes.findIndex(
    (c) => c.id_cliente === pago.value.id_cliente
  );
  const selectedAtendio = employees.findIndex(
    (e) => String(e.id_usuario) === String(pago.value.id_atendio)
  );
  if (fechaSeleccionada.value) {
    pago.value.fecha = formatFechaHoraFullSQL(fechaSeleccionada.value);
  }
  if (validate()) {
    if (!pago.value.id) {
      console.log("new");
      pago.value.cliente = clientes[selectedCliente].nombre;
      pago.value.atendio = employees[selectedAtendio].nombre;
      pago.value.id =
        "C-" +
        new Date()
          .toLocaleString("sv-SE")
          .replace("T", "")
          .replace(/[-: ]/g, "");
      pago.value.isnew = true;
      console.log("trying to send, ", pago.value);

      await ps.addPagoConcepto(pago.value);
      emit("save", { ...pago.value });
    } else {
      console.log("edit");
      pago.value.cliente = clientes[selectedCliente].nombre;
      pago.value.atendio = employees[selectedAtendio].nombre;
      await ps.updatePagoConcepto(pago.value.id, pago.value);
      emit("save", { ...pago.value });
    }
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-content {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 26rem;
  padding: 1.5rem;
  position: relative;
  animation: slideDown 0.3s ease-out;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
