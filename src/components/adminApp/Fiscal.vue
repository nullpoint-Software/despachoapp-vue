<template>
  <main class="fiscal-view">
    <header class="fiscal-hero">
      <div>
        <p>IMPUESTOS / CFDI</p>
        <h1>Fiscal</h1>
        <span>Facturas emitidas y recibidas, clasificadas desde su XML.</span>
      </div>
      <div class="hero-actions">
        <input ref="fileInput" class="sr-only" type="file" accept=".xml,text/xml,application/xml" multiple @change="queueFiles" />
        <AppButton label="Nuevo reporte" icon="pi pi-file-plus" outlined :disabled="!selectedIds.size" @click="openReportDialog" />
      </div>
    </header>

    <section class="filter-strip" aria-label="Filtros fiscales">
      <label class="client-combobox"><span>Cliente</span><div class="combo-shell"><AppInput v-model="clientSearch" role="combobox" aria-autocomplete="list" :aria-expanded="clientOpen" placeholder="Escribe nombre o RFC" @focus="clientOpen=true" @input="clientOpen=true" @blur="closeClientList" /><div v-if="clientOpen" class="combo-list" role="listbox"><button v-for="client in filteredClients" :key="client.id_cliente" type="button" role="option" @mousedown.prevent="chooseClient(client)"><strong>{{ client.nombre }}</strong><small>{{ client.rfc }}</small></button><span v-if="!filteredClients.length">Sin coincidencias</span></div></div></label>
      <label><span>Movimiento</span><AppSelect v-model="filters.direction" :options="directions" option-label="label" option-value="value" /></label>
      <label><span>Ejercicio</span><AppSelect v-model="filters.year" :options="years" /></label>
      <label><span>Mes</span><AppSelect v-model="filters.month" :options="months" option-label="label" option-value="value" /></label>
      <label class="search-field"><span>Buscar UUID, RFC o nombre</span><AppInput v-model="filters.search" type="search" placeholder="Buscar factura" @input="scheduleLoad" /></label>
      <AppButton label="Aplicar" icon="pi pi-filter" @click="loadInvoices" />
    </section>

    <section class="xml-dropzone" :class="{ dragging, disabled: !filters.clienteId || importing }" role="button" tabindex="0" aria-label="Agregar archivos XML" @click="openFilePicker" @keydown.enter.prevent="openFilePicker" @keydown.space.prevent="openFilePicker" @dragenter.prevent="dragging=true" @dragover.prevent @dragleave.prevent="dragging=false" @drop.prevent="dropFiles">
      <div><i class="pi pi-cloud-upload" /><strong>Arrastra tus XML aquí <em>o haz clic para buscarlos</em></strong><span>Ingresos, egresos, nómina, pagos, traslados, notas de crédito y sustituciones.</span></div>
      <div v-if="pendingFiles.length" class="file-preview">
        <article v-for="(file,index) in pendingFiles" :key="`${file.name}-${file.size}`" @click.stop><i class="pi pi-file"/><span><strong>{{ file.name }}</strong><small>{{ fileSize(file.size) }}</small></span><button type="button" aria-label="Quitar archivo" @click="pendingFiles.splice(index,1)">×</button></article>
        <AppButton :label="importing?'Importando…':`Importar ${pendingFiles.length} XML`" icon="pi pi-check" :disabled="importing || !filters.clienteId" @click.stop="uploadQueued" />
      </div>
    </section>

    <div v-if="notice" class="notice" :class="noticeTone" role="status">
      <i :class="noticeTone === 'error' ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" />
      <span>{{ notice }}</span>
      <button type="button" aria-label="Cerrar aviso" @click="notice=''">×</button>
    </div>

    <section class="summary-grid" aria-label="Resumen de impuestos">
      <article><span>Documentos</span><strong>{{ invoices.length }}</strong></article>
      <article><span>Base 16%</span><strong>{{ money(summary.base16) }}</strong></article>
      <article class="accent"><span>IVA 16%</span><strong>{{ money(summary.iva16) }}</strong></article>
      <article><span>Tasa 0%</span><strong>{{ money(summary.zero) }}</strong></article>
      <article><span>Exento</span><strong>{{ money(summary.exempt) }}</strong></article>
      <article><span>Total</span><strong>{{ money(summary.total) }}</strong></article>
    </section>

    <section class="workspace-grid">
      <div class="invoice-panel">
        <header class="panel-heading">
          <div><h2>{{ filters.direction === 'emitida' ? 'Ingresos emitidos' : 'Egresos recibidos' }}</h2><p>{{ selectedIds.size }} seleccionadas para el siguiente reporte</p></div>
          <div class="selection-actions">
            <button type="button" @click="selectVisible">Seleccionar visibles</button>
            <button type="button" @click="selectedIds.clear()">Limpiar selección</button>
          </div>
        </header>

        <div class="table-wrap">
          <table>
            <thead><tr><th class="check-col"><input type="checkbox" :checked="allVisibleSelected" aria-label="Seleccionar todas" @change="toggleAll" /></th><th>Estatus</th><th>Nombre</th><th>RFC</th><th class="number">Abonado</th><th class="number">Subtotal 16%</th><th class="number">Subtotal 8%</th><th class="number">IVA 16%</th><th class="number">IVA 8%</th><th class="number">Pendiente</th><th class="number">Exento</th><th class="number">0%</th><th class="number">Ret. IEPS</th><th>Fecha</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody v-if="loading">
              <tr v-for="index in 5" :key="index" class="skeleton-row"><td colspan="15"><span /></td></tr>
            </tbody>
            <tbody v-else-if="invoices.length">
              <tr v-for="invoice in invoices" :key="invoice.id" :class="{ selected: selectedIds.has(Number(invoice.id)) }">
                <td class="check-col"><input type="checkbox" :checked="selectedIds.has(Number(invoice.id))" :aria-label="`Seleccionar ${invoice.uuid}`" @change="toggleInvoice(Number(invoice.id))" /></td>
                <td><span class="status-pill" :class="invoice.estatus_calculado">{{ invoice.estatus_calculado }}</span><small>{{ typeLabel(invoice.tipo_comprobante) }}</small></td>
                <td><button class="provider-link" type="button" :disabled="invoice.direccion!=='recibida'" @click="openProvider(invoice)">{{ counterpartName(invoice) || 'Sin nombre' }}</button><small v-if="invoice.reportes">{{ parseReports(invoice.reportes).length }} reporte(s)</small></td>
                <td><strong>{{ counterpartRfc(invoice) }}</strong></td>
                <td class="number">{{ currencyMoney(invoice.abonado,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.base_iva_16,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.base_iva_8,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.iva_16,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.iva_8,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.pendiente,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.base_exento,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.base_iva_0,invoice.moneda) }}</td><td class="number">{{ currencyMoney(invoice.ieps_retenido,invoice.moneda) }}</td>
                <td><time>{{ date(invoice.fecha_emision) }}</time><small>{{ shortUuid(invoice.uuid) }}</small></td>
                <td class="row-actions"><button type="button" title="Previsualizar PDF" @click="previewInvoice(invoice)"><i class="pi pi-file-pdf" /></button><button type="button" title="Ver XML desglosado" @click="openDetail(invoice)"><i class="pi pi-eye" /></button><button type="button" title="Descargar XML" @click="downloadXml(invoice)"><i class="pi pi-download" /></button><button class="danger" type="button" title="Eliminar XML" @click="removeInvoice(invoice)"><i class="pi pi-trash" /></button></td>
              </tr>
            </tbody>
            <tbody v-else><tr><td colspan="15"><div class="empty-state"><i class="pi pi-file-import" /><strong>No hay CFDI en este periodo</strong><span>Importa los XML del cliente o cambia los filtros.</span></div></td></tr></tbody>
          </table>
        </div>
      </div>

      <aside class="reports-panel">
        <header><h2>Reportes guardados</h2><span>{{ reports.length }}</span></header>
        <div v-if="reportsLoading" class="reports-loading">Cargando cortes...</div>
        <div v-else class="calendar-reports">
          <div class="annual-row"><strong>{{ filters.year }}</strong><div v-for="report in reportsFor(null,'anual')" :key="report.id" class="report-chip"><button @click="loadReport(Number(report.id))">{{ report.nombre }}</button><button title="PDF" @click="previewReportPdf(report)"><i class="pi pi-file-pdf"/></button><button title="CSV" @click="downloadReport(report)"><i class="pi pi-download"/></button></div><span v-if="!reportsFor(null,'anual').length">Sin reporte anual</span></div>
          <article v-for="(month,index) in monthNames" :key="month"><strong>{{ month }}</strong><div class="month-column"><div v-for="report in reportsFor(index+1,'mensual')" :key="report.id" class="report-chip"><button @click="loadReport(Number(report.id))">{{ report.direccion==='emitida'?'Ingresos':'Egresos' }}</button><button title="PDF" @click="previewReportPdf(report)"><i class="pi pi-file-pdf"/></button><button title="CSV" @click="downloadReport(report)"><i class="pi pi-download"/></button></div><span v-if="!reportsFor(index+1,'mensual').length">Sin corte</span></div><div class="diot-column"><div v-for="report in reportsFor(index+1,'diot')" :key="report.id" class="report-chip"><button @click="loadReport(Number(report.id))">DIOT</button><button title="TXT de carga masiva" @click="downloadReport(report)"><i class="pi pi-download"/></button></div><span v-if="!reportsFor(index+1,'diot').length">DIOT pendiente</span></div></article>
        </div>
      </aside>
    </section>

    <div v-if="showReportDialog" class="modal-overlay" @click.self="showReportDialog=false">
      <section class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <header class="modal-header"><p>SELECCIÓN / CORTE</p><h2 id="report-title">Guardar reporte</h2><button type="button" aria-label="Cerrar" @click="showReportDialog=false">×</button></header>
        <div class="modal-body form-grid">
          <label class="full"><span>Nombre del reporte</span><AppInput v-model="reportDraft.name" /></label>
          <label><span>Tipo</span><AppSelect v-model="reportDraft.type" :options="reportTypes" option-label="label" option-value="value" /></label>
          <label><span>Movimiento</span><AppSelect v-model="reportDraft.direction" :options="directions" option-label="label" option-value="value" :disabled="reportDraft.type==='diot'" /></label>
          <label><span>Ejercicio</span><AppSelect v-model="reportDraft.year" :options="years" /></label>
          <label v-if="reportDraft.type!=='anual'"><span>Mes</span><AppSelect v-model="reportDraft.month" :options="months.slice(1)" option-label="label" option-value="value" /></label>
          <div class="selection-note full"><strong>{{ selectedIds.size }} CFDI</strong><span>La selección quedará guardada y marcada para volver a generar este corte.</span></div>
          <p v-if="reportDraft.type==='mensual' && reportDraft.direction==='recibida'" class="fiscal-note full">La DIOT del mes se guardará automáticamente con exactamente los mismos CFDI de este reporte mensual.</p>
        </div>
        <footer><AppButton label="Cancelar" outlined @click="showReportDialog=false" /><AppButton label="Guardar reporte" class="p-button-primary" :disabled="savingReport" @click="saveReport" /></footer>
      </section>
    </div>

    <div v-if="showDetail && detail" class="modal-overlay" @click.self="showDetail=false">
      <section class="modal-shell detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <header class="modal-header"><p>CFDI / {{ detail.uuid }}</p><h2 id="detail-title">Detalle de factura</h2><button type="button" aria-label="Cerrar" @click="showDetail=false">×</button></header>
        <div class="modal-body">
          <dl class="invoice-meta"><div><dt>Emisor</dt><dd>{{ detail.emisor_nombre }}<small>{{ detail.emisor_rfc }}</small></dd></div><div><dt>Receptor</dt><dd>{{ detail.receptor_nombre }}<small>{{ detail.receptor_rfc }}</small></dd></div><div><dt>Pago</dt><dd>{{ detail.forma_pago || 'Sin clave' }} / {{ detail.metodo_pago || 'Sin método' }}</dd></div><div><dt>Total</dt><dd>{{ money(detail.total) }}</dd></div></dl>
          <h3>Productos y servicios</h3>
          <div class="concept-list"><article v-for="concept in detail.concepts" :key="concept.id"><div><strong>{{ concept.descripcion }}</strong><small>{{ concept.clave_prod_serv }} / {{ concept.clave_unidad || concept.unidad || 'Sin unidad' }}</small></div><span>{{ concept.cantidad }} × {{ money(concept.valor_unitario) }}</span><b>{{ money(concept.importe) }}</b></article></div>
          <h3>Impuestos desglosados</h3>
          <div class="tax-detail"><span v-for="tax in detail.taxes" :key="tax.id">{{ tax.movimiento }} / {{ taxName(tax.impuesto) }} / {{ tax.tipo_factor || 'Sin factor' }} {{ tax.tasa_cuota == null ? '' : percent(tax.tasa_cuota) }}: {{ money(tax.importe) }}</span></div>
        </div>
      </section>
    </div>

    <div v-if="showDiotDialog && diotDraft" class="modal-overlay" @click.self="showDiotDialog=false">
      <section class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="diot-title">
        <header class="modal-header"><p>DIOT / PROVEEDOR</p><h2 id="diot-title">{{ diotDraft.nombre }}</h2><button type="button" aria-label="Cerrar" @click="showDiotDialog=false">×</button></header>
        <div class="modal-body form-grid">
          <label><span>Tipo de tercero</span><AppSelect v-model="diotDraft.tipoTercero" :options="thirdPartyTypes" option-label="label" option-value="value" /></label>
          <label><span>Tipo de operación</span><AppSelect v-model="diotDraft.tipoOperacion" :options="availableOperationTypes" option-label="label" option-value="value" /></label>
          <label><span>Región fronteriza</span><AppSelect v-model="diotDraft.region" :options="regions" option-label="label" option-value="value" /></label>
          <label><span>Importación</span><AppSelect v-model="diotDraft.importacion" :options="importTypes" option-label="label" option-value="value" /></label>
          <label><span>Acreditamiento del IVA</span><AppSelect v-model="diotDraft.acreditamiento" :options="creditTypes" option-label="label" option-value="value" /></label>
          <label v-if="diotDraft.acreditamiento==='proporcion'"><span>Proporción acreditable (0 a 1)</span><AppInput v-model="diotDraft.proporcion" type="number" min="0" max="1" step="0.000001" /></label>
          <template v-if="diotDraft.tipoTercero==='05'"><label><span>ID fiscal extranjero</span><AppInput v-model="diotDraft.numeroIdFiscal" /></label><label><span>País SAT</span><AppInput v-model="diotDraft.pais" maxlength="3" /></label></template>
          <label class="full check-label"><input v-model="diotDraft.efectoFiscal" type="checkbox" /><span>Se dio efectos fiscales a los comprobantes del proveedor</span></label>
          <p class="fiscal-note full">Estos campos controlan la posición de bases e IVA en el TXT de 54 campos del SAT.</p>
        </div>
        <footer><AppButton label="Cancelar" outlined @click="showDiotDialog=false" /><AppButton label="Guardar para este proveedor" class="p-button-primary" @click="saveProvider" /></footer>
      </section>
    </div>
    <div v-if="pdfUrl" class="modal-overlay" @click.self="closePdf">
      <section class="modal-shell pdf-modal" role="dialog" aria-modal="true"><header class="modal-header"><p>PREVISUALIZACIÓN</p><h2>{{ pdfTitle }}</h2><button type="button" aria-label="Cerrar" @click="closePdf">×</button></header><iframe :src="pdfUrl" title="Vista previa PDF" /></section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/img/logblack.png";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { cs, fs } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";

