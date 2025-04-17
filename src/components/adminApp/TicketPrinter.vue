<!-- PrintTicket.vue -->
<template>
  <div
    class="ticket-printer-overlay"
    @mousedown.self="$emit('close')"
  >
    <div class="ticket-printer-modal">
      <!-- Seccion para seleccionar la impresora -->
      <div class="printer-selection">
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

      <!-- Vista previa del ticket -->
      <div class="ticket">
        <div class="logo">
          <img :src="logo" alt="Logo" />
        </div>
        <pre class="ticket-content">{{ formattedTicket }}</pre>
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
import { ref, computed, onMounted } from "vue";
import Button from "primevue/button";
import logoAsset from "@/assets/img/logsymbolblack.png";
import connetor_plugin from "@abrazasoft/thermal_printer_vuejs";

import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import weekday from "dayjs/plugin/weekday";
import utc from "dayjs/plugin/utc";

dayjs.extend(advancedFormat);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(utc);

// permite emitir 'close'
const emit = defineEmits(['close']);

// estado
const printers = ref([]);
const selectedPrinter = ref("");
const apiKey = "123456";
const logo = logoAsset;

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

function centerText(txt) {
  const pad = Math.max(0, Math.floor((totalWidth - txt.length) / 2));
  return " ".repeat(pad) + txt + " ".repeat(totalWidth - txt.length - pad);
}

function wrapText(text, width) {
  const lines = [];
  let rem = text;
  while (rem.length > width) {
    lines.push(rem.slice(0, width));
    rem = rem.slice(width);
  }
  lines.push(rem);
  return lines;
}

function row(label, val) {
  const lab = label.padEnd(leftCol).slice(0, leftCol);
  const vals = wrapText(val, rightCol);
  const first = `| ${lab} | ${vals[0].padEnd(rightCol)} |`;
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
  lines.push(row("Atendio", t.quienAtendio));
  lines.push(dashLine);
  lines.push(row("Honorarios", t.honorarios));
  lines.push(dashLine);
  lines.push(row("Mes y Ano", t.mesAno));
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
    alert("Error al obtener impresoras: " + e.message);
  }
};
onMounted(fetchPrinters);

// imprimir
const doPrint = async () => {
  if (!selectedPrinter.value) {
    return alert("Por favor, seleccione una impresora.");
  }
  try {
    const con = new connetor_plugin();
    // logo
    con.textaling("center");
    con.img_url("https://www.hanekawa.online:444/api/sm.png");
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
    if (props.ticket.id) {
      con.feed("1");
      con.barcode_128(String(props.ticket.id));
      con.textaling("center");
      con.text(props.ticket.id);
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
</style>
