<template>
  <!-- Contenedor principal sin cambios en margin o padding -->
  <div
    class="shadow-xl bg-transparent bg-gradient-to-r from-blue-500 to-purple-600 text-white w-full h-full flex flex-col"
  >
    <!-- Título principal -->
    <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">
      <br />
      Clientes
    </div>

    <!-- Contenedor para la tabla con overflow horizontal -->
    <div
      class="flex-grow w-full overflow-hidden overflow-x-auto rounded-xl shadow-lg"
    >
      <!-- DataTable sin cambios en margin o padding -->
      <DataTable
        :value="customers"
        :filters="filters"
        :globalFilterFields="['id', 'name', 'empresa', 'email', 'tel', 'dom']"
        paginator
        sortMode="multiple"
        removableSort
        :rows="5"
        :rowsPerPageOptions="[5, 10, 20, 50]"
        :rowClass="rowClass"
        class="w-full border border-black bg-white text-gray-900 rounded-lg"
      >
        <!-- Encabezado de la tabla -->
        <template #header>
          <div
            class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg"
          >
            <Button
              type="button"
              icon="pi pi-filter-slash"
              label="Limpiar Filtros"
              outlined
              @click="clearFilter"
              class="mb-2 sm:mb-0 sm:mr-4"
            />
            <div
              class="flex items-center bg-white rounded-lg overflow-hidden w-full sm:w-auto"
            >
              <span class="p-2">
                <i class="pi pi-search text-gray-400"></i>
              </span>
              <InputText
                v-model="filters.global.value"
                placeholder="Buscar..."
                class="p-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              />
            </div>
          </div>
          <!-- NUEVO: Slider para móviles (solo se muestra en dispositivos móviles) -->
          <div v-if="isMobile" class="flex justify-center items-center space-x-2 p-2">
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

        <!-- Se renderizan las columnas usando una propiedad computada para simplificar -->
        <Column
          v-for="col in visibleColumns"
          :key="col.field"
          sortable
          :field="col.field"
          :header="col.header"
        >
          <!-- Encabezado de cada columna -->
          <template #header="{ header }">
            <div
              class="p-1 text-white font-semibold text-center text-sm transition-colors duration-200"
            >
              {{ header }}
            </div>
          </template>
          <!-- Cuerpo de cada columna -->
          <template #body="{ data, field }">
            <div
              class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors duration-200 text-sm"
              @click="copyToClipboard(data[field])"
            >
              {{ data[field] }}
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
    <!-- Componente Toast para notificaciones -->
    <Toast />
  </div>
</template>

<script setup>
// Importación de funciones y componentes necesarios desde Vue y PrimeVue
import { ref, computed, onMounted, onUnmounted } from "vue"; // Se añaden computed, onMounted y onUnmounted para el slider responsive
import { useToast } from "primevue/usetoast"; // Importa el hook para utilizar Toast
import DataTable from "primevue/datatable"; // Importa el componente DataTable para mostrar tablas
import Column from "primevue/column"; // Importa el componente Column para definir columnas en la tabla
import InputText from "primevue/inputtext"; // Importa el componente InputText para campos de texto
import Button from "primevue/button"; // Importa el componente Button para botones
import Toast from "primevue/toast"; // Importa el componente Toast para notificaciones

// Inicialización del Toast para mostrar notificaciones al usuario (sin cambios)
const toast = useToast();

// Definición de la lista de clientes (sin cambios)
const customers = ref([
  {
    id: "2333",
    name: "Juan Perez",
    empresa: "Abarrotes Perez",
    email: "juanp@yahoo.mx",
    tel: "(536) 234 2344",
    dom: "Morelos 18, El Grullo, Jalisco",
  },
  {
    id: "2334",
    name: "Maria López",
    empresa: "Tienda Lupita",
    email: "maria.lopez@gmail.com",
    tel: "(331) 789 5678",
    dom: "Juárez 45, Autlán, Jalisco",
  },
  {
    id: "2335",
    name: "Carlos Ramírez",
    empresa: "Electro Ramírez",
    email: "c.ramirez@hotmail.com",
    tel: "(312) 456 7890",
    dom: "Av. Hidalgo 90, Tonaya, Jalisco",
  },
]);

// Definición de las columnas de la tabla (sin cambios)
const columns = ref([
  { field: "id", header: "ID" },
  { field: "name", header: "Nombre" },
  { field: "empresa", header: "Empresa" },
  { field: "email", header: "Correo Electrónico" },
  { field: "tel", header: "Teléfono" },
  { field: "dom", header: "Domicilio" },
]);

// Configuración inicial de los filtros para la tabla (sin cambios)
const filters = ref({
  global: { value: null, matchMode: "contains" },
});

// Función para limpiar el filtro global (sin cambios)
const clearFilter = () => {
  filters.value.global.value = null;
};

// Función para asignar clases a las filas de la tabla (sin cambios)
const rowClass = (data, index) => {
  return index % 2 === 0
    ? "bg-white hover:bg-gray-100"
    : "bg-gray-50 hover:bg-gray-100";
};

// Función asíncrona para copiar texto al portapapeles (sin cambios)
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({
      severity: "info",
      summary: "Copiado",
      detail: `${text}`,
      life: 2000,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo copiar al portapapeles",
      life: 2000,
    });
  }
};

// NUEVO: Detectar si es un dispositivo móvil (ancho <= 640px)
const isMobile = ref(window.innerWidth <= 640);
const handleResize = () => {
  isMobile.value = window.innerWidth <= 640;
};
onMounted(() => {
  window.addEventListener("resize", handleResize);
});
onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// NUEVO: Estado actual del slider: índice del par actual (cada par son 2 columnas)
const currentPairIndex = ref(0);
// NUEVO: Calcula el índice máximo del slider (número de pares - 1)
const maxPairIndex = computed(() => Math.ceil(columns.value.length / 2) - 1);

// NUEVO: Computed property que determina las columnas visibles
const visibleColumns = computed(() => {
  // Si es móvil, se muestran 2 columnas según el índice actual; en desktop se muestran todas
  return isMobile.value
    ? columns.value.slice(currentPairIndex.value * 2, currentPairIndex.value * 2 + 2)
    : columns.value;
});

// NUEVO: Funciones para navegar en el slider
const prevPair = () => {
  if (currentPairIndex.value > 0) {
    currentPairIndex.value--;
  }
};
const nextPair = () => {
  if (currentPairIndex.value < maxPairIndex.value) {
    currentPairIndex.value++;
  }
};
</script>
