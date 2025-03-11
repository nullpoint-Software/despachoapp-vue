<!-- KanbanColumn.vue -->
<template>
  <div class="kanban-column bg-gray-100 shadow-lg rounded-xl p-4 flex-1 mx-2 min-w-[250px] max-w-sm" @dragover.prevent @drop="drop($event)">
    <!-- Encabezado de la columna -->
    <h2 class="font-bold text-lg text-gray-800 py-2 px-4 rounded-md text-center shadow" :style="{ backgroundColor: color }">
      {{ status }}
    </h2>
    <!-- Contenedor de tarjetas -->
    <div class="mt-3 space-y-3">
      <div v-for="card in cards" :key="card.id" @click="handleCardClick(card)" :id="`card-${card.id}`">
        <KanbanCard :card="card" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import KanbanCard from './KanbanCard.vue';

const props = defineProps({
  status: String,
  cards: Array,
  color: String,
});

const emit = defineEmits(['moveCard', 'viewDetails']);

const drop = event => {
  const cardId = event.dataTransfer.getData('text/plain');
  emit('moveCard', parseInt(cardId, 10), props.status);
};

const handleCardClick = (card) => {
  emit('viewDetails', card);
};
</script>
