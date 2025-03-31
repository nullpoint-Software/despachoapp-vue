<!-- CardDetailHistorial.vue -->
<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-content relative bg-gray-50">
        <!-- Encabezado -->
        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div>
            <h3 class="text-2xl font-bold text-black">
              <i class="pi pi-calendar text-3xl text-blue-500"></i>
              {{ registro.cliente ? 'Editar Registro Historial' : 'Agregar Registro Historial' }}
            </h3>
          </div>
        </div>

        <!-- Formulario -->
        <div class="space-y-4 px-4">
          <!-- Cliente -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Cliente</label>
            <InputText
              v-model="registro.cliente"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el nombre del cliente"
            />
            <span v-if="errors.cliente" class="text-red-500 text-sm">{{ errors.cliente }}</span>
          </div>

          <!-- Quien atendio -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Quien atendio</label>
            <div class="flex items-center">
              <img
                v-if="usuario.foto"
                :src="usuario.foto"
                alt="Foto"
                class="w-8 h-8 rounded-full mr-2"
              />
              <InputText
                v-model="registro.quienAtendio"
                disabled
                class="p-2 border border-gray-300 rounded w-full"
                placeholder="Nombre del usuario"
              />
            </div>
            <span v-if="errors.quienAtendio" class="text-red-500 text-sm">{{ errors.quienAtendio }}</span>
          </div>

          <!-- Fecha con Calendar -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Fecha</label>
            <Calendar
              v-model="fechaSeleccionada"
              dateFormat="dd/mm/yy"
              showIcon
              placeholder="Selecciona la fecha"
              class="w-full border border-gray-300 rounded focus:outline-none"
            />
            <span v-if="errors.fecha" class="text-red-500 text-sm">{{ errors.fecha }}</span>
          </div>

          <!-- Cantidad -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Cantidad</label>
            <div class="flex">
              <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
              <InputText
                type="number"
                step="0.01"
                min="0"
                v-model="registro.cantidad"
                class="p-2 border border-gray-300 rounded-r focus:outline-none w-full"
                placeholder="Ingrese la cantidad"
              />
            </div>
            <span v-if="errors.cantidad" class="text-red-500 text-sm">{{ errors.cantidad }}</span>
          </div>

          <!-- Tipo -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Tipo</label>
            <InputText
              v-model="registro.tipo"
              class="p-2 border border-gray-300 rounded"
              placeholder="Cobro, pago, mensualidad..."
            />
            <span v-if="errors.tipo" class="text-red-500 text-sm">{{ errors.tipo }}</span>
          </div>
        </div>

        <!-- Botones -->
        <div class="flex justify-end space-x-6 mt-6 px-4">
          <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="close" />
          <Button label="Guardar" icon="pi pi-check" class="p-button-primary" @click="save" />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Calendar from "primevue/calendar";

const props = defineProps({
  registro: {
    type: Object,
    default: () => ({
      id: "",
      cliente: "",
      quienAtendio: "",
      fecha: "",
      cantidad: "",
      tipo: "",
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

const registro = ref({ ...props.registro });
const errors = ref({
  cliente: "",
  quienAtendio: "",
  fecha: "",
  cantidad: "",
  tipo: "",
});

// Calendar usa un ref Date
const fechaSeleccionada = ref(null);

// Al montar, si no hay fecha, la ponemos hoy
onMounted(() => {
  if (!registro.value.fecha) {
    const hoy = new Date();
    registro.value.fecha = formatoFecha(hoy);
  }
  if (!registro.value.quienAtendio.trim() && props.usuario.nombre) {
    registro.value.quienAtendio = props.usuario.nombre;
  }
  fechaSeleccionada.value = aDate(registro.value.fecha);
});

watch(() => props.registro, (newVal) => {
  registro.value = { ...newVal };
  errors.value = {
    cliente: "",
    quienAtendio: "",
    fecha: "",
    cantidad: "",
    tipo: "",
  };
  fechaSeleccionada.value = aDate(newVal.fecha);
});

/* Funciones de fecha */
function formatoFecha(fecha) {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}
function aDate(cadena) {
  if (!cadena) return null;
  const [dia, mes, anio] = cadena.split("/");
  if (!dia || !mes || !anio) return null;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

/* VALIDACIÓN */
const validate = () => {
  let valid = true;
  errors.value = {
    cliente: "",
    quienAtendio: "",
    fecha: "",
    cantidad: "",
    tipo: "",
  };
  if (!registro.value.cliente.trim()) {
    errors.value.cliente = "El cliente es obligatorio.";
    valid = false;
  }
  if (!registro.value.quienAtendio.trim()) {
    errors.value.quienAtendio = "El campo 'quien atendio' es obligatorio.";
    valid = false;
  }
  if (!registro.value.fecha.trim()) {
    errors.value.fecha = "La fecha es obligatoria.";
    valid = false;
  }
  if (!registro.value.cantidad) {
    errors.value.cantidad = "La cantidad es obligatoria.";
    valid = false;
  }
  if (!registro.value.tipo.trim()) {
    errors.value.tipo = "El tipo es obligatorio.";
    valid = false;
  }
  return valid;
};

const close = () => {
  emit("close");
};

const addDollarPrefix = (value) => {
  if (!value) return value;
  if (typeof value === "string" && !value.startsWith('$')) {
    return '$' + value;
  }
  return value;
};

const save = () => {
  if (fechaSeleccionada.value) {
    registro.value.fecha = formatoFecha(fechaSeleccionada.value);
  }
  if (validate()) {
    registro.value.cantidad = addDollarPrefix(registro.value.cantidad);
    emit("save", { ...registro.value });
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
