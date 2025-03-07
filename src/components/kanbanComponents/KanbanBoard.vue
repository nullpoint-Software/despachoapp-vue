<!-- KanbanBoard.vue -->
<template>
  <div class="p-4 relative">
    <!-- Buscador -->
    <div class="relative w-full max-w-lg mx-auto">
      <div
        class="flex items-center bg-gray-900 text-white rounded-full px-4 py-2 shadow-md"
      >
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar tareas..."
          class="bg-transparent flex-1 outline-none px-2 py-1 text-lg"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="text-gray-400 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      <ul
        v-if="searchQuery"
        class="absolute top-full left-0 w-full bg-gray-800 shadow-lg rounded-lg mt-2 z-10 text-white"
      >
        <li
          v-for="card in filteredCards"
          :key="card.id"
          @click="markCard(card.id)"
          class="flex items-center p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition"
        >
          <span
            class="w-5 h-5 rounded-full mr-3"
            :style="{ backgroundColor: getColumnColor(card.status) }"
          ></span>
          <span class="flex-1">{{ card.title }}</span>
        </li>
      </ul>
    </div>

    <!-- Kanban Board -->
    <!-- 
      Código original (comentado para no eliminar nada):
      <div class="kanban-board flex flex-col sm:flex-row gap-2 p-6 bg-transparent min-h-screen overflow-x-auto">
    -->
    <!-- 
      Reemplazamos por un grid que, dependiendo del tamaño de la pantalla, 
      muestra 1, 2 o 4 columnas:
        - Por defecto (móvil): 1 columna
        - sm (>=640px): 2 columnas
        - lg (>=1024px): 4 columnas
    -->
    <div
      class="kanban-board grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-6 bg-transparent min-h-screen overflow-x-auto"
    >
      <div v-for="status in columnStatuses" :key="status" class="flex flex-col">
        <!-- 
          NOTA: Conservamos "flex flex-col" aquí para que 
          el contenido interno (tarjetas) se apile verticalmente 
          dentro de cada columna 
        -->
        <!-- Columna con tarjetas paginadas -->
        <KanbanColumn
          :status="status"
          :cards="getPaginatedCardsByStatus(status)"
          :color="getColumnColor(status)"
          @moveCard="moveCard"
          :highlighted-card="highlightedCard"
        />

        <!-- Paginación en la parte inferior -->
        <div class="flex justify-center items-center mt-2 space-x-2">
          <button
            @click="changePage(status, currentPage[status] - 1)"
            :disabled="currentPage[status] === 0"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          <span class="px-4 py-2 bg-blue-500 rounded shadow">
            {{ currentPage[status] + 1 }}
          </span>
          <button
            @click="changePage(status, currentPage[status] + 1)"
            :disabled="currentPage[status] >= pages[status] - 1"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import KanbanColumn from "./KanbanColumn.vue";
import profilePicture from "@/assets/img/havatar.jpg";

// Se definen los estados/etiquetas de las columnas
const columnStatuses = ["Disponible", "Por Hacer", "En progreso", "Terminado"];
const statusOrder = ["Disponible", "Por Hacer", "En progreso", "Terminado"];
const cardsPerPage = 5;

// Control de páginas por cada estado
const currentPage = ref({
  Disponible: 0,
  "Por Hacer": 0,
  "En progreso": 0,
  Terminado: 0,
});

