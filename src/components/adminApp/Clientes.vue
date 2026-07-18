<template>
  <!-- Contenedor principal de la vista -->
  <main ref="pageRef" class="clients-view">
    <!-- Título -->
    <header class="clients-hero">
      <div><p>ADMINISTRACIÓN / 01</p><h1>Clientes</h1><span>Expedientes, accesos y datos de contacto.</span></div>
      <div class="hero-stat"><b>{{ customers.length }}</b><span>{{ customersComplete ? 'registros' : 'cargando…' }}</span></div>
    </header>
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

    <!-- Card para agregar/editar clientes -->
    <CardDetailCliente v-if="cardVisible" :customer="selectedCustomer" @close="cardVisible = false"
      @save="saveCustomer" />

    <!-- Confirmación para eliminación -->
    <ConfirmDeleteDialog v-if="confirmDialogVisible" @confirm="confirmDelete" @cancel="cancelDelete" />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useAppToast } from "@/composables/useAppToast";
import DataTable from "@/components/ui/AppDataTable";
import { driverObjClientes } from "@/components/tour/clientes";
import Column from "@/components/ui/AppColumn.vue";
import InputText from "@/components/ui/AppInput.vue";
import Button from "@/components/ui/AppButton.vue";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailCliente from "@/components/adminApp/CardDetail/CardDetailCliente.vue";
import ConfirmDeleteDialog from "@/components/adminApp/Dialogs/ConfirmDeleteDialog.vue";
import { cs } from "@/service/adminApp/client";
import type { ColumnDef } from "@/types/ClientesTable";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";
const pageRef = ref<HTMLElement | null>(null);
useBrutalMotion(pageRef, [".clients-hero", "#clientes-table"]);
const canAddCliente = ref(false)
const canEditCliente = ref(false)
const canDeleteCliente = ref(false)

onMounted(async () => {
  canAddCliente.value = await hasPermission('canAddCliente')
  canEditCliente.value = await hasPermission('canEditCliente')
  canDeleteCliente.value = await hasPermission('canDeleteCliente')
})
const toast = useAppToast();
// Ejemplos de clientes
const customers = ref<any[]>([]);
const customersComplete = ref(false);
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
onMounted(async () => {
  try {
    await loadProgressively<any>({
      pageSize: 40,
      fetchPage: (page) => cs.getClientes(page),
      onUpdate: (items, complete) => { customers.value = items; customersComplete.value = complete; },
      onBackgroundError: (error) => console.error("No se pudo completar la carga de clientes", error),
    });
  } catch (error) {
    console.error("No se pudieron cargar los clientes", error);
    toast.add({ severity: "error", summary: "Sin conexión", detail: "No se pudieron cargar los clientes.", life: 3500 });
  }
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
    try {
      if (index !== -1) {
        const saved = await cs.editCliente(customer);
        customers.value.splice(index, 1, { ...customer, ...(saved && typeof saved === "object" ? saved : {}) });
        toast.add({ severity: "success", summary: "Actualizado", detail: "Cliente actualizado correctamente", life: 2000 });
      } else {
        const saved = await cs.addCliente(customer);
        customers.value.unshift({ ...customer, ...(saved && typeof saved === "object" ? saved : {}) });
        toast.add({ severity: "success", summary: "Agregado", detail: "Cliente agregado correctamente", life: 2000 });
      }
      cardVisible.value = false;
    } catch (error) {
      console.error("No se pudo guardar el cliente", error);
      toast.add({ severity: "error", summary: "No guardado", detail: "Revisa la conexión e inténtalo de nuevo.", life: 3500 });
    }
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
    try {
      await cs.deleteCliente(candidateToDelete.value.id_cliente);
      customers.value = customers.value.filter((c: any) => c.id_cliente !== candidateToDelete.value.id_cliente);
      toast.add({ severity: "warn", summary: "Eliminado", detail: "Cliente eliminado correctamente", life: 2000 });
    } catch (error) {
      console.error("No se pudo eliminar el cliente", error);
      toast.add({ severity: "error", summary: "No eliminado", detail: "No se pudo eliminar el cliente.", life: 3500 });
    }
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
<style scoped>
.clients-view{min-height:100%;padding:clamp(1rem,2.5vw,2rem);background:var(--br-bg);color:var(--br-text)}.clients-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.5rem 0;border-top:1px solid var(--br-line);border-bottom:1px solid var(--br-line);margin-bottom:1rem}.clients-hero p{margin:0 0 .5rem;color:var(--br-accent);font:800 .75rem "Courier New",monospace;letter-spacing:.12em}.clients-hero h1{margin:0;font:900 clamp(3.2rem,9vw,7rem)/.75 Arial,sans-serif;letter-spacing:-.075em;text-transform:uppercase}.clients-hero>div>span{display:block;margin-top:1rem;color:var(--br-muted);font:700 .9rem "Courier New",monospace}.hero-stat{min-width:10rem;padding:1rem;border:1px solid var(--br-line-strong);text-align:right}.hero-stat b{display:block;font:900 2.8rem/1 Arial,sans-serif}.hero-stat span{font:800 .7rem "Courier New",monospace;text-transform:uppercase}@media(max-width:640px){.clients-hero{align-items:flex-start;flex-direction:column}.hero-stat{width:100%;text-align:left}}
</style>
