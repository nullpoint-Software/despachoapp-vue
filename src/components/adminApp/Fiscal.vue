<template>
  <main class="fiscal-view">
    <header class="fiscal-hero">
      <div>
        <p>IMPUESTOS / CFDI</p>
        <h1>Fiscal</h1>
        <span>Facturas emitidas y recibidas, clasificadas desde su XML.</span>
      </div>
      <div class="hero-actions">
        <input
          ref="fileInput"
          class="sr-only"
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          @change="queueFiles"
        />
        <AppButton
          label="Nuevo reporte"
          icon="pi pi-file-plus"
          outlined
          :disabled="!selectedIds.size"
          @click="openReportDialog"
        />
      </div>
    </header>

    <section class="filter-strip" aria-label="Filtros fiscales">
      <label class="client-combobox"
        ><span>Cliente</span
        ><AppAutocomplete
          v-model="clientSearch"
          :options="clientOptions"
          placeholder="Escribe nombre o RFC"
          @update:model-value="onClientSearch"
      /></label>
      <label
        ><span>Ejercicio</span
        ><AppSelect v-model="filters.year" :options="years"
      /></label>
      <label
        ><span>Mes</span
        ><AppSelect
          v-model="filters.month"
          :options="months"
          option-label="label"
          option-value="value"
      /></label>
      <label class="search-field"
        ><span>Buscar UUID, RFC o nombre</span
        ><AppInput
          v-model="filters.search"
          type="search"
          placeholder="Buscar factura"
          @input="scheduleLoad"
      /></label>
      <AppButton label="Aplicar" icon="pi pi-filter" @click="loadInvoices" />
      <AppButton
        label="Limpiar"
        icon="pi pi-times"
        outlined
        @click="clearFilters"
      />
    </section>

    <section
      class="xml-dropzone"
      :class="{ dragging, disabled: !filters.clienteId || importing }"
      role="button"
      tabindex="0"
      aria-label="Agregar archivos XML"
      @click="openFilePicker"
      @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker"
      @dragenter.prevent="dragging = true"
      @dragover.prevent
      @dragleave.prevent="dragging = false"
      @drop.prevent="dropFiles"
    >
      <div>
        <i class="pi pi-cloud-upload" /><strong
          >Arrastra tus XML aquí <em>o haz clic para buscarlos</em></strong
        ><span
          >Ingresos, egresos, nómina, pagos, traslados, notas de crédito y
          sustituciones.</span
        >
      </div>
      <div v-if="pendingFiles.length" class="file-preview">
        <article
          v-for="(file, index) in pendingFiles"
          :key="`${file.name}-${file.size}`"
          @click.stop
        >
          <i class="pi pi-file" /><span
            ><strong>{{ file.name }}</strong
            ><small>{{ fileSize(file.size) }}</small></span
          ><button
            type="button"
            aria-label="Quitar archivo"
            @click="pendingFiles.splice(index, 1)"
          >
            ×
          </button>
        </article>
        <AppButton
          :label="
            importing ? 'Importando…' : `Importar ${pendingFiles.length} XML`
          "
          icon="pi pi-check"
          :disabled="importing || !filters.clienteId"
          @click.stop="uploadQueued"
        />
      </div>
    </section>

    <div v-if="notice" class="notice" :class="noticeTone" role="status">
      <i
        :class="
          noticeTone === 'error'
            ? 'pi pi-exclamation-triangle'
            : 'pi pi-check-circle'
        "
      />
      <span>{{ notice }}</span>
      <button type="button" aria-label="Cerrar aviso" @click="notice = ''">
        ×
      </button>
    </div>

    <section class="summary-grid" aria-label="Resumen de impuestos">
      <article>
        <span>Documentos</span><strong>{{ invoices.length }}</strong>
      </article>
      <article>
        <span>Base 16%</span><strong>{{ money(summary.base16) }}</strong>
      </article>
      <article class="accent">
        <span>IVA 16%</span><strong>{{ money(summary.iva16) }}</strong>
      </article>
      <article>
        <span>Tasa 0%</span><strong>{{ money(summary.zero) }}</strong>
      </article>
      <article>
        <span>Exento</span><strong>{{ money(summary.exempt) }}</strong>
      </article>
      <article>
        <span>Total</span><strong>{{ money(summary.total) }}</strong>
      </article>
    </section>

    <div class="fiscal-tabs" role="tablist" aria-label="Tipo de facturas">
      <button type="button" role="tab" aria-controls="fiscal-invoice-panel" :aria-selected="filters.direction === 'emitida'" :class="{ active: filters.direction === 'emitida' }" @click="filters.direction = 'emitida'">
        Emitidas / ingresos
      </button>
      <button type="button" role="tab" aria-controls="fiscal-invoice-panel" :aria-selected="filters.direction === 'recibida'" :class="{ active: filters.direction === 'recibida' }" @click="filters.direction = 'recibida'">
        Recibidas / egresos
      </button>
    </div>

    <section class="workspace-grid">
      <div id="fiscal-invoice-panel" class="invoice-panel" role="tabpanel">
        <header class="panel-heading">
          <div>
            <h2>
              {{
                filters.direction === "emitida"
                  ? "Ingresos emitidos"
                  : "Egresos recibidos"
              }}
            </h2>
            <p>
              {{ selectedIds.size }} seleccionadas para el siguiente reporte
            </p>
            <strong class="selected-subtotal">Subtotal seleccionado: {{ money(selectedSubtotal) }}</strong>
            <div class="row-legend"><span class="used">Usada en reporte</span><span class="blocked">No seleccionable</span></div>
          </div>
          <div class="selection-actions">
            <button
              class="reports-drawer-trigger"
              type="button"
              aria-haspopup="dialog"
              :aria-expanded="showReportsDrawer"
              @click="showReportsDrawer = true"
            >
              <i class="pi pi-folder-open" /> Reportes guardados
              <strong>{{ reports.length }}</strong>
            </button>
            <button type="button" @click="selectVisible">
              Seleccionar visibles
            </button>
            <button type="button" @click="selectedIds.clear()">
              Limpiar selección
            </button>
          </div>
        </header>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="check-col">
                  <input
                    type="checkbox"
                    :checked="allVisibleSelected"
                    aria-label="Seleccionar todas"
                    @change="toggleAll"
                  />
                </th>
                <th class="actions-col">Acciones</th>
                <th>Estatus</th>
                <th>Forma de pago</th>
                <th>Nombre</th>
                <th>RFC</th>
                <th class="number">Abonado</th>
                <th class="number">Subtotal 16%</th>
                <th class="number">Subtotal 8%</th>
                <th class="number">IVA 16%</th>
                <th class="number">IVA 8%</th>
                <th class="number">Pendiente</th>
                <th class="number">Exento</th>
                <th class="number">0%</th>
                <th class="number">Ret. IEPS</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody v-if="loading">
              <tr v-for="index in 5" :key="index" class="skeleton-row">
                <td colspan="16"><span /></td>
              </tr>
            </tbody>
            <tbody v-else-if="invoices.length">
              <tr
                v-for="invoice in invoices"
                :key="invoice.id"
                :class="{
                  selected: selectedIds.has(Number(invoice.id)),
                  'used-monthly': Number(invoice.usada_reporte_mensual) === 1,
                  'report-blocked': !isSelectable(invoice),
                }"
                :title="invoice.motivo_no_seleccionable || undefined"
              >
                <td class="check-col">
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(Number(invoice.id))"
                    :disabled="!isSelectable(invoice)"
                    :aria-label="isSelectable(invoice) ? `Seleccionar ${invoice.uuid}` : invoice.motivo_no_seleccionable"
                    @change="toggleInvoice(invoice)"
                  />
                </td>
                <td class="row-actions">
                  <button
                    type="button"
                    title="Previsualizar PDF"
                    @click="previewInvoice(invoice)"
                  >
                    <i class="pi pi-file-pdf" /></button
                  ><button
                    type="button"
                    title="Ver XML desglosado"
                    @click="openDetail(invoice)"
                  >
                    <i class="pi pi-eye" /></button
                  ><button
                    type="button"
                    title="Descargar XML"
                    @click="downloadXml(invoice)"
                  >
                    <i class="pi pi-download" /></button
                  ><button
                    class="danger"
                    type="button"
                    title="Eliminar XML"
                    @click="removeInvoice(invoice)"
                  >
                    <i class="pi pi-trash" />
                  </button>
                </td>
                <td>
                  <span
                    class="status-pill"
                    :class="invoice.estatus_calculado"
                    >{{ invoice.estatus_calculado }}</span
                  ><small>{{ typeLabel(invoice.tipo_comprobante) }}</small>
                  <small v-if="!isSelectable(invoice)" class="blocked-label">No seleccionable: {{ invoice.motivo_no_seleccionable }}</small>
                </td>
                <td><strong>{{ paymentLabel(invoice) }}</strong></td>
                <td>
                  <button
                    class="provider-link"
                    type="button"
                    :disabled="invoice.direccion !== 'recibida'"
                    @click="openProvider(invoice)"
                  >
                    {{ counterpartName(invoice) || "Sin nombre" }}</button
                  ><div v-if="invoice.reportes" class="report-badges">
                    <small
                      v-if="Number(invoice.usada_reporte_mensual) === 1"
                      class="monthly-used-label"
                      >Usada en:</small
                    >
                    <button
                      v-for="report in parseReports(invoice.reportes)"
                      :key="report.id"
                      type="button"
                      :title="`Abrir reporte ${report.name}`"
                      @click="loadReport(report.id)"
                    >
                      {{ report.name }}
                    </button>
                  </div>
                </td>
                <td>
                  <strong>{{ counterpartRfc(invoice) }}</strong>
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.abonado, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.base_iva_16, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.base_iva_8, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.iva_16, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.iva_8, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.pendiente, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.base_exento, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.base_iva_0, invoice.moneda) }}
                </td>
                <td class="number">
                  {{ currencyMoney(invoice.ieps_retenido, invoice.moneda) }}
                </td>
                <td>
                  <time>{{ date(invoice.fecha_emision) }}</time
                  ><small>{{ shortUuid(invoice.uuid) }}</small>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr>
                <td colspan="16">
                  <div class="empty-state">
                    <i class="pi pi-file-import" /><strong>{{
                      filters.clienteId
                        ? "No hay CFDI en este periodo"
                        : "Selecciona un cliente"
                    }}</strong
                    ><span>{{
                      filters.clienteId
                        ? "Importa los XML del cliente o cambia los filtros."
                        : "Escribe el nombre o RFC para comenzar."
                    }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </section>

    <div
      v-if="showReportsDrawer"
      class="reports-drawer-overlay"
      @click.self="showReportsDrawer = false"
    >
      <aside
        class="reports-panel reports-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-reports-title"
      >
        <header>
          <div>
            <small>ARCHIVO / FISCAL</small>
            <h2 id="saved-reports-title">Reportes guardados</h2>
          </div>
          <span class="report-count">{{ reports.length }}</span>
          <button
            class="reports-drawer-close"
            type="button"
            aria-label="Cerrar reportes guardados"
            @click="showReportsDrawer = false"
          >
            ×
          </button>
        </header>
        <div v-if="reportsLoading" class="reports-loading">
          Cargando cortes...
        </div>
        <div v-else class="calendar-reports">
          <div class="annual-row">
            <strong>{{ filters.year }}</strong>
            <div
              v-for="report in reportsFor(null, 'anual')"
              :key="report.id"
              class="report-chip"
            >
              <button @click="loadReport(Number(report.id))">
                {{ report.nombre }}</button
              ><button title="PDF" @click="previewReportPdf(report)">
                <i class="pi pi-file-pdf" /></button
              ><button title="CSV" @click="downloadReport(report)">
                <i class="pi pi-download" />
              </button>
            </div>
            <span v-if="!reportsFor(null, 'anual').length"
              >Sin reporte anual</span
            >
          </div>
          <article v-for="(month, index) in monthNames" :key="month">
            <strong>{{ month }}</strong>
            <div class="month-column">
              <div
                v-for="report in reportsFor(index + 1, 'mensual')"
                :key="report.id"
                class="report-chip"
              >
                <button @click="loadReport(Number(report.id))">
                  {{
                    report.direccion === "emitida" ? "Ingresos" : "Egresos"
                  }}</button
                ><button title="CSV" @click="downloadReport(report)">
                  <i class="pi pi-download" />
                </button>
              </div>
              <button
                v-if="reportsFor(index + 1, 'mensual').length"
                class="combined-pdf"
                title="PDF mensual con emitidas y recibidas"
                @click="previewMonthlyPdf(index + 1)"
              >
                <i class="pi pi-file-pdf" /> PDF conjunto</button
              ><span v-else>Sin corte</span>
            </div>
            <div class="diot-column">
              <div
                v-for="report in reportsFor(index + 1, 'diot')"
                :key="report.id"
                class="report-chip"
              >
                <button @click="loadReport(Number(report.id))">DIOT</button
                ><button
                  title="TXT de carga masiva"
                  @click="downloadReport(report)"
                >
                  <i class="pi pi-download" />
                </button>
              </div>
              <span v-if="!reportsFor(index + 1, 'diot').length"
                >DIOT pendiente</span
              >
            </div>
          </article>
        </div>
      </aside>
    </div>

    <div
      v-if="showReportDialog"
      class="modal-overlay"
      @click.self="showReportDialog = false"
    >
      <section
        class="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <header class="modal-header">
          <p>SELECCIÓN / CORTE</p>
          <h2 id="report-title">Guardar reporte</h2>
          <button
            type="button"
            aria-label="Cerrar"
            @click="showReportDialog = false"
          >
            ×
          </button>
        </header>
        <div class="modal-body form-grid">
          <label class="full"
            ><span>Nombre del reporte</span
            ><AppInput v-model="reportDraft.name"
          /></label>
          <label
            ><span>Tipo</span
            ><AppSelect
              v-model="reportDraft.type"
              :options="reportTypes"
              option-label="label"
              option-value="value"
          /></label>
          <label
            ><span>Movimiento</span
            ><AppSelect
              v-model="reportDraft.direction"
              :options="directions"
              option-label="label"
              option-value="value"
              disabled
          /></label>
          <label
            ><span>Ejercicio</span
            ><AppSelect v-model="reportDraft.year" :options="years" disabled
          /></label>
          <label v-if="reportDraft.type !== 'anual'"
            ><span>Mes de emisión</span
            ><AppSelect
              v-model="reportDraft.month"
              :options="months.slice(1)"
              option-label="label"
              option-value="value"
              disabled
          /></label>
          <div class="selection-note full">
            <strong>{{ selectedIds.size }} CFDI</strong
            ><span
              >La selección quedará guardada y marcada para volver a generar
              este corte.</span
            >
          </div>
          <p
            v-if="
              reportDraft.type === 'mensual' &&
              reportDraft.direction === 'recibida'
            "
            class="fiscal-note full"
          >
            La DIOT del mes se guardará automáticamente con exactamente los
            mismos CFDI de este reporte mensual.
          </p>
        </div>
        <footer>
          <AppButton
            label="Cancelar"
            outlined
            @click="showReportDialog = false"
          /><AppButton
            label="Guardar reporte"
            class="p-button-primary"
            :disabled="savingReport"
            @click="saveReport"
          />
        </footer>
      </section>
    </div>

    <div
      v-if="showDetail && detail"
      class="modal-overlay"
      @click.self="showDetail = false"
    >
      <section
        class="modal-shell detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <header class="modal-header">
          <p>CFDI / {{ detail.uuid }}</p>
          <h2 id="detail-title">Detalle de factura</h2>
          <button type="button" aria-label="Cerrar" @click="showDetail = false">
            ×
          </button>
        </header>
        <div class="modal-body">
          <dl class="invoice-meta">
            <div>
              <dt>Emisor</dt>
              <dd>
                {{ detail.emisor_nombre }}<small>{{ detail.emisor_rfc }}</small>
              </dd>
            </div>
            <div>
              <dt>Receptor</dt>
              <dd>
                {{ detail.receptor_nombre
                }}<small>{{ detail.receptor_rfc }}</small>
              </dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>
                {{ detail.forma_pago || "Sin clave" }} /
                {{ detail.metodo_pago || "Sin método" }}
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{{ money(detail.total) }}</dd>
            </div>
          </dl>
          <h3>Productos y servicios</h3>
          <div class="concept-list">
            <article v-for="concept in detail.concepts" :key="concept.id">
              <div>
                <strong>{{ concept.descripcion }}</strong
                ><small
                  >{{ concept.clave_prod_serv }} /
                  {{
                    concept.clave_unidad || concept.unidad || "Sin unidad"
                  }}</small
                >
              </div>
              <span
                >{{ concept.cantidad }} ×
                {{ money(concept.valor_unitario) }}</span
              ><b>{{ money(concept.importe) }}</b>
            </article>
          </div>
          <h3>Impuestos desglosados</h3>
          <div class="tax-detail">
            <span v-for="tax in detail.taxes" :key="tax.id"
              >{{ tax.movimiento }} / {{ taxName(tax.impuesto) }} /
              {{ tax.tipo_factor || "Sin factor" }}
              {{ tax.tasa_cuota == null ? "" : percent(tax.tasa_cuota) }}:
              {{ money(tax.importe) }}</span
            >
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="showDiotDialog && diotDraft"
      class="modal-overlay"
      @click.self="showDiotDialog = false"
    >
      <section
        class="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diot-title"
      >
        <header class="modal-header">
          <p>DIOT / PROVEEDOR</p>
          <h2 id="diot-title">{{ diotDraft.nombre }}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            @click="showDiotDialog = false"
          >
            ×
          </button>
        </header>
        <div class="modal-body form-grid">
          <label
            ><span>Tipo de tercero</span
            ><AppSelect
              v-model="diotDraft.tipoTercero"
              :options="thirdPartyTypes"
              option-label="label"
              option-value="value"
          /></label>
          <label
            ><span>Tipo de operación</span
            ><AppSelect
              v-model="diotDraft.tipoOperacion"
              :options="availableOperationTypes"
              option-label="label"
              option-value="value"
          /></label>
          <label
            ><span>Región fronteriza</span
            ><AppSelect
              v-model="diotDraft.region"
              :options="regions"
              option-label="label"
              option-value="value"
          /></label>
          <label
            ><span>Importación</span
            ><AppSelect
              v-model="diotDraft.importacion"
              :options="importTypes"
              option-label="label"
              option-value="value"
          /></label>
          <label
            ><span>Acreditamiento del IVA</span
            ><AppSelect
              v-model="diotDraft.acreditamiento"
              :options="creditTypes"
              option-label="label"
              option-value="value"
          /></label>
          <label v-if="diotDraft.acreditamiento === 'proporcion'"
            ><span>Proporción acreditable (0 a 1)</span
            ><AppInput
              v-model="diotDraft.proporcion"
              type="number"
              min="0"
              max="1"
              step="0.000001"
          /></label>
          <template v-if="diotDraft.tipoTercero === '05'"
            ><label
              ><span>ID fiscal extranjero</span
              ><AppInput v-model="diotDraft.numeroIdFiscal" /></label
            ><label
              ><span>País SAT</span
              ><AppInput v-model="diotDraft.pais" maxlength="3" /></label
          ></template>
          <label class="full check-label"
            ><input v-model="diotDraft.efectoFiscal" type="checkbox" /><span
              >Se dio efectos fiscales a los comprobantes del proveedor</span
            ></label
          >
          <p class="fiscal-note full">
            Estos campos controlan la posición de bases e IVA en el TXT de 54
            campos del SAT.
          </p>
        </div>
        <footer>
          <AppButton
            label="Cancelar"
            outlined
            @click="showDiotDialog = false"
          /><AppButton
            label="Guardar para este proveedor"
            class="p-button-primary"
            @click="saveProvider"
          />
        </footer>
      </section>
    </div>
    <div v-if="pdfUrl" class="modal-overlay" @click.self="closePdf">
      <section class="modal-shell pdf-modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <p>PREVISUALIZACIÓN</p>
          <h2>{{ pdfTitle }}</h2>
          <button type="button" aria-label="Cerrar" @click="closePdf">×</button>
        </header>
        <iframe :src="pdfUrl" title="Vista previa PDF" />
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import logo from "@/assets/img/logblack.png";
import AppButton from "@/components/ui/AppButton.vue";
import AppAutocomplete from "@/components/ui/AppAutocomplete.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { cs, fs } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";

type Direction = "emitida" | "recibida";
type ReportType = "mensual" | "anual" | "diot";
type Invoice = Record<string, any>;
const now = new Date();
const clients = ref<any[]>([]),
  invoices = ref<Invoice[]>([]),
  reports = ref<any[]>([]);
const loading = ref(false),
  reportsLoading = ref(false),
  importing = ref(false),
  savingReport = ref(false);
const notice = ref(""),
  noticeTone = ref<"success" | "error">("success"),
  activeReportId = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null),
  selectedIds = reactive(new Set<number>());
