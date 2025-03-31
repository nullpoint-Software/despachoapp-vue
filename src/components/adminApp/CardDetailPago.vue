<!-- CardDetailPago.vue -->
<template>
    <transition name="fade">
      <div class="modal-overlay" @click.self="close">
        <div class="modal-content relative bg-gray-50">
          <!-- Encabezado, mostrando datos del usuario -->
          <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
            <div>
              <h3 class="text-2xl font-bold text-black">
                <i class="pi pi-receipt text-3xl text-blue-500"></i>
                {{ pago.nombreCompleto ? 'Editar pago' : 'Agregar pago' }}
              </h3>
            </div>
          </div>
  
          <!-- Formulario -->
          <div class="space-y-4 px-4">
            <!-- Nombre completo -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Nombre completo</label>
              <InputText
                v-model="pago.nombreCompleto"
                class="p-2 border border-gray-300 rounded"
                placeholder="Ingrese el nombre completo"
              />
              <span v-if="errors.nombreCompleto" class="text-red-500 text-sm">{{ errors.nombreCompleto }}</span>
            </div>
            <!-- Asunto o trámite -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Asunto o trámite</label>
              <InputText
                v-model="pago.asunto"
                class="p-2 border border-gray-300 rounded"
                placeholder="Ingrese el asunto o trámite"
              />
              <span v-if="errors.asunto" class="text-red-500 text-sm">{{ errors.asunto }}</span>
            </div>
            <!-- Quien atendió (deshabilitado, con imagen del usuario al inicio) -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Quien atendió</label>
              <div class="flex items-center">
                <img
                  v-if="usuario.foto"
                  :src="usuario.foto"
                  alt="Foto"
                  class="w-8 h-8 rounded-full mr-2"
                />
                <InputText
                  v-model="pago.quienAtendio"
                  disabled
                  class="p-2 border border-gray-300 rounded w-full"
                  placeholder="Nombre del usuario"
                />
              </div>
              <span v-if="errors.quienAtendio" class="text-red-500 text-sm">{{ errors.quienAtendio }}</span>
            </div>
            <!-- Campo 'cobramos' con prefijo "$" -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Cobramos</label>
              <div class="flex">
                <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
                <InputText
                  v-model="pago.cobramos"
                  @input="onMoneyInput('cobramos')"
                  @blur="onMoneyBlur('cobramos')"
                  class="p-2 border border-gray-300 rounded-r focus:outline-none"
                  placeholder="Ingrese el monto cobrado"
                />
              </div>
              <span v-if="errors.cobramos" class="text-red-500 text-sm">{{ errors.cobramos }}</span>
            </div>
            <!-- Campo 'pagamos' con prefijo "$" -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Pagamos</label>
              <div class="flex">
                <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
                <InputText
                  v-model="pago.pagamos"
                  @input="onMoneyInput('pagamos')"
                  @blur="onMoneyBlur('pagamos')"
                  class="p-2 border border-gray-300 rounded-r focus:outline-none"
                  placeholder="Ingrese el monto pagado"
                />
              </div>
              <span v-if="errors.pagamos" class="text-red-500 text-sm">{{ errors.pagamos }}</span>
            </div>
            <!-- Campo 'saldo' con prefijo "$" -->
            <div class="flex flex-col">
              <label class="font-semibold text-black">Saldo</label>
              <div class="flex">
                <span class="inline-flex items-center px-2 bg-gray-200 text-gray-600 rounded-l">$</span>
                <InputText
                  v-model="pago.saldo"
                  @input="onMoneyInput('saldo')"
                  @blur="onMoneyBlur('saldo')"
                  class="p-2 border border-gray-300 rounded-r focus:outline-none"
                  placeholder="Ingrese el saldo"
                />
              </div>
              <span v-if="errors.saldo" class="text-red-500 text-sm">{{ errors.saldo }}</span>
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
  import { ref, watch, defineProps, defineEmits } from "vue";
  import InputText from "primevue/inputtext";
  import Button from "primevue/button";
  
  const props = defineProps({
    pago: {
      type: Object,
      default: () => ({
        id: "",
        nombreCompleto: "",
        asunto: "",
        quienAtendio: "",
        cobramos: "",
        pagamos: "",
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
    nombreCompleto: "",
    asunto: "",
    quienAtendio: "",
    cobramos: "",
    pagamos: "",
    saldo: "",
  });
  
  watch(() => props.pago, (newVal) => {
    pago.value = { ...newVal };
    errors.value = {
      nombreCompleto: "",
      asunto: "",
      quienAtendio: "",
      cobramos: "",
      pagamos: "",
      saldo: "",
    };
  });
  
  /* VALIDACIÓN */
  const validate = () => {
    let valid = true;
    errors.value = {
      nombreCompleto: "",
      asunto: "",
      quienAtendio: "",
      cobramos: "",
      pagamos: "",
      saldo: "",
    };
  
    if (!pago.value.nombreCompleto.trim()) {
      errors.value.nombreCompleto = "El nombre completo es obligatorio.";
      valid = false;
    }
    if (!pago.value.asunto.trim()) {
      errors.value.asunto = "El asunto o trámite es obligatorio.";
      valid = false;
    }
    if (!pago.value.quienAtendio.trim()) {
      errors.value.quienAtendio = "El campo 'quien atendió' es obligatorio.";
      valid = false;
    }
    if (!pago.value.cobramos.trim()) {
      errors.value.cobramos = "El monto cobrado es obligatorio.";
      valid = false;
    }
    if (!pago.value.pagamos.trim()) {
      errors.value.pagamos = "El monto pagado es obligatorio.";
      valid = false;
    }
    if (!pago.value.saldo.trim()) {
      errors.value.saldo = "El saldo es obligatorio.";
      valid = false;
    }
    return valid;
  };
  
  /* FORMATEO DE MONTO (SOLO NÚMEROS Y DECIMALES) */
  const onMoneyInput = (field) => {
    pago.value[field] = pago.value[field].replace(/[^0-9.]/g, '');
    const parts = pago.value[field].split('.');
    if (parts.length > 2) {
      pago.value[field] = parts[0] + '.' + parts.slice(1).join('');
    }
  };
  
  const onMoneyBlur = (field) => {
    const num = parseFloat(pago.value[field]);
    if (!isNaN(num)) {
      // Formatea con separador de miles y hasta 2 decimales
      pago.value[field] = num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
  };
  
  /* AGREGA EL SIGNO DE $ SOLO AL INICIO (SI NO EXISTE) */
  const addDollarPrefix = (value) => {
    if (typeof value === 'string' && !value.startsWith('$')) {
      return '$' + value;
    }
    return value;
  };
  
  /* CIERRE DEL MODAL */
  const close = () => {
    emit("close");
  };
  
  /* GUARDAR */
  const save = () => {
    if (validate()) {
      // Al guardar, se asegura que los campos monetarios tengan $ al inicio
      pago.value.cobramos = addDollarPrefix(pago.value.cobramos);
      pago.value.pagamos = addDollarPrefix(pago.value.pagamos);
      pago.value.saldo = addDollarPrefix(pago.value.saldo);
      emit("save", { ...pago.value });
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
  