type Direction = "emitida" | "recibida";
type ReportType = "mensual" | "anual" | "diot";
type Invoice = Record<string, any>;
const now = new Date();
const clients = ref<any[]>([]), invoices = ref<Invoice[]>([]), reports = ref<any[]>([]);
const loading = ref(false), reportsLoading = ref(false), importing = ref(false), savingReport = ref(false);
const notice = ref(""), noticeTone = ref<"success"|"error">("success"), activeReportId = ref<number|null>(null);
const fileInput = ref<HTMLInputElement|null>(null), selectedIds = reactive(new Set<number>());
const showReportDialog = ref(false), showDetail = ref(false), showDiotDialog = ref(false), detail = ref<any>(null), diotDraft = ref<any>(null);
const clientSearch = ref(""), clientOpen = ref(false), pendingFiles = ref<File[]>([]), dragging = ref(false);
const pdfUrl = ref(""), pdfTitle = ref("");
const filters = reactive({ clienteId: 0, direction: "emitida" as Direction, year: now.getFullYear(), month: 0 as number, search: "" });
const reportDraft = reactive({ name: "", type: "mensual" as ReportType, direction: "emitida" as Direction, year: now.getFullYear(), month: now.getMonth()+1 });
let searchTimer = 0;
let invoiceLoadVersion = 0;

