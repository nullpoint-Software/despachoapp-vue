<!-- PaymentsTable.vue -->
<template>
  <!-- Contenedor de la tabla -->
  <div
    class="flex-grow w-full overflow-hidden rounded-xl shadow-lg"
  >
    <DataTable
      :value="payments"
      :filters="filters"
      :globalFilterFields="[
        'id',
        'cliente',
        'asunto',
        'atendio',
        'cobramos',
        'pagamos',
        'fecha_legible',
      ]"
      :paginator="!isMobile"
      sortMode="multiple"
      removableSort
      :rows="10"
      :rowsPerPageOptions="[10, 20, 50]"
      :rowClass="rowClass"
      class="w-full rounded-lg p-5"
    >
      <!-- Encabezado de la tabla -->
      <template #header>
        <div
          class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg"
        >
          <div class="flex flex-col sm:flex-row items-center gap-2 w-full">
            <!-- Buscador -->
            <div class="flex space-x-2 border-2 border-solid">
              <span>
                <i class="pi pi-search text-gray-400 text-xl"></i>
              </span>
            </div>
            <div class="relative w-full sm:w-auto">
              <!-- no se porque pero solamente asi chrome le hace caso de no rellenar -->
              <InputText
                v-model="filters.global.value"
                autocomplete="new-password"
                placeholder="Buscar..."
                aria-autocomplete="none"
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
                v-if="canAddPagoConcepto"
                icon="pi pi-plus"
                :label="isMobile ? '' : 'Agregar Pago Concepto'"
                class="p-button-success p-2"
                @click="openCard(null)"
              />
              <ExportExcelButton />
            </div>
          </div>
        </div>
      </template>

      <!-- Renderizado dinámico de columnas -->
      <Column
        v-for="col in tableColumns"
        :key="col.field"
        :sortable="col.field !== 'actions'"
        :field="col.field !== 'actions' ? col.field : undefined"
      >
        <template #header>
          <div class="p-1 text-black font-semibold text-center text-sm w-full">
            {{ col.header }}
          </div>
        </template>
        <template #body="{ data }">
          <!-- Acciones -->
          <div
            v-if="col.field === 'actions'"
            class="flex justify-center space-x-2"
          >
            <Button
              v-if="canEditPagoConcepto"
              icon="pi pi-pencil"
              class="p-button-rounded p-button-warning"
              @click="openCard(data)"
            />
            <Button
              v-if="canDeletePagoConcepto"
              icon="pi pi-trash"
              class="p-button-rounded p-button-danger"
              @click="openConfirmDialog(data)"
            />
            <!-- Botón Imprimir -->
            <Button
              icon="pi pi-print"
              class="p-button-rounded p-button-info"
              @click="openPrint(data)"
            />
          </div>
          <!-- Celdas normales -->
          <div
            v-if="col.field === 'fecha'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="
              copyToClipboard(formatFechaHoraFullPagoSQL(data[col.field]))
            "
          >
            {{ formatFechaHoraFullPagoSQL(data[col.field]) }}
          </div>
          <div
            v-if="col.field === 'cobramos'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard('$' + data[col.field])"
          >
            {{ "$" + data[col.field] }}
          </div>
          <div
            v-if="col.field === 'pagamos'"
            class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
            @click="copyToClipboard('$' + data[col.field])"
          >
            {{ "$" + data[col.field] }}
          </div>
          <div
            v-else-if="
              col.field !== 'cobramos' &&
              col.field !== 'pagamos' &&
              col.field !== 'saldo' &&
              col.field !== 'fecha' &&
              col.field !== 'actions'
            "
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
  <CardDetailPagoConcepto
    v-if="cardVisible"
    :pago="selectedPayment"
    :usuario="usuario"
    @close="cardVisible = false"
    @save="savePayment"
  />
  <ConfirmDeleteDialog
    v-if="confirmDialogVisible"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
  <!-- Modal de impresión -->
  <PrintPagoConcepto
    v-if="printVisible"
    :payment="paymentToPrint"
    @close="printVisible = false"
  />
  <PrintDialog
    v-if="printDialogVisible"
    @close="printDialogVisible = false"
    @ok="
      openPrint(payments[0]);
      printDialogVisible = false;
    "
  />
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ps,
  formatFechaSQL,
  formatFechaHoraFullSQL,
  formatFechaHoraFullPagoSQL,
} from "@/service/adminApp/client";
import { useAppToast } from "@/composables/useAppToast";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";
import DataTable from "@/components/ui/AppDataTable";
import Column from "@/components/ui/AppColumn.vue";
import InputText from "@/components/ui/AppInput.vue";
import Button from "@/components/ui/AppButton.vue";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailPagoConcepto from "../CardDetail/CardDetailPagoConcepto.vue";
import ConfirmDeleteDialog from "../Dialogs/ConfirmDeleteDialog.vue";
import PrintPagoConcepto from "../Print/PrintPagoConcepto.vue";
import PrintDialog from "../Print/PrintDialog.vue";
import ExportExcelButton from "../Exports/ExportExcelButton.vue";
import { usePaymentActions } from "@/composables/usePaymentActions";

const printDialogVisible = ref(false);
const canAddPagoConcepto = ref(false);
const canEditPagoConcepto = ref(false);
const canDeletePagoConcepto = ref(false);
const toast = useAppToast();
const route = useRoute();
// Datos de ejemplo
const payments = ref([]);
const { newPaymentRequest } = usePaymentActions();

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
  { field: "asunto", header: "Concepto" },
  { field: "cliente", header: "Cliente" },
  { field: "atendio", header: "Atendió" },
  { field: "pagamos", header: "Pagamos" },
  { field: "cobramos", header: "Cobramos" },
  { field: "fecha", header: "Fecha" },
  // { field: "saldo", header: "Saldo" },
]);
const actionsColumn = { field: "actions", header: "Acciones" };
const tableColumns = computed(() => [...columns.value, actionsColumn]);

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
const handleResize = () => {
  isMobile.value = window.innerWidth <= 640;
};
onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));

