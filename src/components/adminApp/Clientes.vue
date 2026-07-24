<template>
  <!-- Contenedor principal de la vista -->
  <main ref="pageRef" class="clients-view">
    <!-- Título -->
    <header class="clients-hero">
      <div><p>ADMINISTRACIÓN / 01</p><h1>Clientes</h1><span>Expedientes, accesos y datos de contacto.</span></div>
      <div class="hero-stat"><b>{{ customers.length }}</b><span>{{ customersComplete ? 'registros' : 'cargando…' }}</span></div>
    </header>
    <div id="clientes-table" class="flex-grow w-full overflow-hidden rounded-xl shadow-lg">
      <DataTable id="inner-info" :value="customers" :filters="filters" :globalFilterFields="[
        'id_cliente',
        'nombre',
        'rfc',
        'regimen_fiscal',
        'fiel',
        'ciecf',
        'telefono',
        'correo',
      ]" :paginator="!isMobile" sortMode="multiple" removableSort :rows="10" :rowsPerPageOptions="[10, 20, 50]"
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
        </template>

        <!-- Renderizado dinámico de columnas usando la página actual -->
        <Column v-for="col in tableColumns" :key="col.field" :sortable="col.field !== 'actions'"
          :field="col.field !== 'actions' ? col.field : undefined">
          <!-- Encabezado de columna: color negro -->
          <template #header>
            <div class="p-1 text-black font-semibold text-center text-sm w-full">
              {{ col.header }}
            </div>
          </template>
          <template #body="{ data }">
            <!-- Si la columna es de acciones, mostrar botones -->
            <div v-if="col.field === 'actions'" class="client-actions flex justify-center space-x-2">
              <Button v-if="canEditCliente" icon="pi pi-pencil" class="p-button-rounded p-button-warning"
                @click="openCard(data)" />
              <Button v-if="canEditCliente" icon="pi pi-folder" class="p-button-rounded p-button-info"
                aria-label="Abrir documentos del cliente" @click="openDocuments(data)" />
              <Button v-if="canDeleteCliente" icon="pi pi-trash" class="p-button-rounded p-button-danger"
                @click="openConfirmDialog(data)" />
            </div>
            <!-- Sino, mostrar el contenido de la celda -->
            <div v-else :title="col.visible === false ? 'Dato protegido' : String(data[col.field] ?? '')"
              class="p-1 text-center border-b border-gray-200 cursor-pointer hover:bg-gray-200 text-sm"
              @click="handleCellClick(data, col.field, col)">
              <span v-if="col.visible || isFieldVisible(data, col.field)">
                {{ col.field === 'regimen_fiscal' ? regimenFiscalLabel(data[col.field]) : data[col.field] }}
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
    <ClientDocumentsModal v-if="selectedDocumentClient" :client="selectedDocumentClient"
      @close="selectedDocumentClient = null" />

    <div v-if="credentialDialogVisible" class="credential-overlay" @click.self="closeCredentialDialog">
      <form class="credential-dialog" @submit.prevent="verifyAndReveal">
        <header>
          <div>
            <p>VERIFICACIÓN DE IDENTIDAD</p>
            <h2>Revelar credencial</h2>
            <span>Confirma tu contraseña de acceso para consultar este dato protegido.</span>
          </div>
          <button type="button" aria-label="Cerrar" @click="closeCredentialDialog">×</button>
        </header>
        <label>
          <span>Tu contraseña</span>
          <InputText v-model="verificationPassword" type="password" autocomplete="current-password"
            autofocus placeholder="Escribe tu contraseña" />
        </label>
        <p v-if="verificationError" class="credential-error" role="alert">{{ verificationError }}</p>
        <footer>
          <Button type="button" label="Cancelar" outlined :disabled="verificationBusy" @click="closeCredentialDialog" />
          <Button type="submit" label="Verificar y mostrar" icon="pi pi-eye"
            :disabled="!verificationPassword || verificationBusy" />
        </footer>
      </form>
    </div>

    <!-- Confirmación para eliminación -->
    <ConfirmDeleteDialog v-if="confirmDialogVisible" @confirm="confirmDelete" @cancel="cancelDelete" />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useAppToast } from "@/composables/useAppToast";
