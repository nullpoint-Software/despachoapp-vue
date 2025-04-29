<!-- KanbanBoard.vue -->
<template>
  <Toast />
  <div class="relative">
    <!-- Buscador -->
    <div class="relative w-full max-w-lg mx-auto">
      <div v-if="!mini" class="flex items-center bg-gray-900 text-white rounded-full px-4 py-2 shadow-md">
        <input v-model="searchQuery" type="text" placeholder="Buscar tareas..."
          class="bg-transparent flex-1 outline-none px-2 py-1 text-lg" />
        <button v-if="searchQuery" @click="searchQuery = ''" class="text-gray-400 hover:text-white transition">
          ✕
        </button>
      </div>
      <ul v-if="searchQuery"
        class="absolute top-full left-0 w-full bg-gray-800 shadow-lg rounded-lg mt-2 z-10 text-white">
        <li v-for="card in filteredCards" :key="card.id_tarea" @click="markCard(card.id_tarea)"
          class="flex items-center p-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition">
          <span class="w-5 h-5 rounded-full mr-3" :style="{ backgroundColor: getColumnColor(card.estado) }"></span>
          <span class="flex-1">{{ card.titulo }}</span>
        </li>
      </ul>
    </div>

    <!-- Kanban Board -->
    <div
      :class="'kanban-board ' + (mini ? 'place-items-center' : 'lg:grid-cols-4 grid grid-cols-1 sm:grid-cols-2') + ' gap-2 p-6 bg-transparent ' + (mini ? 'min-h-2' : 'min-h-screen') + ' overflow-x-auto'">
      <div v-if="cardsDisponible && showDisponible" class="flex flex-col">
        <!-- SEPARAR COLUMNA DISPONIBLE PARA MOSTRAR LAS TAREAS SIN USUARIO ASIGNADO -->
        <KanbanColumn :status="'Disponible'" :cards="getPaginatedCardsDisponible()"
          :color="getColumnColor('Disponible')" @moveCard="moveCard" @viewDetails="openCardDetail"
          :highlighted-card="highlightedCard" />

        <div class="flex justify-center items-center mt-2 space-x-2">
          <button @click="
            changePageDisponible('Disponible', currentPage['Disponible']--)
            " :disabled="currentPage['Disponible'] === 0"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            &lt;
          </button>
          <span class="px-4 py-2 bg-blue-500 rounded shadow">
            {{ currentPage["Disponible"] + 1 }}
          </span>
          <button @click="
            changePageDisponible('Disponible', currentPage['Disponible']++)
            " :disabled="currentPage['Disponible'] >= pagesDisponible['Disponible'] - 1
              "
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            &gt;
          </button>
        </div>
      </div>
      <div v-if="cards" v-for="status in columnStatuses" :key="status" class="flex flex-col">
        <!-- Cada tarjeta tiene su id="card-{card.id}" para scroll -->
        <KanbanColumn :mini="mini" :status="status" :cards="getPaginatedCardsByStatus(status)"
          :color="getColumnColor(status)" @moveCard="moveCard" @viewDetails="openCardDetail"
          :highlighted-card="highlightedCard" />

        <!-- Paginación -->
        <div class="flex justify-center items-center mt-2 space-x-2">
          <button @click="changePage(status, currentPage[status] - 1)" :disabled="currentPage[status] === 0"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            &lt;
          </button>
          <span class="px-4 py-2 bg-blue-500 rounded shadow">
            {{ currentPage[status] + 1 }}
          </span>
          <button @click="changePage(status, currentPage[status] + 1)"
            :disabled="currentPage[status] >= pages[status] - 1"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            &gt;
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Detalle -->
    <CardDetail v-if="selectedCard" :card="selectedCard" @close="selectedCard = null" @advanceState="advanceState"
      @edit="openTaskForm('edit', $event)" />

    <!-- Botón flotante para añadir tarea -->
    <FloatingTaskButton v-if="!mini" @click="openTaskForm('add')" />

    <!-- Modal de Formulario para Añadir/Modificar Tarea -->
    <TaskFormModal v-if="showTaskForm" :mode="taskFormMode" :task="currentTaskForm" @close="closeTaskForm"
      @save="saveTaskForm" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from "vue";