const showReportDialog = ref(false),
  showDetail = ref(false),
  showDiotDialog = ref(false),
  showReportsDrawer = ref(false),
  detail = ref<any>(null),
  diotDraft = ref<any>(null);
const clientSearch = ref(""),
  pendingFiles = ref<File[]>([]),
  dragging = ref(false);
const pdfUrl = ref(""),
  pdfTitle = ref("");
const filters = reactive({
  clienteId: 0,
  direction: "emitida" as Direction,
  year: now.getFullYear(),
  month: 0 as number,
  search: "",
});
const reportDraft = reactive({
  name: "",
  type: "mensual" as ReportType,
  direction: "emitida" as Direction,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
});
let searchTimer = 0;
let invoiceLoadVersion = 0;

const directions = [
  { label: "Emitidas / ingresos", value: "emitida" },
  { label: "Recibidas / egresos", value: "recibida" },
];
const years = Array.from(
  { length: 8 },
  (_, index) => now.getFullYear() - index,
);
const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const months = [
  { label: "Todo el año", value: 0 },
  ...monthNames.map((label, index) => ({ label, value: index + 1 })),
];
const reportTypes = [
  { label: "Mensual", value: "mensual" },
  { label: "Anual", value: "anual" },
];
const thirdPartyTypes = [
  { label: "04 Proveedor nacional", value: "04" },
  { label: "05 Proveedor extranjero", value: "05" },
  { label: "15 Proveedor global", value: "15" },
];
const operationTypes = [
  { label: "02 Enajenación de bienes", value: "02" },
  { label: "03 Servicios profesionales", value: "03" },
  { label: "06 Uso o goce temporal", value: "06" },
  { label: "07 Importación", value: "07" },
  { label: "08 Transferencia virtual", value: "08" },
  { label: "85 Otros", value: "85" },
  { label: "87 Operaciones globales", value: "87" },
];
const availableOperationTypes = computed(() => {
  const map: Record<string, string[]> = {
    "04": ["02", "03", "06", "08", "85"],
    "05": ["02", "03", "07"],
    "15": ["87"],
  };
  return operationTypes.filter((option) =>
    (map[diotDraft.value?.tipoTercero] || []).includes(option.value),
  );
});
const regions = [
  { label: "Ninguna", value: "ninguna" },
  { label: "Frontera norte", value: "norte" },
  { label: "Frontera sur", value: "sur" },
];
const importTypes = [
  { label: "No es importación", value: "ninguna" },
  { label: "Bienes tangibles", value: "tangible" },
  { label: "Intangibles o servicios", value: "intangible" },
];
const creditTypes = [
  { label: "Exclusivo de actividades gravadas", value: "exclusivo" },
  { label: "Aplicó proporción", value: "proporcion" },
  { label: "No cumple requisitos", value: "no_requisitos" },
  { label: "Asociado a actividades exentas", value: "actividades_exentas" },
  { label: "Asociado a actividades no objeto", value: "no_objeto" },
];
const clientLabel = (client: any) =>
  `${client.nombre || "Sin nombre"}${client.rfc ? ` - ${client.rfc}` : ""}`;
