<!-- KanbanBoard.vue -->
<template>
  <div class="p-4 relative">
    <!-- Buscador -->
    <div class="relative w-full max-w-lg mx-auto">
      <div class="flex items-center bg-gray-900 text-white rounded-full px-4 py-2 shadow-md">
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
          :key="card.id_tarea"
          @click="markCard(card.id_tarea)"
          class="flex items-center p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition"
        >
          <span
            class="w-5 h-5 rounded-full mr-3"
            :style="{ backgroundColor: getColumnColor(card.estado) }"
          ></span>
          <span class="flex-1">{{ card.titulo }}</span>
        </li>
      </ul>
    </div>

    <!-- Kanban Board -->
    <div
      class="kanban-board grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-6 bg-transparent min-h-screen overflow-x-auto"
    >
      <div v-for="status in columnStatuses" :key="status" class="flex flex-col">
        <!-- Cada tarjeta tiene su id="card-{card.id}" para scroll -->
        <KanbanColumn
          :status="status"
          :cards="getPaginatedCardsByStatus(status)"
          :color="getColumnColor(status)"
          @moveCard="moveCard"
          @viewDetails="openCardDetail"
          :highlighted-card="highlightedCard"
        />

        <!-- Paginación -->
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

    <!-- Modal de Detalle -->
    <CardDetail
      v-if="selectedCard"
      :card="selectedCard"
      @close="selectedCard = null"
      @advanceState="advanceState"
      @edit="openTaskForm('edit', $event)"
    />

    <!-- Botón flotante para añadir tarea -->
    <FloatingTaskButton @click="openTaskForm('add')" />

    <!-- Modal de Formulario para Añadir/Modificar Tarea -->
    <TaskFormModal
      v-if="showTaskForm"
      :mode="taskFormMode"
      :task="currentTaskForm"
      @close="closeTaskForm"
      @save="saveTaskForm"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import KanbanColumn from "./KanbanColumn.vue";
import CardDetail from "./CardDetail.vue";
import FloatingTaskButton from "./FloatingTaskButton.vue";
import TaskFormModal from "./TaskFormModal.vue";
import profilePicture from "@/assets/img/havatar.jpg";
import { ts } from "@/service/adminApp/client";

const cards = ref((await ts.getTareas()).map(item => ({ 
    ...item,
    highlight: false 
})));
console.log("cards", cards);

const columnStatuses = ["Disponible", "Pendiente", "En Progreso", "Terminado"];
const statusOrder = ["Disponible", "Pendiente", "En Progreso", "Terminado"];
const cardsPerPage = 5;

