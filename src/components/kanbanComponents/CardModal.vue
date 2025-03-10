<template>
    <div class="fixed inset-0 flex items-center justify-center z-50">
      <!-- Overlay semitransparente, al hacer clic cierra el modal -->
      <div class="absolute inset-0 bg-black opacity-50" @click="close"></div>
      <!-- Contenedor del modal -->
      <div class="bg-white rounded-lg shadow-lg z-10 w-11/12 md:w-1/2 p-6 relative">
        <!-- Botón de cierre -->
        <button @click="close" class="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-2xl">
          &times;
        </button>
        <h2 class="text-xl font-bold mb-4">{{ card.title }}</h2>
        <p class="mb-2"><strong>Descripción:</strong> {{ card.descripcion }}</p>
        <p class="mb-2"><strong>Estado:</strong> {{ card.estado }}</p>
        <p class="mb-2"><strong>Inicio:</strong> {{ card.fecha_creacion }}</p>
        <p class="mb-2"><strong>Fin:</strong> {{ card.fencha_vencimiento }}</p>
        <img v-if="card.image" :src="card.image" alt="Imagen" class="w-full h-auto rounded mt-4" />
      </div>
    </div>
  </template>
  
  <script setup>
  import { defineProps, defineEmits } from 'vue';
  
  const props = defineProps({
    card: { type: Object, required: true }
  });
  const emit = defineEmits(['close']);
  
  const close = () => {
    emit('close');
  };
  </script>
  
  <style scoped>
  /* Puedes agregar estilos adicionales aquí si lo necesitas */
  </style>
  