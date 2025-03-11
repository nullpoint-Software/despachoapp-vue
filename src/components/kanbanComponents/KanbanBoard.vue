<!-- KanbanBoard.vue -->
<template>
  <div class="p-4 relative">
    <!-- Bloque: Información del usuario (nombre, foto e id) se omite aquí, ya que se obtiene de localStorage -->
    
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

    <!-- Modal de Detalle (se abre al hacer clic en la tarjeta) -->
    <CardDetail
      v-if="selectedCard"
      :card="selectedCard"
      @close="selectedCard = null"
      @advanceState="advanceState"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from "vue";
import KanbanColumn from "./KanbanColumn.vue";
import CardDetail from "./CardDetail.vue";
import profilePicture from "@/assets/img/havatar.jpg";
import logo from "@/assets/img/logsymbolblack.png";

// Obtener datos del usuario desde localStorage
const userName = ref(localStorage.getItem("userName") || "Usuario Desconocido");
const userPhoto = ref(localStorage.getItem("userPhoto") || logo);
const userId = ref(localStorage.getItem("userId") || null);

const columnStatuses = ["Disponible", "Por Hacer", "En progreso", "Terminado"];
const statusOrder = ["Disponible", "Por Hacer", "En progreso", "Terminado"];
const cardsPerPage = 5;

const currentPage = ref({
  Disponible: 0,
  "Por Hacer": 0,
  "En progreso": 0,
  Terminado: 0,
});

// Cada tarjeta incluye 'fechaFinalizacion' que se asignará al pasar a "Terminado"
// La fecha original 'date' permanece estática
const cards = ref([
  {
    id: 1,
    title: "Cita",
    description: "Cita con los asociados para discutir estrategias.",
    status: "Disponible",
    startDate: "2024-03-05",
    endDate: null,
    fechaFinalizacion: null,
    image: null,
    userIcon: null,
    userName: "",
    ClientName: "Cliente 1",
    attachmentName: "agenda.pdf",
    date: "2024-03-05",
    startTime: "09:00 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 2,
    title: "Revisión de documentos",
    description: "Verificar contratos y anexos legales.",
    status: "Disponible",
    startDate: "2024-03-04",
    endDate: null,
    fechaFinalizacion: null,
    image: null,
    userIcon: null,
    userName: "",
    ClientName: "Cliente 2",
    attachmentName: ["contrato.pdf", "anexo.pdf"],
    date: "2024-03-04",
    startTime: "10:00 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 3,
    title: "Revisión técnica",
    description: "Analizar y optimizar código.",
    status: "Disponible",
    startDate: "2024-03-03",
    endDate: null,
    fechaFinalizacion: null,
    image: null,
    userIcon: null,
    userName: "",
    ClientName: "Cliente 3",
    attachmentName: "specs.pdf",
    date: "2024-03-03",
    startTime: "08:30 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 4,
    title: "Planificación",
    description: "Organizar actividades y asignar tareas.",
    status: "Disponible",
    startDate: "2024-03-02",
    endDate: null,
    fechaFinalizacion: null,
    image: null,
    userIcon: null,
    userName: "",
    ClientName: "Cliente 4",
    attachmentName: "planificacion.pdf",
    date: "2024-03-02",
    startTime: "11:00 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 5,
    title: "Charros",
    description: "Reunión con los charros para coordinar el evento.",
    status: "Por Hacer",
    startDate: "2024-03-05",
    endDate: null,
    fechaFinalizacion: null,
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Carlos Ruiz",
    ClientName: "Cliente 5",
    attachmentName: "evento.pdf",
    date: "2024-03-05",
    startTime: "10:30 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 6,
    title: "Actualizar sistema",
    description: "Migrar a nueva versión del software.",
    status: "Por Hacer",
    startDate: "2024-03-04",
    endDate: null,
    fechaFinalizacion: null,
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Ana Gómez",
    ClientName: "Cliente 6",
    attachmentName: "actualizacion.pdf",
    date: "2024-03-04",
    startTime: "02:00 PM",
    endTime: null,
    highlight: false,
  },
  {
    id: 7,
    title: "Entrevistas",
    description: "Seleccionar nuevos miembros del equipo.",
    status: "Por Hacer",
    startDate: "2024-03-03",
    endDate: null,
    fechaFinalizacion: null,
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Ricardo Mora",
    ClientName: "Cliente 7",
    attachmentName: "entrevista.pdf",
    date: "2024-03-03",
    startTime: "03:00 PM",
    endTime: null,
    highlight: false,
  },
  {
    id: 8,
    title: "Toros",
    description: "Ajuste de cuentas y conciliación.",
    status: "En progreso",
    startDate: "2024-03-05",
    endDate: null,
    fechaFinalizacion: null,
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Verónica Díaz",
    ClientName: "Cliente 8",
    attachmentName: "cuentas.pdf",
    date: "2024-03-05",
    startTime: "01:00 PM",
    endTime: null,
    highlight: false,
  },
  {
    id: 9,
    title: "Revisión de proyecto",
    description: "Verificar avances y coordinar equipo.",
    status: "En progreso",
    startDate: "2024-03-04",
    endDate: null,
    fechaFinalizacion: null,
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Miguel Torres",
    ClientName: "Cliente 9",
    attachmentName: "proyecto.pdf",
    date: "2024-03-04",
    startTime: "09:30 AM",
    endTime: null,
    highlight: false,
  },
  {
    id: 10,
    title: "Carnaval",
    description: "Preparar logística para el carnaval.",
    status: "Terminado",
    startDate: "2024-03-05",
    endDate: "2024-03-07",
    fechaFinalizacion: "2024-03-07",
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Elena Ríos",
    ClientName: "Cliente 10",
    attachmentName: "carnaval.pdf",
    date: "2024-03-07",
    startTime: "08:00 AM",
    endTime: "05:00 PM",
    highlight: false,
  },
  {
    id: 11,
    title: "Entrega de informe",
    description: "Enviar reporte mensual al cliente.",
    status: "Terminado",
    startDate: "2024-03-04",
    endDate: "2024-03-06",
    fechaFinalizacion: "2024-03-06",
    image: profilePicture,
    userIcon: "pi pi-user",
    userName: "Laura Méndez",
    ClientName: "Cliente 11",
    attachmentName: "informe.pdf",
    date: "2024-03-06",
    startTime: "07:00 AM",
    endTime: "12:00 PM",
    highlight: false,
  },
]);

