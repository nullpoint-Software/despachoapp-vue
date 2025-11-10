<template>
  <!-- Contenedor principal de la vista -->
  <div class="shadow-xl bg-transparent text-white w-full h-full flex flex-col">
    <!-- Título -->
    <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">
      <br />
      Clientes
    </div>
    <!-- Contenedor de la tabla: se usa containerRef para medir el ancho asignado -->
    <div ref="containerRef" id="clientes-table" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
      <DataTable id="inner-info" :value="customers" :filters="filters" :globalFilterFields="[
        'id_cliente',
        'nombre',
        'rfc',
        'fiel',
        'ciecf',
        'telefono',
        'correo',
      ]" paginator sortMode="multiple" removableSort :rows="5" :rowsPerPageOptions="[5, 10, 20, 50]"
        :rowClass="rowClass" class="w-full rounded-lg p-5">
        <!-- Encabezado de la tabla -->
        <template #header>
          <div
            class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg">
            <div class="flex flex-col sm:flex-row items-center gap-2 w-full">
              <!-- Buscador con ícono -->
              <div class="flex space-x-2 border-2 border-solid">
                <span>
                  <i class="pi pi-search text-gray-400 text-xl"></i>
                </span>
              </div>
              <div id="search-bar" class="relative w-full sm:w-auto">
                <InputText v-model="filters.global.value" autocomplete="new-password" placeholder="Buscar..."
                  class="w-full pl-10 p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <!-- Botones -->
              <div class="flex space-x-2">
                <Button type="button" icon="pi pi-filter-slash" :label="isMobile ? '' : 'Limpiar Filtros'" outlined
                  class="p-2" @click="clearFilter" />
                <Button icon="pi pi-plus" v-if="canAddCliente" :label="isMobile ? '' : 'Agregar Cliente'"
                  class="p-button-success p-2" id="agregar-cliente-btn" @click="openCard(null)" />
              </div>
            </div>
          </div>
          <!-- Slider para columnas: se muestra cuando hay más de una página -->
          <div v-if="pages.length > 1"
            class="flex justify-center items-center space-x-2 p-2 bg-gray-800 rounded-md shadow-md mt-2">
            <Button icon="pi pi-chevron-left" @click="prevPage" :disabled="currentPageIndex === 0"
              class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info" />
            <Button icon="pi pi-chevron-right" @click="nextPage" :disabled="currentPageIndex === maxPageIndex"
              class="p-button-rounded p-button-outlined p-button-secondary hover:p-button-info" />
          </div>
        </template>

        <!-- Renderizado dinámico de columnas usando la página actual -->
        <Column v-for="col in visibleColumns" :key="col.field" :sortable="col.field !== 'actions'"
          :field="col.field !== 'actions' ? col.field : undefined">
          <!-- Encabezado de columna: color negro -->
          <template #header>
            <div class="p-1 text-black font-semibold text-center text-sm w-full">
              {{ col.header }}
            </div>
          </template>
          <template #body="{ data }">
            <!-- Si la columna es de acciones, mostrar botones -->
            <div v-if="col.field === 'actions'" class="flex justify-center space-x-2">
              <Button v-if="canEditCliente" icon="pi pi-pencil" class="p-button-rounded p-button-warning"
                @click="openCard(data)" />
              <Button v-if="canDeleteCliente" icon="pi pi-trash" class="p-button-rounded p-button-danger"
                @click="openConfirmDialog(data)" />
            </div>
            <!-- Sino, mostrar el contenido de la celda -->
            <div v-else class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
              @click="handleCellClick(data, col.field, col)">
              <span v-if="col.visible || isFieldVisible(data, col.field)">
                {{ data[col.field] }}
              </span>
              <!-- Caso contrario, mostrar enmascarado -->
              <span v-else>
                *****
              </span>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Toast -->
    <Toast />

    <!-- Card para agregar/editar clientes -->
    <CardDetailCliente v-if="cardVisible" :customer="selectedCustomer" @close="cardVisible = false"
      @save="saveCustomer" />

    <!-- Confirmación para eliminación -->
    <ConfirmDeleteDialog v-if="confirmDialogVisible" @confirm="confirmDelete" @cancel="cancelDelete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import { driverObjClientes } from "@/components/tour/clientes";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailCliente from "@/components/adminApp/CardDetail/CardDetailCliente.vue";