import KanbanColumn from "./KanbanColumn.vue";
import { Toast, useToast } from "primevue";
import CardDetail from "./CardDetail.vue";
import FloatingTaskButton from "./FloatingTaskButton.vue";
import TaskFormModal from "./TaskFormModal.vue";
import { hasPermission } from "@/service/adminApp/permissionsService";
import { cs, ts } from "@/service/adminApp/client";
import { base64ToFile } from "@/service/adminApp/authService";
const toast = useToast();
const userId = ref(await localStorage.getItem("userid"));
const userFullName = ref(localStorage.getItem("fullname"));
const userName = ref(localStorage.getItem("username"));
const userPhoto = ref(localStorage.getItem("userphoto"));
let isOpeningTaskForm = false;
const rawProps = defineProps([
  'showOwn',
  'showPendiente',
  'showDisponible',
  'showEnProgreso',
  'showTerminado',
  'mini' //argumento especial para Inicio.vue
]);


const mini = rawProps.mini ?? false;
const showOwn = ref(rawProps.showOwn ?? false);
const showPendiente = rawProps.showPendiente ?? true;
const showDisponible = rawProps.showDisponible ?? true;
const showEnProgreso = rawProps.showEnProgreso ?? true;
const showTerminado = rawProps.showTerminado ?? true;

const cardsDisponible = ref(
  (await ts.getTareasDisponibles()).map((item) => ({
    ...item,
    highlight: false,
  }))
);
console.log("cards disponibles", cardsDisponible);

const cards = ref(
  (
    (showOwn.value || localStorage.getItem("level") == 'Empleado'
      ? (await ts.getTareas()).filter(
        (item) => item.id_usuario == userId.value
      )
      : await ts.getTareas()
    ).map((item) => ({
      ...item,
      highlight: false,
      image: item.usuario_imagen
        ? URL.createObjectURL(base64ToFile(item.usuario_imagen, "task-img.png"))
        : null,
    }))
  )
);
console.log("cards", cards);

const columnStatuses = [
  ...(showPendiente ? ["Pendiente"] : []),
  ...(showEnProgreso ? ["En Progreso"] : []),
  ...(showTerminado ? ["Terminado"] : [])
];
const statusOrder = ["Disponible", "Pendiente", "En Progreso", "Terminado"];
const cardsPerPage = mini ? 2 : 4;

const currentPage = ref({
  Disponible: 0,
  Pendiente: 0,
  "En Progreso": 0,
  Terminado: 0,
});

const highlightedCard = ref(null);
const selectedCard = ref(null);

// Cálculo de páginas basado en el número de tareas por estado
const pages = computed(() => {
  const result = {};

  // For each status, calculate pages
  columnStatuses.forEach((status) => {
    let allCards = [];

    if (status === "Disponible") {
      // For "Disponible", consider both cards and cardsDisponible
      allCards = [...cards.value, ...cardsDisponible.value];
    } else {
      // For other statuses, use just cards
      allCards = cards.value.filter((card) => card.estado === status);
    }

    const total = allCards.length;
    result[status] = Math.max(1, Math.ceil(total / cardsPerPage)); // Ensure at least 1 page
  });

  return result;
});

const pagesDisponible = computed(() => {
  const result = {};

  // Considerar solo las tarjetas con estado "Disponible"
  const allCards = [...cardsDisponible.value];
  const total = allCards.length;

  result["Disponible"] = Math.max(1, Math.ceil(total / cardsPerPage)); // Asegura al menos 1 página

  return result;
});

const getPaginatedCardsByStatus = (status) => {
  const filtered = cards.value
    .filter((card) => card.estado === status)
    .sort((a, b) => a.id_tarea - b.id_tarea);
  const start = currentPage.value[status] * cardsPerPage;
  return filtered.slice(start, start + cardsPerPage);
};

