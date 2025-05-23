<template>
  <!-- Contenedor de la tabla -->
  <div ref="containerRef" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
    <DataTable :value="mensual" :filters="filters" :globalFilterFields="['id','cliente', 'asunto', 'atendio', 'honorarios', 'mes_ano_legible', 'fechapago_legible']"
      paginator sortMode="multiple" removableSort :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]" :rowClass="rowClass"
      class="w-full rounded-lg p-5">
      <!-- Encabezado de la tabla -->
      <template #header>
        <div
          class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg">
          <div class="flex flex-col sm:flex-row items-center gap-2 w-full">
            <!-- Buscador -->
            <div class="flex space-x-2 border-2 border-solid">
              <span>
                <i class="pi pi-search text-gray-400 text-xl"></i>
              </span>
            </div>
            <div class="relative w-full sm:w-auto">
              <InputText v-model="filters.global.value" autocomplete="new-password" placeholder="Buscar..."
                class="w-full pl-10 p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <!-- Botones -->
            <div class="flex space-x-2">
              <Button type="button" icon="pi pi-filter-slash" :label="isMobile ? '' : 'Limpiar Filtros'" outlined
                class="p-2" @click="clearFilter" />
              <Button v-if="canAddPagoMensual" icon="pi pi-plus" :label="isMobile ? '' : 'Agregar Pago Mensual'" class="p-button-success p-2"
                @click="openCard(null)" />
            </div>
          </div>
        </div>
        <!-- Slider para columnas -->
        <div v-if="pages.length > 1"
          class="flex justify-center items-center space-x-2 p-2 bg-gray-800 rounded-md shadow-md mt-2">
          <Button icon="pi pi-chevron-left" @click="prevPage" :disabled="currentPageIndex === 0"
            class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info" />
          <Button icon="pi pi-chevron-right" @click="nextPage" :disabled="currentPageIndex === maxPageIndex"
            class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info" />
        </div>
      </template>

      <!-- Renderizado dinámico de columnas -->
      <Column v-for="col in visibleColumns" :key="col.field" :sortable="col.field !== 'actions'"
        :field="col.field !== 'actions' ? col.field : undefined">
        <template #header>
          <div class="p-1 text-black font-semibold text-center text-sm w-full">
            {{ col.header }}
          </div>
        </template>
        <template #body="{ data }">
          <!-- Acciones -->
          <div v-if="col.field === 'actions'" class="flex justify-center space-x-2">
            <Button v-if="canEditPagoMensual" icon="pi pi-pencil" class="p-button-rounded p-button-warning" @click="openCard(data)" />
            <Button v-if="canDeletePagoMensual" icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="openConfirmDialog(data)" />
            <Button icon="pi pi-print" class="p-button-rounded p-button-info" @click="printTicket(data)" />
          </div>
          <div v-if="col.field === 'honorarios'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(addDollarPrefix(data[col.field]))">
            {{ "$" + data[col.field] }}
          </div>
          <div v-if="col.field === 'mes_ano'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(formatFechaMesAnoSQL(data[col.field]))">
            {{ formatFechaMesAnoSQL(data[col.field]) }}
          </div>
          <div v-if="col.field === 'fechapago'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(formatFechaHoraFullPagoSQL(data[col.field]))">
            {{ formatFechaHoraFullPagoSQL(data[col.field]) }}
          </div>

          <!-- Celdas normales -->
          <div v-else-if="col.field !== 'actions' && col.field !== 'honorarios' && col.field !== 'mes_ano' && col.field !== 'fechapago'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(data[col.field])">
            {{ data[col.field] }}
          </div>
        </template>
      </Column>
    </DataTable>
  </div>

  <!-- Toast y modales -->
  <Toast />
  <CardDetailMensual v-if="cardVisible" :pago="selectedMensual" :usuario="usuario" @close="cardVisible = false"
    @save="saveMensual" />
  <ConfirmDeleteDialog v-if="confirmDialogVisible" @confirm="confirmDelete" @cancel="cancelDelete" />

  <!-- Componente para impresión -->
  <TicketPrinter v-if="printVisible" :ticket="selectedTicket" @close="printVisible = false" />
  <PrintDialog v-if="printDialogVisible" @close="printDialogVisible = false" @ok="printTicket(mensual[0]);printDialogVisible=false"/>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import { useRoute } from "vue-router";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailMensual from "./CardDetailMensual.vue";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.vue";
