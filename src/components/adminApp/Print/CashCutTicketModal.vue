<template>
  <div class="thermal-overlay" @mousedown.self="emit('close')">
    <section class="thermal-modal" role="dialog" aria-modal="true" aria-labelledby="thermal-title">
      <header>
        <p>CAJA / IMPRESIÓN TÉRMICA</p>
        <h2 id="thermal-title">Ticket de corte</h2>
        <button type="button" aria-label="Cerrar" @click="emit('close')">×</button>
      </header>

      <div class="thermal-body">
        <div v-if="!showDownload" class="printer-selection">
          <label for="cutPrinter">Impresora de tickets</label>
          <div><select id="cutPrinter" v-model="selectedPrinter"><option disabled value="">Selecciona una impresora</option><option v-for="printer in printers" :key="printer" :value="printer">{{ printer }}</option></select><AppButton label="Refrescar" icon="pi pi-refresh" outlined @click="fetchPrinters" /></div>
        </div>
        <AppButton v-else label="Descargar plugin de impresión" icon="pi pi-download" outlined @click="downloadPlugin" />

        <div class="ticket-preview">
          <span>VISTA PREVIA / 80 MM</span>
          <div class="ticket-logo"><img :src="logo" alt="Logo" /></div>
          <pre>{{ formattedTicket }}</pre>
          <div class="ticket-barcode" aria-label="Codigo de barras">
            <div class="ticket-barcode__bars"></div>
            <span>{{ barcodeValue }}</span>
          </div>
        </div>
      </div>

      <footer>
        <AppButton label="Cancelar" outlined @click="emit('close')" />
        <AppButton label="Imprimir ticket" icon="pi pi-print" class="p-button-primary" @click="doPrint" />
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";
import connetor_plugin from "@abrazasoft/thermal_printer_vuejs";
import AppButton from "@/components/ui/AppButton.vue";
import logoAsset from "@/assets/img/logsymbolblack.png";