import DataTable from "@/components/ui/AppDataTable";
import { driverObjClientes } from "@/components/tour/clientes";
import Column from "@/components/ui/AppColumn.vue";
import InputText from "@/components/ui/AppInput.vue";
import Button from "@/components/ui/AppButton.vue";
import { hasPermission } from "@/service/adminApp/permissionsService";
import CardDetailCliente from "@/components/adminApp/CardDetail/CardDetailCliente.vue";
import ConfirmDeleteDialog from "@/components/adminApp/Dialogs/ConfirmDeleteDialog.vue";
import ClientDocumentsModal from "@/components/adminApp/ClientDocumentsModal.vue";
import { cs } from "@/service/adminApp/client";
import type { ColumnDef } from "@/types/ClientesTable";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";
import { regimenFiscalLabel } from "@/constants/regimenesFiscales";
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
  { field: "regimen_fiscal", header: "Régimen Fiscal", visible: true },
  { field: "fiel", header: "Contraseña FIEL", visible: false },
  { field: "ciecf", header: "Contraseña CLECF", visible: false },
  { field: "telefono", header: "Celular", visible: true },
  { field: "email", header: "Correo Electrónico", visible: true },
]);

// Columna de acciones (siempre se mostrará)
const actionsColumn = { field: "actions", header: "Acciones" };
// Base de columnas para el slider (excluyendo la columna de acciones)
const tableColumns = computed<ColumnDef[]>(() => {
  const showActions = canEditCliente.value || canDeleteCliente.value;
  return showActions ? [...columns.value, actionsColumn] : [...columns.value];
});

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
const handleResize = () => {
  isMobile.value = window.innerWidth <= 640;
};
onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));

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
  const done = localStorage.getItem('tourClientesDone');
  if (!done) {
    driverObjClientes.drive()
  }
});

