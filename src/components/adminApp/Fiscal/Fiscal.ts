import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { saveAs } from "file-saver";
import logo from "@/assets/img/logblack.png";
import { cs, fs } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";
import { useAppDialog } from "@/composables/useAppDialog";

type Direction = "emitida" | "recibida";
type ReportType = "mensual" | "anual" | "diot";
type Invoice = Record<string, any>;
const now = new Date();
const { confirm: confirmDialog } = useAppDialog();
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
  selectedIds = reactive(new Set<number>()),
  activeReportInvoiceIds = reactive(new Set<number>());
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
const activeReport = computed(() =>
  reports.value.find((report) => Number(report.id) === activeReportId.value),
);
const matchingReport = computed(() =>
  reports.value.find(
    (report) =>
      Number(report.id_cliente) === Number(filters.clienteId) &&
      report.tipo === reportDraft.type &&
      report.direccion === reportDraft.direction &&
      Number(report.ejercicio) === Number(reportDraft.year) &&
      (reportDraft.type === "anual" ||
        Number(report.mes) === Number(reportDraft.month)),
  ),
);
function invoiceBelongsToActiveReport(invoice: Invoice) {
  return !!activeReportId.value && activeReportInvoiceIds.has(Number(invoice.id));
}

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
  activeReportInvoiceIds.clear();
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
function closeActiveReport() {
  activeReportId.value = null;
  selectedIds.clear();
  activeReportInvoiceIds.clear();
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
  const selectedMonth = Number(filters.month);
  const baseFilters = {
    clienteId: Number(filters.clienteId),
    direction: filters.direction,
    year: Number(filters.year),
    month: selectedMonth > 0 ? selectedMonth : undefined,
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
const selectedInvoices = computed(() =>
  invoices.value.filter((invoice) => selectedIds.has(Number(invoice.id))),
);
function invoicePeriod(invoice: Invoice) {
  const match = String(invoice.fecha_emision || "").match(/^(\d{4})-(\d{2})/);
  return match
    ? { year: Number(match[1]), month: Number(match[2]) }
    : null;
}
function inferSelectedPeriod() {
  const periods = new Map<string, { year: number; month: number }>();
  selectedInvoices.value.forEach((invoice) => {
    const period = invoicePeriod(invoice);
    if (period) periods.set(`${period.year}-${period.month}`, period);
  });
  return periods.size === 1 ? [...periods.values()][0] : null;
}
const reportValidation = computed(() => {
  if (!selectedIds.size)
    return "Selecciona al menos un CFDI para guardar el reporte.";
  if (!reportDraft.name.trim()) return "Escribe un nombre para el reporte.";
  const selected = selectedInvoices.value;
  if (selected.length !== selectedIds.size)
    return "Espera a que termine de cargar la selección antes de guardar.";
  const year = Number(reportDraft.year);
  const month = Number(reportDraft.month);
  if (reportDraft.type === "mensual" && (month < 1 || month > 12))
    return "Selecciona un mes válido para el reporte mensual.";
  const outsidePeriod = selected.some((invoice) => {
    const period = invoicePeriod(invoice);
    return (
      !period ||
      period.year !== year ||
      (reportDraft.type === "mensual" && period.month !== month)
    );
  });
  if (outsidePeriod)
    return reportDraft.type === "mensual"
      ? "Todos los CFDI seleccionados deben pertenecer al mismo mes y año. Filtra el mes y vuelve a seleccionarlos."
      : "Todos los CFDI seleccionados deben pertenecer al ejercicio elegido.";
  if (
    selected.some((invoice) => invoice.direccion !== reportDraft.direction)
  )
    return "La selección contiene CFDI de un movimiento distinto.";
  return "";
});
function openReportDialog() {
  const selectedMonth = Number(filters.month);
  reportDraft.type = selectedMonth > 0 ? "mensual" : "anual";
  reportDraft.direction = filters.direction;
  reportDraft.year = Number(filters.year);
  reportDraft.month =
    selectedMonth > 0 ? selectedMonth : now.getMonth() + 1;
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
    if (!showReportDialog.value) return;
    if (reportDraft.type === "mensual" && Number(filters.month) === 0) {
      const period = inferSelectedPeriod();
      if (period) {
        reportDraft.year = period.year;
        reportDraft.month = period.month;
      }
    }
    syncReportName();
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
  if (reportValidation.value) {
    setNotice(reportValidation.value, "error");
    return;
  }
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
    const savedReport = await fs.getReport(Number(response.id));
    activeReportInvoiceIds.clear();
    savedReport.invoices.forEach((invoice: Invoice) =>
      activeReportInvoiceIds.add(Number(invoice.id)),
    );
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
    filters.clienteId = Number(data.report.id_cliente);
    filters.direction = data.report.direccion;
    filters.year = Number(data.report.ejercicio);
    filters.month = data.report.tipo === "anual" ? 0 : Number(data.report.mes);
    filters.search = "";
    selectedIds.clear();
    activeReportInvoiceIds.clear();
    data.invoices.forEach((invoice: Invoice) =>
      activeReportInvoiceIds.add(Number(invoice.id)),
    );
    data.invoices.filter(isSelectable).forEach((invoice: Invoice) => selectedIds.add(Number(invoice.id)));
    await Promise.all([loadInvoices(), loadReports()]);
    activeReportId.value = id;
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
    if (report.tipo === "diot") {
      await fs.exportReport(Number(report.id), "DIOT.txt");
      return;
    }
    const data = await fs.getReport(Number(report.id));
    await exportReportWorkbook(data);
    setNotice("Reporte Excel preparado con formatos y totales.");
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
    money(mxn(invoice, invoice.abonado)),
    money(mxn(invoice, invoice.base_iva_16)),
    money(mxn(invoice, invoice.base_iva_8)),
    money(mxn(invoice, invoice.iva_16)),
    money(mxn(invoice, invoice.iva_8)),
    money(mxn(invoice, invoice.pendiente)),
    money(mxn(invoice, invoice.base_exento)),
    money(mxn(invoice, invoice.base_iva_0)),
    money(mxn(invoice, invoice.ieps_retenido)),
    date(invoice.fecha_emision),
  ]);
}
function reportTotal(items: Invoice[], field: string) {
  return items.reduce(
    (total, invoice) => total + mxn(invoice, invoice[field]),
    0,
  );
}
function reportFoot(items: Invoice[]) {
  return [[
    {
      content: `TOTALES (${items.length} CFDI)`,
      colSpan: 4,
      styles: { halign: "left" as const, cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 } },
    },
    money(reportTotal(items, "abonado")),
    money(reportTotal(items, "base_iva_16")),
    money(reportTotal(items, "base_iva_8")),
    money(reportTotal(items, "iva_16")),
    money(reportTotal(items, "iva_8")),
    money(reportTotal(items, "pendiente")),
    money(reportTotal(items, "base_exento")),
    money(reportTotal(items, "base_iva_0")),
    money(reportTotal(items, "ieps_retenido")),
    "",
  ]];
}
function reportTableOptions(data: any, startY: number): UserOptions {
  return {
    startY,
    margin: { top: 34, left: 8, right: 8 },
    head: reportHead,
    body: reportRows(data.invoices),
    foot: reportFoot(data.invoices),
    styles: { fontSize: 6.5, cellPadding: 1.4 },
    headStyles: { fillColor: [20, 20, 19] },
    footStyles: {
      fillColor: [210, 210, 207],
      textColor: [20, 20, 19],
      fontStyle: "bold",
      fontSize: 6.5,
      cellPadding: { top: 2.2, right: 1.4, bottom: 2.2, left: 1.4 },
      halign: "left",
    },
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
  const confirmed = await confirmDialog({
    title: "Eliminar CFDI",
    message: `Se eliminará el CFDI ${invoice.uuid} y dejará de aparecer en los reportes guardados.`,
    tone: "danger",
    confirmLabel: "Eliminar CFDI",
  });
  if (!confirmed) return;
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
async function exportReportWorkbook(data: any) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DespachoApp";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Reporte fiscal", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const headers = [
    "UUID", "Dirección", "Fecha", "Tipo", "RFC contraparte", "Nombre contraparte",
    "Forma de pago", "Método de pago", "Moneda", "Tipo de cambio", "Subtotal",
    "IVA 16 base", "IVA 16", "IVA 8 base", "IVA 8", "Tasa 0", "Exento",
    "No objeto", "Retención IVA", "Retención ISR", "Total", "Total MXN", "Productos",
  ];
  const lastColumn = headers.length;
  sheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = data.report.nombre || "Reporte fiscal";
  titleCell.font = { name: "Arial", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141413" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, 12);
  sheet.mergeCells(2, 13, 2, lastColumn);
  sheet.getCell(2, 1).value = `Cliente: ${data.report.cliente || "Sin cliente"}`;
  sheet.getCell(2, 13).value = `RFC: ${data.report.cliente_rfc || "Sin RFC"}`;
  sheet.mergeCells(3, 1, 3, 12);
  sheet.mergeCells(3, 13, 3, lastColumn);
  sheet.getCell(3, 1).value = `Periodo: ${periodLabel(data.report)}`;
  sheet.getCell(3, 13).value = `Movimiento: ${data.report.direccion === "emitida" ? "Ingresos" : "Egresos"}`;
  [2, 3].forEach((rowNumber) => {
    const row = sheet.getRow(rowNumber);
    row.height = 22;
    row.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF242321" } };
    row.alignment = { vertical: "middle", horizontal: "left" };
  });

  const headerRow = sheet.getRow(5);
  headerRow.values = headers;
  headerRow.height = 30;
  for (let column = 1; column <= lastColumn; column += 1) {
    const cell = headerRow.getCell(column);
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF242321" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FF38D996" } } };
  }

  data.invoices.forEach((invoice: Invoice, index: number) => {
    const exchangeRate = invoice.moneda === "MXN" ? 1 : num(invoice.tipo_cambio) || 1;
    const row = sheet.addRow([
      invoice.uuid, invoice.direccion, invoice.fecha_emision, typeLabel(invoice.tipo_comprobante),
      counterpartRfc(invoice), counterpartName(invoice), invoice.forma_pago || "", invoice.metodo_pago || "",
      invoice.moneda || "MXN", exchangeRate, num(invoice.subtotal), num(invoice.base_iva_16), num(invoice.iva_16),
      num(invoice.base_iva_8), num(invoice.iva_8), num(invoice.base_iva_0), num(invoice.base_exento),
      num(invoice.base_no_objeto), num(invoice.iva_retenido), num(invoice.isr_retenido), num(invoice.total),
      num(invoice.total) * exchangeRate, invoice.productos || "",
    ]);
    row.height = 23;
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.font = { name: "Arial", size: 9, color: { argb: "FF242321" } };
      cell.alignment = { vertical: "middle" };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F2EC" } };
    }
  });

  const firstDataRow = 6;
  const lastDataRow = Math.max(firstDataRow, firstDataRow + data.invoices.length - 1);
  const totalRow = sheet.addRow([]);
  totalRow.getCell(1).value = `TOTALES (${data.invoices.length} CFDI)`;
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 10);
  for (let column = 11; column <= 22; column += 1) {
    const letter = sheet.getColumn(column).letter;
    totalRow.getCell(column).value = data.invoices.length
      ? { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` }
      : 0;
  }
  totalRow.height = 28;
  for (let column = 1; column <= lastColumn; column += 1) {
    const cell = totalRow.getCell(column);
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141413" } };
    cell.alignment = { vertical: "middle", horizontal: column <= 10 ? "left" : "right" };
  }

  for (let column = 11; column <= 22; column += 1) sheet.getColumn(column).numFmt = '"$"#,##0.00';
  sheet.getColumn(10).numFmt = "0.0000";
  sheet.columns.forEach((column, index) => {
    const preferred = [39, 12, 19, 14, 18, 32, 14, 14, 10, 13, 15, 15, 14, 15, 14, 14, 14, 14, 14, 14, 15, 16, 42][index];
    column.width = preferred;
  });
  sheet.getColumn(23).alignment = { vertical: "top", wrapText: true };
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastDataRow, column: lastColumn } };
  sheet.properties.defaultRowHeight = 20;
  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = String(data.report.nombre || `Reporte_${data.report.id}`).replace(/[\\/:*?"<>|]+/g, "-");
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeName}.xlsx`);
}
async function removeInvoiceFromReport(invoice: Invoice) {
  if (!activeReportId.value || !activeReport.value) return;
  const confirmed = await confirmDialog({
    title: "Quitar factura del reporte",
    message: `Se quitará el CFDI ${invoice.uuid} de “${activeReport.value.nombre}”. El XML y la factura seguirán disponibles.`,
    tone: "danger",
    confirmLabel: "Quitar del reporte",
  });
  if (!confirmed) return;
  try {
    const response = await fs.removeReportInvoice(
      activeReportId.value,
      Number(invoice.id),
    );
    selectedIds.delete(Number(invoice.id));
    activeReportInvoiceIds.delete(Number(invoice.id));
    if ((response.deletedReportIds || []).includes(activeReportId.value))
      closeActiveReport();
    setNotice(response.message || "Factura retirada del reporte.");
    await Promise.all([loadInvoices(), loadReports()]);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error ||
        "No se pudo quitar la factura del reporte.",
      "error",
    );
  }
}
async function removeReport(report: any) {
  const removesLinkedDiot =
    report.tipo === "mensual" && report.direccion === "recibida";
  const confirmed = await confirmDialog({
    title: "Eliminar reporte",
    message: removesLinkedDiot
      ? `Se eliminará “${report.nombre}” y su DIOT vinculada. Las facturas y XML permanecerán disponibles.`
      : `Se eliminará “${report.nombre}”. Las facturas y XML permanecerán disponibles.`,
    tone: "danger",
    confirmLabel: "Eliminar reporte",
  });
  if (!confirmed) return;
  try {
    const response = await fs.deleteReport(Number(report.id));
    const deletedIds = (response.deletedReportIds || []).map(Number);
    if (activeReportId.value && deletedIds.includes(activeReportId.value))
      closeActiveReport();
    setNotice(response.message || "Reporte eliminado.");
    await Promise.all([loadInvoices(), loadReports()]);
  } catch (error: any) {
    setNotice(
      error.response?.data?.error || "No se pudo eliminar el reporte.",
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
