<template>
  <transition name="fade">
    <!-- Modal Overlay que cierra al dar clic fuera -->
    <div class="modal-overlay" @click.self="close">
      <!-- Contenedor del Modal (se usa el estilo del CardDetail de referencia) -->
      <div class="modal-content relative bg-gray-50">
        <!-- Quité el botón de cierre interno según lo solicitado -->
        <!-- Encabezado -->
        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <i class="pi pi-user-edit text-3xl text-blue-500"></i>
          <h3 class="text-2xl font-bold text-black">
            {{ customer.nombre ? 'Editar Cliente' : 'Agregar Cliente' }}
          </h3>
        </div>
        <!-- Formulario -->
        <div class="space-y-4 px-4">
          <div class="flex flex-col">
            <label class="font-semibold text-black">Nombre Cliente</label>
            <InputText
              v-model="customer.nombre"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el nombre"
            />
            <span v-if="errors.nombre" class="text-red-500 text-sm">{{ errors.nombre }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">RFC</label>
            <InputText
              v-model="customer.rfc"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el RFC"
            />
            <span v-if="errors.rfc" class="text-red-500 text-sm">{{ errors.rfc }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Contraseña FIEL</label>
            <InputText
              v-model="customer.fiel"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese la contraseña FIEL"
            />
            <span v-if="errors.fiel" class="text-red-500 text-sm">{{ errors.fiel }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Contraseña CLECF</label>
            <InputText
              v-model="customer.clecf"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese la contraseña CLECF"
            />
            <span v-if="errors.clecf" class="text-red-500 text-sm">{{ errors.clecf }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Celular</label>
            <InputText
              v-model="customer.celular"
              type="tel"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el celular"
            />
            <span v-if="errors.celular" class="text-red-500 text-sm">{{ errors.celular }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Correo Electrónico</label>
            <InputText
              v-model="customer.correo"
              type="email"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el correo"
            />
            <span v-if="errors.correo" class="text-red-500 text-sm">{{ errors.correo }}</span>
          </div>
        </div>
        <!-- Footer: botones -->
        <div class="flex justify-end space-x-6 mt-6 px-4">
          <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="close" />
          <Button label="Guardar" icon="pi pi-check" class="p-button-primary" @click="save" />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from "vue";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

const props = defineProps({
  customer: {
    type: Object,
    default: () => ({
      id: "",
      nombre: "",
      rfc: "",
      fiel: "",
      clecf: "",
      celular: "",
      correo: "",
    }),
  },
});
const emit = defineEmits(["close", "save"]);

const customer = ref({ ...props.customer });
const errors = ref({
  nombre: "",
  rfc: "",
  fiel: "",
  clecf: "",
  celular: "",
  correo: "",
});

watch(() => props.customer, (newVal) => {
  customer.value = { ...newVal };
  errors.value = { nombre: "", rfc: "", fiel: "", clecf: "", celular: "", correo: "" };
});

const validate = () => {
  let valid = true;
  errors.value = { nombre: "", rfc: "", fiel: "", clecf: "", celular: "", correo: "" };

  if (!customer.value.nombre.trim()) {
    errors.value.nombre = "El nombre es obligatorio.";
    valid = false;
  }
  if (!customer.value.rfc.trim()) {
    errors.value.rfc = "El RFC es obligatorio.";
    valid = false;
  }
  if (!customer.value.fiel.trim()) {
    errors.value.fiel = "La contraseña FIEL es obligatoria.";
    valid = false;
  }
  if (!customer.value.clecf.trim()) {
    errors.value.clecf = "La contraseña CLECF es obligatoria.";
    valid = false;
  }
  const celularPattern = /^[0-9\s\-\(\)]+$/;
  if (!customer.value.celular.trim() || !celularPattern.test(customer.value.celular)) {
    errors.value.celular = "Celular inválido.";
    valid = false;
  }
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!customer.value.correo.trim() || !emailPattern.test(customer.value.correo)) {
    errors.value.correo = "Correo electrónico inválido.";
    valid = false;
  }
  return valid;
};

const close = () => {
  emit("close");
};

const save = () => {
  if (validate()) {
    emit("save", { ...customer.value });
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