const serverip=import.meta.env.VITE_API_SERVER_IP;
const logo=logoAsset;
const props=defineProps({movements:{type:Array,required:true},from:{type:Date,required:true},to:{type:Date,required:true}});
const emit=defineEmits(["close"]);
const printers=ref([]),selectedPrinter=ref(""),showDownload=ref(false);
const apiKey="123456",width=48,line="-".repeat(width),doubleLine="=".repeat(width);
const center=(text)=>{const value=String(text).slice(0,width);const left=Math.max(0,Math.floor((width-value.length)/2));return " ".repeat(left)+value};
const amount=(value)=>Number(value||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const valueRow=(label,value)=>{const right=String(value).slice(0,width);const safeLabel=String(label).slice(0,Math.max(1,width-right.length-1));const available=Math.max(1,width-safeLabel.length);return safeLabel+" ".repeat(Math.max(1,available-right.length))+right};
const netTotal=computed(()=>props.movements.reduce((total,item)=>total+Number(item.cobramos||0)-Number(item.pagamos||0),0));
const barcodeValue=computed(()=>`CORTE-${dayjs(props.from).format("YYYYMMDDHHmm")}-${dayjs(props.to).format("YYYYMMDDHHmm")}`);
const formattedTicket=computed(()=>{
  const rows=[line,center("CORTE DE CAJA"),line,`INICIO: ${dayjs(props.from).format("DD/MM/YYYY HH:mm:ss")}`,`FIN:    ${dayjs(props.to).format("DD/MM/YYYY HH:mm:ss")}`,doubleLine];
  props.movements.forEach((item,index)=>{
    rows.push(`${String(index+1).padStart(2,"0")} ${String(item.cliente||"Sin cliente").slice(0,width-3)}`);
    if(Number(item.cobramos||0)!==0)rows.push(valueRow("  COBRO (+)",`+$${amount(item.cobramos)}`));
    if(Number(item.pagamos||0)!==0)rows.push(valueRow("  PAGO  (-)",`-$${amount(item.pagamos)}`));
    rows.push(line);
  });
  if(!props.movements.length)rows.push(center("SIN MOVIMIENTOS"),line);
  rows.push(valueRow("TOTAL NETO",`${netTotal.value<0?"-":"+"}$${amount(Math.abs(netTotal.value))}`),doubleLine,center(`IMPRESO ${dayjs().format("DD/MM/YYYY HH:mm")}`),"","");
  return rows.join("\n");
});
async function fetchPrinters(){try{const list=await connetor_plugin.obtenerImpresoras();printers.value=Array.isArray(list)?list:[];if(!printers.value.includes(selectedPrinter.value))selectedPrinter.value="";showDownload.value=false}catch(error){showDownload.value=true;alert("No se pudo conectar con el plugin de impresión térmica.")}}
function downloadPlugin(){const anchor=document.createElement("a");anchor.href=`${serverip}/Plugin_Impresora_termica.exe`;anchor.download="Plugin_Impresora_termica.exe";document.body.appendChild(anchor);anchor.click();anchor.remove()}
async function doPrint(){if(!selectedPrinter.value)return alert("Selecciona una impresora térmica.");try{const connector=new connetor_plugin();connector.textaling("center");connector.img_url(`${serverip}/sm.png`);connector.feed("1");connector.fontsize("2");connector.text("CORTE DE CAJA");connector.feed("1");connector.fontsize("1");connector.textaling("left");formattedTicket.value.split("\n").forEach(row=>connector.text(row));connector.feed("1");connector.textaling("center");connector.barcode_128(barcodeValue.value);connector.text(barcodeValue.value);connector.feed("5");connector.cut("0");const response=await connector.imprimir(selectedPrinter.value,apiKey);if(response===true){alert("Ticket de corte enviado.");emit("close")}else alert("Error al imprimir: "+response)}catch(error){alert("Error al imprimir: "+error.message)}}
onMounted(fetchPrinters);
</script>

<style scoped>
.thermal-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:1rem;background:rgba(7,7,6,.9)}.thermal-modal{width:min(42rem,100%);max-height:calc(100vh - 2rem);overflow:auto;border:2px solid #141413;background:var(--br-control);color:#141413;box-shadow:10px 10px 0 var(--br-accent)}header{position:relative;padding:1.25rem 4.5rem 1.15rem 1.4rem;background:#141413;color:#fff}header p{margin:0 0 .35rem;color:var(--br-accent);font:800 .7rem "Courier New",monospace;letter-spacing:.09em}h2{margin:0;font:900 clamp(1.8rem,5vw,3rem)/.9 Arial,sans-serif;letter-spacing:-.05em;text-transform:uppercase}header>button{position:absolute;right:0;top:0;width:3.75rem;height:3.75rem;border:0;border-left:2px solid #fff;border-bottom:2px solid #fff;border-radius:0;background:var(--br-accent);color:var(--br-accent-text);font-size:1.8rem;cursor:pointer}.thermal-body{display:grid;gap:1rem;padding:1.25rem}.printer-selection>label{display:block;margin-bottom:.4rem;font:800 .72rem "Courier New",monospace;text-transform:uppercase}.printer-selection>div{display:grid;grid-template-columns:1fr auto;gap:.6rem}.printer-selection select{min-width:0;height:3rem;border:1px solid #56534c;border-radius:0;background:#fff;color:#141413;padding:.5rem .7rem;font:700 .82rem "Courier New",monospace}.ticket-preview{border:2px solid #141413;background:#fff}.ticket-preview>span{display:block;padding:.6rem .75rem;background:#141413;color:#fff;font:800 .65rem "Courier New",monospace}.ticket-preview pre{overflow:auto;margin:0;padding:1rem;color:#141413;font:700 .76rem/1.35 "Courier New",monospace}footer{display:flex;justify-content:flex-end;gap:.7rem;padding:1rem 1.25rem;border-top:2px solid #141413}@media(max-width:520px){.printer-selection>div{grid-template-columns:1fr}footer{display:grid;grid-template-columns:1fr}}
.thermal-modal{width:min(34rem,100%);border-color:var(--br-line-strong);box-shadow:7px 7px 0 var(--br-accent)}.thermal-modal>header{padding-top:1rem;padding-bottom:.9rem;background:var(--br-bg);color:var(--br-text)}.thermal-modal>header h2{color:var(--br-text);font-size:clamp(1.6rem,4vw,2.3rem)}.thermal-modal>header>button{border-color:var(--br-control);background:var(--br-accent);color:var(--br-accent-text)}.thermal-body{padding:1rem}.thermal-body :deep(.app-button--outlined){border-color:#141413!important;background:transparent!important;color:#141413!important}.ticket-preview{border:2px solid #141413!important;background:#fff!important;color:#141413!important}.ticket-preview>span{background:var(--br-bg)!important;color:var(--br-text)!important}.ticket-preview>pre{display:block!important;overflow:auto!important;min-height:10rem!important;max-height:18rem!important;margin:0!important;padding:.75rem!important;border:0!important;background:#fff!important;color:#141413!important;font:700 .68rem/1.25 "Courier New",monospace!important;opacity:1!important}
.ticket-preview{width:fit-content;max-width:100%;margin:0 auto;overflow:auto}.ticket-logo{display:grid;place-items:center;padding:.5rem;border-bottom:1px solid #77736b;background:#fff}.ticket-logo img{display:block;width:2.3rem;height:auto}.ticket-preview>span{padding:.45rem .6rem!important;text-align:left;font-size:.62rem!important}.ticket-preview>pre{box-sizing:border-box;width:max-content;max-width:none;min-height:0!important;max-height:none!important;padding:.6rem .75rem!important;overflow:visible!important;white-space:pre!important;font:700 .72rem/1.28 "Courier New",monospace!important}.ticket-barcode{display:grid;place-items:center;gap:.25rem;padding:.25rem .75rem .75rem;background:#fff;color:#141413}.ticket-barcode__bars{width:70%;height:2.1rem;background:repeating-linear-gradient(90deg,#141413 0 2px,transparent 2px 4px,#141413 4px 5px,transparent 5px 8px,#141413 8px 11px,transparent 11px 13px)}.ticket-barcode>span{font:700 .58rem "Courier New",monospace}
footer :deep(.app-button--outlined){border-color:#141413!important;background:transparent!important;color:#141413!important}footer :deep(.app-button--outlined:hover:not(:disabled)){background:#141413!important;color:#fff!important}footer :deep(.app-button){min-width:8rem}
</style>