const clientOptions = computed(() => clients.value.map(clientLabel));

const num = (value: any) => Number(value || 0),
  signed = (invoice: Invoice, value: any) =>
    invoice.tipo_comprobante === "E" ? -num(value) : num(value);
const mxn = (invoice: Invoice, value: any) =>
  signed(invoice, value) *
  (invoice.moneda === "MXN" ? 1 : num(invoice.tipo_cambio) || 1);
const summary = computed(() =>
  invoices.value.reduce(
    (total, invoice) => {
      total.base16 += mxn(invoice, invoice.base_iva_16);
      total.iva16 += mxn(invoice, invoice.iva_16);
      total.zero += mxn(invoice, invoice.base_iva_0);
      total.exempt += mxn(invoice, invoice.base_exento);
      total.total += mxn(invoice, invoice.total);
      return total;
    },
    { base16: 0, iva16: 0, zero: 0, exempt: 0, total: 0 },
  ),
);
const selectableInvoices = computed(() => invoices.value.filter(isSelectable));
const allVisibleSelected = computed(
  () =>
    !!selectableInvoices.value.length &&
    selectableInvoices.value.every((invoice) => selectedIds.has(Number(invoice.id))),
);
const money = (value: any) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(num(value));
const currencyMoney = (value: any, currency: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 2,
  }).format(num(value));
const selectedSubtotal = computed(() => invoices.value.reduce((total, invoice) => selectedIds.has(Number(invoice.id)) ? total + mxn(invoice, invoice.subtotal) : total, 0));
const date = (value: string) =>
  new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const percent = (value: any) =>
  `${(num(value) * 100).toLocaleString("es-MX", { maximumFractionDigits: 4 })}%`;