const directions = [{label:"Emitidas / ingresos",value:"emitida"},{label:"Recibidas / egresos",value:"recibida"}];
const years = Array.from({length:8},(_,index)=>now.getFullYear()-index);
const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const months = [{label:"Todo el año",value:0},...monthNames.map((label,index)=>({label,value:index+1}))];
const reportTypes = [{label:"Mensual",value:"mensual"},{label:"Anual",value:"anual"}];
const thirdPartyTypes = [{label:"04 Proveedor nacional",value:"04"},{label:"05 Proveedor extranjero",value:"05"},{label:"15 Proveedor global",value:"15"}];
const operationTypes = [{label:"02 Enajenación de bienes",value:"02"},{label:"03 Servicios profesionales",value:"03"},{label:"06 Uso o goce temporal",value:"06"},{label:"07 Importación",value:"07"},{label:"08 Transferencia virtual",value:"08"},{label:"85 Otros",value:"85"},{label:"87 Operaciones globales",value:"87"}];
const availableOperationTypes=computed(()=>{const map:Record<string,string[]>={"04":["02","03","06","08","85"],"05":["02","03","07"],"15":["87"]};return operationTypes.filter(option=>(map[diotDraft.value?.tipoTercero]||[]).includes(option.value))});
const regions = [{label:"Ninguna",value:"ninguna"},{label:"Frontera norte",value:"norte"},{label:"Frontera sur",value:"sur"}];
const importTypes = [{label:"No es importación",value:"ninguna"},{label:"Bienes tangibles",value:"tangible"},{label:"Intangibles o servicios",value:"intangible"}];
const creditTypes = [{label:"Exclusivo de actividades gravadas",value:"exclusivo"},{label:"Aplicó proporción",value:"proporcion"},{label:"No cumple requisitos",value:"no_requisitos"},{label:"Asociado a actividades exentas",value:"actividades_exentas"},{label:"Asociado a actividades no objeto",value:"no_objeto"}];
const filteredClients=computed(()=>{const term=clientSearch.value.trim().toLocaleLowerCase("es");return clients.value.filter(client=>!term||`${client.nombre} ${client.rfc||""}`.toLocaleLowerCase("es").includes(term)).slice(0,10)});