onMounted(async () => {
  try {
    await loadProgressively({
      pageSize: 40,
      fetchPage: (page) => ps.getPagoConcepto(page),
      onUpdate: (items) => { payments.value = items.map((item) => ({ ...item, fecha_legible: formatFechaHoraFullPagoSQL(item.fecha) })); },
      onBackgroundError: (error) => console.error("No se pudo completar la carga de pagos", error),
    });
  } catch (error) {
    console.error("No se pudieron cargar los pagos", error);
    toast.add({ severity: "error", summary: "Sin conexión", detail: "No se pudieron cargar los pagos.", life: 3500 });
  }
  const searchParam = route.query.search;
  console.log(searchParam);

  if (searchParam) {
    filters.value.global.value = searchParam;
  }
  canAddPagoConcepto.value = await hasPermission("canAddPagoConcepto");
  canEditPagoConcepto.value = await hasPermission("canEditPagoConcepto");
  canDeletePagoConcepto.value = await hasPermission("canDeletePagoConcepto");
});
watch(
  () => route.query.search,
  (newSearch) => {
    filters.value.global.value = newSearch || "";
  }
);

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
      id_atendio: usuario.value.id,
      cobramos: 0,
      pagamos: 0,
      fecha: "",
      saldo: "",
    };
  }
  cardVisible.value = true;
};
watch(newPaymentRequest, () => openCard(null));
const savePayment = async (payment) => {
  const normalizedPayment = { ...payment, fecha_legible: formatFechaHoraFullPagoSQL(payment.fecha) };

  if (payment.id) {
    const index = payments.value.findIndex((p) => p.id === payment.id);
    if (index !== -1) {
      console.log(index);
      console.log("edit save");

      payments.value.splice(index, 1, normalizedPayment);
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
    payments.value.unshift(normalizedPayment);
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Pago concepto agregado correctamente",
      life: 2000,
    });
    printDialogVisible.value = true;
  }
  cardVisible.value = false;
};

const confirmDialogVisible = ref(false);
const candidateToDelete = ref(null);
const openConfirmDialog = (payment) => {
  candidateToDelete.value = { ...payment };
  confirmDialogVisible.value = true;
};
const confirmDelete = async () => {
  if (candidateToDelete.value) {
    try {
      await ps.deletePagoConcepto(candidateToDelete.value.id);
      payments.value = payments.value.filter((p) => p.id !== candidateToDelete.value.id);
      toast.add({ severity: "warn", summary: "Eliminado", detail: "Pago concepto eliminado correctamente", life: 2000 });
    } catch (error) {
      console.error("No se pudo eliminar el pago", error);
      toast.add({ severity: "error", summary: "No eliminado", detail: "No se pudo eliminar el pago.", life: 3500 });
    }
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
:deep(.app-data-table__table) {
  min-width: 62rem;
  table-layout: fixed;
}

:deep(.app-data-table__table th) {
  height: 2.5rem;
  min-width: 0;
  padding: 0.3rem 0.35rem;
  font-size: 10px;
  line-height: 1.15;
}

:deep(.app-data-table__table th > div) {
  padding: 0.2rem !important;
  font-size: 10px !important;
  line-height: 1.15;
}

:deep(.app-data-table__table td) {
  min-width: 0;
  font-size: 12px;
}

:deep(.app-data-table__table td > div),
:deep(.app-data-table__table td div) {
  min-width: 0;
  overflow: hidden;
  padding: 0.32rem 0.28rem !important;
  font-size: 12px !important;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.app-data-table__table td .app-button) {
  width: 1.9rem;
  min-width: 1.9rem;
  min-height: 1.9rem;
  padding: 0.3rem;
  font-size: 11px;
}

:deep(.app-data-table__table td .flex) {
  gap: 0.3rem !important;
  padding: 0.32rem 0.2rem !important;
}

:deep(.app-data-table__table th:nth-child(1)),
:deep(.app-data-table__table td:nth-child(1)) { width: 10%; }
:deep(.app-data-table__table th:nth-child(2)),
:deep(.app-data-table__table td:nth-child(2)) { width: 17%; }
:deep(.app-data-table__table th:nth-child(3)),
:deep(.app-data-table__table td:nth-child(3)) { width: 15%; }
:deep(.app-data-table__table th:nth-child(4)),
:deep(.app-data-table__table td:nth-child(4)) { width: 10%; }
:deep(.app-data-table__table th:nth-child(5)),
:deep(.app-data-table__table td:nth-child(5)),
:deep(.app-data-table__table th:nth-child(6)),
:deep(.app-data-table__table td:nth-child(6)) { width: 9%; }
:deep(.app-data-table__table th:nth-child(7)),
:deep(.app-data-table__table td:nth-child(7)) { width: 17%; }
:deep(.app-data-table__table th:nth-child(8)),
:deep(.app-data-table__table td:nth-child(8)) { width: 13%; }

:deep(.app-pager) {
  min-height: 3rem;
  font-size: 11px;
}

:deep(.app-data-table__header input) {
  font-size: 0.85rem !important;
}

@media (max-width: 700px) {
  :deep(.app-data-table__table) { min-width: 58rem; }
  :deep(.app-data-table__table th),
  :deep(.app-data-table__table td),
  :deep(.app-data-table__table td > div),
  :deep(.app-data-table__table td div) {
    font-size: 11px !important;
  }
}
</style>
