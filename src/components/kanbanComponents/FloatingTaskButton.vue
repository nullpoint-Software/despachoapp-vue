<template>
  <!-- Botón flotante para añadir tarea -->
  <button
    @click="$emit('click')"
    class="fixed bottom-4 right-4 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg z-20 transition transform hover:scale-110 
           w-14 h-14 flex items-center justify-center" 
    aria-label="Añadir tarea"
  >
    <i class="pi pi-plus text-2xl"></i>
  </button>
</template>

<script setup>
// No se requiere lógica adicional aquí.
</script>

<style scoped>
/* Se agregó transition y transform en la clase del botón para animación de escala al hacer hover */

button {
  /* Se define una transición suave para transformaciones y cambios de color */
  transition: transform 0.3s ease, background-color 0.3s ease;
  /* Se añade una animación de pulso para llamar la atención del usuario */
  animation: pulse 3s infinite;
}

/* Animación de pulso: aumenta y reduce la escala suavemente */
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* Puedes agregar estilos personalizados si es necesario */
</style>