const num=(value:any)=>Number(value||0), signed=(invoice:Invoice,value:any)=>invoice.tipo_comprobante==="E"?-num(value):num(value);
const mxn=(invoice:Invoice,value:any)=>signed(invoice,value)*(invoice.moneda==="MXN"?1:num(invoice.tipo_cambio)||1);
const summary=computed(()=>invoices.value.reduce((total,invoice)=>{total.base16+=mxn(invoice,invoice.base_iva_16);total.iva16+=mxn(invoice,invoice.iva_16);total.zero+=mxn(invoice,invoice.base_iva_0);total.exempt+=mxn(invoice,invoice.base_exento);total.total+=mxn(invoice,invoice.total);return total},{base16:0,iva16:0,zero:0,exempt:0,total:0}));
const allVisibleSelected=computed(()=>!!invoices.value.length&&invoices.value.every(invoice=>selectedIds.has(Number(invoice.id))));
const money=(value:any)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(num(value));
const currencyMoney=(value:any,currency:string)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:currency||"MXN",maximumFractionDigits:2}).format(num(value));
const date=(value:string)=>new Date(value).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});
const percent=(value:any)=>`${(num(value)*100).toLocaleString("es-MX",{maximumFractionDigits:4})}%`;
const shortUuid=(uuid:string)=>`${uuid.slice(0,8)}...${uuid.slice(-6)}`;
const typeLabel=(type:string)=>({I:"Ingreso",E:"Nota de crédito",P:"Pago",T:"Traslado",N:"Nómina"}[type]||type);
const taxName=(code:string)=>({"001":"ISR","002":"IVA","003":"IEPS"}[code]||code);
const counterpartName=(invoice:Invoice)=>invoice.direccion==="emitida"?invoice.receptor_nombre:invoice.emisor_nombre;
const counterpartRfc=(invoice:Invoice)=>invoice.direccion==="emitida"?invoice.receptor_rfc:invoice.emisor_rfc;
const paymentLabel=(invoice:Invoice)=>[invoice.metodo_pago,invoice.moneda].filter(Boolean).join(" / ")||"Sin método";
const hasTaxBase=(invoice:Invoice)=>[invoice.base_iva_16,invoice.base_iva_8,invoice.base_iva_0,invoice.base_exento,invoice.base_no_objeto].some(num);
const reportTypeLabel=(type:ReportType)=>({mensual:"Mensual",anual:"Anual",diot:"DIOT"}[type]);
const periodLabel=(report:any)=>report.tipo==="anual"?String(report.ejercicio):`${monthNames[Number(report.mes)-1]} ${report.ejercicio}`;
const parseReports=(value:string)=>String(value).split("||").map(entry=>{const [id,...name]=entry.split(":");return{id:Number(id),name:name.join(":")}});
const reportsFor=(month:number|null,type:ReportType)=>reports.value.filter(report=>Number(report.ejercicio)===Number(filters.year)&&report.tipo===type&&(type==="anual"||Number(report.mes)===month));