const currentPage = ref({
  Disponible: 0,
  "Pendiente": 0,
  "En Progreso": 0,
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

const highlightedCard = ref(null);
const selectedCard = ref(null);

// Cálculo de páginas basado en el número de tareas por estado
const pages = computed(() => {
  const result = {};
  columnStatuses.forEach((status) => {
    const total = cards.value.filter((card) => card.estado === status).length;
    result[status] = Math.ceil(total / cardsPerPage);
  });
  return result;
});

const getPaginatedCardsByStatus = (status) => {
  const filtered = cards.value
    .filter((card) => card.estado === status)
    .sort((a, b) => a.id_tarea - b.id_tarea);
  const start = currentPage.value[status] * cardsPerPage;
  return filtered.slice(start, start + cardsPerPage);
};

const changePage = (status, newPage) => {
  if (newPage >= 0 && newPage < pages.value[status]) {
    currentPage.value[status] = newPage;
  }
};

function getCurrentTimeFormatted() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  return hours + ":" + minutesStr + " " + ampm;
}

// Al mover la tarjeta, se actualiza el estado y se asignan datos del usuario si es necesario.
const moveCard = (cardId, newStatus) => {
  const card = cards.value.find((card) => card.id_tarea === cardId);
  if (card) {
    const originalStatus = card.status;
    const currentIndex = statusOrder.indexOf(originalStatus);
    const newIndex = statusOrder.indexOf(newStatus);
    if (newIndex === currentIndex + 1) {
      card.estado = newStatus;
      if (originalStatus === "Disponible" && newStatus === "Por Hacer") {
        card.userName = userName.value;
        card.image = userPhoto.value;
      } else if (newStatus !== "Disponible" && !card.userName) {
        card.userName = "Usuario Asignado";
      }
      if (newStatus === "Terminado") {
        card.fechaFinalizacion = card.fechaFinalizacion || new Date().toISOString().split("T")[0];
        card.endTime = card.endTime || getCurrentTimeFormatted();
      }
      currentPage.value[newStatus] = 0;
    }
  }
};

const getColumnColor = (status) => {
  const colors = {
    Disponible: "#A7F3D0",
    "Pendiente": "#FCD34D",
    "En Progreso": "#93C5FD",
    Terminado: "#D1D5DB",
  };
  return colors[status] || "#FFFFFF";
};

const openCardDetail = (card) => {
  selectedCard.value = card;
};

const markCard = (cardId) => {
  const card = cards.value.find((c) => c.id_tarea === cardId);
  if (card) {
    card.highlight = true;
    highlightedCard.value = cardId;
    searchQuery.value = "";
    const status = card.estado;
    const index = cards.value.filter((c) => c.estado === status).findIndex((c) => c.id_tarea === cardId);
    currentPage.value[status] = Math.floor(index / cardsPerPage);
    nextTick(() => {
      setTimeout(() => {
        const cardElement = document.getElementById(`card-${cardId}`);
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const top = rect.top + scrollTop - 50;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }, 100);
    });
    setTimeout(() => {
      card.highlight = false;
    }, 3000);
  }
};

const searchQuery = ref("");
const filteredCards = computed(() =>
  cards.value.filter((card) =>
    card.titulo.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);

/* -----------------------------------------------------------
   Código para el modal de formulario para añadir/modificar tarea
----------------------------------------------------------- */
const showTaskForm = ref(false);
const taskFormMode = ref("add"); // "add" o "edit"
const currentTaskForm = ref({
  id: null,
  title: "",
  description: "",
  ClientName: "",
  startDate: "",
  startTime: "",
  status: "Disponible",
  image: null,
  userName: "",
  attachmentName: [] // Asegurarse de tener la propiedad de archivos
});

// Cambio: Modificación de openTaskForm para normalizar archivos adjuntos y cerrar CardDetail al editar
const openTaskForm = (mode, task = null) => {
  taskFormMode.value = mode;
  if (mode === "edit" && task) {
    // Normalizar la propiedad attachmentName para que siempre sea un array de objetos { name, file }
    let normalizedAttachments = [];
    if (task.attachmentName) {
      if (Array.isArray(task.attachmentName)) {
        // Si el primer elemento es un objeto, se asume que ya está normalizado
        if (task.attachmentName.length > 0 && typeof task.attachmentName[0] === "object") {
          normalizedAttachments = task.attachmentName;
        } else {
          // Si es un array de strings, se transforma cada uno en objeto
          normalizedAttachments = task.attachmentName.map(fileName => ({ name: fileName, file: null }));
        }
      } else {
        // Si no es un array, se envuelve en un array como objeto
        normalizedAttachments = [{ name: task.attachmentName, file: null }];
      }
    }
    currentTaskForm.value = { ...task, attachmentName: normalizedAttachments };
    // Cambio: Cerrar el CardDetail después de modificar
    selectedCard.value = null;
  } else {
    currentTaskForm.value = {
      id: null,
      title: "",
      description: "",
      ClientName: "",
      startDate: "",
      startTime: "",
      status: "Disponible",
      image: null,
      userName: "",
      attachmentName: [] // Inicialización de archivos vacía
    };
  }
  showTaskForm.value = true;
};

const closeTaskForm = () => {
  showTaskForm.value = false;
};

const saveTaskForm = (taskData) => {
  if (taskFormMode.value === "add") {
    const newId = cards.value.length > 0 ? Math.max(...cards.value.map((c) => c.id)) + 1 : 1;
    taskData.id = newId;
    cards.value.push({ ...taskData });
    // Resetear la página del estado del nuevo tarea a 0
    currentPage.value[taskData.status] = 0;
  } else if (taskFormMode.value === "edit") {
    const index = cards.value.findIndex((c) => c.id === taskData.id);
    if (index !== -1) {
      cards.value.splice(index, 1, { ...taskData });
    }
  }
  searchQuery.value = ""; // limpiar búsqueda
  closeTaskForm();
};
</script>

<style scoped>
.custom-scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
