<template>
    <div
      class="kanban-card bg-white rounded-2xl shadow-lg p-4 mb-3 cursor-pointer border border-gray-300 hover:shadow-xl transition-all duration-300 flex items-start gap-3"
      draggable="true"
      @dragstart="dragStart($event, card)"
    >
      <!-- Miniatura de la tarjeta -->
      <img :src="card.image" alt="Miniatura" class="w-12 h-12 rounded-lg object-cover" />
  
      <div class="flex-1">
        <!-- Título de la tarjeta -->
        <h3 class="text-lg font-semibold text-gray-800">{{ card.title }}</h3>
  
        <!-- Descripción -->
        <p class="text-sm text-gray-600">{{ card.description }}</p>
  
        <!-- Estado e icono -->
        <div class="flex items-center mt-2">
          <span class="w-3 h-3 rounded-full" :class="statusColor"></span>
          <span class="ml-2 text-sm text-gray-700">{{ card.status }}</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { defineProps, computed } from 'vue';
  
  // Definimos las propiedades que recibe el componente, en este caso una tarjeta con más información.
  const props = defineProps({
    card: Object, // La tarjeta debe ser un objeto con 'id', 'title', 'description', 'image' y 'status'
  });
  
  // Función que se ejecuta cuando se inicia el arrastre de la tarjeta
  const dragStart = (event, card) => {
    event.dataTransfer.setData('text/plain', card.id);
  };
  
  // Computed para determinar el color del estado
  const statusColor = computed(() => {
    switch (props.card.status) {
      case 'Pendiente':
        return 'bg-yellow-500';
      case 'En progreso':
        return 'bg-blue-500';
      case 'Completado':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  });
  </script>
  