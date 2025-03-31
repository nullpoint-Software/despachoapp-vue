<template>
  <!-- Contenedor de la tabla -->
  <div ref="containerRef" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
    <DataTable
      :value="historial"
      :filters="filters"
      :globalFilterFields="['cliente', 'quienAtendio', 'fecha', 'cantidad', 'tipo']"
      paginator
      sortMode="multiple"
      removableSort
      :rows="5"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      :rowClass="rowClass"
      class="w-full rounded-lg p-5"
    >
      <!-- Encabezado de la tabla -->
      <template #header>
        <div class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg">
          <div class="flex flex-col sm:flex-row items-center gap-2 w-full">
            <!-- Buscador -->
            <div class="flex space-x-2 border-2 border-solid">
              <span>
                <i class="pi pi-search text-gray-400 text-xl"></i>
              </span>
            </div>
            <div class="relative w-full sm:w-auto">
              <InputText
                v-model="filters.global.value"
                placeholder="Buscar..."
                class="w-full pl-10 p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <!-- Botones -->
            <div class="flex space-x-2">
              <Button
                type="button"
                icon="pi pi-filter-slash"
                :label="isMobile ? '' : 'Limpiar Filtros'"
                outlined
                class="p-2"
                @click="clearFilter"
              />
              <Button
                icon="pi pi-plus"
                :label="isMobile ? '' : 'Agregar Historial'"
                class="p-button-success p-2"
                @click="openCard(null)"
              />
            </div>
          </div>
        </div>
        <!-- Slider para columnas -->
        <div
          v-if="pages.length > 1"
          class="flex justify-center items-center space-x-2 p-2 bg-gray-800 rounded-md shadow-md mt-2"
        >
          <Button
            icon="pi pi-chevron-left"
            @click="prevPage"
            :disabled="currentPageIndex === 0"
            class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info"
          />
          <Button
            icon="pi pi-chevron-right"
            @click="nextPage"
            :disabled="currentPageIndex === maxPageIndex"
            class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info"
          />
        </div>
      </template>

      <!-- Renderizado dinámico de columnas -->
      <Column
        v-for="col in visibleColumns"
        :key="col.field"
        :sortable="col.field !== 'actions'"
        :field="col.field !== 'actions' ? col.field : undefined"
      >
        <template #header>
          <div class="p-1 text-black font-semibold text-center text-sm">
            {{ col.header }}
          </div>
        </template>
        <template #body="{ data }">
          <!-- Acciones -->
          <div v-if="col.field === 'actions'" class="flex justify-center space-x-2">
            <Button icon="pi pi-pencil" class="p-button-rounded p-button-warning" @click="openCard(data)" />
            <Button icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="openConfirmDialog(data)" />
          </div>
          <!-- Celdas normales -->
          <div
            v-else
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(data[col.field])"
          >
            {{ data[col.field] }}
          </div>
        </template>
      </Column>
    </DataTable>
  </div>

  <!-- Toast y modales -->
  <Toast />
  <CardDetailHistorial
    v-if="cardVisible"
    :registro="selectedHistorial"
    :usuario="usuario"
    @close="cardVisible = false"
    @save="saveHistorial"
  />
  <ConfirmDeleteDialog
    v-if="confirmDialogVisible"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import CardDetailHistorial from "./CardDetailHistorial.vue";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.vue";

const toast = useToast();

// Datos de ejemplo
const historial = ref([
  { id: "H-1001", cliente: "Cliente A", quienAtendio: "Usuario X", fecha: "01/05/2025", cantidad: "$500.00", tipo: "cobro" },
  { id: "H-1002", cliente: "Cliente B", quienAtendio: "Usuario Y", fecha: "02/05/2025", cantidad: "$300.00", tipo: "pago" },
]);

// Lectura del usuario desde localStorage
const usuario = ref({
  id: localStorage.getItem("userId") || "",
  nombre: localStorage.getItem("userName") || "",
  foto: localStorage.getItem("userPhoto") || "",
});

// Definición de columnas base
const columns = ref([
  { field: "cliente", header: "Cliente" },
  { field: "quienAtendio", header: "Atendió" },
  { field: "fecha", header: "Fecha" },
  { field: "cantidad", header: "Cantidad" },
  { field: "tipo", header: "Tipo" },
]);
const actionsColumn = { field: "actions", header: "Acciones" };
const baseColumns = computed(() => columns.value);

