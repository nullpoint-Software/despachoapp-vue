<!-- PrintPagoConcepto.vue -->
<template>
  <div class="ticket-printer-overlay" @mousedown.self="$emit('close')">
    <div class="ticket-printer-modal">
      <header class="ticket-modal-header">
        <p>CAJA / IMPRESIÓN TÉRMICA</p>
        <h2>Ticket de pago</h2>
        <button type="button" aria-label="Cerrar" @click="$emit('close')">×</button>
      </header>
      <div class="ticket-modal-body">
      <!-- Seccion para seleccionar la impresora -->
      <div class="printer-selection" v-if="!showDownload">
        <select id="printerSelect" v-model="selectedPrinter">
          <option disabled value="">Seleccione una impresora</option>
          <option
            v-for="impresora in printers"
            :key="impresora"
            :value="impresora"
          >
            {{ impresora }}
          </option>
        </select>
        <Button
          label="Refrescar"
          icon="pi pi-refresh"
          @click="fetchPrinters"
          outlined
        />
      </div>
      <Button
        icon="pi pi-download"
        v-if="showDownload"
        label="Descargar plugin de impresión"
          @click="downloadPlugin"
          outlined
        />
      <!-- Vista previa del ticket -->
      <div class="ticket">
        <span>Vista previa / 80 mm</span>
        <div class="ticket-logo"><img :src="logo" alt="Logo" /></div>
        <pre class="ticket-content">{{ formattedTicket }}</pre>
        <div v-if="barcodeValue" class="ticket-barcode" aria-label="Codigo de barras">
          <div class="ticket-barcode__bars"></div>
          <span>{{ barcodeValue }}</span>
        </div>
      </div>
      </div>

      <!-- Botones de accion -->
      <div class="actions">
        <Button
          label="Cancelar"
          @click="$emit('close')"
          outlined
        />
        <Button
          label="Imprimir ticket"
          icon="pi pi-print"
          @click="doPrint"
          class="p-button-primary"
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
import { formatFechaHoraFullPagoSQL } from "@/service/adminApp/client";

dayjs.extend(advancedFormat);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(utc);
const showDownload = ref(false);
const emit = defineEmits(["close"]);
const props = defineProps({
  payment: { type: Object, required: true },
});

const printers = ref([]);
const selectedPrinter = ref("");
const apiKey = "123456";
const logo = logoAsset;

const fetchPrinters = async () => {
  try {
    const list = await connetor_plugin.obtenerImpresoras();
    printers.value = list;
    if (!list.includes(selectedPrinter.value)) selectedPrinter.value = "";
  } catch (e) {
    alert("Error al obtener impresoras: " + e.message);
    showDownload.value = true;
  }
};
onMounted(fetchPrinters);

const totalWidth = 48;
const leftCol = 14;
const rightCol = totalWidth - 7 - leftCol;
const dashLine = "-".repeat(totalWidth);
const eqLine = "=".repeat(totalWidth);
const barcodeValue = computed(() => {
  const id = props.payment?.id ?? props.payment?.pago_id ?? props.payment?.folio;
  if (id) return String(id);
  return `PAGO-${dayjs(props.payment?.fecha || new Date()).format("YYYYMMDDHHmmss")}`;
});