const shortUuid = (uuid: string) => `${uuid.slice(0, 8)}...${uuid.slice(-6)}`;
const typeLabel = (type: string) =>
  ({
    I: "Ingreso",
    E: "Nota de crédito",
    P: "Pago",
    T: "Traslado",
    N: "Nómina",
  })[type] || type;
const taxName = (code: string) =>
  ({ "001": "ISR", "002": "IVA", "003": "IEPS" })[code] || code;
const counterpartName = (invoice: Invoice) =>
  invoice.direccion === "emitida"
    ? invoice.receptor_nombre
    : invoice.emisor_nombre;
const counterpartRfc = (invoice: Invoice) =>
  invoice.direccion === "emitida" ? invoice.receptor_rfc : invoice.emisor_rfc;
const paymentForms:Record<string,string>={"01":"Efectivo","02":"Cheque nominativo","03":"Transferencia electrónica","04":"Tarjeta de crédito","05":"Monedero electrónico","06":"Dinero electrónico","08":"Vales de despensa","12":"Dación en pago","13":"Subrogación","14":"Consignación","15":"Condonación","17":"Compensación","23":"Novación","24":"Confusión","25":"Remisión de deuda","26":"Prescripción o caducidad","27":"Satisfacción del acreedor","28":"Tarjeta de débito","29":"Tarjeta de servicios","30":"Aplicación de anticipos","31":"Intermediario de pagos","99":"Por definir"};
const paymentLabel = (invoice: Invoice) => invoice.forma_pago ? `${invoice.forma_pago} - ${paymentForms[invoice.forma_pago]||"Otra forma"}` : "Sin forma de pago";
function isSelectable(invoice:Invoice){return Number(invoice.seleccionable_reporte)!==0}
const hasTaxBase = (invoice: Invoice) =>
  [
    invoice.base_iva_16,
    invoice.base_iva_8,
    invoice.base_iva_0,
    invoice.base_exento,
    invoice.base_no_objeto,
  ].some(num);
const reportTypeLabel = (type: ReportType) =>
  ({ mensual: "Mensual", anual: "Anual", diot: "DIOT" })[type];
const periodLabel = (report: any) =>
  report.tipo === "anual"
    ? String(report.ejercicio)
    : `${monthNames[Number(report.mes) - 1]} ${report.ejercicio}`;
const parseReports = (value: string) =>
  String(value)
    .split("||")
    .map((entry) => {
      const [id, ...name] = entry.split(":");
      return { id: Number(id), name: name.join(":") };
    });
const reportsFor = (month: number | null, type: ReportType) =>
  reports.value.filter(
    (report) =>
      Number(report.ejercicio) === Number(filters.year) &&
      report.tipo === type &&
      (type === "anual" || Number(report.mes) === month),
  );

function setNotice(message: string, tone: "success" | "error" = "success") {
  notice.value = message;
  noticeTone.value = tone;
}
function scheduleLoad() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadInvoices, 350);
}
function clearFilters() {
  window.clearTimeout(searchTimer);
  invoiceLoadVersion++;
  filters.clienteId = 0;
  filters.direction = "emitida";
  filters.year = now.getFullYear();
  filters.month = 0;
  filters.search = "";
  clientSearch.value = "";
  selectedIds.clear();
  activeReportId.value = null;
  invoices.value = [];
  reports.value = [];
  notice.value = "";
}
function toggleInvoice(invoice:Invoice) {
  if(!isSelectable(invoice))return;
  const id=Number(invoice.id);
  selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
}
function selectVisible() {
  selectableInvoices.value.forEach((invoice) => selectedIds.add(Number(invoice.id)));
}
function toggleAll() {
  allVisibleSelected.value
    ? selectableInvoices.value.forEach((invoice) =>
        selectedIds.delete(Number(invoice.id)),
      )
    : selectVisible();
}
function onClientSearch(value: string) {
  const term = value.trim().toLocaleLowerCase("es-MX");
  const client = clients.value.find(
    (item) =>
      clientLabel(item).toLocaleLowerCase("es-MX") === term ||
      String(item.nombre || "").toLocaleLowerCase("es-MX") === term ||
      String(item.rfc || "").toLocaleLowerCase("es-MX") === term,
  );
  filters.clienteId = client ? Number(client.id_cliente) : 0;
}
const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
function addFiles(files: File[]) {
  const xml = files.filter((file) => file.name.toLowerCase().endsWith(".xml"));
  for (const file of xml) {
    if (
      !pendingFiles.value.some(
        (item) => item.name === file.name && item.size === file.size,
      )
    )
      pendingFiles.value.push(file);
  }
  if (xml.length !== files.length)
    setNotice("Sólo se agregaron archivos con extensión .xml.", "error");
}
function openFilePicker() {
  if (!filters.clienteId) {
    setNotice("Selecciona un cliente antes de agregar XML.", "error");
    return;
  }
  if (!importing.value) fileInput.value?.click();
}
function queueFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  addFiles(Array.from(input.files || []));
  input.value = "";
}
function dropFiles(event: DragEvent) {
  dragging.value = false;
  if (!filters.clienteId) {
    setNotice("Selecciona un cliente antes de agregar XML.", "error");
    return;
  }
  addFiles(Array.from(event.dataTransfer?.files || []));
}

