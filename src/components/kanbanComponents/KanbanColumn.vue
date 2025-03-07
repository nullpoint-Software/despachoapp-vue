<template>
  <div
    class="kanban-column bg-gray-100 shadow-lg rounded-xl p-4 flex-1 mx-2 min-w-[250px] max-w-sm"
    @dragover.prevent
    @drop="drop($event)"
  >
    <!-- Encabezado de la columna con color dinámico -->
    <h2 
      class="font-bold text-lg text-gray-800 py-2 px-4 rounded-md text-center shadow"
      :style="{ backgroundColor: color }"
    >
      {{ status }}
    </h2>

    <!-- Contenedor de tarjetas -->
    <div class="mt-3 space-y-3">
      <KanbanCard v-for="card in cards" :key="card.id" :card="card" />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import KanbanCard from './KanbanCard.vue';

// Propiedades que recibe el componente
const props = defineProps({
status: String, // Nombre de la columna
cards: Array, // Lista de tarjetas asociadas a la columna
color: String // Color de fondo del encabezado
});

// Evento para mover tarjetas entre columnas
const emit = defineEmits(['moveCard']);

// Función que maneja la acción de soltar una tarjeta en la columna
const drop = event => {
const cardId = event.dataTransfer.getData('text/plain');
emit('moveCard', parseInt(cardId, 10), props.status);
};
</script>
