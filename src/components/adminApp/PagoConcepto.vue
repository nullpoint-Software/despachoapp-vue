<!-- PaymentsTable.vue -->
<template>
  <!-- Contenedor de la tabla -->
  <div ref="containerRef" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
    <DataTable :value="payments" :filters="filters" :globalFilterFields="[
      'cliente',
      'asunto',
      'atendio',
      'cobramos',
      'pagamos',
      'fecha',
      'saldo',
    ]" paginator sortMode="multiple" removableSort :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]" :rowClass="rowClass"
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
              <!-- no se porque pero solamente asi chrome le hace caso de no rellenar -->
              <InputText v-model="filters.global.value" autocomplete="new-password" placeholder="Buscar..."
                aria-autocomplete="none"
                class="w-full pl-10 p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <!-- Botones -->
            <div class="flex space-x-2">
              <Button type="button" icon="pi pi-filter-slash" :label="isMobile ? '' : 'Limpiar Filtros'" outlined
                class="p-2" @click="clearFilter" />
              <Button v-if="canAddPagoConcepto" icon="pi pi-plus" :label="isMobile ? '' : 'Agregar Pago Concepto'"
                class="p-button-success p-2" @click="openCard(null)" />
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
          <div class="p-1 text-black font-semibold text-center text-sm">
            {{ col.header }}
          </div>
        </template>
        <template #body="{ data }">
          <!-- Acciones -->
          <div v-if="col.field === 'actions'" class="flex justify-center space-x-2">
            <Button v-if="canEditPagoConcepto" icon="pi pi-pencil" class="p-button-rounded p-button-warning"
              @click="openCard(data)" />
            <Button v-if="canDeletePagoConcepto" icon="pi pi-trash" class="p-button-rounded p-button-danger"
              @click="openConfirmDialog(data)" />
            <!-- Botón Imprimir -->
            <Button icon="pi pi-print" class="p-button-rounded p-button-info" @click="openPrint(data)" />
          </div>
          <!-- Celdas normales -->
          <div v-if="col.field === 'fecha'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard(formatFechaSQL(data[col.field]))">
            {{ formatFechaHoraFullSQL(data[col.field]) }}
          </div>
          <div v-if="col.field === 'cobramos'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard('$' + data[col.field])">
            {{ "$" + data[col.field] }}
          </div>
          <div v-if="col.field === 'pagamos'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard('$' + data[col.field])">
            {{ "$" + data[col.field] }}
          </div>
          <!-- <div v-if="col.field === 'saldo'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard('$' + data[col.field])">
            {{ "$" + data[col.field] }}
          </div> -->
          <div
            v-else-if="col.field !== 'cobramos' && col.field !== 'pagamos' && col.field !== 'saldo' && col.field !== 'fecha'"
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
  <CardDetailPagoConcepto v-if="cardVisible" :pago="selectedPayment" :usuario="usuario" @close="cardVisible = false"
    @save="savePayment" />
  <ConfirmDeleteDialog v-if="confirmDialogVisible" @confirm="confirmDelete" @cancel="cancelDelete" />
  <!-- Modal de impresión -->
  <PrintPagoConcepto v-if="printVisible" :payment="paymentToPrint" @close="printVisible = false" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { ps, formatFechaSQL, formatFechaHoraFullSQL } from "@/service/adminApp/client"
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailPagoConcepto from "./CardDetailPagoConcepto.vue";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.vue";
import PrintPagoConcepto from "./PrintPagoConcepto.vue";
const canAddPagoConcepto = ref(false);
const canEditPagoConcepto = ref(false);
const canDeletePagoConcepto = ref(false);
const toast = useToast();

// Datos de ejemplo
const payments = ref(await ps.getPagoConcepto());

// Lectura del usuario desde localStorage
const usuario = ref({
  id: localStorage.getItem("userId") || "",
  nombre: localStorage.getItem("fullname") || "",
  username: localStorage.getItem("username") || "",
  foto: localStorage.getItem("userphoto") || "",
});

// Definición de columnas base
const columns = ref([
  { field: "id", header: "ID" },
  { field: "cliente", header: "Cliente" },
  { field: "asunto", header: "Asunto" },
  { field: "atendio", header: "Atendió" },
  { field: "cobramos", header: "Cobramos" },
  { field: "pagamos", header: "Pagamos" },
  { field: "fecha", header: "Fecha" },
  // { field: "saldo", header: "Saldo" },
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
  index % 2 === 0
    ? "bg-white hover:bg-gray-100"
    : "bg-gray-50 hover:bg-gray-100";

// Copiar al portapapeles
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({
      severity: "info",
      summary: "Copiado",
      detail: text,
      life: 2000,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo copiar",
      life: 2000,
    });
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
onMounted(async () => {
  canAddPagoConcepto.value = await hasPermission('canAddPagoConcepto')
  canEditPagoConcepto.value = await hasPermission('canEditPagoConcepto')
  canDeletePagoConcepto.value = await hasPermission('canDeletePagoConcepto')
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

// Lógica para el Card y eliminación (igual que antes)
const cardVisible = ref(false);
const selectedPayment = ref({});
const openCard = (payment) => {
  if (payment) {
    selectedPayment.value = { ...payment };
  } else {
    selectedPayment.value = {
      id: "",
      cliente: "",
      asunto: "",
      atendio: usuario.value.username,
      cobramos: 0,
      pagamos: 0,
      fecha: "",
      saldo: "",
    };
  }
  cardVisible.value = true;
};
const savePayment = async (payment) => {
  console.log("recieve save pay", payment);

  if (payment.id) {
    const index = payments.value.findIndex((p) => p.id === payment.id);
    if (index !== -1) {
      console.log(index);
      console.log("edit save");
      
      payments.value.splice(index, 1, { ...payment });
      payments.value = [...payments.value];
      toast.add({
        severity: "success",
        summary: "Actualizado",
        detail: "Pago concepto actualizado correctamente",
        life: 2000,
      });
    }
  }
  if (payment.isnew) {
    payments.value.unshift(payment);
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Pago concepto agregado correctamente",
      life: 2000,
    });
  }
  cardVisible.value = false;
};

const confirmDialogVisible = ref(false);
const candidateToDelete = ref(null);
const openConfirmDialog = (payment) => {
  candidateToDelete.value = { ...payment };
  confirmDialogVisible.value = true;
};
const confirmDelete = () => {
  if (candidateToDelete.value) {
    payments.value = payments.value.filter(
      (p) => p.id !== candidateToDelete.value.id
    );
    ps.deletePagoConcepto(candidateToDelete.value.id)
    toast.add({
      severity: "warn",
      summary: "Eliminado",
      detail: "Pago concepto eliminado correctamente",
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

// --------- Impresión ---------
const printVisible = ref(false);
const paymentToPrint = ref({});
const openPrint = (payment) => {
  paymentToPrint.value = { ...payment };
  printVisible.value = true;
};
</script>

<style scoped>
/* tu CSS existente */
</style>