const getPaginatedCardsDisponible = () => {
  const start = currentPage.value["Disponible"] * cardsPerPage;
  return [...cards.value, ...cardsDisponible.value]
    .filter((card) => card.estado === "Disponible")
    .sort((a, b) => a.id_tarea - b.id_tarea)
    .slice(start, start + cardsPerPage);
};

const changePage = (status, newPage) => {
  if (newPage >= 0 && newPage < pages.value[status]) {
    currentPage.value[status] = newPage;
  }
};

const changePageDisponible = (status, newPage) => {
  console.log(status + " " + newPage);
  console.log("curr " + currentPage.value["Disponible"]);
  console.log("disp " + pagesDisponible.value["Disponible"]);

  if (newPage >= 0 && newPage < pagesDisponible["Disponible"]) {
    currentPage.value[status] = newPage;
  }
};

// Al mover la tarjeta, se actualiza el estado y se asignan datos del usuario si es necesario.
// BUSCA SI LA CARTA QUE SE QUIERE MOVER ESTA EN cards o cardsDisponible
const moveCard = async (cardId, newStatus) => {
  let card = cards.value.find((card) => card.id_tarea === cardId);
  if (!card) {
    card = cardsDisponible.value.find((card) => card.id_tarea === cardId);
  }

  //JERARQUIA DE OPERACION, solo puede mover carta, si: eres admin, la card tiene tu id de usuario asignado, la card no tiene id usuario asignado (status = disponible)
  const permission =
    (await hasPermission("canMoveAllCards")) ||
      (card.id_usuario == localStorage.getItem("userid") &&
        (await hasPermission("canMoveOwnCard"))) ||
      (!card.id_usuario && (await hasPermission("canMoveAvailableCard")))
      ? true
      : false;
  console.log("card moving", card);
  if (permission) {
    if (card) {
      const originalStatus = card.estado;
      const currentIndex = statusOrder.indexOf(originalStatus);
      const newIndex = statusOrder.indexOf(newStatus);

      const isAdmin = await hasPermission("canMoveAllCards");
      console.log("index ", newIndex);

      const movingForwardOneStep = newIndex === currentIndex + 1;
      const movingToStart = newIndex === 0;
      const invalidBackFrom3 = currentIndex == 3 && (newIndex == 1 || newIndex == 2 || newIndex == 0);
      console.log(movingForwardOneStep, movingToStart, invalidBackFrom3);

      if (
        isAdmin ||
        (
          (movingForwardOneStep || movingToStart) &&
          !invalidBackFrom3
        )
      ) {
        // ✅ Move the card
        console.log("Moving card from", originalStatus, "to", newStatus);
        // perform move logic here
      } else {
        console.warn("Invalid move attempted");
        toast.add({
          severity: "error",
          summary: "Error",
          detail: "No es posible mover esta tarea!",
          life: 2000,
        });
        return
      }
      card.estado = newStatus;
      if (originalStatus != newStatus) {
        card.id_usuario = parseInt(userId.value); //tambien int por si es problema
        card.username = userName.value;
        card.image = userPhoto.value;
        card.nombre = userFullName.value; //son las 5AM y me dio flojera volver a llamar la base de datos, sorry
      } else if (newStatus !== "Disponible" && !card.username) {
        card.username = "Usuario Asignado";
      }

      if (originalStatus === "Disponible") {
        cardsDisponible.value = cardsDisponible.value.filter(
          (c) => c.id_tarea !== card.id_tarea
        );
        cards.value.push(card);
      }

      if (newStatus === "Disponible") {
        card.image = null;
        card.id_usuario = null;
        cards.value = cards.value.filter((c) => c.id_tarea !== card.id_tarea);
        cardsDisponible.value.push(card);
        // window.location.reload()
      }
      if (!(newStatus === "Terminado")) {
        card.fecha_vencimiento = null;
        console.log(
          "update estado",
          await ts.updateTarea(card.id_tarea, null, newStatus)
        );
      } else {
        card.fecha_vencimiento =
          card.fecha_vencimiento ||
          new Date().toLocaleString("sv-SE").replace("T", "");
        console.log(
          "update estado",
          await ts.updateTarea(
            card.id_tarea,
            null,
            newStatus,
            card.fecha_vencimiento
          )
        );
      }

      currentPage.value[newStatus] = 0;
      toast.add({
        severity: "info",
        summary: "Exito",
        detail: "Tarea actualizada con exito",
        life: 2000,
      });
    } else {
      console.log("no permission de mover!!");
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Solo un administrador puede regresar esta tarea!",
        life: 2000,
      });
    }
  } else {
    console.log("no permission de mover!!");
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No tienes permiso para mover esta tarea!",
      life: 2000,
    });
  }
}

