<template>
  <!-- Contenedor principal de la vista -->
  <div class="shadow-xl bg-transparent text-white w-full h-full flex flex-col">
    <!-- Título -->
    <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">
      <br />
      Clientes
    </div>
    <!-- Contenedor de la tabla: se usa containerRef para medir el ancho asignado -->
    <div ref="containerRef" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
      <DataTable
        :value="customers"
        :filters="filters"
        :globalFilterFields="[
          'nombre',
          'rfc',
          'fiel',
          'ciecf',
          'telefono',
          'correo',
        ]"
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
          <div
            class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg"
          >
            <div class="flex flex-col sm:flex-row items-center gap-2 w-full">
              <!-- Buscador con ícono -->
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
                  v-if="hasPermission('canAddCliente')"
                  :label="isMobile ? '' : 'Agregar Cliente'"
                  class="p-button-success p-2"
                  @click="openCard(null)"
                />
              </div>
            </div>
          </div>
          <!-- Slider para columnas: se muestra cuando hay más de una página -->
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

        <!-- Renderizado dinámico de columnas usando la página actual -->
        <Column
          v-for="col in visibleColumns"
          :key="col.field"
          :sortable="col.field !== 'actions'"
          :field="col.field !== 'actions' ? col.field : undefined"
        >
          <!-- Encabezado de columna: color negro -->
          <template #header>
            <div class="p-1 text-black font-semibold text-center text-sm">
              {{ col.header }}
            </div>
          </template>
          <template #body="{ data }">
            <!-- Si la columna es de acciones, mostrar botones -->
            <div v-if="col.field === 'actions'" class="flex justify-center space-x-2">
              <Button icon="pi pi-pencil" class="p-button-rounded p-button-warning" @click="openCard(data)" />
              <Button icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="openConfirmDialog(data)" />
            </div>
            <!-- Sino, mostrar el contenido de la celda -->
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

    <!-- Toast -->
    <Toast />

    <!-- Card para agregar/editar clientes -->
    <CardDetailCliente
      v-if="cardVisible"
      :customer="selectedCustomer"
      @close="cardVisible = false"
      @save="saveCustomer"
    />

    <!-- Confirmación para eliminación -->
    <ConfirmDeleteDialog
      v-if="confirmDialogVisible"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailCliente from "./CardDetailCliente.vue";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.vue";
import { cs } from "@/service/adminApp/client";

const toast = useToast();

// Ejemplos de clientes
const customers = ref(
  (await cs.getClientes()).map((item) => ({
    ...item,
    nombre: item.nombre + " " + item.apellido,
  }))
);

// Definición de columnas base (sin la columna de acciones)
const columns = ref([
  { field: "nombre", header: "Nombre Cliente" },
  { field: "rfc", header: "RFC" },
  { field: "fiel", header: "Contraseña FIEL" },
  { field: "ciecf", header: "Contraseña CLECF" },
  { field: "telefono", header: "Celular" },
  { field: "email", header: "Correo Electrónico" },
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
const rowClass = (data, index) =>
  index % 2 === 0
    ? "bg-white hover:bg-gray-100"
    : "bg-gray-50 hover:bg-gray-100";

// Función para copiar al portapapeles
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

// ====================== MEDICIÓN DEL ANCHO DEL COMPONENTE ======================
// Uso de containerRef y ResizeObserver para medir el ancho asignado al componente
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
const visibleColumns = computed(() => {
  if (pages.value.length === 1) {
    return [...baseColumns.value, actionsColumn];
  } else {
    return [...pages.value[currentPageIndex.value], actionsColumn];
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
const openCard = (customer) => {
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
const saveCustomer = async (customer) => {
  if (customer) {
    // const index = customers.value.findIndex((c) => c.id_cliente === customer.id_cliente);
    const apellido = customer.nombre.split(" ")[1]
    customer.nombre = customer.nombre.split(" ")[0]
    customer.apellido = apellido;
    console.log("sending", await cs.addCliente(customer));
    // if (index !== -1) {
    customers.value[index] = { ...customer };
    toast.add({
      severity: "success",
      summary: "Actualizado",
      detail: "Cliente actualizado correctamente",
      life: 2000,
    });
    // }
  } else {
    customers.value.push(customer);
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Cliente agregado correctamente",
      life: 2000,
    });
  }
  cardVisible.value = false;
};

// Variables para confirmación de eliminación
const confirmDialogVisible = ref(false);
const candidateToDelete = ref(null);
const openConfirmDialog = (customer) => {
  candidateToDelete.value = { ...customer };
  confirmDialogVisible.value = true;
};
const confirmDelete = () => {
  if (candidateToDelete.value) {
    customers.value = customers.value.filter(
      (c) => c.id !== candidateToDelete.value.id
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
</script>
