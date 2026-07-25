<template>
  <transition name="fade">
    <!-- Modal Overlay que cierra al dar clic fuera -->
    <div class="modal-overlay" @click.self="close">
      <!-- Contenedor del Modal (se usa el estilo del CardDetail de referencia) -->
      <div class="modal-content relative bg-gray-50">
        <!-- Quité el botón de cierre interno según lo solicitado -->
        <!-- Encabezado -->
        <div class="standard-modal-header flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <button type="button" class="standard-modal-close" aria-label="Cerrar" @click="close">×</button>
          <i class="pi pi-user-edit text-3xl text-blue-500"></i>
          <h3 class="text-2xl font-bold text-black">
            {{ customer.id_cliente ? 'Editar Cliente' : 'Agregar Cliente' }}
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
              maxlength="13"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el RFC"
              @input="normalizeRfcInput"
            />
            <span v-if="errors.rfc" class="text-red-500 text-sm">{{ errors.rfc }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Régimen fiscal</label>
            <AppSelect
              v-model="customer.regimen_fiscal"
              :options="regimenesFiscales"
              option-label="label"
              option-value="value"
              placeholder="Selecciona el régimen"
            />
            <span v-if="errors.regimen_fiscal" class="text-red-500 text-sm">{{ errors.regimen_fiscal }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Contraseña FIEL</label>
            <InputText
              v-model="customer.fiel"
              type="password"
              autocomplete="new-password"
              class="p-2 border border-gray-300 rounded"
              :placeholder="customer.id_cliente ? 'Deja vacío para conservarla' : 'Ingrese la contraseña FIEL'"
            />
            <small v-if="customer.id_cliente" class="text-gray-600">Sólo escribe una nueva contraseña si deseas reemplazarla.</small>
            <span v-if="errors.fiel" class="text-red-500 text-sm">{{ errors.fiel }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Contraseña CIECF</label>
            <InputText
              v-model="customer.ciecf"
              type="password"
              autocomplete="new-password"
              class="p-2 border border-gray-300 rounded"
              :placeholder="customer.id_cliente ? 'Deja vacío para conservarla' : 'Ingrese la contraseña CIECF'"
            />
            <small v-if="customer.id_cliente" class="text-gray-600">Sólo escribe una nueva contraseña si deseas reemplazarla.</small>
            <span v-if="errors.ciecf" class="text-red-500 text-sm">{{ errors.ciecf }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Teléfono</label>
            <InputText
              v-model="customer.telefono"
              type="tel"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el telefono"
            />
            <span v-if="errors.telefono" class="text-red-500 text-sm">{{ errors.telefono }}</span>
          </div>
          <div class="flex flex-col">
            <label class="font-semibold text-black">Email</label>
            <InputText
              v-model="customer.email"
              type="email"
              class="p-2 border border-gray-300 rounded"
              placeholder="Ingrese el email"
            />
            <span v-if="errors.email" class="text-red-500 text-sm">{{ errors.email }}</span>
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
import InputText from "@/components/ui/AppInput.vue";
import Button from "@/components/ui/AppButton.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { regimenesFiscales } from "@/constants/regimenesFiscales";

const props = defineProps({
  customer: {
    type: Object,
    default: () => ({
      id_cliente: "",
      nombre: "",
      rfc: "",
      regimen_fiscal: "",
      fiel: "",
      ciecf: "",
      telefono: "",
      email: "",
    }),
  },
});
const emit = defineEmits(["close", "save"]);

const customer = ref({ ...props.customer });
const errors = ref({
  nombre: "",
  rfc: "",
  regimen_fiscal: "",
  fiel: "",
  ciecf: "",
  telefono: "",
  email: "",
});

watch(() => props.customer, (newVal) => {
  customer.value = { ...newVal };
  errors.value = { nombre: "", rfc: "", regimen_fiscal: "", fiel: "", ciecf: "", telefono: "", email: "" };
});

const validate = () => {
  let valid = true;
  errors.value = { nombre: "", rfc: "", regimen_fiscal: "", fiel: "", ciecf: "", telefono: "", email: "" };

  if (!customer.value.nombre.trim()) {
    errors.value.nombre = "El nombre es obligatorio.";
    valid = false;
  }
  if (!customer.value.rfc.trim()) {
    errors.value.rfc = "El RFC es obligatorio.";
    valid = false;
  } else if (!/^[A-Z0-9&Ñ]{12,13}$/.test(customer.value.rfc.trim().toUpperCase())) {
    errors.value.rfc = "El RFC debe tener 12 o 13 caracteres válidos.";
    valid = false;
  }
  if (!customer.value.regimen_fiscal) {
    errors.value.regimen_fiscal = "Selecciona el régimen fiscal.";
    valid = false;
  }
  if (!customer.value.id_cliente && !customer.value.fiel.trim()) {
    errors.value.fiel = "La contraseña FIEL es obligatoria.";
    valid = false;
  }
  if (!customer.value.id_cliente && !customer.value.ciecf.trim()) {
    errors.value.ciecf = "La contraseña CIECF es obligatoria.";
    valid = false;
  }
  const telefonoPattern = /^[0-9\s\-\(\)]+$/;
  if (!customer.value.telefono.trim() || !telefonoPattern.test(customer.value.telefono)) {
    errors.value.telefono = "telefono inválido.";
    valid = false;
  }
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!customer.value.email.trim() || !emailPattern.test(customer.value.email)) {
    errors.value.email = "email electrónico inválido.";
    valid = false;
  }
  return valid;
};

const normalizeRfcInput = () => {
  customer.value.rfc = String(customer.value.rfc || "")
    .trim()
    .toUpperCase()
    .slice(0, 13);
};

const close = () => {
  emit("close");
};

const save = () => {
  normalizeRfcInput();
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
