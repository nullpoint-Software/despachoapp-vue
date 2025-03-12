<template>
    <!-- Botón flotante para añadir tarea -->
    <button
      @click="$emit('click')"
      class="fixed bottom-4 right-4 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg z-20"
      aria-label="Añadir tarea"
    >
      <i class="pi pi-plus text-2xl"></i>
    </button>
  </template>
  
  <script setup>
  // No se requiere lógica adicional aquí.
  </script>
  
  <style scoped>
  /* Puedes agregar estilos personalizados si es necesario */
  </style>
  