const downloadPlugin = async () => {
  const url = `${serverip}/Plugin_Impresora_termica.exe`;
  const a = document.createElement("a");
  a.href = url;
  a.download = "Plugin_Impresora_termica.exe";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

function centerText(txt) {
  const value = String(txt).slice(0, totalWidth);
  const pad = Math.max(0, Math.floor((totalWidth - value.length) / 2));
  return " ".repeat(pad) + value + " ".repeat(Math.max(0, totalWidth - value.length - pad));
}

function wrapText(text, width) {
  const lines = [];
  let rem = String(text ?? "");
  while (rem.length > width) {
    lines.push(rem.slice(0, width));
    rem = rem.slice(width);
  }
  lines.push(rem);
  return lines;
}

function row(label, val) {
  const lab = String(label).padEnd(leftCol).slice(0, leftCol);
  const vals = wrapText(String(val), rightCol);
  const first = `| ${lab} | ${vals[0].padEnd(rightCol)} |`;
  const rest = vals
    .slice(1)
    .map((l) => `| ${" ".repeat(leftCol)} | ${l.padEnd(rightCol)} |`);
  return [first, ...rest].join("\n");
}

const formattedTicket = computed(() => {
  const t = props.payment;
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
  lines.push(row("Cobramos", "$" + t.cobramos));
  lines.push(dashLine);
  lines.push(row("Pagamos", "$" + t.pagamos));
  lines.push(dashLine);
  lines.push(row("Fecha", formatFechaHoraFullPagoSQL(t.fecha)));
  lines.push(dashLine);
  lines.push(eqLine);
  lines.push(centerText("Fecha de impresion:"));
  lines.push(centerText(dayjs().format("h:mm A, ddd MMM DD")));
  lines.push(eqLine);
  lines.push(centerText("Despacho Contable Y Fiscal Sanchez"));
  lines.push("");
  lines.push(centerText("Gracias por su preferencia"));
  lines.push(centerText(":)"));
  lines.push("");
  return lines.join("\n");
});

const doPrint = async () => {
  if (!selectedPrinter.value) {
    return alert("Por favor, seleccione una impresora.");
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
    con.text("Detalle de pago");
    con.feed("1");
    // contenido ASCII
    con.fontsize("1");
    con.textaling("left");
    formattedTicket.value.split("\n").forEach((line) => con.text(line));
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
    if (resp === true) alert("✅ Ticket enviado.");
    else alert("❌ Error al imprimir: " + resp);
  } catch (err) {
    alert("Error al imprimir: " + err.message);
  }
};
</script>

<style scoped>
.ticket-printer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.ticket-printer-modal {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 460px;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  /* forzar texto negro */
  color: #000 !important;
}
.ticket-printer-modal * {
  color: #000 !important;
}
.printer-selection {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.printer-selection select {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 5px 10px;
}
.ticket {
  margin-bottom: 20px;
}
.logo img {
  width: 70px;
  margin: 0 auto 10px;
  display: block;
}
.ticket-content {
  font-family: monospace;
  font-size: 14px;
  white-space: pre;
  line-height: 1.4;
  background: #f9f9f9;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 0;
  text-align: left;
  overflow-x: auto;
}
.actions {
  display: flex;
  justify-content: space-around;
  margin-top: 10px;
}
.ticket-printer-overlay{z-index:1200;padding:1rem;background:rgba(7,7,6,.9)}.ticket-printer-modal{width:min(34rem,100%);max-height:calc(100vh - 2rem);overflow:auto;padding:0;border:2px solid var(--br-line-strong);border-radius:0;background:var(--br-control);color:#141413!important;text-align:left;box-shadow:7px 7px 0 var(--br-accent)}.ticket-printer-modal *{color:inherit!important}.ticket-modal-header{position:relative;padding:1rem 4.5rem .9rem 1.2rem;background:var(--br-bg);color:var(--br-text)!important}.ticket-modal-header p{margin:0 0 .3rem;color:var(--br-accent)!important;font:800 .65rem "Courier New",monospace;letter-spacing:.09em}.ticket-modal-header h2{margin:0;color:var(--br-text)!important;font:900 clamp(1.6rem,4vw,2.3rem)/.9 Arial,sans-serif;letter-spacing:-.05em;text-transform:uppercase}.ticket-modal-header>button{position:absolute;right:0;top:0;width:3.5rem;height:3.5rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);border-radius:0;background:var(--br-accent);color:var(--br-accent-text)!important;font-size:1.7rem;cursor:pointer}.ticket-modal-body{padding:1rem}.printer-selection{display:grid;grid-template-columns:1fr auto;gap:.5rem;margin-bottom:.75rem}.printer-selection select{min-width:0;height:2.75rem;border:1px solid #56534c;border-radius:0;background:#fff;color:#141413!important;padding:.45rem .6rem;font:700 .76rem "Courier New",monospace}.ticket-modal-body>:deep(.app-button--outlined){width:100%;min-height:3rem;border-color:#141413!important;background:transparent!important;color:#141413!important}.ticket{border:2px solid #141413;background:#fff!important}.ticket>span{display:block;padding:.45rem .6rem;background:var(--br-bg)!important;color:var(--br-text)!important;font:800 .62rem "Courier New",monospace!important;text-transform:uppercase}.ticket-content{display:block;margin:0;border:0;border-radius:0;background:#fff!important;color:#141413!important}.actions{display:flex;justify-content:flex-end;gap:.7rem;margin:0;padding:1rem 1.25rem;border-top:2px solid #141413}.actions :deep(.app-button){min-width:8rem;min-height:3rem;color:var(--br-text)!important}.actions :deep(.app-button.p-button-primary){background:var(--br-accent)!important;border-color:var(--br-accent)!important;color:var(--br-accent-text)!important}.actions :deep(.app-button--outlined){border-color:#141413!important;background:transparent!important;color:#141413!important}.actions :deep(.app-button--outlined:hover:not(:disabled)){background:#141413!important;color:#fff!important}@media(max-width:520px){.printer-selection{grid-template-columns:1fr}.actions{display:grid;grid-template-columns:1fr}}
.printer-selection :deep(.app-button--outlined){border-color:#141413!important;background:transparent!important;color:#141413!important}.printer-selection :deep(.app-button--outlined:hover:not(:disabled)){background:#141413!important;color:#fff!important}.ticket{width:fit-content;max-width:100%;margin:.75rem auto 0;overflow:auto}.ticket-logo{display:grid;place-items:center;padding:.5rem;border-bottom:1px solid #77736b;background:#fff}.ticket-logo img{display:block;width:2.3rem;height:auto}.ticket-content{box-sizing:border-box;width:max-content;max-width:none;min-height:0!important;max-height:none!important;padding:.6rem .75rem!important;overflow:visible!important;white-space:pre!important;font:700 .72rem/1.28 "Courier New",monospace!important}.ticket-barcode{display:grid;place-items:center;gap:.25rem;padding:.25rem .75rem .75rem;background:#fff;color:#141413}.ticket-barcode__bars{width:70%;height:2.1rem;background:repeating-linear-gradient(90deg,#141413 0 2px,transparent 2px 4px,#141413 4px 5px,transparent 5px 8px,#141413 8px 11px,transparent 11px 13px)}.ticket-barcode>span{font:700 .58rem "Courier New",monospace}
</style>