// Filtros
const filters = ref({
  global: { value: null, matchMode: "contains" },
});
const clearFilter = () => {
  filters.value.global.value = null;
};

// Clase para las filas
const rowClass = (data, index) =>
  index % 2 === 0 ? "bg-white hover:bg-gray-100" : "bg-gray-50 hover:bg-gray-100";

// Copiar al portapapeles
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ severity: "info", summary: "Copiado", detail: text, life: 2000 });
  } catch (err) {
    toast.add({ severity: "error", summary: "Error", detail: "No se pudo copiar", life: 2000 });
  }
};

// Detección de dispositivo móvil
const isMobile = ref(window.innerWidth <= 640);
const screenWidth = ref(window.innerWidth);
const handleResize = () => {
  screenWidth.value = window.innerWidth;
  isMobile.value = screenWidth.value <= 640;
};
onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));

// MEDICIÓN DEL ANCHO DEL COMPONENTE
const containerRef = ref(null);
const containerWidth = ref(0);
let resizeObserver = null;
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});
onUnmounted(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value);
  }
});

// CÁLCULO DEL SLIDER DE COLUMNAS
const minColumnWidth = 150;
const visibleCount = computed(() =>
  Math.floor((containerWidth.value || screenWidth.value) / minColumnWidth)
);
const totalColumnsWithActions = computed(() => baseColumns.value.length + 1);
const pages = computed(() => {
  const total = baseColumns.value.length;
  const vis = visibleCount.value;
  if (total + 1 <= vis) return [baseColumns.value];
  const pagesArray = [];
  const firstPageCount = Math.max(1, vis - 1);
  pagesArray.push(baseColumns.value.slice(0, firstPageCount));
  const remaining = baseColumns.value.slice(firstPageCount);
  for (let i = 0; i < remaining.length; i += 2) {
    pagesArray.push(remaining.slice(i, i + 2));
  }
  return pagesArray;
});
const currentPageIndex = ref(0);
watch(pages, () => {
  currentPageIndex.value = 0;
});
const maxPageIndex = computed(() => pages.value.length - 1);
const visibleColumns = computed(() => {
  if (pages.value.length === 1) {
    return [...baseColumns.value, actionsColumn];
  } else {
    return [...pages.value[currentPageIndex.value], actionsColumn];
  }
});
const prevPage = () => {
  if (currentPageIndex.value > 0) currentPageIndex.value--;
};
const nextPage = () => {
  if (currentPageIndex.value < maxPageIndex.value) currentPageIndex.value++;
};

// Lógica para el Card y eliminación
const cardVisible = ref(false);
const selectedHistorial = ref({});
const openCard = (registro) => {
  if (registro) {
    selectedHistorial.value = { ...registro };
  } else {
    selectedHistorial.value = {
      id: "",
      cliente: "",
      quienAtendio: usuario.value.nombre, // se asigna nombre del usuario
      fecha: "",
      cantidad: "",
      tipo: "",
    };
  }
  cardVisible.value = true;
};
const saveHistorial = (registro) => {
  if (registro.id) {
    const index = historial.value.findIndex((r) => r.id === registro.id);
    if (index !== -1) {
      historial.value[index] = { ...registro };
      toast.add({
        severity: "success",
        summary: "Actualizado",
        detail: "Registro de historial actualizado correctamente",
        life: 2000,
      });
    }
  } else {
    registro.id = "H-" + Date.now().toString();
    historial.value.push(registro);
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Registro de historial agregado correctamente",
      life: 2000,
    });
  }
  cardVisible.value = false;
};

const confirmDialogVisible = ref(false);
const candidateToDelete = ref(null);
const openConfirmDialog = (registro) => {
  candidateToDelete.value = { ...registro };
  confirmDialogVisible.value = true;
};
const confirmDelete = () => {
  if (candidateToDelete.value) {
    historial.value = historial.value.filter((r) => r.id !== candidateToDelete.value.id);
    toast.add({
      severity: "warn",
      summary: "Eliminado",
      detail: "Registro de historial eliminado correctamente",
      life: 2000,
    });
  }
  confirmDialogVisible.value = false;
  candidateToDelete.value = null;
};
const cancelDelete = () => {
  confirmDialogVisible.value = false;
  candidateToDelete.value = null;
};
</script>
