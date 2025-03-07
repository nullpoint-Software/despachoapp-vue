<template>
  <!-- Contenedor principal de la vista con estilos globales -->
  <div class="shadow-xl bg-transparent text-white w-full h-full flex flex-col">
    <!-- Sección del título principal -->
    <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">
      <br />
      Clientes
    </div>

    <!-- Contenedor de la tabla que maneja el overflow horizontal y esquinas redondeadas -->
    <div class="flex-grow w-full overflow-hidden overflow-x-auto rounded-xl shadow-lg">
      <!--
        Componente DataTable de PrimeVue.
        Atributos:
          :value="customers"                -> Lista reactiva de clientes.
          :filters="filters"                -> Objeto de filtros para la tabla.
          :globalFilterFields="['id', 'name', 'empresa', 'email', 'tel', 'dom']"
                                            -> Campos a filtrar globalmente.
          paginator                         -> Activa la paginación.
          sortMode="multiple"               -> Permite ordenar por varias columnas a la vez.
          removableSort                   -> Permite eliminar el ordenamiento aplicado.
          :rows="5"                         -> Número fijo de filas por página.
          :rowsPerPageOptions="[5, 10, 20, 50]"
                                            -> Opciones para el número de filas por página.
          :rowClass="rowClass"              -> Función que asigna clases CSS a cada fila.
          class="w-full rounded-lg"         -> Asegura que la tabla ocupe todo el ancho y tenga bordes redondeados.
      -->
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
        class="w-full rounded-lg p-5"
      >
        <!-- Encabezado de la tabla -->
        <template #header>
          <div class="flex flex-col sm:flex-row justify-between items-center p-3 text-white font-bold text-lg rounded-t-lg">
            <!-- Botón para limpiar los filtros activos -->
            <Button
              type="button"
              icon="pi pi-filter-slash"
              label="Limpiar Filtros"
              outlined
              @click="clearFilter"
              class="mb-2 sm:mb-0 sm:mr-4"
            />
            <!-- Contenedor del campo de búsqueda global -->
            <div class="flex items-center bg-white rounded-lg overflow-hidden w-full sm:w-auto">
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
          <!-- Slider para navegación entre columnas cuando no caben todas en la pantalla -->
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

        <!-- Renderizado dinámico de columnas basado en 'visibleColumns' -->
        <Column
          v-for="col in visibleColumns"
          :key="col.field"
          sortable
          :field="col.field"
          :header="col.header"
        >
          <!-- Encabezado de cada columna -->
          <template #header="{ header }">
            <div class="p-1 text-white font-semibold text-center text-sm transition-colors duration-200">
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
    <!-- Componente Toast para notificaciones emergentes -->
    <Toast />
  </div>
</template>

<script setup>
/* 
  Importación de funciones y componentes esenciales:
  - ref: Para declarar variables reactivas.
  - computed: Para crear propiedades computadas.
  - onMounted, onUnmounted: Para gestionar eventos del ciclo de vida del componente.
  - Los componentes de PrimeVue se usan para construir la interfaz de usuario.
*/
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useToast } from "primevue/usetoast";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Toast from "primevue/toast";

// Inicialización del Toast para mostrar notificaciones al usuario.
const toast = useToast();

// Lista reactiva de clientes.
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

// Definición reactiva de las columnas de la tabla.
const columns = ref([
  { field: "id", header: "ID" },
  { field: "name", header: "Nombre" },
  { field: "empresa", header: "Empresa" },
  { field: "email", header: "Correo Electrónico" },
  { field: "tel", header: "Teléfono" },
  { field: "dom", header: "Domicilio" },
]);

// Configuración inicial de filtros para la tabla.
const filters = ref({
  global: { value: null, matchMode: "contains" },
});

// Función para limpiar el filtro global.
const clearFilter = () => {
  filters.value.global.value = null;
};

// Función que asigna clases condicionales a cada fila para alternar estilos.
const rowClass = (data, index) => {
  return index % 2 === 0
    ? "bg-white hover:bg-gray-100"  // Filas pares
    : "bg-gray-50 hover:bg-gray-100"; // Filas impares
};

// Función asíncrona para copiar texto al portapapeles y mostrar notificación.
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

// Detectar si se utiliza un dispositivo móvil (ancho de pantalla <= 640px).
const isMobile = ref(window.innerWidth <= 640);

// Variable reactiva que almacena el ancho actual de la pantalla.
const screenWidth = ref(window.innerWidth);

// Función para manejar el redimensionamiento de la ventana.
const handleResize = () => {
  screenWidth.value = window.innerWidth;
  isMobile.value = screenWidth.value <= 640;
};

// Registrar el evento 'resize' al montar el componente.
onMounted(() => {
  window.addEventListener("resize", handleResize);
});

// Remover el evento 'resize' al desmontar el componente.
onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// Propiedad computada que determina cuántas columnas mostrar según el ancho de la pantalla.
const columnsToShow = computed(() => {
  if (screenWidth.value <= 640) return 2;         // Móviles: 2 columnas
  else if (screenWidth.value <= 1024) return 3;     // Tablets: 3 columnas
  else return columns.value.length;               // Escritorio: todas las columnas
});

// Propiedad computada que indica si se debe mostrar el slider para navegación entre columnas.
const showSlider = computed(() => {
  return columnsToShow.value < columns.value.length;
});

// Variable reactiva que almacena el índice del grupo actual de columnas en el slider.
const currentPairIndex = ref(0);

// Propiedad computada que calcula el índice máximo permitido para el slider.
const maxPairIndex = computed(() =>
  Math.ceil(columns.value.length / columnsToShow.value) - 1
);

// Propiedad computada que determina las columnas visibles actualmente.
const visibleColumns = computed(() => {
  if (showSlider.value) {
    return columns.value.slice(
      currentPairIndex.value * columnsToShow.value,
      currentPairIndex.value * columnsToShow.value + columnsToShow.value
    );
  }
  return columns.value;
});

// Función para retroceder en el slider.
const prevPair = () => {
  if (currentPairIndex.value > 0) {
    currentPairIndex.value--;
  }
};

// Función para avanzar en el slider.
const nextPair = () => {
  if (currentPairIndex.value < maxPairIndex.value) {
    currentPairIndex.value++;
  }
};
</script>
