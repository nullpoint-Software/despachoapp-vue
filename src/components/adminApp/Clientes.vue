<template>
  <!-- Contenedor principal de la vista -->
  <div class="shadow-xl bg-transparent text-white w-full h-full flex flex-col">
    <!-- Título -->
    <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">
      <br />
      Clientes
    </div>

    <!-- Contenedor de la tabla (diseño original) -->
    <div class="flex-grow w-full overflow-hidden overflow-x-auto rounded-xl shadow-lg">
      <DataTable
        :value="customers"
        :filters="filters"
        :globalFilterFields="['nombre', 'rfc', 'fiel', 'clecf', 'celular', 'correo']"
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
              <!-- Buscador con ícono a la izquierda -->
              <div class="flex space-x-2 border-2 border-solid">
                <span class="">
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
                  :label="isMobile ? '' : 'Agregar Cliente'"
                  class="p-button-success p-2"
                  @click="openCard(null)"
                />
              </div>
            </div>
          </div>
          <!-- Slider para navegación entre columnas (si aplica) -->
          <div v-if="showSlider" class="flex justify-center items-center space-x-2 p-2">
            <Button
              icon="pi pi-chevron-left"
              @click="prevPair"
              :disabled="currentPairIndex === 0"
              class="p-button-rounded p-button-outlined"
            />
            <Button
              icon="pi pi-chevron-right"
              @click="nextPair"
              :disabled="currentPairIndex === maxPairIndex"
              class="p-button-rounded p-button-outlined"
            />
          </div>
        </template>

        <!-- Renderizado dinámico de columnas -->
        <Column
          v-for="col in visibleColumns"
          :key="col.field"
          sortable
          :field="col.field"
          :header="col.header"
        >
          <!-- Header centrado -->
          <template #header="{ header }">
            <div class="p-1 text-white font-semibold text-center text-sm">
              {{ header }}
            </div>
          </template>
          <!-- Cuerpo centrado -->
          <template #body="{ data, field }">
            <div
              class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
              @click="copyToClipboard(data[field])"
            >
              {{ data[field] }}
            </div>
          </template>
        </Column>

        <!-- Columna de acciones SIN header -->
        <Column>
          <template #body="{ data }">
            <div class="flex justify-center space-x-2">
              <Button icon="pi pi-pencil" class="p-button-rounded p-button-warning" @click="openCard(data)" />
              <Button icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="openConfirmDialog(data)" />
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";
import CardDetailCliente from "./CardDetailCliente.vue";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog.vue";

const toast = useToast();

// Ejemplos de clientes
const customers = ref([
  {
    id: "1001",
    nombre: "Juan Pérez",
    rfc: "JUPE880101XYZ",
    fiel: "claveFIEL123",
    clecf: "claveCLECF123",
    celular: "5566778899",
    correo: "juan.perez@email.com",
  },
  {
    id: "1002",
    nombre: "María López",
    rfc: "MALO900202ABC",
    fiel: "claveFIEL456",
    clecf: "claveCLECF456",
    celular: "5544332211",
    correo: "maria.lopez@email.com",
  },
  {
    id: "1003",
    nombre: "Carlos Ramírez",
    rfc: "CARA920303DEF",
    fiel: "claveFIEL789",
    clecf: "claveCLECF789",
    celular: "5511223344",
    correo: "carlos.ramirez@email.com",
  },
]);

// Columnas definidas
const columns = ref([
  { field: "nombre", header: "Nombre Cliente" },
  { field: "rfc", header: "RFC" },
  { field: "fiel", header: "Contraseña FIEL" },
  { field: "clecf", header: "Contraseña CLECF" },
  { field: "celular", header: "Celular" },
  { field: "correo", header: "Correo Electrónico" },
]);

// Filtros
const filters = ref({
  global: { value: null, matchMode: "contains" },
});
const clearFilter = () => {
  filters.value.global.value = null;
};

// Clase para filas
const rowClass = (data, index) =>
  index % 2 === 0 ? "bg-white hover:bg-gray-100" : "bg-gray-50 hover:bg-gray-100";

// Copiar texto al portapapeles
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({ severity: "info", summary: "Copiado", detail: text, life: 2000 });
  } catch (err) {
    toast.add({ severity: "error", summary: "Error", detail: "No se pudo copiar", life: 2000 });
  }
};

// Slider de columnas
const isMobile = ref(window.innerWidth <= 640);
const screenWidth = ref(window.innerWidth);
const handleResize = () => {
  screenWidth.value = window.innerWidth;
  isMobile.value = screenWidth.value <= 640;
};
onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));
const columnsToShow = computed(() => {
  if (screenWidth.value <= 640) return 2;
  else if (screenWidth.value <= 1024) return 3;
  else return columns.value.length;
});
const showSlider = computed(() => columnsToShow.value < columns.value.length);
const currentPairIndex = ref(0);
const maxPairIndex = computed(() =>
  Math.ceil(columns.value.length / columnsToShow.value) - 1
);
const visibleColumns = computed(() => {
  if (showSlider.value) {
    return columns.value.slice(
      currentPairIndex.value * columnsToShow.value,
      currentPairIndex.value * columnsToShow.value + columnsToShow.value
    );
  }
  return columns.value;
});
const prevPair = () => {
  if (currentPairIndex.value > 0) currentPairIndex.value--;
};
const nextPair = () => {
  if (currentPairIndex.value < maxPairIndex.value) currentPairIndex.value++;
};

// Variables para el card de agregar/editar
const cardVisible = ref(false);
const selectedCustomer = ref({});
const openCard = (customer) => {
  if (customer) {
    selectedCustomer.value = { ...customer };
  } else {
    selectedCustomer.value = {
      id: "",
      nombre: "",
      rfc: "",
      fiel: "",
      clecf: "",
      celular: "",
      correo: "",
    };
  }
  cardVisible.value = true;
};
const saveCustomer = (customer) => {
  if (customer.id) {
    const index = customers.value.findIndex((c) => c.id === customer.id);
    if (index !== -1) {
      customers.value[index] = { ...customer };
      toast.add({
        severity: "success",
        summary: "Actualizado",
        detail: "Cliente actualizado correctamente",
        life: 2000,
      });
    }
  } else {
    customer.id = Date.now().toString();
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
    customers.value = customers.value.filter((c) => c.id !== candidateToDelete.value.id);
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