function setNotice(message:string,tone:"success"|"error"="success"){notice.value=message;noticeTone.value=tone}
function scheduleLoad(){window.clearTimeout(searchTimer);searchTimer=window.setTimeout(loadInvoices,350)}
function toggleInvoice(id:number){selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id)}
function selectVisible(){invoices.value.forEach(invoice=>selectedIds.add(Number(invoice.id)))}
function toggleAll(){allVisibleSelected.value?invoices.value.forEach(invoice=>selectedIds.delete(Number(invoice.id))):selectVisible()}
function chooseClient(client:any){filters.clienteId=Number(client.id_cliente);clientSearch.value=`${client.nombre}${client.rfc?` · ${client.rfc}`:""}`;clientOpen.value=false}
function closeClientList(){window.setTimeout(()=>clientOpen.value=false,120)}
const fileSize=(bytes:number)=>bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`;
function addFiles(files:File[]){const xml=files.filter(file=>file.name.toLowerCase().endsWith(".xml"));for(const file of xml){if(!pendingFiles.value.some(item=>item.name===file.name&&item.size===file.size))pendingFiles.value.push(file)}if(xml.length!==files.length)setNotice("Sólo se agregaron archivos con extensión .xml.","error")}
function openFilePicker(){if(!filters.clienteId){setNotice("Selecciona un cliente antes de agregar XML.","error");return}if(!importing.value)fileInput.value?.click()}
function queueFiles(event:Event){const input=event.target as HTMLInputElement;addFiles(Array.from(input.files||[]));input.value=""}
function dropFiles(event:DragEvent){dragging.value=false;if(!filters.clienteId){setNotice("Selecciona un cliente antes de agregar XML.","error");return}addFiles(Array.from(event.dataTransfer?.files||[]))}

async function loadInvoices(){
  if(!filters.clienteId){invoices.value=[];return}
  const version=++invoiceLoadVersion;
  loading.value=true;
  const baseFilters={clienteId:Number(filters.clienteId),direction:filters.direction,year:Number(filters.year),month:filters.month||undefined,search:filters.search||undefined};
  try{await loadProgressively<Invoice>({pageSize:40,fetchPage:(page)=>fs.getInvoices({...baseFilters,...page}),onUpdate:(items)=>{if(version===invoiceLoadVersion)invoices.value=items},onBackgroundError:(error:any)=>{if(version===invoiceLoadVersion)setNotice(error.response?.data?.error||"No se completó la carga de facturas.","error")}})}
  catch(error:any){setNotice(error.response?.data?.error||"No se pudieron cargar las facturas.","error")}
  finally{loading.value=false}
}
async function loadReports(){
  if(!filters.clienteId){reports.value=[];return}
  reportsLoading.value=true;
  try{reports.value=await fs.getReports(Number(filters.clienteId))}catch{reports.value=[]}finally{reportsLoading.value=false}
}
async function uploadQueued(){
  const files=[...pendingFiles.value];if(!files.length)return;
  importing.value=true;
  try{const response=await fs.importXml(Number(filters.clienteId),files);const ok=response.results.filter((item:any)=>item.status==="imported").length;const duplicate=response.results.filter((item:any)=>item.status==="duplicate").length;const errors=response.results.filter((item:any)=>item.status==="error");pendingFiles.value=[];setNotice(`${ok} XML importados, ${duplicate} duplicados${errors.length?`, ${errors.length} con error`:""}.`,errors.length&&!ok?"error":"success");await Promise.all([loadInvoices(),loadReports()])}
  catch(error:any){setNotice(error.response?.data?.error||"No se pudieron importar los XML.","error")}
  finally{importing.value=false}
}
function openReportDialog(){reportDraft.type=filters.month?"mensual":"anual";reportDraft.direction=filters.direction;reportDraft.year=filters.year;reportDraft.month=filters.month||now.getMonth()+1;reportDraft.name=`${reportTypeLabel(reportDraft.type)} ${filters.direction} ${reportDraft.type==="anual"?reportDraft.year:`${monthNames[reportDraft.month-1]} ${reportDraft.year}`}`;showReportDialog.value=true}
watch(()=>diotDraft.value?.tipoTercero,(type)=>{if(type&&diotDraft.value&&!availableOperationTypes.value.some(option=>option.value===diotDraft.value.tipoOperacion))diotDraft.value.tipoOperacion=availableOperationTypes.value[0]?.value||"85"});
async function saveReport(){
  savingReport.value=true;
  try{const response=await fs.createReport({clienteId:Number(filters.clienteId),nombre:reportDraft.name,tipo:reportDraft.type,direccion:reportDraft.direction,ejercicio:Number(reportDraft.year),mes:reportDraft.type==="anual"?null:Number(reportDraft.month),invoiceIds:[...selectedIds]});showReportDialog.value=false;activeReportId.value=Number(response.id);setNotice(response.message||"Reporte guardado. Las facturas quedaron marcadas.");await Promise.all([loadInvoices(),loadReports()])}
  catch(error:any){setNotice(error.response?.data?.error||"No se pudo guardar el reporte.","error")}
  finally{savingReport.value=false}
}
async function loadReport(id:number){
  try{const data=await fs.getReport(id);activeReportId.value=id;filters.clienteId=Number(data.report.id_cliente);filters.direction=data.report.direccion;filters.year=Number(data.report.ejercicio);filters.month=data.report.tipo==="anual"?0:Number(data.report.mes);filters.search="";selectedIds.clear();data.invoices.forEach((invoice:Invoice)=>selectedIds.add(Number(invoice.id)));await Promise.all([loadInvoices(),loadReports()]);setNotice(`Corte “${data.report.nombre}” cargado con ${data.invoices.length} facturas.`)}
  catch(error:any){setNotice(error.response?.data?.error||"No se pudo abrir el reporte.","error")}
}
async function downloadReport(report:any){try{await fs.exportReport(Number(report.id),report.tipo==="diot"?"DIOT.txt":"Reporte.csv")}catch(error:any){setNotice(error.response?.data?.error||"No se pudo descargar el reporte.","error")}}
async function openDetail(invoice:Invoice){showDetail.value=true;detail.value=null;try{detail.value=await fs.getInvoice(Number(invoice.id))}catch{showDetail.value=false;setNotice("No se pudo abrir el detalle.","error")}}
async function openProvider(invoice:Invoice){if(invoice.direccion!=="recibida")return;const fallback={nombre:invoice.emisor_nombre,rfc:invoice.emisor_rfc,tipoTercero:invoice.diot_tipo_tercero||"04",tipoOperacion:invoice.diot_tipo_operacion||"85",numeroIdFiscal:invoice.diot_numero_id_fiscal||"",pais:invoice.diot_pais||"",jurisdiccion:invoice.diot_jurisdiccion||"",region:invoice.diot_region||"ninguna",importacion:invoice.diot_importacion||"ninguna",acreditamiento:invoice.diot_acreditamiento||"exclusivo",proporcion:num(invoice.diot_proporcion)||1,efectoFiscal:invoice.diot_efecto_fiscal!==0};diotDraft.value=fallback;showDiotDialog.value=true;try{const provider=await fs.getProvider(Number(filters.clienteId),invoice.emisor_rfc);diotDraft.value={nombre:provider.nombre||fallback.nombre,rfc:provider.rfc,tipoTercero:provider.tipo_tercero,tipoOperacion:provider.tipo_operacion,numeroIdFiscal:provider.numero_id_fiscal||"",pais:provider.pais||"",jurisdiccion:provider.jurisdiccion||"",region:provider.region,importacion:provider.importacion,acreditamiento:provider.acreditamiento,proporcion:num(provider.proporcion),efectoFiscal:!!provider.efecto_fiscal}}catch(error:any){if(error.response?.status!==404)setNotice("No se pudo cargar la configuración del proveedor.","error")}}
async function saveProvider(){try{await fs.updateProvider(Number(filters.clienteId),diotDraft.value.rfc,diotDraft.value);showDiotDialog.value=false;setNotice("La configuración se aplicó a todas las facturas de este proveedor.");await loadInvoices()}catch(error:any){setNotice(error.response?.data?.error||"No se pudo guardar la configuración del proveedor.","error")}}

let cachedLogo="";
async function logoData(){if(cachedLogo)return cachedLogo;cachedLogo=await new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext("2d")?.drawImage(image,0,0);resolve(canvas.toDataURL("image/png"))};image.onerror=reject;image.src=logo});return cachedLogo}
function showPdf(doc:jsPDF,title:string){closePdf();pdfTitle.value=title;pdfUrl.value=URL.createObjectURL(doc.output("blob"))}
function closePdf(){if(pdfUrl.value)URL.revokeObjectURL(pdfUrl.value);pdfUrl.value="";pdfTitle.value=""}
async function previewInvoice(invoice:Invoice){try{const data=await fs.getInvoice(Number(invoice.id));const doc=new jsPDF({unit:"mm",format:"a4"});const image=await logoData();doc.addImage(image,"PNG",14,10,34,10);doc.setFontSize(16);doc.text("Representación del CFDI",14,29);doc.setFontSize(9);doc.text(`UUID: ${data.uuid}`,14,36);doc.text(`Emisor: ${data.emisor_nombre||""} · ${data.emisor_rfc}`,14,42);doc.text(`Receptor: ${data.receptor_nombre||""} · ${data.receptor_rfc}`,14,48);doc.text(`Fecha: ${date(data.fecha_emision)}   Tipo: ${typeLabel(data.tipo_comprobante)}   Pago: ${data.metodo_pago||"—"}/${data.forma_pago||"—"}`,14,54);autoTable(doc,{startY:61,head:[["Producto / servicio","Cantidad","V. unitario","Importe"]],body:data.concepts.map((concept:any)=>[concept.descripcion,String(concept.cantidad),currencyMoney(concept.valor_unitario,data.moneda),currencyMoney(concept.importe,data.moneda)]),styles:{fontSize:8},headStyles:{fillColor:[20,20,19]}});const finalY=(doc as any).lastAutoTable?.finalY||80;doc.setFontSize(11);doc.text(`Subtotal: ${currencyMoney(data.subtotal,data.moneda)}`,196,finalY+10,{align:"right"});doc.text(`IVA: ${currencyMoney(num(data.iva_16)+num(data.iva_8),data.moneda)}`,196,finalY+16,{align:"right"});doc.setFontSize(14);doc.text(`Total: ${currencyMoney(data.total,data.moneda)}`,196,finalY+24,{align:"right"});showPdf(doc,`CFDI ${shortUuid(data.uuid)}`)}catch{setNotice("No se pudo generar la vista previa de la factura.","error")}}
async function previewReportPdf(report:any){try{const data=await fs.getReport(Number(report.id));const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4"});autoTable(doc,{startY:28,margin:{top:28,left:8,right:8},head:[["Estatus","Nombre","RFC","Abonado","Subt. 16%","Subt. 8%","IVA 16%","IVA 8%","Pendiente","Exento","0%","Ret. IEPS","Fecha"]],body:data.invoices.map((invoice:Invoice)=>[invoice.estatus_calculado||typeLabel(invoice.tipo_comprobante),counterpartName(invoice),counterpartRfc(invoice),money(invoice.abonado),money(invoice.base_iva_16),money(invoice.base_iva_8),money(invoice.iva_16),money(invoice.iva_8),money(invoice.pendiente),money(invoice.base_exento),money(invoice.base_iva_0),money(invoice.ieps_retenido),date(invoice.fecha_emision)]),styles:{fontSize:6.5,cellPadding:1.4},headStyles:{fillColor:[20,20,19]},alternateRowStyles:{fillColor:[244,242,236]}});const image=await logoData();const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.addImage(image,"PNG",8,7,28,8);doc.setFontSize(11);doc.setFont("helvetica","bold");doc.text(data.report.cliente||"Cliente",42,11);doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text(`${data.report.nombre} · ${periodLabel(data.report)}`,42,17);doc.text(`Página ${page} de ${pages}`,289,11,{align:"right"})}showPdf(doc,data.report.nombre)}catch{setNotice("No se pudo generar el PDF del reporte.","error")}}
async function removeInvoice(invoice:Invoice){if(!window.confirm(`¿Eliminar el CFDI ${invoice.uuid}? También dejará de aparecer en reportes guardados.`))return;try{await fs.deleteInvoice(Number(invoice.id));selectedIds.delete(Number(invoice.id));setNotice("CFDI eliminado.");await Promise.all([loadInvoices(),loadReports()])}catch(error:any){setNotice(error.response?.data?.error||"No se pudo eliminar el CFDI.","error")}}
async function downloadXml(invoice:Invoice){try{await fs.downloadInvoiceXml(Number(invoice.id),invoice.uuid)}catch(error:any){setNotice(error.response?.data?.error||"No se pudo descargar el XML.","error")}}

onMounted(async()=>{try{await loadProgressively<any>({pageSize:40,fetchPage:(page)=>cs.getClientes(page),onUpdate:(items)=>{clients.value=items;if(!filters.clienteId&&items.length)chooseClient(items[0])},onBackgroundError:()=>setNotice("No se completó la carga del catálogo de clientes.","error")})}catch{setNotice("No se pudieron cargar los clientes.","error")}});
onBeforeUnmount(closePdf);
watch(()=>filters.clienteId,()=>{selectedIds.clear();activeReportId.value=null;Promise.all([loadInvoices(),loadReports()])});
</script>

<style scoped>
.fiscal-view{min-height:100%;padding:clamp(1rem,2.5vw,2rem);background:var(--br-bg);color:var(--br-text)}.fiscal-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding:1.5rem 0 2rem;border-top:2px solid var(--br-line-strong);border-bottom:2px solid var(--br-line-strong)}.fiscal-hero p,.modal-header p{margin:0 0 .5rem;color:var(--br-accent);font:800 .72rem "Courier New",monospace;letter-spacing:.12em}.fiscal-hero h1{margin:0;font:900 clamp(3.4rem,9vw,7rem)/.75 Arial,sans-serif;letter-spacing:-.075em;text-transform:uppercase}.fiscal-hero span{display:block;margin-top:1rem;color:var(--br-muted);font:700 .9rem "Courier New",monospace}.hero-actions{display:flex;gap:.65rem;flex-wrap:wrap}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.filter-strip{display:grid;grid-template-columns:minmax(13rem,1.4fr) repeat(3,minmax(8rem,.7fr)) minmax(14rem,1.3fr) auto;align-items:end;gap:.75rem;padding:1rem 0;border-bottom:1px solid var(--br-line)}label>span{display:block;margin-bottom:.4rem;color:var(--br-muted);font:800 .66rem "Courier New",monospace;letter-spacing:.06em;text-transform:uppercase}.search-field :deep(input){width:100%}.notice{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.75rem;margin-top:1rem;border:1px solid var(--br-success-line,#78a187);background:var(--br-panel);padding:.85rem 1rem;font-weight:700}.notice.error{border-color:var(--br-danger-line,#e06a5c)}.notice button{border:0;background:transparent;color:inherit;font-size:1.4rem;cursor:pointer}.summary-grid{display:grid;grid-template-columns:repeat(6,1fr);margin-top:1rem;border:1px solid var(--br-line)}.summary-grid article{min-width:0;padding:1rem;border-right:1px solid var(--br-line);background:var(--br-panel)}.summary-grid article:last-child{border-right:0}.summary-grid span{display:block;margin-bottom:.7rem;color:var(--br-muted);font:800 .64rem "Courier New",monospace;text-transform:uppercase}.summary-grid strong{font:900 clamp(1.05rem,2vw,1.6rem)/1 Arial,sans-serif}.summary-grid .accent{background:var(--br-accent);color:var(--br-accent-text)}.summary-grid .accent span{color:inherit}.workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) 20rem;gap:1rem;margin-top:1rem}.invoice-panel,.reports-panel{min-width:0;border:1px solid var(--br-line);background:var(--br-panel)}.panel-heading,.reports-panel>header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid var(--br-line)}.panel-heading h2,.reports-panel h2{margin:0;font:900 1.25rem Arial,sans-serif;text-transform:uppercase}.panel-heading p{margin:.25rem 0 0;color:var(--br-muted);font:700 .72rem "Courier New",monospace}.selection-actions{display:flex;gap:.5rem}.selection-actions button{border:0;border-bottom:1px solid var(--br-line-strong);background:transparent;color:var(--br-muted);padding:.35rem;font:800 .65rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}.selection-actions button:hover{color:var(--br-text)}.table-wrap{max-width:100%;overflow:auto}table{width:100%;min-width:68rem;border-collapse:collapse}th{position:sticky;top:0;z-index:1;background:var(--br-panel-2);color:var(--br-muted);padding:.7rem;text-align:left;font:800 .64rem "Courier New",monospace;text-transform:uppercase}td{padding:.8rem .7rem;border-top:1px solid var(--br-line);vertical-align:top;font-size:.82rem}tbody tr.selected{background:color-mix(in srgb,var(--br-accent) 11%,var(--br-panel))}.check-col{width:2.5rem;text-align:center}.number{text-align:right}.actions-col{width:8rem}td time,td small{display:block;color:var(--br-muted);font:700 .66rem/1.45 "Courier New",monospace}td strong{display:block;max-width:18rem}.uuid-link{display:block;border:0;background:transparent;color:var(--br-text);padding:.25rem 0;font:800 .68rem "Courier New",monospace;cursor:pointer}.uuid-link:hover{color:var(--br-accent)}.document-type{display:inline-block;border:1px solid var(--br-line-strong);padding:.2rem .35rem;color:var(--br-muted);font:800 .58rem "Courier New",monospace;text-transform:uppercase}.tax-stack{display:flex;max-width:16rem;flex-wrap:wrap;gap:.25rem}.tax-stack span,.report-badges button{border:1px solid var(--br-line);background:var(--br-panel-2);color:var(--br-text);padding:.2rem .35rem;font:700 .6rem "Courier New",monospace}.report-badges{display:flex;max-width:14rem;flex-wrap:wrap;gap:.25rem}.report-badges button{border-color:var(--br-accent);cursor:pointer}.muted{color:var(--br-muted);font:700 .65rem "Courier New",monospace}.row-actions{display:flex;gap:.3rem}.row-actions button{display:grid;width:2.25rem;height:2.25rem;place-items:center;border:1px solid var(--br-line-strong);background:transparent;color:var(--br-text);cursor:pointer}.row-actions button:hover{background:var(--br-accent);color:var(--br-accent-text)}.row-actions .danger:hover{background:var(--br-danger,#96382e)}.skeleton-row span{display:block;height:2.5rem;background:linear-gradient(90deg,var(--br-panel-2),var(--br-line),var(--br-panel-2));background-size:200% 100%;animation:skeleton 1.2s linear infinite}.empty-state{display:grid;min-height:16rem;place-items:center;align-content:center;gap:.5rem;color:var(--br-muted);text-align:center}.empty-state i{font-size:2rem}.empty-state strong{color:var(--br-text);font-size:1rem}.reports-panel>header span{display:grid;width:2rem;height:2rem;place-items:center;background:var(--br-accent);color:var(--br-accent-text);font:800 .72rem "Courier New",monospace}.report-list article{display:grid;grid-template-columns:1fr auto;border-bottom:1px solid var(--br-line)}.report-list article.active{box-shadow:inset 4px 0 0 var(--br-accent)}.report-main{min-width:0;border:0;background:transparent;color:inherit;padding:1rem;text-align:left;cursor:pointer}.report-main>span{display:block;color:var(--br-accent);font:800 .6rem "Courier New",monospace;text-transform:uppercase}.report-main strong,.report-main small{display:block;margin-top:.3rem}.report-main small{color:var(--br-muted);font:700 .62rem "Courier New",monospace}.download{width:3rem;border:0;border-left:1px solid var(--br-line);background:transparent;color:var(--br-text);cursor:pointer}.download:hover{background:var(--br-accent);color:var(--br-accent-text)}.reports-loading,.aside-empty{padding:1.25rem;color:var(--br-muted);font:700 .72rem/1.5 "Courier New",monospace}.modal-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(8,8,7,.84);padding:1rem;backdrop-filter:blur(3px)}.modal-shell{width:min(48rem,calc(100vw - 2rem));max-height:calc(100dvh - 2rem);overflow:auto;border:2px solid #111;background:var(--br-control);color:#141413;box-shadow:12px 12px 0 var(--br-accent)}.detail-modal{width:min(70rem,calc(100vw - 2rem))}.modal-header{position:relative;padding:1.3rem 4.5rem 1.2rem 1.4rem;border-bottom:2px solid #141413;background:#141413;color:var(--br-text)}.modal-header h2{margin:0;font:900 clamp(1.8rem,5vw,3rem)/.95 Arial,sans-serif;letter-spacing:-.05em;text-transform:uppercase}.modal-header button{position:absolute;right:0;top:0;width:3.75rem;height:3.75rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);background:var(--br-accent);color:var(--br-accent-text);font-size:2rem;cursor:pointer}.modal-body{padding:1.4rem}.modal-shell footer{display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.4rem;border-top:1px solid #77736b}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.form-grid .full{grid-column:1/-1}.form-grid :deep(input){width:100%}.selection-note{display:flex;align-items:center;gap:1rem;border:1px solid #77736b;padding:1rem}.selection-note strong{font:900 1.5rem Arial}.selection-note span{color:#56534c;font-size:.8rem}.invoice-meta{display:grid;grid-template-columns:repeat(4,1fr);margin:0 0 1.5rem;border:1px solid #77736b}.invoice-meta div{padding:1rem;border-right:1px solid #77736b}.invoice-meta div:last-child{border-right:0}.invoice-meta dt{font:800 .65rem "Courier New",monospace;text-transform:uppercase}.invoice-meta dd{margin:.4rem 0 0;font-weight:800}.invoice-meta small{display:block;color:#56534c;font:700 .65rem "Courier New",monospace}.modal-body h3{margin:1.4rem 0 .6rem;font:900 1rem Arial;text-transform:uppercase}.concept-list{border:1px solid #77736b}.concept-list article{display:grid;grid-template-columns:1fr auto auto;gap:1rem;padding:.8rem;border-bottom:1px solid #aaa69c}.concept-list article:last-child{border-bottom:0}.concept-list small{display:block;color:#56534c;font:700 .65rem "Courier New",monospace}.tax-detail{display:flex;flex-wrap:wrap;gap:.4rem}.tax-detail span{border:1px solid #77736b;padding:.4rem;font:700 .68rem "Courier New",monospace}.check-label{display:flex;align-items:center;gap:.6rem;border:1px solid #77736b;padding:.8rem}.check-label span{margin:0;color:#141413}.fiscal-note{margin:0;border-left:4px solid var(--br-accent);padding:.7rem;color:#56534c;font-size:.78rem}@keyframes skeleton{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.skeleton-row span{animation:none}}@media(max-width:1100px){.filter-strip{grid-template-columns:repeat(3,1fr)}.search-field{grid-column:span 2}.summary-grid{grid-template-columns:repeat(3,1fr)}.summary-grid article:nth-child(3){border-right:0}.summary-grid article:nth-child(-n+3){border-bottom:1px solid var(--br-line)}.workspace-grid{grid-template-columns:1fr}.reports-panel{order:-1}.report-list{display:grid;grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.fiscal-hero{align-items:stretch;flex-direction:column}.hero-actions :deep(button){flex:1}.filter-strip{grid-template-columns:1fr 1fr}.filter-strip label:first-child,.search-field{grid-column:1/-1}.summary-grid{grid-template-columns:1fr 1fr}.summary-grid article{border-bottom:1px solid var(--br-line)}.summary-grid article:nth-child(even){border-right:0}.panel-heading{align-items:flex-start;flex-direction:column}.selection-actions{width:100%;justify-content:space-between}.report-list{grid-template-columns:1fr}.form-grid,.invoice-meta{grid-template-columns:1fr}.form-grid .full{grid-column:auto}.invoice-meta div{border-right:0;border-bottom:1px solid #77736b}.concept-list article{grid-template-columns:1fr}.modal-shell{box-shadow:6px 6px 0 var(--br-accent)}}
.combo-shell{position:relative}.combo-shell :deep(input){width:100%}.combo-list{position:absolute;z-index:20;top:calc(100% + .25rem);left:0;right:0;max-height:18rem;overflow:auto;border:1px solid var(--br-line-strong);background:var(--br-panel);box-shadow:6px 6px 0 rgba(0,0,0,.2)}.combo-list button{display:block;width:100%;border:0;border-bottom:1px solid var(--br-line);background:transparent;color:var(--br-text);padding:.7rem;text-align:left;cursor:pointer}.combo-list button:hover{background:var(--br-accent);color:var(--br-accent-text)}.combo-list small{display:block;margin-top:.2rem;font:700 .65rem "Courier New",monospace}.combo-list>span{display:block;padding:.8rem;color:var(--br-muted)}
.xml-dropzone{display:grid;grid-template-columns:1fr auto;align-items:center;gap:1rem;margin-top:1rem;border:1px dashed var(--br-line-strong);background:var(--br-panel);padding:1rem}.xml-dropzone.dragging{border-style:solid;background:color-mix(in srgb,var(--br-accent) 12%,var(--br-panel))}.xml-dropzone>div:first-child{display:grid;grid-template-columns:auto 1fr;column-gap:.7rem}.xml-dropzone>div:first-child i{grid-row:1/3;font-size:1.5rem}.xml-dropzone>div:first-child span{color:var(--br-muted);font:700 .68rem "Courier New",monospace}.xml-dropzone>button{border:1px solid var(--br-line-strong);background:transparent;color:inherit;padding:.65rem;cursor:pointer}.file-preview{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.5rem;border-top:1px solid var(--br-line);padding-top:.8rem}.file-preview article{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.5rem;border:1px solid var(--br-line);padding:.5rem}.file-preview article small{display:block;color:var(--br-muted)}.file-preview article button{border:0;background:transparent;color:inherit;font-size:1.2rem}
.table-wrap table{min-width:112rem}.provider-link{max-width:15rem;border:0;border-bottom:1px solid var(--br-accent);background:transparent;color:inherit;padding:0;text-align:left;font-weight:800;cursor:pointer}.provider-link:disabled{border:0;cursor:default}.status-pill{display:inline-block;border:1px solid var(--br-line-strong);padding:.22rem .35rem;font:800 .58rem "Courier New",monospace;text-transform:uppercase}.status-pill.pagada{background:#d8ead9;color:#16391e}.status-pill.pendiente,.status-pill.parcial{background:#f4ddb0;color:#573b09}.status-pill.cancelada,.status-pill.sustituida{background:#efd0cb;color:#68251d}.workspace-grid{grid-template-columns:minmax(0,1fr) 26rem}
.calendar-reports .annual-row,.calendar-reports article{display:grid;grid-template-columns:5rem 1fr 7.5rem;gap:.5rem;align-items:center;border-bottom:1px solid var(--br-line);padding:.6rem}.calendar-reports .annual-row{grid-template-columns:5rem 1fr;background:var(--br-panel-2)}.calendar-reports article>strong,.annual-row>strong{text-transform:uppercase;font:900 .72rem Arial}.calendar-reports span{color:var(--br-muted);font:700 .6rem "Courier New",monospace}.report-chip{display:flex;margin:.18rem 0}.report-chip button{border:1px solid var(--br-line);background:transparent;color:inherit;padding:.3rem .4rem;font:700 .62rem "Courier New",monospace;cursor:pointer}.report-chip button:first-child{flex:1;text-align:left}.report-chip button:hover{background:var(--br-accent);color:var(--br-accent-text)}.pdf-modal{width:min(90rem,calc(100vw - 2rem));height:calc(100dvh - 2rem);display:grid;grid-template-rows:auto 1fr;overflow:hidden}.pdf-modal iframe{width:100%;height:100%;border:0;background:#666}
@media(max-width:1100px){.workspace-grid{grid-template-columns:1fr}.calendar-reports{display:grid;grid-template-columns:repeat(2,1fr)}.calendar-reports .annual-row{grid-column:1/-1}.calendar-reports article{grid-template-columns:5rem 1fr 7rem}}@media(max-width:700px){.xml-dropzone{grid-template-columns:1fr}.calendar-reports{grid-template-columns:1fr}.calendar-reports article{grid-template-columns:4.5rem 1fr 6.5rem}}
.invoice-panel{display:flex;min-height:34rem;flex-direction:column}.invoice-panel .table-wrap{min-height:0;flex:1}.invoice-panel .table-wrap table{min-height:100%}.xml-dropzone{grid-template-columns:1fr;cursor:pointer;transition:border-color .18s ease,background-color .18s ease}.xml-dropzone:focus-visible{outline:2px solid var(--br-accent);outline-offset:3px}.xml-dropzone:hover:not(.disabled){border-color:var(--br-accent)}.xml-dropzone.disabled{cursor:not-allowed;opacity:.68}.xml-dropzone>div:first-child strong em{color:var(--br-accent);font-style:normal;font-size:.72rem}.file-preview{cursor:default}
</style>
