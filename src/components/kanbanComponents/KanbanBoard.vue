<template>
  <div class="p-4 relative">
    <!-- Buscador -->
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar tareas..."
        class="p-2 border border-gray-300 rounded w-full mb-4"
      />
      <ul
        v-if="searchQuery"
        class="absolute top-full left-0 w-full bg-gray-200 shadow-md rounded mt-1 z-10 text-black"
      >
        <li
          v-for="card in filteredCards"
          :key="card.id_tarea"
          @click="markCard(card.id_tarea)"
          class="flex justify-between p-2 border-b cursor-pointer hover:bg-gray-200"
        >
          <span>{{ card.titulo }}</span>
          <span
            :class="{
              'text-green-900': card.estado === 'Terminado',
              'text-red-900': card.estado !== 'Terminado',
            }"
          >
            {{ card.estado === "Terminado" ? "Completado" : "Pendiente" }}
          </span>
        </li>
      </ul>
    </div>

    <!-- Kanban Board -->
    <div
      class="kanban-board flex flex-col sm:flex-row gap-2 p-6 bg-transparent min-h-screen overflow-x-auto"
    >
      <KanbanColumn
        v-for="estado in columnStatuses"
        :key="estado"
        :status="estado"
        :cards="filteredCards.filter((card) => card.estado === estado)"
        @moveCard="moveCard"
        class="flex-shrink-0 w-80"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import KanbanColumn from "./kanbanColumn.vue";
import profilePicture from "@/assets/img/havatar.jpg";
import { ts } from "@/service/adminApp/client";

const cards = ref(await ts.getTareas());
console.log("cards", cards);

// Lista de tarjetas con sus respectivos estados
// const cards = ref([
//   { id: 1, title: 'Cita', description: 'Cita con los asociados', status: 'Disponible', marked: false, image:profilePicture },
//   { id: 2, title: 'Charros', description: 'Reunion con los charros', status: 'Por Hacer', marked: false, image:profilePicture  },
//   { id: 3, title: 'Toros', description: 'Ajuste de cuentas', status: 'En progreso', marked: false, image:profilePicture  },
//   { id: 4, title: 'Carnaval', description: 'Ir al carnaval', status: 'Terminado', marked: false, image:profilePicture  },
// ]);

// Estados disponibles para las columnas
const columnStatuses = ["Disponible", "Pendiente", "En Progreso", "Terminado"];

// Buscador de tareas
const searchQuery = ref("");
const filteredCards = computed(() => {
  const seen = new Set();
  return cards.value.filter((card) => {
    const matchesSearchQuery = card.titulo
      .toLowerCase()
      .includes(searchQuery.value.toLowerCase());
    const isUnique = !seen.has(card.id_tarea);
    if (matchesSearchQuery && isUnique) {
      seen.add(card.id_tarea);
      return true;
    }
    return false;
  });
});

// Función para mover tarjetas entre columnas
const moveCard = (cardId, newStatus) => {
  const card = cards.value.find((card) => card.id_tarea === cardId);
  if (card) {
    card.estado = newStatus;
  }
};

// Marcar tarjeta seleccionada
const markCard = (cardId) => {
  cards.value.forEach((card) => {
    card.marked = card.id_tarea === cardId;
  });
};
</script>

<style>
.marked {
  border: 2px solid blue;
  background-color: rgba(0, 0, 255, 0.1);
}
</style>