import ConfirmDeleteDialog from "@/components/adminApp/Dialogs/ConfirmDeleteDialog.vue";
import { cs } from "@/service/adminApp/client";
import type { ColumnDef } from "@/types/ClientesTable";
const canAddCliente = ref(false)
const canEditCliente = ref(false)
const canDeleteCliente = ref(false)

onMounted(async () => {
  canAddCliente.value = await hasPermission('canAddCliente')
  canEditCliente.value = await hasPermission('canEditCliente')
  canDeleteCliente.value = await hasPermission('canDeleteCliente')
})
const toast = useToast();
// Ejemplos de clientes
const customers = ref(await cs.getClientes());
// Definición de columnas base (sin la columna de acciones)
const columns = ref<ColumnDef[]>([
  { field: "id_cliente", header: "ID", visible: true },
  { field: "nombre", header: "Nombre Cliente", visible: true },
  { field: "rfc", header: "RFC", visible: false },
  { field: "fiel", header: "Contraseña FIEL", visible: false },
  { field: "ciecf", header: "Contraseña CLECF", visible: false },
  { field: "telefono", header: "Celular", visible: true },
  { field: "email", header: "Correo Electrónico", visible: true },
]);

// Columna de acciones (siempre se mostrará)
const actionsColumn = { field: "actions", header: "Acciones" };
// Base de columnas para el slider (excluyendo la columna de acciones)
const baseColumns = computed(() => columns.value);

// Filtros
const filters = ref({
  global: { value: null, matchMode: "contains" },
});
const clearFilter = () => {
  filters.value.global.value = null;
};

// Clase para las filas
const rowClass = ((data: any, index: number) =>
  index % 2 === 0
    ? "bg-white hover:bg-gray-100"
    : "bg-gray-50 hover:bg-gray-100") as any;


// Función para copiar al portapapeles
const copyToClipboard = async (text: string, confidential?: boolean) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({
      severity: "info",
      summary: "Copiado",
      detail: confidential ? 'Dato protegido' : text,
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

// ====================== MEDICIÓN DEL ANCHO DEL COMPONENTE ======================
// Uso de containerRef y ResizeObserver para medir el ancho asignado al componente
const containerRef = ref(null);
const containerWidth = ref(0);
let resizeObserver: ResizeObserver;
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(containerRef.value);
    const done = localStorage.getItem('tourClientesDone');
    if (!done) {
      driverObjClientes.drive()
    }
    
  }
});
onUnmounted(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value);
  }
});
// ====================== FIN DE MEDICIÓN ======================

// ====================== CÁLCULO DE PÁGINAS DEL SLIDER ======================
// Definición del ancho mínimo para cada columna (en píxeles)
const minColumnWidth = 150;
// Número de columnas que cabrían si se muestran todas (incluyendo la columna de acciones)
const visibleCount = computed(() =>
  Math.floor((containerWidth.value || screenWidth.value) / minColumnWidth)
);
// Si todas (baseColumns + actions) caben, no se activa el slider
const totalColumnsWithActions = computed(() => baseColumns.value.length + 1);
const sliderActive = computed(() => totalColumnsWithActions.value > visibleCount.value);

// Para el slider, reservamos siempre espacio para la columna de acciones.
// La primera página mostrará (visibleCount - 1) columnas de base, y las páginas siguientes se agruparán de 2 en 2.
const pages = computed(() => {
  const total = baseColumns.value.length;
  const vis = visibleCount.value;
  // Si todas las columnas (base + actions) caben, una sola página
  if (total + 1 <= vis) return [baseColumns.value];
  const pagesArray = [];
  // Primera página: vis - 1 columnas de base
  const firstPageCount = Math.max(1, vis - 1);
  pagesArray.push(baseColumns.value.slice(0, firstPageCount));
  const remaining = baseColumns.value.slice(firstPageCount);
  for (let i = 0; i < remaining.length; i += 2) {
    pagesArray.push(remaining.slice(i, i + 2));
  }
  return pagesArray;
});