const getColumnColor = (status) => {
  const colors = {
    Disponible: "#A7F3D0",
    Pendiente: "#FCD34D",
    "En Progreso": "#93C5FD",
    Terminado: "#D1D5DB",
  };
  return colors[status] || "#FFFFFF";
};

const openCardDetail = (card) => {
  selectedCard.value = card;
};

const markCard = (cardId) => {
  let card = cards.value.find((c) => c.id_tarea === cardId); //mutable para que funcione con la disponibles
  if (!card) {
    card = cardsDisponible.value.find((card) => card.id_tarea === cardId);
  }
  if (card) {
    card.highlight = true;
    highlightedCard.value = cardId;
    searchQuery.value = "";
    const status = card.estado;
    const index = cards.value
      .filter((c) => c.estado === status)
      .findIndex((c) => c.id_tarea === cardId);
    currentPage.value[status] = Math.floor(index / cardsPerPage);
    nextTick(() => {
      setTimeout(() => {
        const cardElement = document.getElementById(`card-${cardId}`);
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop;
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
  [...cards.value, ...cardsDisponible.value].filter((card) =>
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
  attachmentName: [], // Se mantiene la propiedad, pero se inicializa vacía
});

// Cambio: Modificación de openTaskForm para eliminar la normalización de archivos adjuntos
const openTaskForm = async (mode, task = null) => {
  if (isOpeningTaskForm) return;
  isOpeningTaskForm = true;
  taskFormMode.value = mode;

  const canEdit = await hasPermission('canEditCard');
  const canAdd = await hasPermission('canAddCard');

  if ((mode === "edit" && canEdit) || (canAdd)) {
    if (mode === "edit" && task) {
      currentTaskForm.value = { ...task };
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
        attachmentName: [],
      };
    }

    showTaskForm.value = true;
  } else {
    toast.add({
      severity: "error",
      summary: "Permiso denegado",
      detail:
        mode === "edit"
          ? "No tienes permiso de editar tareas!"
          : "No tienes permiso de crear tareas!",
      life: 2000,
    });
  }

  setTimeout(() => {
    isOpeningTaskForm = false;
  }, 200);
};


const closeTaskForm = () => {
  showTaskForm.value = false;
};

const saveTaskForm = (taskData) => {
  console.log("save taskform activated with task: " + taskData);
  console.log("mode is " + taskFormMode.value);

  // if (taskFormMode.value === "add") {
  //   const newId =
  //     cards.value.length > 0
  //       ? Math.max(...cards.value.map((c) => c.id_tarea)) + 1
  //       : 1;
  //   taskData.id_tarea = newId;
  //   cards.value.push({ ...taskData });
  //   // Resetear la página del estado del nueva tarea a 0
  //   currentPage.value[taskData.status] = 0;
  // } else if (taskFormMode.value === "edit") {
  //   const index = cards.value.findIndex((c) => c.id_tarea === taskData.id_tarea);
  //   if (index !== -1) {
  //     cards.value.splice(index, 1, { ...taskData });
  //   }
  // }
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