async function loadInvoices() {
  if (!filters.clienteId) {
    invoices.value = [];
    return;
  }
  const version = ++invoiceLoadVersion;
  loading.value = true;
  const baseFilters = {
    clienteId: Number(filters.clienteId),
    direction: filters.direction,
    year: Number(filters.year),
    month: filters.month || undefined,
    search: filters.search || undefined,
  };
  try {
    await loadProgressively<Invoice>({
      pageSize: 40,
      fetchPage: (page) => fs.getInvoices({ ...baseFilters, ...page }),
      onUpdate: (items) => {
        if (version === invoiceLoadVersion) {
          invoices.value = items;
          items.filter(invoice=>!isSelectable(invoice)).forEach(invoice=>selectedIds.delete(Number(invoice.id)));
        }
      },
      onBackgroundError: (error: any) => {
        if (version === invoiceLoadVersion)
          setNotice(
            error.response?.data?.error ||
              "No se completó la carga de facturas.",
            "error",
          );
      },
    });
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudieron cargar las facturas.",
      "error",
    );
  } finally {
    loading.value = false;
  }
}
async function loadReports() {
  if (!filters.clienteId) {
    reports.value = [];
    return;
  }
  reportsLoading.value = true;
  try {
    reports.value = await fs.getReports(Number(filters.clienteId));
  } catch {
    reports.value = [];
  } finally {
    reportsLoading.value = false;
  }
}
async function uploadQueued() {
  const files = [...pendingFiles.value];
  if (!files.length) return;
  importing.value = true;
  try {
    const response = await fs.importXml(Number(filters.clienteId), files);
    const ok = response.results.filter(
      (item: any) => item.status === "imported",
    ).length;
    const duplicate = response.results.filter(
      (item: any) => item.status === "duplicate",
    ).length;
    const errors = response.results.filter(
      (item: any) => item.status === "error",
    );
    pendingFiles.value = [];
    const errorDetail = errors
      .slice(0, 2)
      .map((item: any) => `${item.file}: ${item.error}`)
      .join(" · ");
    setNotice(
      `${ok} XML importados, ${duplicate} duplicados${errors.length ? `, ${errors.length} rechazados. ${errorDetail}` : "."}`,
      errors.length ? "error" : "success",
    );
    await Promise.all([loadInvoices(), loadReports()]);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudieron importar los XML.",
      "error",
    );
  } finally {
    importing.value = false;
  }
}
function suggestedReportName() {
  const movement =
    reportDraft.direction === "emitida" ? "Emitidas" : "Recibidas";
  return `${reportTypeLabel(reportDraft.type)} ${movement} ${reportDraft.type === "anual" ? reportDraft.year : `${monthNames[reportDraft.month - 1]} ${reportDraft.year}`}`;
}
function syncReportName() {
  reportDraft.name = suggestedReportName();
}
function openReportDialog() {
  reportDraft.type = filters.month ? "mensual" : "anual";
  reportDraft.direction = filters.direction;
  reportDraft.year = filters.year;
  reportDraft.month = filters.month || now.getMonth() + 1;
  syncReportName();
  showReportDialog.value = true;
}
watch(
  [
    () => reportDraft.type,
    () => reportDraft.direction,
    () => reportDraft.year,
    () => reportDraft.month,
  ],
  () => {
    if (showReportDialog.value) syncReportName();
  },
);
watch(
  () => diotDraft.value?.tipoTercero,
  (type) => {
    if (
      type &&
      diotDraft.value &&
      !availableOperationTypes.value.some(
        (option) => option.value === diotDraft.value.tipoOperacion,
      )
    )
      diotDraft.value.tipoOperacion =
        availableOperationTypes.value[0]?.value || "85";
  },
);
async function saveReport() {
  savingReport.value = true;
  try {
    const response = await fs.createReport({
      clienteId: Number(filters.clienteId),
      nombre: reportDraft.name,
      tipo: reportDraft.type,
      direccion: reportDraft.direction,
      ejercicio: Number(reportDraft.year),
      mes: reportDraft.type === "anual" ? null : Number(reportDraft.month),
      invoiceIds: [...selectedIds],
    });
    showReportDialog.value = false;
    activeReportId.value = Number(response.id);
    setNotice(
      response.message || "Reporte guardado. Las facturas quedaron marcadas.",
    );
    await Promise.all([loadInvoices(), loadReports()]);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo guardar el reporte.",
      "error",
    );
  } finally {
    savingReport.value = false;
  }
}
async function loadReport(id: number) {
  try {
    const data = await fs.getReport(id);
    activeReportId.value = id;
    filters.clienteId = Number(data.report.id_cliente);
    filters.direction = data.report.direccion;
    filters.year = Number(data.report.ejercicio);
    filters.month = data.report.tipo === "anual" ? 0 : Number(data.report.mes);
    filters.search = "";
    selectedIds.clear();
    data.invoices.filter(isSelectable).forEach((invoice: Invoice) => selectedIds.add(Number(invoice.id)));
    await Promise.all([loadInvoices(), loadReports()]);
    showReportsDrawer.value = false;
    setNotice(
      `Corte “${data.report.nombre}” cargado con ${data.invoices.length} facturas.`,
    );
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo abrir el reporte.",
      "error",
    );
  }
}
async function downloadReport(report: any) {
  try {
    await fs.exportReport(
      Number(report.id),
      report.tipo === "diot" ? "DIOT.txt" : "Reporte.csv",
    );
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo descargar el reporte.",
      "error",
    );
  }
}
async function openDetail(invoice: Invoice) {
  showDetail.value = true;
  detail.value = null;
  try {
    detail.value = await fs.getInvoice(Number(invoice.id));
  } catch {
    showDetail.value = false;
    setNotice("No se pudo abrir el detalle.", "error");
  }
}
async function openProvider(invoice: Invoice) {
  if (invoice.direccion !== "recibida") return;
  const fallback = {
    nombre: invoice.emisor_nombre,
    rfc: invoice.emisor_rfc,
    tipoTercero: invoice.diot_tipo_tercero || "04",
    tipoOperacion: invoice.diot_tipo_operacion || "85",
    numeroIdFiscal: invoice.diot_numero_id_fiscal || "",
    pais: invoice.diot_pais || "",
    jurisdiccion: invoice.diot_jurisdiccion || "",
    region: invoice.diot_region || "ninguna",
    importacion: invoice.diot_importacion || "ninguna",
    acreditamiento: invoice.diot_acreditamiento || "exclusivo",
    proporcion: num(invoice.diot_proporcion) || 1,
    efectoFiscal: invoice.diot_efecto_fiscal !== 0,
  };
  diotDraft.value = fallback;
  showDiotDialog.value = true;
  try {
    const provider = await fs.getProvider(
      Number(filters.clienteId),
      invoice.emisor_rfc,
    );
    diotDraft.value = {
      nombre: provider.nombre || fallback.nombre,
      rfc: provider.rfc,
      tipoTercero: provider.tipo_tercero,
      tipoOperacion: provider.tipo_operacion,
      numeroIdFiscal: provider.numero_id_fiscal || "",
      pais: provider.pais || "",
      jurisdiccion: provider.jurisdiccion || "",
      region: provider.region,
      importacion: provider.importacion,
      acreditamiento: provider.acreditamiento,
      proporcion: num(provider.proporcion),
      efectoFiscal: !!provider.efecto_fiscal,
    };
  } catch (error: any) {
    if (error.response?.status !== 404)
      setNotice("No se pudo cargar la configuración del proveedor.", "error");
  }
}
async function saveProvider() {
  try {
    await fs.updateProvider(
      Number(filters.clienteId),
      diotDraft.value.rfc,
      diotDraft.value,
    );
    showDiotDialog.value = false;
    setNotice(
      "La configuración se aplicó a todas las facturas de este proveedor.",
    );
    await loadInvoices();
  } catch (error: any) {
    setNotice(
      error.response?.data?.error ||
        "No se pudo guardar la configuración del proveedor.",
      "error",
    );
  }
}