// Reinicia el índice de página cuando cambian las páginas (por redimensionamiento, por ejemplo)
const currentPageIndex = ref(0);
watch(pages, () => {
  currentPageIndex.value = 0;
});
const maxPageIndex = computed(() => pages.value.length - 1);

// Las columnas visibles siempre incluyen la página actual de baseColumns + la columna de acciones
const visibleColumns = computed<ColumnDef[]>(() => {
  const showActions = canEditCliente.value || canDeleteCliente.value;

  if (pages.value.length === 1) {
    return showActions
      ? [...baseColumns.value, actionsColumn]
      : [...baseColumns.value];
  } else {
    return showActions
      ? [...pages.value[currentPageIndex.value], actionsColumn]
      : [...pages.value[currentPageIndex.value]];
  }
});

// Funciones de navegación del slider (páginas)
const prevPage = () => {
  if (currentPageIndex.value > 0) currentPageIndex.value--;
};
const nextPage = () => {
  if (currentPageIndex.value < maxPageIndex.value) currentPageIndex.value++;
};
// ====================== FIN DEL SLIDER ======================

// Variables para el Card de agregar/editar clientes
const cardVisible = ref(false);
const selectedCustomer = ref({});
const openCard = (customer: any) => {
  if (customer) {
    selectedCustomer.value = { ...customer };
  } else {
    selectedCustomer.value = {
      id_cliente: "",
      nombre: "",
      rfc: "",
      fiel: "",
      ciecf: "",
      telefono: "",
      email: "",
    };
  }
  cardVisible.value = true;
};
const saveCustomer = async (customer: any) => {
  if (customer) {
    const index = customers.value.findIndex((c: any) => c.id_cliente === customer.id_cliente);
    if (index !== -1) {
      customers.value[index] = { ...customer };
      console.log("sending edit to id " + customer.id_cliente, await cs.editCliente(customer))
      toast.add({
        severity: "success",
        summary: "Actualizado",
        detail: "Cliente actualizado correctamente",
        life: 2000,
      });
    } else {
      customers.value.unshift(customer);
      toast.add({
        severity: "success",
        summary: "Agregado",
        detail: "Cliente agregado correctamente",
        life: 2000,
      });
      console.log("sending", await cs.addCliente(customer));
      window.location.reload()
    }
    cardVisible.value = false;
  }
}

// Variables para confirmación de eliminación
const confirmDialogVisible = ref(false);
const candidateToDelete: any = ref(null);
const openConfirmDialog = (customer: any) => {
  candidateToDelete.value = { ...customer };
  confirmDialogVisible.value = true;
};
const confirmDelete = async () => {
  if (candidateToDelete.value) {
    console.log("deleting cliente with id " + candidateToDelete.value.id, await cs.deleteCliente(candidateToDelete.value.id_cliente))
    customers.value = await customers.value.filter(
      (c: any) => c.id_cliente !== candidateToDelete.value.id_cliente
    );
    toast.add({
      severity: "warn",
      summary: "Eliminado",
      detail: "Cliente eliminado correctamente",
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


const revealed = ref<Record<string, Record<string, boolean>>>({});
function isFieldVisible(row: any, field: string) {
  return revealed.value[row.id_cliente]?.[field] ?? false;
}

// Toggle reveal
function toggleField(row: any, field: string) {
  if (!revealed.value[row.id_cliente]) {
    revealed.value[row.id_cliente] = {};
  }
  revealed.value[row.id_cliente][field] =
    !revealed.value[row.id_cliente][field];
}

function handleCellClick(row: any, field: string, col: ColumnDef) {
  const isVisible = col.visible ?? true;
  copyToClipboard(row[field], !col.visible);
  // Toggle only if the column is sensitive (visible === false)
  if (!isVisible) {
    toggleField(row, field);
  }
}
</script>
