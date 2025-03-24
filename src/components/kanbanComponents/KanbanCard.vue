<!-- KanbanCard.vue -->
<template>
  <!-- Cambio: Se agregó el atributo id para identificar la tarjeta y permitir el scroll hacia ella -->
  <div
    :id="`card-${card.id}`"
    class="kanban-card bg-white rounded-2xl shadow-lg p-4 mb-3 cursor-pointer border border-gray-300 hover:shadow-xl transition-all duration-300 flex items-start gap-3"
    :class="{ highlighted: card.highlight }"
    draggable="true"
    @dragstart="dragStart($event, card)"
  >
    <!-- Cambio: Se agrega un placeholder si card.image es nula -->
    <img
      :src="card.image ? card.image : logo"
      alt="Miniatura"
      class="w-12 h-12 rounded-lg object-cover"
    />

    <div class="flex-1">
      <!-- Título de la tarjeta -->
      <h3 class="text-lg font-semibold text-gray-800">{{ card.titulo }}</h3>

      <!-- Descripción -->
      <p class="text-sm text-gray-600">{{ card.descripcion }}</p>

      <!-- Fechas -->
      <p class="text-xs text-gray-500 mt-1">Inicio: {{ formatFechaHoraSQL(card.fecha_creacion) }}</p>
      <p class="text-xs text-gray-500">Fin: {{ (card.fecha_vencimiento) ? formatFechaHoraSQL(card.fecha_vencimiento) : "N/A" }}</p>

      <!-- Estado e icono -->
      <div class="flex items-center mt-2">
        <span class="w-3 h-3 rounded-full" :class="statusColor"></span>
        <span class="ml-2 text-sm text-gray-700">{{ card.estado }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import defaultProfilePicture from '@/assets/img/WorkerHome.png'
import { defineProps, computed } from "vue";
import logo from '@/assets/img/logsymbolblack.png';
import { formatFechaHoraSQL } from "@/service/adminApp/client";
const props = defineProps({
  card: Object,
  highlight: Boolean, // Se deja para no eliminar nada del código original
  highlightedCard: {
    type: [Number, null],
    default: null,
  },
});

// Función para iniciar el drag and drop
const dragStart = (event, card) => {
  event.dataTransfer.setData("text/plain", card.id_tarea);
};

// Computa la clase del color según el status de la tarjeta
const statusColor = computed(() => {
  switch (props.card.estado) {
    case "Disponible":
      return "bg-green-300";
    case "Pendiente":
      return "bg-yellow-300";
    case "En Progreso":
      return "bg-blue-300";
    case "Terminado":
      return "bg-gray-300";
    default:
      return "bg-gray-400";
  }
});
</script>

<style scoped>
@keyframes pulseGlow {
  0% {
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(0, 102, 255, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(0, 102, 255, 0.5);
  }
}

.highlighted {
  animation: pulseGlow 1.5s infinite alternate; /* Animación para el resaltado */
  border-color: rgba(0, 102, 255, 0.8); /* Color de borde cuando se resalta */
}
</style>
