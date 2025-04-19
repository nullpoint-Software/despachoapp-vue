<!-- CardDetailMensual.vue -->
<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-content relative bg-gray-50">
        <!-- Encabezado -->
        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div>
            <h3 class="text-2xl font-bold text-black">
              <i class="pi pi-calendar text-3xl text-blue-500"></i>
              {{ pago.id ? "Editar Pago Mensual" : "Agregar Pago Mensual" }}
            </h3>
          </div>
        </div>

        <!-- Formulario -->
        <div class="space-y-4 px-4">
          <!-- Cliente -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Cliente</label>
            <InputText v-model="pago.cliente" class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el nombre del cliente" />
            <span v-if="errors.cliente" class="text-red-500 text-sm">{{
              errors.cliente
            }}</span>
          </div>

          <!-- Quien atendio -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Quien atendio</label>
            <div class="flex items-center">
              <img v-if="usuario.foto" :src="usuario.foto" alt="Foto" class="w-8 h-8 rounded-full mr-2" />
              <InputText v-model="pago.atendio" disabled class="p-2 border border-gray-300 rounded w-full"
                placeholder="Nombre del usuario" />
            </div>
            <span v-if="errors.atendio" class="text-red-500 text-sm">{{
              errors.atendio
            }}</span>
          </div>

          <!-- Honorarios -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Honorarios</label>
            <div class="flex">
              <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
              <InputText type="number" step="0.01" min="0" v-model="pago.honorarios"
                class="p-2 border border-gray-300 rounded-r focus:outline-none w-full"
                placeholder="Ingrese los honorarios" />
            </div>
            <span v-if="errors.honorarios" class="text-red-500 text-sm">{{
              errors.honorarios
            }}</span>
          </div>

          <!-- Mes y Año (texto, pero el user no quiso date) -->
          <div class="flex flex-col">
            <label class="font-semibold text-black">Mes y Año</label>
            <InputText v-model="pago.mes_ano" class="p-2 border border-gray-300 rounded" placeholder="MM/YYYY" />
            <span v-if="errors.mes_ano" class="text-red-500 text-sm">{{
              errors.mes_ano
            }}</span>
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
import { formatFechaMesAnoSQL, ps } from "@/service/adminApp/client";
const props = defineProps({
  pago: {
    type: Object,
    default: () => ({
      id: "",
      cliente: "",
      atendio: "",
      honorarios: "",
      mes_ano: "",
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
if (pago.value.atendio == "") { //por si es un registro nuevo se ocupa el nombre de user
  pago.value.atendio = localStorage.getItem("username");
  // pago.value.mes_ano = new Date().toLocaleString("sv-SE").replace('T', '')
  pago.value.mes_ano = formatFechaMesAnoSQL(new Date().toLocaleString("sv-SE").replace('T', ''))
} else {
  pago.value.mes_ano = formatFechaMesAnoSQL(pago.value.mes_ano);
}
const errors = ref({
  cliente: "",
  atendio: "",
  honorarios: "",
  mes_ano: "",
});

onMounted(() => {
  if (!pago.value.atendio.trim() && props.usuario.nombre) {
    pago.value.atendio = props.usuario.nombre;
  }
});

watch(
  () => props.pago,
  (newVal) => {
    pago.value = { ...newVal };
    errors.value = {
      cliente: "",
      atendio: "",
      honorarios: "",
      mes_ano: "",
    };
  }
);

/* VALIDACIÓN */
const validate = () => {
  let valid = true;
  errors.value = {
    cliente: "",
    atendio: "",
    honorarios: "",
    mes_ano: "",
  };
  if (!pago.value.cliente.trim()) {
    errors.value.cliente = "El cliente es obligatorio.";
    valid = false;
  }
  if (!pago.value.atendio.trim()) {
    errors.value.atendio = "El campo 'Quien atendio' es obligatorio.";
    valid = false;
  }
  if (!pago.value.honorarios) {
    errors.value.honorarios = "Los honorarios son obligatorios.";
    valid = false;
  }
  if (!pago.value.mes_ano.trim()) {
    errors.value.mes_ano = "El mes y año es obligatorio.";
    valid = false;
  }
  return valid;
};

const close = () => {
  emit("close");
};

const addDollarPrefix = (value) => {
  if (!value) return value;
  if (typeof value === "string" && !value.startsWith("$")) {
    return "$" + value;
  }
  return value;
};

const save = async () => {
  if (validate()) {
    if (!pago.value.id) {
      console.log("nuevo regist");
      if (pago.value.mes_ano && typeof pago.value.mes_ano === 'string') {
        const [mes, anio] = pago.value.mes_ano.split('/');
        if (mes && anio) {
          // Usar padStart por si el usuario mete '5/2020' sin el cero
          const mesFormateado = mes.padStart(2, '0');
          pago.value.mes_ano = `${anio}-${mesFormateado}-01 00:00:00`;
        }
      }
      try {
        pago.value.id = "M-" + new Date()
          .toLocaleString("sv-SE")
          .replace('T', '')
          .replace(/[-: ]/g, '');

        await ps.addPagoMensual(pago.value);
        emit("save", { ...pago.value });
      } catch (error) {
        console.log("error al guardar pago mensual", error);
      }
    }else {
      console.log("edit!");

      // Convertir 'mes_ano' de "MM/YYYY" a "YYYY-MM-01 00:00:00"
      if (pago.value.mes_ano && typeof pago.value.mes_ano === 'string') {
        const [mes, anio] = pago.value.mes_ano.split('/');
        if (mes && anio) {
          // Usar padStart por si el usuario mete '5/2020' sin el cero
          const mesFormateado = mes.padStart(2, '0');
          pago.value.mes_ano = `${anio}-${mesFormateado}-01 00:00:00`;
        }
      }

      try {
        await ps.updatePagoMensual(pago.value.id, pago.value);
        emit("save", { ...pago.value });
      } catch (error) {
        console.log("error al guardar pago mensual", error);
      }
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