// Variables para resaltar y seleccionar tarjetas
const highlightedCard = ref(null);
const selectedCard = ref(null);

// Calcula cuántas páginas hay para cada columna
const pages = computed(() => {
  const result = {};
  columnStatuses.forEach((status) => {
    const total = cards.value.filter((card) => card.status === status).length;
    result[status] = Math.ceil(total / cardsPerPage);
  });
  return result;
});

// Filtra y pagina tarjetas por estado
const getPaginatedCardsByStatus = (status) => {
  const filtered = cards.value
    .filter((card) => card.status === status)
    .sort((a, b) => a.id - b.id);
  const start = currentPage.value[status] * cardsPerPage;
  return filtered.slice(start, start + cardsPerPage);
};

// Cambia de página en la columna
const changePage = (status, newPage) => {
  if (newPage >= 0 && newPage < pages.value[status]) {
    currentPage.value[status] = newPage;
  }
};

// Función para obtener la hora actual en formato 12 horas
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

// Lógica para avanzar de estado.
// Si se cambia de "Disponible" a "Por Hacer", la tarjeta recibe la foto y el nombre del usuario.
const moveCard = (cardId, newStatus) => {
  const card = cards.value.find((card) => card.id === cardId);
  if (card) {
    const originalStatus = card.status;
    const currentIndex = statusOrder.indexOf(originalStatus);
    const newIndex = statusOrder.indexOf(newStatus);
    if (newIndex === currentIndex + 1) {
      card.status = newStatus;
      if (originalStatus === "Disponible" && newStatus === "Por Hacer") {
        // Asigna los datos del usuario a la tarea
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

// Devuelve el color de la columna según su estado
const getColumnColor = (status) => {
  const colors = {
    Disponible: "#A7F3D0",
    "Por Hacer": "#FCD34D",
    "En progreso": "#93C5FD",
    Terminado: "#D1D5DB",
  };
  return colors[status] || "#FFFFFF";
};

// Abre el detalle de una tarjeta
const openCardDetail = (card) => {
  selectedCard.value = card;
};

// Función de búsqueda
const markCard = (cardId) => {
  const card = cards.value.find((c) => c.id === cardId);
  if (card) {
    card.highlight = true;
    highlightedCard.value = cardId;
    searchQuery.value = "";
    const status = card.status;
    const index = cards.value.filter((c) => c.status === status).findIndex((c) => c.id === cardId);
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
    card.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);
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