// Arreglo de tarjetas, cada una con "highlight: false" para el efecto de resaltado
const cards = ref([
  {
    id: 1,
    title: "Cita",
    description: "Cita con los asociados",
    status: "Disponible",
    startDate: "2024-03-05",
    endDate: "2024-03-06",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 2,
    title: "Revisión de documentos",
    description: "Verificar contratos",
    status: "Disponible",
    startDate: "2024-03-04",
    endDate: "2024-03-07",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 3,
    title: "Revisión técnica",
    description: "Analizar códigos",
    status: "Disponible",
    startDate: "2024-03-03",
    endDate: "2024-03-06",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 4,
    title: "Planificación",
    description: "Organizar actividades",
    status: "Disponible",
    startDate: "2024-03-02",
    endDate: "2024-03-08",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 5,
    title: "Charros",
    description: "Reunión con los charros",
    status: "Por Hacer",
    startDate: "2024-03-05",
    endDate: "2024-03-07",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 6,
    title: "Actualizar sistema",
    description: "Migrar a nueva versión",
    status: "Por Hacer",
    startDate: "2024-03-04",
    endDate: "2024-03-06",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 7,
    title: "Entrevistas",
    description: "Seleccionar nuevos miembros",
    status: "Por Hacer",
    startDate: "2024-03-03",
    endDate: "2024-03-09",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 8,
    title: "Toros",
    description: "Ajuste de cuentas",
    status: "En progreso",
    startDate: "2024-03-05",
    endDate: "2024-03-07",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 9,
    title: "Revisión de proyecto",
    description: "Verificar avances",
    status: "En progreso",
    startDate: "2024-03-04",
    endDate: "2024-03-06",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 10,
    title: "Carnaval",
    description: "Ir al carnaval",
    status: "Terminado",
    startDate: "2024-03-05",
    endDate: "2024-03-07",
    image: profilePicture,
    highlight: false,
  },
  {
    id: 11,
    title: "Entrega de informe",
    description: "Enviar reporte mensual",
    status: "Terminado",
    startDate: "2024-03-04",
    endDate: "2024-03-06",
    image: profilePicture,
    highlight: false,
  },
]);

// ID que se usaba para resaltar la tarjeta (se deja para no eliminar nada)
const highlightedCard = ref(null);

// Calcula cuántas páginas hay para cada columna
const pages = computed(() => {
  const result = {};
  columnStatuses.forEach((status) => {
    const total = cards.value.filter((card) => card.status === status).length;
    result[status] = Math.ceil(total / cardsPerPage);
  });
  return result;
});

// Retorna las tarjetas filtradas y paginadas por status
const getPaginatedCardsByStatus = (status) => {
  const filtered = cards.value
    .filter((card) => card.status === status)
    .sort((a, b) => a.id - b.id);
  const start = currentPage.value[status] * cardsPerPage;
  return filtered.slice(start, start + cardsPerPage);
};

// Cambia de página dentro de una columna dada
const changePage = (status, newPage) => {
  if (newPage >= 0 && newPage < pages.value[status]) {
    currentPage.value[status] = newPage;
  }
};

// Mueve la tarjeta de un status a otro
const moveCard = (cardId, newStatus) => {
  const card = cards.value.find((card) => card.id === cardId);
  if (card) {
    const currentIndex = statusOrder.indexOf(card.status);
    const newIndex = statusOrder.indexOf(newStatus);
    if (newIndex > currentIndex) {
      card.status = newStatus;
      currentPage.value[newStatus] = 0;
    }
  }
};

// Devuelve el color de la columna según su status
const getColumnColor = (status) => {
  const colors = {
    Disponible: "#A7F3D0",
    "Por Hacer": "#FCD34D",
    "En progreso": "#93C5FD",
    Terminado: "#D1D5DB",
  };
  return colors[status] || "#FFFFFF";
};

// Al hacer clic en un resultado del buscador, resalta la tarjeta y cambia a la página adecuada
const markCard = (cardId) => {
  const card = cards.value.find((c) => c.id === cardId);
  if (card) {
    // Activa el highlight en la tarjeta
    card.highlight = true;

    // Se deja para no eliminar nada
    highlightedCard.value = cardId;

    // Determina en qué página está la tarjeta
    const status = card.status;
    const index = cards.value
      .filter((c) => c.status === status)
      .findIndex((c) => c.id === cardId);
    currentPage.value[status] = Math.floor(index / cardsPerPage);

    // Desactiva el resaltado después de 3 segundos
    setTimeout(() => {
      card.highlight = false;
    }, 3000);
  }
};

// Campo de búsqueda
const searchQuery = ref("");
// Retorna las tarjetas que coinciden con el texto ingresado
const filteredCards = computed(() => {
  return cards.value.filter((card) =>
    card.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});
</script>
