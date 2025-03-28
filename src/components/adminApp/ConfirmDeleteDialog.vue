<template>
    <transition name="fade">
      <!-- Overlay: se cierra al dar clic fuera -->
      <div class="modal-overlay" @click.self="cancel">
        <div class="modal-content relative bg-gray-50">
          <!-- Botón de cierre -->
          <button
            @click="cancel"
            class="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-3xl focus:outline-none"
          >
            &times;
          </button>
          <!-- Encabezado -->
          <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
            <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
            <h3 class="text-2xl font-bold text-gray-800">Confirmar Eliminación</h3>
          </div>
          <!-- Mensaje y checkbox -->
          <div class="mb-6 px-4">
            <p class="text-center text-gray-700 mb-4">
              ¿Estás seguro de eliminar este Elemento? Marca la casilla para confirmar.
            </p>
            <div class="flex items-center justify-center">
              <input type="checkbox" id="confirmDelete" v-model="agreed" class="mr-2" />
              <label for="confirmDelete" class="text-gray-700 font-medium">
                Estoy de acuerdo
              </label>
            </div>
          </div>
          <!-- Footer: botones -->
          <div class="flex justify-end space-x-6 px-4">
            <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="cancel" />
            <Button label="Confirmar" icon="pi pi-check" class="p-button-danger" :disabled="!agreed" @click="confirm" />
          </div>
        </div>
      </div>
    </transition>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import Button from 'primevue/button';
  
  const agreed = ref(false);
  const emit = defineEmits(['confirm', 'cancel']);
  
  const confirm = () => {
    if (agreed.value) {
      emit('confirm');
      agreed.value = false;
    }
  };
  
  const cancel = () => {
    emit('cancel');
    agreed.value = false;
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
  