// Variables para el Card de agregar/editar clientes
const cardVisible = ref(false);
const selectedCustomer = ref({});
const selectedDocumentClient = ref<any | null>(null);
const openDocuments = (customer: any) => {
  selectedDocumentClient.value = { ...customer };
};
const openCard = (customer: any) => {
  if (customer) {
    selectedCustomer.value = { ...customer };
  } else {
    selectedCustomer.value = {
      id_cliente: "",
      nombre: "",
      rfc: "",
      regimen_fiscal: "",
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
        const previous = customers.value[index];
        customers.value.splice(index, 1, {
          ...customer,
          ...(saved && typeof saved === "object" ? saved : {}),
          fiel: null,
          ciecf: null,
          tiene_fiel: previous.tiene_fiel || Boolean(customer.fiel),
          tiene_ciecf: previous.tiene_ciecf || Boolean(customer.ciecf),
        });
        toast.add({ severity: "success", summary: "Actualizado", detail: "Cliente actualizado correctamente", life: 2000 });
      } else {
        const saved = await cs.addCliente(customer);
        customers.value.unshift({
          ...customer,
          ...(saved && typeof saved === "object" ? saved : {}),
          fiel: null,
          ciecf: null,
          tiene_fiel: Boolean(customer.fiel),
          tiene_ciecf: Boolean(customer.ciecf),
        });
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
const revealedValues = ref<Record<string, Record<string, string>>>({});
const revealTimers = new Map<string, ReturnType<typeof setTimeout>>();
type ProtectedClientField = "rfc" | "fiel" | "ciecf";
onUnmounted(() => {
  revealTimers.forEach((timer) => clearTimeout(timer));
  revealTimers.clear();
});
const credentialDialogVisible = ref(false);
const credentialTarget = ref<{ row: any; field: ProtectedClientField } | null>(null);
const verificationPassword = ref("");
const verificationError = ref("");
const verificationBusy = ref(false);

function isFieldVisible(row: any, field: string) {
  return revealed.value[row.id_cliente]?.[field] ?? false;
}

function setFieldVisibility(row: any, field: string, visible: boolean) {
  if (!revealed.value[row.id_cliente]) revealed.value[row.id_cliente] = {};
  revealed.value[row.id_cliente][field] = visible;
}

function clearsValueWhenHidden(field: string) {
  return field === "fiel" || field === "ciecf";
}

function closeCredentialDialog() {
  if (verificationBusy.value) return;
  credentialDialogVisible.value = false;
  credentialTarget.value = null;
  verificationPassword.value = "";
  verificationError.value = "";
}

async function verifyAndReveal() {
  const target = credentialTarget.value;
  if (!target || !verificationPassword.value) return;
  verificationBusy.value = true;
  verificationError.value = "";
  try {
    const response = await cs.revelarCredencial(
      target.row.id_cliente,
      target.field,
      verificationPassword.value,
    );
    const rowKey = String(target.row.id_cliente);
    if (!revealedValues.value[rowKey]) revealedValues.value[rowKey] = {};
    revealedValues.value[rowKey][target.field] = response.value;
    target.row[target.field] = response.value;
    setFieldVisibility(target.row, target.field, true);

    const timerKey = `${rowKey}:${target.field}`;
    const previousTimer = revealTimers.get(timerKey);
    if (previousTimer) clearTimeout(previousTimer);
    revealTimers.set(timerKey, setTimeout(() => {
      setFieldVisibility(target.row, target.field, false);
      delete revealedValues.value[rowKey]?.[target.field];
      if (clearsValueWhenHidden(target.field)) target.row[target.field] = null;
      revealTimers.delete(timerKey);
    }, 20000));

    verificationBusy.value = false;
    closeCredentialDialog();
    toast.add({ severity: "success", summary: "Identidad verificada", detail: "La credencial se ocultará en 20 segundos.", life: 3000 });
  } catch (error: any) {
    verificationError.value = error?.response?.data?.error || "No fue posible verificar tu identidad.";
    verificationBusy.value = false;
    verificationPassword.value = "";
  }
}

function handleCellClick(row: any, field: string, col: ColumnDef) {
  const isVisible = col.visible ?? true;
  if (isVisible) {
    copyToClipboard(row[field]);
    return;
  }
  if (isFieldVisible(row, field)) {
    copyToClipboard(revealedValues.value[row.id_cliente]?.[field] || row[field], true);
    setFieldVisibility(row, field, false);
    if (clearsValueWhenHidden(field)) row[field] = null;
    const timerKey = `${row.id_cliente}:${field}`;
    const timer = revealTimers.get(timerKey);
    if (timer) clearTimeout(timer);
    revealTimers.delete(timerKey);
    return;
  }
  credentialTarget.value = { row, field: field as ProtectedClientField };
  verificationPassword.value = "";
  verificationError.value = "";
  credentialDialogVisible.value = true;
}
</script>
<style scoped>
.clients-view{min-height:100%;padding:clamp(1rem,2.5vw,2rem);background:var(--br-bg);color:var(--br-text)}.clients-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.5rem 0;border-top:1px solid var(--br-line);border-bottom:1px solid var(--br-line);margin-bottom:1rem}.clients-hero p{margin:0 0 .5rem;color:var(--br-accent);font:800 .75rem "Courier New",monospace;letter-spacing:.12em}.clients-hero h1{margin:0;font:900 clamp(3.2rem,9vw,7rem)/.75 Arial,sans-serif;letter-spacing:-.075em;text-transform:uppercase}.clients-hero>div>span{display:block;margin-top:1rem;color:var(--br-muted);font:700 .9rem "Courier New",monospace}.hero-stat{min-width:10rem;padding:1rem;border:1px solid var(--br-line-strong);text-align:right}.hero-stat b{display:block;font:900 2.8rem/1 Arial,sans-serif}.hero-stat span{font:800 .7rem "Courier New",monospace;text-transform:uppercase}@media(max-width:640px){.clients-hero{align-items:flex-start;flex-direction:column}.hero-stat{width:100%;text-align:left}}
.credential-overlay{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:1rem;background:rgba(0,0,0,.82);backdrop-filter:blur(4px)}.credential-dialog{width:min(31rem,100%);border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:9px 9px 0 var(--br-accent)}.credential-dialog header{display:flex;justify-content:space-between;border-bottom:1px solid var(--br-line);background:var(--br-bg)}.credential-dialog header>div{padding:1.25rem}.credential-dialog header p{margin:0 0 .35rem;color:var(--br-accent);font:800 .68rem "Courier New",monospace;letter-spacing:.1em}.credential-dialog header h2{margin:0;font:900 1.8rem/1 Arial,sans-serif;text-transform:uppercase}.credential-dialog header span{display:block;margin-top:.6rem;color:var(--br-muted);font:700 .78rem/1.35 "Courier New",monospace}.credential-dialog header button{width:3.75rem;align-self:stretch;border:0;border-left:1px solid var(--br-line);background:var(--br-accent);color:var(--br-accent-text);font-size:2rem;cursor:pointer}.credential-dialog>label{display:grid;gap:.45rem;padding:1.25rem}.credential-dialog>label>span{font:800 .72rem "Courier New",monospace;text-transform:uppercase}.credential-error{margin:0 1.25rem;border:1px solid #ef4d3d;background:rgba(239,77,61,.12);padding:.75rem;color:var(--br-text);font:800 .76rem "Courier New",monospace}.credential-dialog footer{display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.25rem 1.25rem}

:deep(.app-data-table__table) { min-width: 74rem; table-layout: fixed; }
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
:deep(.app-data-table__table td .client-actions) {
  min-width: 8rem;
  overflow: visible;
  gap: 0.45rem !important;
  padding-inline: 0.45rem !important;
}
:deep(.app-data-table__table th:nth-child(1)),
:deep(.app-data-table__table td:nth-child(1)) { width: 6%; }
:deep(.app-data-table__table th:nth-child(2)),
:deep(.app-data-table__table td:nth-child(2)) { width: 16%; }
:deep(.app-data-table__table th:nth-child(3)),
:deep(.app-data-table__table td:nth-child(3)) { width: 11%; }
:deep(.app-data-table__table th:nth-child(4)),
:deep(.app-data-table__table td:nth-child(4)),
:deep(.app-data-table__table th:nth-child(5)),
:deep(.app-data-table__table td:nth-child(5)),
:deep(.app-data-table__table th:nth-child(6)),
:deep(.app-data-table__table td:nth-child(6)) { width: 10%; }
:deep(.app-data-table__table th:nth-child(7)),
:deep(.app-data-table__table td:nth-child(7)) { width: 12%; }
:deep(.app-data-table__table th:nth-child(8)),
:deep(.app-data-table__table td:nth-child(8)) { width: 13%; }
:deep(.app-data-table__table th:nth-child(9)),
:deep(.app-data-table__table td:nth-child(9)) { width: 12%; min-width: 8.5rem; }
:deep(.app-pager) { min-height: 3rem; font-size: 11px; }
:deep(.app-data-table__header input) { font-size: 0.85rem !important; }

@media (max-width: 700px) {
  :deep(.app-data-table__table) { min-width: 72rem; }
  :deep(.app-data-table__table th),
  :deep(.app-data-table__table td),
  :deep(.app-data-table__table th > div),
  :deep(.app-data-table__table td > div),
  :deep(.app-data-table__table td div) { font-size: 11px !important; }
}
.clients-view{background:transparent}
</style>
