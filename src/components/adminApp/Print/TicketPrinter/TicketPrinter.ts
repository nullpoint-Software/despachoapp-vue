const serverip = import.meta.env.VITE_API_SERVER_IP;
import { ref, computed, onMounted } from "vue";
import logoAsset from "@/assets/img/logsymbolblack.png";
import connetor_plugin from "@abrazasoft/thermal_printer_vuejs";

import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import weekday from "dayjs/plugin/weekday";
import utc from "dayjs/plugin/utc";
import { formatFechaHoraFullPagoSQL, formatFechaMesAnoSQL } from "@/service/adminApp/client";
import { useAppToast } from "@/composables/useAppToast";

interface MonthlyPaymentTicket {
  id?: string | number;
  folio?: string | number;
  cliente?: string;
  asunto?: string;
  atendio?: string;
  honorarios?: number | string;
  mes_ano: string;
  fechapago: string;
}

dayjs.extend(advancedFormat);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(utc);

// permite emitir 'close'
const emit = defineEmits(['close']);
const toast = useAppToast();

// estado
const printers = ref<string[]>([]);
const selectedPrinter = ref("");
const apiKey = "123456";
const logo = logoAsset;
const showDownload = ref(false)
// props
const props = defineProps<{ ticket: MonthlyPaymentTicket }>();

// ASCII params
const totalWidth = 48;
const leftCol = 14;
const rightCol = totalWidth - 7 - leftCol;
const dashLine = "-".repeat(totalWidth);
const eqLine = "=".repeat(totalWidth);
const barcodeValue = computed(() => {
  const id = props.ticket?.id ?? props.ticket?.folio;
  if (id) return String(id);
  return `PAGO-${dayjs(props.ticket?.fechapago || new Date()).format("YYYYMMDDHHmmss")}`;
});

function centerText(txt: unknown): string {
  const value = String(txt).slice(0, totalWidth);
  const pad = Math.max(0, Math.floor((totalWidth - value.length) / 2));
  return " ".repeat(pad) + value + " ".repeat(Math.max(0, totalWidth - value.length - pad));
}

function wrapText(text: unknown, width: number): string[] {
  const lines: string[] = [];
  let rem = String(text ?? "");
  while (String(rem).length > width) {
    lines.push(rem.slice(0, width));
    rem = rem.slice(width);
  }
  lines.push(rem);
  return lines;
}

function row(label: unknown, val: unknown): string {
  const lab = String(label).padEnd(leftCol).slice(0, leftCol);
  const vals = wrapText(val, rightCol);
  const first = `| ${lab} | ${String(vals[0]).padEnd(rightCol)} |`;
  const rest = vals.slice(1).map((l: string) => `| ${" ".repeat(leftCol)} | ${l.padEnd(rightCol)} |`);
  return [first, ...rest].join("\n");
}

const formattedTicket = computed(() => {
  const t = props.ticket;
  const lines = [];
  lines.push(dashLine);
  lines.push(centerText("Ticket de Pago"));
  lines.push(dashLine);
  lines.push(row("Cliente", t.cliente));
  lines.push(dashLine);
  lines.push(row("Asunto", t.asunto));
  lines.push(dashLine);
  lines.push(row("Atendio", t.atendio));
  lines.push(dashLine);
  lines.push(row("Honorarios", "$"+t.honorarios));
  lines.push(dashLine);
  lines.push(row("Mes y Ano", formatFechaMesAnoSQL(t.mes_ano)));
  lines.push(dashLine);
  lines.push(row("Fecha de pago", formatFechaHoraFullPagoSQL(t.fechapago)));
  lines.push(dashLine);
  lines.push("");
  lines.push(eqLine);
  lines.push(centerText("Fecha de impresion:"));
  const now = dayjs();
  lines.push(centerText(now.format("h:mm A, ddd MMM DD")));
  lines.push(eqLine);
  lines.push(centerText("Despacho Contable Y Fiscal Sanchez"));
  lines.push("");
  lines.push(centerText("Gracias por su preferencia"));
  lines.push(centerText(":)"));
  lines.push("");
  return lines.join("\n");
});

// cargar impresoras
const fetchPrinters = async () => {
  try {
    const list = await connetor_plugin.obtenerImpresoras();
    printers.value = list;
    if (!list.includes(selectedPrinter.value)) selectedPrinter.value = "";
  } catch (e) {
    toast.add({ severity: "error", summary: "Impresión no disponible", detail: e instanceof Error ? e.message : String(e), life: 4500 });
    showDownload.value = true;
  }
};
onMounted(fetchPrinters);
const downloadPlugin = async () =>{
  const url = `${serverip}/Plugin_Impresora_termica.exe`;
  const a = document.createElement("a");
  a.href = url;
  a.download = "Plugin_Impresora_termica.exe";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
// imprimir
const doPrint = async () => {
  if (!selectedPrinter.value) {
    toast.add({ severity: "warn", summary: "Falta una impresora", detail: "Selecciona una impresora.", life: 3000 });
    return;
  }
  try {
    const con = new connetor_plugin();
    // logo
    con.textaling("center");
    con.img_url(`${serverip}/sm.png`);
    con.feed("1");
    // titulo
    con.fontsize("2");
    con.textaling("center");
    con.text("Ticket de Pago");
    con.feed("1");
    // contenido ASCII
    con.fontsize("1");
    con.textaling("left");
    formattedTicket.value.split("\n").forEach(line => con.text(line));
    // barcode
    if (barcodeValue.value) {
      con.feed("1");
      con.barcode_128(barcodeValue.value);
      con.textaling("center");
      con.text(barcodeValue.value);
    }
    // cierre
    con.feed("5");
    con.cut("0");
    const resp = await con.imprimir(selectedPrinter.value, apiKey);
    if (resp === true) toast.add({ severity: "success", summary: "Ticket enviado", detail: "La impresión fue solicitada.", life: 3000 });
    else toast.add({ severity: "error", summary: "No se pudo imprimir", detail: String(resp), life: 4500 });
  } catch (err) {
    toast.add({ severity: "error", summary: "No se pudo imprimir", detail: err instanceof Error ? err.message : String(err), life: 4500 });
  }
};
