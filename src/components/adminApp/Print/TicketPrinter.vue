<!-- PrintTicket.vue -->
<template>
  <div
    class="ticket-printer-overlay"
    @mousedown.self="$emit('close')"
  >
    <div class="ticket-printer-modal">
      <!-- Seccion para seleccionar la impresora -->
      <div class="printer-selection" v-if="!showDownload">
        <select id="printerSelect" v-model="selectedPrinter">
          <option disabled value="">Seleccione una impresora</option>
          <option v-for="impresora in printers" :key="impresora" :value="impresora">
            {{ impresora }}
          </option>
        </select>
        <Button
          label="Refrescar"
          icon="pi pi-refresh"
          @click="fetchPrinters"
          class="p-button-secondary"
        />
      </div>
      <Button
        icon="pi pi-download"
        v-if="showDownload"
        label="Descargar plugin de impresión"
          @click="downloadPlugin"
          class="p-button-info"
        />
      <!-- Vista previa del ticket -->
      <div class="ticket">
        <div class="logo">
          <img :src="logo" alt="Logo" />
        </div>
        <pre class="ticket-content">{{ formattedTicket }}</pre>
        <div v-if="barcodeValue" class="ticket-barcode" aria-label="Codigo de barras">
          <div class="ticket-barcode__bars"></div>
          <span>{{ barcodeValue }}</span>
        </div>
      </div>

      <!-- Botones de accion -->
      <div class="actions">
        <Button
          label="Imprimir"
          icon="pi pi-print"
          @click="doPrint"
          class="p-button-info"
        />
        <Button
          label="Cerrar"
          icon="pi pi-times"
          @click="$emit('close')"
          class="p-button-secondary"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const serverip = import.meta.env.VITE_API_SERVER_IP;
import { ref, computed, onMounted } from "vue";
import Button from "@/components/ui/AppButton.vue";
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

dayjs.extend(advancedFormat);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(utc);

// permite emitir 'close'
const emit = defineEmits(['close']);
const toast = useAppToast();

// estado
const printers = ref([]);
const selectedPrinter = ref("");
const apiKey = "123456";
const logo = logoAsset;
const showDownload = ref(false)
// props
const props = defineProps({
  ticket: { type: Object, required: true }
});

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

function centerText(txt) {
  const value = String(txt).slice(0, totalWidth);
  const pad = Math.max(0, Math.floor((totalWidth - value.length) / 2));
  return " ".repeat(pad) + value + " ".repeat(Math.max(0, totalWidth - value.length - pad));
}

function wrapText(text, width) {
  const lines = [];
  let rem = String(text ?? "");
  while (String(rem).length > width) {
    lines.push(rem.slice(0, width));
    rem = rem.slice(width);
  }
  lines.push(rem);
  return lines;
}

function row(label, val) {
  const lab = String(label).padEnd(leftCol).slice(0, leftCol);
  const vals = wrapText(val, rightCol);
  const first = `| ${lab} | ${String(vals[0]).padEnd(rightCol)} |`;
  const rest = vals.slice(1).map(l => `| ${" ".repeat(leftCol)} | ${l.padEnd(rightCol)} |`);
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
    toast.add({ severity: "error", summary: "Impresión no disponible", detail: e.message, life: 4500 });
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
    toast.add({ severity: "error", summary: "No se pudo imprimir", detail: err.message, life: 4500 });
  }
};
</script>

<style scoped>
.ticket-printer-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.ticket-printer-modal {
  background: #fff; padding: 20px; border-radius: 8px;
  width: 460px; text-align: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  /* forzar texto negro */
  color: #000 !important;
}
.ticket-printer-modal * {
  color: #000 !important;
}
.printer-selection {
  margin-bottom: 20px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.printer-selection select {
  border: 1px solid #ccc; border-radius: 4px; padding: 5px 10px;
}
.ticket { margin-bottom: 20px; }
.logo img { width: 70px; margin: 0 auto 10px; display: block; }
.ticket-content {
  font-family: monospace; font-size: 14px;
  white-space: pre; line-height: 1.4;
  background: #f9f9f9; padding: 10px;
  border: 1px solid #ddd; border-radius: 4px; margin: 0;
  text-align: left; overflow-x: auto;
}
.actions {
  display: flex; justify-content: space-around; margin-top: 10px;
}
.ticket{width:fit-content;max-width:100%;margin:0 auto 20px;overflow:auto}.logo{padding:.45rem}.logo img{width:2.4rem}.ticket-content{box-sizing:border-box;width:max-content;max-width:none;min-height:0;padding:.6rem .75rem;overflow:visible;white-space:pre;font:700 .72rem/1.28 "Courier New",monospace}.ticket-barcode{display:grid;place-items:center;gap:.25rem;padding:.25rem .75rem .75rem;background:#fff;color:#141413}.ticket-barcode__bars{width:70%;height:2.1rem;background:repeating-linear-gradient(90deg,#141413 0 2px,transparent 2px 4px,#141413 4px 5px,transparent 5px 8px,#141413 8px 11px,transparent 11px 13px)}.ticket-barcode>span{font:700 .58rem "Courier New",monospace}
</style>