let cachedLogo = "";
async function logoData() {
  if (cachedLogo) return cachedLogo;
  cachedLogo = await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = reject;
    image.src = logo;
  });
  return cachedLogo;
}
function showPdf(doc: jsPDF, title: string) {
  closePdf();
  pdfTitle.value = title;
  pdfUrl.value = URL.createObjectURL(doc.output("blob"));
}
function closePdf() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value);
  pdfUrl.value = "";
  pdfTitle.value = "";
}
function addPdfLogo(
  doc: jsPDF,
  image: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const properties = doc.getImageProperties(image);
  const ratio = properties.width / properties.height;
  let width = maxWidth,
    height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  doc.addImage(image, "PNG", x, y, width, height);
}
async function previewInvoice(invoice: Invoice) {
  try {
    const data = await fs.getInvoice(Number(invoice.id));
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const image = await logoData();
    addPdfLogo(doc, image, 14, 8, 48, 18);
    doc.setDrawColor(20, 20, 19);
    doc.line(14, 29, 196, 29);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Representación del CFDI", 14, 38);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`UUID: ${data.uuid}`, 14, 45);
    doc.text(
      `Emisor: ${data.emisor_nombre || ""} - ${data.emisor_rfc}`,
      14,
      51,
    );
    doc.text(
      `Receptor: ${data.receptor_nombre || ""} - ${data.receptor_rfc}`,
      14,
      57,
    );
    doc.text(
      `Fecha: ${date(data.fecha_emision)}   Tipo: ${typeLabel(data.tipo_comprobante)}   Pago: ${data.metodo_pago || "Sin método"}/${data.forma_pago || "Sin forma"}`,
      14,
      63,
    );
    autoTable(doc, {
      startY: 70,
      head: [["Producto / servicio", "Cantidad", "V. unitario", "Importe"]],
      body: data.concepts.map((concept: any) => [
        concept.descripcion,
        String(concept.cantidad),
        currencyMoney(concept.valor_unitario, data.moneda),
        currencyMoney(concept.importe, data.moneda),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 20, 19] },
    });
    const finalY = (doc as any).lastAutoTable?.finalY || 88;
    doc.setFontSize(11);
    doc.text(
      `Subtotal: ${currencyMoney(data.subtotal, data.moneda)}`,
      196,
      finalY + 10,
      { align: "right" },
    );
    doc.text(
      `IVA: ${currencyMoney(num(data.iva_16) + num(data.iva_8), data.moneda)}`,
      196,
      finalY + 16,
      { align: "right" },
    );
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Total: ${currencyMoney(data.total, data.moneda)}`,
      196,
      finalY + 24,
      { align: "right" },
    );
    showPdf(doc, `CFDI ${shortUuid(data.uuid)}`);
  } catch {
    setNotice("No se pudo generar la vista previa de la factura.", "error");
  }
}

const reportHead = [
  [
    "Estatus",
    "Forma de pago",
    "Nombre",
    "RFC",
    "Abonado",
    "Subt. 16%",
    "Subt. 8%",
    "IVA 16%",
    "IVA 8%",
    "Pendiente",
    "Exento",
    "0%",
    "Ret. IEPS",
    "Fecha",
  ],
];
function reportRows(items: Invoice[]) {
  return items.map((invoice: Invoice) => [
    invoice.estatus_calculado || typeLabel(invoice.tipo_comprobante),
    paymentLabel(invoice),
    counterpartName(invoice),
    counterpartRfc(invoice),
    money(invoice.abonado),
    money(invoice.base_iva_16),
    money(invoice.base_iva_8),
    money(invoice.iva_16),
    money(invoice.iva_8),
    money(invoice.pendiente),
    money(invoice.base_exento),
    money(invoice.base_iva_0),
    money(invoice.ieps_retenido),
    date(invoice.fecha_emision),
  ]);
}
function reportTableOptions(data: any, startY: number): UserOptions {
  return {
    startY,
    margin: { top: 34, left: 8, right: 8 },
    head: reportHead,
    body: reportRows(data.invoices),
    styles: { fontSize: 6.5, cellPadding: 1.4 },
    headStyles: { fillColor: [20, 20, 19] },
    alternateRowStyles: { fillColor: [244, 242, 236] },
  };
}
function reportTableFits(data: any, startY: number) {
  const probe = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  autoTable(probe, reportTableOptions(data, startY));
  return probe.getNumberOfPages() === 1;
}
async function buildReportPdf(dataSets: any[], title: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const image = await logoData();
  dataSets.forEach((data, index) => {
    const previousEnd = Number((doc as any).lastAutoTable?.finalY || 0);
    const sharedPageStart = previousEnd + 12;
    const startY =
      index === 0
        ? 34
        : reportTableFits(data, sharedPageStart)
          ? sharedPageStart
          : 34;
    if (index > 0 && startY === 34) doc.addPage("a4", "landscape");
    const movement =
      data.report.direccion === "emitida"
        ? "FACTURAS EMITIDAS / INGRESOS"
        : "FACTURAS RECIBIDAS / EGRESOS";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(movement, 8, startY - 4);
    autoTable(doc, reportTableOptions(data, startY));
  });
  const totalPages = doc.getNumberOfPages();
  const report = dataSets[0]?.report || {};
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    addPdfLogo(doc, image, 8, 5, 34, 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(report.cliente || "Cliente", 48, 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(periodLabel(report), 48, 16);
    doc.setDrawColor(20, 20, 19);
    doc.line(48, 20, 289, 20);
    doc.text(`Página ${page} de ${totalPages}`, 289, 10, { align: "right" });
  }
  showPdf(doc, title);
}
async function previewMonthlyPdf(month: number) {
  try {
    const monthlyReports = [...reportsFor(month, "mensual")].sort(
      (a: any, b: any) =>
        a.direccion === "emitida" ? -1 : b.direccion === "emitida" ? 1 : 0,
    );
    const dataSets = await Promise.all(
      monthlyReports.map((item: any) => fs.getReport(Number(item.id))),
    );
    if (!dataSets.length) throw new Error("No hay reportes mensuales.");
    await buildReportPdf(
      dataSets,
      `Reporte mensual ${monthNames[month - 1]} ${filters.year}`,
    );
  } catch {
    setNotice("No se pudo generar el PDF mensual conjunto.", "error");
  }
}
async function previewReportPdf(report: any) {
  try {
    if (report.tipo === "mensual") {
      await previewMonthlyPdf(Number(report.mes));
      return;
    }
    const data = await fs.getReport(Number(report.id));
    await buildReportPdf([data], data.report.nombre);
  } catch {
    setNotice("No se pudo generar el PDF del reporte.", "error");
  }
}
async function removeInvoice(invoice: Invoice) {
  if (
    !window.confirm(
      `¿Eliminar el CFDI ${invoice.uuid}? También dejará de aparecer en reportes guardados.`,
    )
  )
    return;
  try {
    await fs.deleteInvoice(Number(invoice.id));
    selectedIds.delete(Number(invoice.id));
    setNotice("CFDI eliminado.");
    await Promise.all([loadInvoices(), loadReports()]);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo eliminar el CFDI.",
      "error",
    );
  }
}
async function downloadXml(invoice: Invoice) {
  try {
    await fs.downloadInvoiceXml(Number(invoice.id), invoice.uuid);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo descargar el XML.",
      "error",
    );
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && showReportsDrawer.value)
    showReportsDrawer.value = false;
}
onMounted(async () => {
  window.addEventListener("keydown", onGlobalKeydown);
  try {
    await loadProgressively<any>({
      pageSize: 40,
      fetchPage: (page) => cs.getClientes(page),
      onUpdate: (items) => {
        clients.value = items;
      },
      onBackgroundError: () =>
        setNotice("No se completó la carga del catálogo de clientes.", "error"),
    });
  } catch {
    setNotice("No se pudieron cargar los clientes.", "error");
  }
});
onBeforeUnmount(() => {
  closePdf();
  window.removeEventListener("keydown", onGlobalKeydown);
});
watch(
  () => filters.clienteId,
  () => {
    selectedIds.clear();
    activeReportId.value = null;
    Promise.all([loadInvoices(), loadReports()]);
  },
);
watch(
  [() => filters.direction, () => filters.year, () => filters.month],
  () => {
    selectedIds.clear();
    activeReportId.value = null;
    loadInvoices();
  },
  { flush: "sync" },
);
</script>

<style scoped>
.fiscal-view {
  min-height: 100%;
  padding: clamp(1rem, 2.5vw, 2rem);
  background: var(--br-bg);
  color: var(--br-text);
}
.fiscal-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem 0 2rem;
  border-top: 2px solid var(--br-line-strong);
  border-bottom: 2px solid var(--br-line-strong);
}
.fiscal-hero p,
.modal-header p {
  margin: 0 0 0.5rem;
  color: var(--br-accent);
  font:
    800 0.72rem "Courier New",
    monospace;
  letter-spacing: 0.12em;
}
.fiscal-hero h1 {
  margin: 0;
  font:
    900 clamp(3.4rem, 9vw, 7rem)/0.75 Arial,
    sans-serif;
  letter-spacing: -0.075em;
  text-transform: uppercase;
}
.fiscal-hero span {
  display: block;
  margin-top: 1rem;
  color: var(--br-muted);
  font:
    700 0.9rem "Courier New",
    monospace;
}
.hero-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.filter-strip {
  display: grid;
  grid-template-columns: minmax(13rem, 1.4fr) repeat(
      2,
      minmax(8rem, 0.7fr)
    ) minmax(14rem, 1.3fr) auto auto;
  align-items: end;
  gap: 0.75rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--br-line);
}
label > span {
  display: block;
  margin-bottom: 0.4rem;
  color: var(--br-muted);
  font:
    800 0.66rem "Courier New",
    monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.search-field :deep(input) {
  width: 100%;
}
.notice {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  border: 1px solid var(--br-success-line, #78a187);
  background: var(--br-panel);
  padding: 0.85rem 1rem;
  font-weight: 700;
}
.notice.error {
  border-color: var(--br-danger-line, #e06a5c);
}
.notice button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.4rem;
  cursor: pointer;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  margin-top: 1rem;
  border: 1px solid var(--br-line);
}
.summary-grid article {
  min-width: 0;
  padding: 1rem;
  border-right: 1px solid var(--br-line);
  background: var(--br-panel);
}
.summary-grid article:last-child {
  border-right: 0;
}
.summary-grid span {
  display: block;
  margin-bottom: 0.7rem;
  color: var(--br-muted);
  font:
    800 0.64rem "Courier New",
    monospace;
  text-transform: uppercase;
}
.summary-grid strong {
  font:
    900 clamp(1.05rem, 2vw, 1.6rem)/1 Arial,
    sans-serif;
}
.summary-grid .accent {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.summary-grid .accent span {
  color: inherit;
}
.fiscal-tabs{display:flex;margin-top:1rem;border:1px solid var(--br-line);border-bottom:0;background:var(--br-panel)}.fiscal-tabs button{min-height:3rem;flex:1;border:0;border-right:1px solid var(--br-line);background:transparent;color:var(--br-muted);font:800 .72rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}.fiscal-tabs button:last-child{border-right:0}.fiscal-tabs button:hover{color:var(--br-text)}.fiscal-tabs button.active{background:var(--br-accent);color:var(--br-accent-text)}.fiscal-tabs+.workspace-grid{margin-top:0}.selected-subtotal{display:block;margin-top:.45rem;color:var(--br-accent);font:800 .72rem "Courier New",monospace}.row-legend{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.55rem}.row-legend span{border-left:4px solid;padding:.2rem .4rem;color:var(--br-muted);font:800 .58rem "Courier New",monospace;text-transform:uppercase}.row-legend .used{border-color:var(--br-warning-line,#d0a928)}.row-legend .blocked{border-color:var(--br-danger-line,#e06a5c)}
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 1rem;
  margin-top: 1rem;
}
.invoice-panel,
.reports-panel {
  min-width: 0;
  border: 1px solid var(--br-line);
  background: var(--br-panel);
}
.panel-heading,
.reports-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--br-line);
}
.panel-heading h2,
.reports-panel h2 {
  margin: 0;
  font:
    900 1.25rem Arial,
    sans-serif;
  text-transform: uppercase;
}
.panel-heading p {
  margin: 0.25rem 0 0;
  color: var(--br-muted);
  font:
    700 0.72rem "Courier New",
    monospace;
}
.selection-actions {
  display: flex;
  gap: 0.5rem;
}
.selection-actions button {
  border: 0;
  border-bottom: 1px solid var(--br-line-strong);
  background: transparent;
  color: var(--br-muted);
  padding: 0.35rem;
  font:
    800 0.65rem "Courier New",
    monospace;
  text-transform: uppercase;
  cursor: pointer;
}
.selection-actions button:hover {
  color: var(--br-text);
}
.table-wrap {
  max-width: 100%;
  overflow: auto;
}
table {
  width: 100%;
  min-width: 68rem;
  border-collapse: collapse;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--br-panel-2);
  color: var(--br-muted);
  padding: 0.7rem;
  text-align: left;
  font:
    800 0.64rem "Courier New",
    monospace;
  text-transform: uppercase;
}
td {
  padding: 0.8rem 0.7rem;
  border-top: 1px solid var(--br-line);
  vertical-align: top;
  font-size: 0.82rem;
}
tbody tr.selected {
  background: color-mix(in srgb, var(--br-accent) 11%, var(--br-panel));
}
.check-col {
  width: 2.5rem;
  text-align: center;
}
.number {
  text-align: right;
}
.actions-col {
  width: 8rem;
}
td time,
td small {
  display: block;
  color: var(--br-muted);
  font:
    700 0.66rem/1.45 "Courier New",
    monospace;
}
td strong {
  display: block;
  max-width: 18rem;
}
.uuid-link {
  display: block;
  border: 0;
  background: transparent;
  color: var(--br-text);
  padding: 0.25rem 0;
  font:
    800 0.68rem "Courier New",
    monospace;
  cursor: pointer;
}
.uuid-link:hover {
  color: var(--br-accent);
}
.document-type {
  display: inline-block;
  border: 1px solid var(--br-line-strong);
  padding: 0.2rem 0.35rem;
  color: var(--br-muted);
  font:
    800 0.58rem "Courier New",
    monospace;
  text-transform: uppercase;
}
.tax-stack {
  display: flex;
  max-width: 16rem;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.tax-stack span,
.report-badges button {
  border: 1px solid var(--br-line);
  background: var(--br-panel-2);
  color: var(--br-text);
  padding: 0.2rem 0.35rem;
  font:
    700 0.6rem "Courier New",
    monospace;
}
.report-badges {
  display: grid;
  width: 100%;
  max-width: 21rem;
  gap: 0.25rem;
  margin-top: 0.35rem;
}
.report-badges button {
  display: grid;
  width: 100%;
  min-height: 2.75rem;
  place-items: center;
  border-color: var(--br-accent);
  padding: 0.45rem 0.65rem;
  text-align: center;
  text-wrap: balance;
  cursor: pointer;
}
.report-badges small {
  width: 100%;
  text-align: left;
}
.muted {
  color: var(--br-muted);
  font:
    700 0.65rem "Courier New",
    monospace;
}
.row-actions {
  display: flex;
  gap: 0.3rem;
}
.row-actions button {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  background: transparent;
  color: var(--br-text);
  cursor: pointer;
}
.row-actions button:hover {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.row-actions .danger:hover {
  background: var(--br-danger, #96382e);
}
.skeleton-row span {
  display: block;
  height: 2.5rem;
  background: linear-gradient(
    90deg,
    var(--br-panel-2),
    var(--br-line),
    var(--br-panel-2)
  );
  background-size: 200% 100%;
  animation: skeleton 1.2s linear infinite;
}
.empty-state {
  display: grid;
  min-height: 16rem;
  place-items: center;
  align-content: center;
  gap: 0.5rem;
  color: var(--br-muted);
  text-align: center;
}
.empty-state i {
  font-size: 2rem;
}
.empty-state strong {
  color: var(--br-text);
  font-size: 1rem;
}
.reports-panel > header span {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  background: var(--br-accent);
  color: var(--br-accent-text);
  font:
    800 0.72rem "Courier New",
    monospace;
}
.report-list article {
  display: grid;
  grid-template-columns: 1fr auto;
  border-bottom: 1px solid var(--br-line);
}
.report-list article.active {
  box-shadow: inset 4px 0 0 var(--br-accent);
}
.report-main {
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
}
.report-main > span {
  display: block;
  color: var(--br-accent);
  font:
    800 0.6rem "Courier New",
    monospace;
  text-transform: uppercase;
}
.report-main strong,
.report-main small {
  display: block;
  margin-top: 0.3rem;
}
.report-main small {
  color: var(--br-muted);
  font:
    700 0.62rem "Courier New",
    monospace;
}
.download {
  width: 3rem;
  border: 0;
  border-left: 1px solid var(--br-line);
  background: transparent;
  color: var(--br-text);
  cursor: pointer;
}
.download:hover {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.reports-loading,
.aside-empty {
  padding: 1.25rem;
  color: var(--br-muted);
  font:
    700 0.72rem/1.5 "Courier New",
    monospace;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(8, 8, 7, 0.84);
  padding: 1rem;
  backdrop-filter: blur(3px);
}
.modal-shell {
  width: min(48rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  border: 2px solid #111;
  background: var(--br-control);
  color: #141413;
  box-shadow: 12px 12px 0 var(--br-accent);
}
.detail-modal {
  width: min(70rem, calc(100vw - 2rem));
}
.modal-header {
  position: relative;
  padding: 1.3rem 4.5rem 1.2rem 1.4rem;
  border-bottom: 2px solid #141413;
  background: #141413;
  color: var(--br-text);
}
.modal-header h2 {
  margin: 0;
  font:
    900 clamp(1.8rem, 5vw, 3rem)/0.95 Arial,
    sans-serif;
  letter-spacing: -0.05em;
  text-transform: uppercase;
}
.modal-header button {
  position: absolute;
  right: 0;
  top: 0;
  width: 3.75rem;
  height: 3.75rem;
  border: 0;
  border-left: 2px solid var(--br-control);
  border-bottom: 2px solid var(--br-control);
  background: var(--br-accent);
  color: var(--br-accent-text);
  font-size: 2rem;
  cursor: pointer;
}
.modal-body {
  padding: 1.4rem;
}
.modal-shell footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.4rem;
  border-top: 1px solid #77736b;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.form-grid .full {
  grid-column: 1/-1;
}
.form-grid :deep(input) {
  width: 100%;
}
.selection-note {
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #77736b;
  padding: 1rem;
}
.selection-note strong {
  font: 900 1.5rem Arial;
}
.selection-note span {
  color: #56534c;
  font-size: 0.8rem;
}
.invoice-meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0 0 1.5rem;
  border: 1px solid #77736b;
}
.invoice-meta div {
  padding: 1rem;
  border-right: 1px solid #77736b;
}
.invoice-meta div:last-child {
  border-right: 0;
}
.invoice-meta dt {
  font:
    800 0.65rem "Courier New",
    monospace;
  text-transform: uppercase;
}
.invoice-meta dd {
  margin: 0.4rem 0 0;
  font-weight: 800;
}
.invoice-meta small {
  display: block;
  color: #56534c;
  font:
    700 0.65rem "Courier New",
    monospace;
}
.modal-body h3 {
  margin: 1.4rem 0 0.6rem;
  font: 900 1rem Arial;
  text-transform: uppercase;
}
.concept-list {
  border: 1px solid #77736b;
}
.concept-list article {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  padding: 0.8rem;
  border-bottom: 1px solid #aaa69c;
}
.concept-list article:last-child {
  border-bottom: 0;
}
.concept-list small {
  display: block;
  color: #56534c;
  font:
    700 0.65rem "Courier New",
    monospace;
}
.tax-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.tax-detail span {
  border: 1px solid #77736b;
  padding: 0.4rem;
  font:
    700 0.68rem "Courier New",
    monospace;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid #77736b;
  padding: 0.8rem;
}
.check-label span {
  margin: 0;
  color: #141413;
}
.fiscal-note {
  margin: 0;
  border-left: 4px solid var(--br-accent);
  padding: 0.7rem;
  color: #56534c;
  font-size: 0.78rem;
}
@keyframes skeleton {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-row span {
    animation: none;
  }
}
@media (max-width: 1100px) {
  .filter-strip {
    grid-template-columns: repeat(3, 1fr);
  }
  .search-field {
    grid-column: span 2;
  }
  .summary-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .summary-grid article:nth-child(3) {
    border-right: 0;
  }
  .summary-grid article:nth-child(-n + 3) {
    border-bottom: 1px solid var(--br-line);
  }
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .reports-panel {
    order: -1;
  }
  .report-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 700px) {
  .fiscal-hero {
    align-items: stretch;
    flex-direction: column;
  }
  .hero-actions :deep(button) {
    flex: 1;
  }
  .filter-strip {
    grid-template-columns: 1fr 1fr;
  }
  .filter-strip label:first-child,
  .search-field {
    grid-column: 1/-1;
  }
  .summary-grid {
    grid-template-columns: 1fr 1fr;
  }
  .summary-grid article {
    border-bottom: 1px solid var(--br-line);
  }
  .summary-grid article:nth-child(even) {
    border-right: 0;
  }
  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .selection-actions {
    width: 100%;
    justify-content: space-between;
  }
  .report-list {
    grid-template-columns: 1fr;
  }
  .form-grid,
  .invoice-meta {
    grid-template-columns: 1fr;
  }
  .form-grid .full {
    grid-column: auto;
  }
  .invoice-meta div {
    border-right: 0;
    border-bottom: 1px solid #77736b;
  }
  .concept-list article {
    grid-template-columns: 1fr;
  }
  .modal-shell {
    box-shadow: 6px 6px 0 var(--br-accent);
  }
}
.xml-dropzone {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  border: 1px dashed var(--br-line-strong);
  background: var(--br-panel);
  padding: 1rem;
}
.xml-dropzone.dragging {
  border-style: solid;
  background: color-mix(in srgb, var(--br-accent) 12%, var(--br-panel));
}
.xml-dropzone > div:first-child {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 0.7rem;
}
.xml-dropzone > div:first-child i {
  grid-row: 1/3;
  font-size: 1.5rem;
}
.xml-dropzone > div:first-child span {
  color: var(--br-muted);
  font:
    700 0.68rem "Courier New",
    monospace;
}
.xml-dropzone > button {
  border: 1px solid var(--br-line-strong);
  background: transparent;
  color: inherit;
  padding: 0.65rem;
  cursor: pointer;
}
.file-preview {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.5rem;
  border-top: 1px solid var(--br-line);
  padding-top: 0.8rem;
}
.file-preview article {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--br-line);
  padding: 0.5rem;
}
.file-preview article small {
  display: block;
  color: var(--br-muted);
}
.file-preview article button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.2rem;
}
.table-wrap table {
  min-width: 122rem;
}
.provider-link {
  max-width: 15rem;
  border: 0;
  border-bottom: 1px solid var(--br-accent);
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
  font-weight: 800;
  cursor: pointer;
}
.provider-link:disabled {
  border: 0;
  cursor: default;
}
.status-pill {
  display: inline-block;
  border: 1px solid var(--br-line-strong);
  padding: 0.22rem 0.35rem;
  font:
    800 0.58rem "Courier New",
    monospace;
  text-transform: uppercase;
}
.status-pill.pagada {
  background: #d8ead9;
  color: #16391e;
}
.status-pill.pendiente,
.status-pill.parcial {
  background: #f4ddb0;
  color: #573b09;
}
.status-pill.cancelada,
.status-pill.sustituida {
  background: #efd0cb;
  color: #68251d;
}
.workspace-grid {
  grid-template-columns: minmax(0, 1fr) 26rem;
}
.calendar-reports .annual-row,
.calendar-reports article {
  display: grid;
  grid-template-columns: 5rem 1fr 7.5rem;
  gap: 0.5rem;
  align-items: center;
  border-bottom: 1px solid var(--br-line);
  padding: 0.6rem;
}
.calendar-reports .annual-row {
  grid-template-columns: 5rem 1fr;
  background: var(--br-panel-2);
}
.calendar-reports article > strong,
.annual-row > strong {
  text-transform: uppercase;
  font: 900 0.72rem Arial;
}
.calendar-reports span {
  color: var(--br-muted);
  font:
    700 0.6rem "Courier New",
    monospace;
}
.report-chip {
  display: flex;
  margin: 0.18rem 0;
}
.report-chip button {
  border: 1px solid var(--br-line);
  background: transparent;
  color: inherit;
  padding: 0.3rem 0.4rem;
  font:
    700 0.62rem "Courier New",
    monospace;
  cursor: pointer;
}
.report-chip button:first-child {
  flex: 1;
  text-align: left;
}
.report-chip button:hover {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.pdf-modal {
  width: min(90rem, calc(100vw - 2rem));
  height: calc(100dvh - 2rem);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
}
.pdf-modal iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: #666;
}
.combined-pdf {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  border: 1px solid var(--br-accent);
  background: color-mix(in srgb, var(--br-accent) 12%, transparent);
  color: var(--br-text);
  padding: 0.4rem;
  font:
    800 0.61rem "Courier New",
    monospace;
  text-transform: uppercase;
  cursor: pointer;
}
.combined-pdf:hover {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
tbody tr.used-monthly:not(.selected) {
  background: color-mix(
    in srgb,
    var(--br-warning-line, #d0a928) 14%,
    var(--br-panel)
  );
}
tbody tr.used-monthly td:first-child {
  box-shadow: inset 4px 0 0 var(--br-warning-line, #d0a928);
}
.monthly-used-label {
  color: var(--br-warning-line, #d0a928) !important;
  text-transform: uppercase;
}
tbody tr.report-blocked:not(.selected){background:color-mix(in srgb,var(--br-danger-line,#e06a5c) 17%,var(--br-panel))}tbody tr.report-blocked td:first-child{box-shadow:inset 4px 0 0 var(--br-danger-line,#e06a5c)}.blocked-label{max-width:16rem;margin-top:.35rem!important;color:var(--br-danger-line,#e06a5c)!important;font-weight:800!important}.check-col input:disabled{cursor:not-allowed;opacity:.55}
@media (max-width: 1100px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
  .calendar-reports {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
  .calendar-reports .annual-row {
    grid-column: 1/-1;
  }
  .calendar-reports article {
    grid-template-columns: 5rem 1fr 7rem;
  }
}
@media (max-width: 700px) {
  .xml-dropzone {
    grid-template-columns: 1fr;
  }
  .calendar-reports {
    grid-template-columns: 1fr;
  }
  .calendar-reports article {
    grid-template-columns: 4.5rem 1fr 6.5rem;
  }
}
.invoice-panel {
  display: flex;
  min-height: 34rem;
  flex-direction: column;
}
.invoice-panel .table-wrap {
  min-height: 0;
  flex: 1;
}
.invoice-panel .table-wrap table {
  min-height: 100%;
}
.xml-dropzone {
  grid-template-columns: 1fr;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}
.xml-dropzone:focus-visible {
  outline: 2px solid var(--br-accent);
  outline-offset: 3px;
}
.xml-dropzone:hover:not(.disabled) {
  border-color: var(--br-accent);
}
.xml-dropzone.disabled {
  cursor: not-allowed;
  opacity: 0.68;
}
.xml-dropzone > div:first-child strong em {
  color: var(--br-accent);
  font-style: normal;
  font-size: 0.72rem;
}
.file-preview {
  cursor: default;
}
.workspace-grid {
  grid-template-columns: minmax(0, 1fr);
}
.reports-drawer-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--br-accent) !important;
  padding: 0.55rem 0.7rem !important;
  color: var(--br-text) !important;
}
.reports-drawer-trigger strong {
  display: grid;
  min-width: 1.6rem;
  height: 1.6rem;
  place-items: center;
  background: var(--br-accent);
  color: var(--br-accent-text);
  font-size: 0.65rem;
}
.reports-drawer-trigger:hover {
  background: var(--br-accent) !important;
  color: var(--br-accent-text) !important;
}
.reports-drawer-trigger:hover strong {
  background: var(--br-bg);
  color: var(--br-text);
}
.reports-drawer-overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(2px);
  animation: drawer-overlay-in 0.2s ease-out;
}
.reports-drawer {
  width: min(36rem, 100vw);
  height: 100dvh;
  overflow-y: auto;
  border: 0;
  border-left: 4px solid var(--br-accent);
  background: var(--br-panel);
  color: var(--br-text);
  box-shadow: none !important;
  animation: reports-drawer-in 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.reports-drawer > header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 3.75rem;
  min-height: 5.25rem;
  padding: 0 0 0 1.2rem;
  background: var(--br-panel);
}
.reports-drawer > header small {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--br-accent);
  font: 800 0.62rem "Courier New", monospace;
  letter-spacing: 0.1em;
}
.reports-drawer .report-count {
  align-self: center;
  margin-right: 1rem;
}
.reports-drawer-close {
  align-self: stretch;
  border: 0;
  border-left: 1px solid var(--br-line-strong);
  background: var(--br-accent);
  color: var(--br-accent-text);
  font: 400 2rem/1 Arial, sans-serif;
  cursor: pointer;
}
.reports-drawer-close:hover,
.reports-drawer-close:focus-visible {
  background: var(--br-text);
  color: var(--br-bg);
}
.reports-drawer .calendar-reports {
  display: block;
}
.reports-drawer .calendar-reports article {
  grid-template-columns: 6rem minmax(0, 1fr) 8rem;
}
@keyframes reports-drawer-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes drawer-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (max-width: 620px) {
  .selection-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .reports-drawer-trigger {
    grid-column: 1 / -1;
    justify-content: center;
  }
  .reports-drawer .calendar-reports article {
    grid-template-columns: 5rem minmax(0, 1fr) 7rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reports-drawer-overlay,
  .reports-drawer {
    animation: none;
  }
}
</style>