import TicketPrinter from "./TicketPrinter.vue"; // Importa el componente de impresión
import PrintDialog from "./PrintDialog.vue";
import { formatFechaHoraFullPagoSQL, formatFechaMesAnoSQL, formatFechaSQL, ps } from "@/service/adminApp/client";
const toast = useToast();
const canAddPagoMensual = ref(false);
const canEditPagoMensual = ref(false);
const canDeletePagoMensual = ref(false);
// Datos de ejemplo
const route = useRoute();
const mensual = ref(await ps.getPagoMensual());
const printDialogVisible = ref(false);
const printVisible = ref(false);
// Lectura del usuario desde localStorage
const usuario = ref({
  id: localStorage.getItem("userid") || "",
  nombre: localStorage.getItem("username") || "",
  foto: localStorage.getItem("userphoto") || "",
});

// Definición de columnas base
const columns = ref([
  { field: "id", header: "ID" },
  { field: "cliente", header: "Cliente" },
  { field: "asunto", header: "Asunto" },
  { field: "atendio", header: "Atendió" },
  { field: "honorarios", header: "Honorarios" },
  { field: "mes_ano", header: "Mes y Año" },
  { field: "fechapago", header: "Fecha de pago" },
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
onMounted(async() => {
  const searchParam = route.query.search;
  console.log(searchParam);
  
  if (searchParam) {
    filters.value.global.value = searchParam;
  }
  canAddPagoMensual.value = await hasPermission('canAddPagoMensual')
  canEditPagoMensual.value = await hasPermission('canEditPagoMensual')
  canDeletePagoMensual.value = await hasPermission('canDeletePagoMensual')
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(containerRef.value);
  }
  mensual.value = mensual.value.map(item => ({
    ...item,
    mes_ano_legible: formatFechaMesAnoSQL(item.mes_ano),
    fechapago_legible: formatFechaHoraFullPagoSQL(item.fechapago),
  }));
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
watch(
  () => route.query.search,
  (newSearch) => {
    filters.value.global.value = newSearch || '';
  }
);
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
const selectedMensual = ref({});
const openCard = (pago) => {
  if (pago) {
    selectedMensual.value = { ...pago };
  } else {
    selectedMensual.value = {
      id: "",
      cliente: "",
      atendio: "",
      id_atendio: "", // se asigna nombre del usuario
      imagen: "",
      honorarios: "",
      mes_ano: "",
    };
  }
  cardVisible.value = true;
};
const saveMensual = (pago) => {
  console.log("new mens ", pago);
  
  if (pago.id) {
    const index = mensual.value.findIndex((m) => m.id === pago.id);
    if (index !== -1) {
      mensual.value[index] = { ...pago };
      toast.add({
        severity: "success",
        summary: "Actualizado",
        detail: "Pago mensual actualizado correctamente",
        life: 2000,
      });
    }
  } 
  if(pago.isnew){
    printDialogVisible.value = true;
    pago.fechapago = new Date().toISOString()
    mensual.value.unshift(pago);
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Pago mensual agregado correctamente",
      life: 2000,
    });
  }
  cardVisible.value = false;
};

const confirmDialogVisible = ref(false);
const candidateToDelete = ref(null);
const openConfirmDialog = (pago) => {
  candidateToDelete.value = { ...pago };
  confirmDialogVisible.value = true;
};
const confirmDelete = async () => {
  if (candidateToDelete.value) {
    await ps.deletePagoMensual(candidateToDelete.value.id)
    mensual.value = mensual.value.filter((m) => m.id !== candidateToDelete.value.id);
    toast.add({
      severity: "warn",
      summary: "Eliminado",
      detail: "Pago mensual eliminado correctamente",
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

// Lógica para impresión de tickets

const selectedTicket = ref(null);
const printTicket = (data) => {
  selectedTicket.value = data;
  printVisible.value = true;
};
</script>
