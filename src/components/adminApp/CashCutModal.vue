<template>
  <Teleport to="body">
    <div class="cut-overlay" @click.self="emit('close')">
      <section class="cut-modal" role="dialog" aria-modal="true" aria-labelledby="cut-title">
        <header><p>CAJA / RESUMEN</p><h2 id="cut-title">Corte de caja</h2><button type="button" aria-label="Cerrar" @click="emit('close')">×</button></header>
        <div class="cut-body">
          <p class="intro">Define el periodo exacto que debe entrar en el corte. El resumen se recalcula al instante.</p>
          <div class="period-summary">
            <div><span>Inicio</span><strong>{{ formatPeriod(from) }}</strong></div>
            <div><span>Fin</span><strong>{{ formatPeriod(to) }}</strong></div>
            <AppButton label="Cambiar periodo" icon="pi pi-calendar" class="p-button-primary" @click="periodVisible=true" />
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <div class="metrics" aria-live="polite">
            <article><span>Movimientos</span><strong>{{ filtered.length }}</strong></article>
            <article><span>Cobrado</span><strong>{{ money(totalCollected) }}</strong></article>
            <article><span>Pagado</span><strong>{{ money(totalPaid) }}</strong></article>
            <article class="balance"><span>Resultado</span><strong>{{ money(totalCollected-totalPaid) }}</strong></article>
          </div>
          <div class="preview"><div><b>Últimos movimientos del periodo</b><span v-if="loading">Cargando…</span></div><ol><li v-for="item in filtered.slice(0,6)" :key="item.id"><span>{{ item.cliente }} · {{ item.asunto }}</span><b>{{ money(item.cobramos) }}</b></li><li v-if="!loading&&!filtered.length">No hay movimientos en este rango.</li></ol></div>
        </div>
        <footer><AppButton label="Cancelar" outlined @click="emit('close')"/><AppButton label="Preparar ticket" icon="pi pi-print" class="p-button-primary" :disabled="loading||!!error" @click="printerVisible=true"/></footer>
      </section>
      <DateRangeModal v-if="periodVisible" :from="from" :to="to" @close="periodVisible=false" @apply="applyPeriod" />
      <CashCutTicketModal v-if="printerVisible" :movements="filtered" :from="from" :to="to" @close="printerVisible=false" />
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import DateRangeModal from "@/components/adminApp/DateRangeModal.vue";
import CashCutTicketModal from "@/components/adminApp/Print/CashCutTicketModal.vue";
import { ps } from "@/service/adminApp/client";
const emit=defineEmits<{close:[]}>();
const now=new Date();const start=new Date(now);start.setHours(0,0,0,0);
const from=ref<Date>(start),to=ref<Date>(now),payments=ref<any[]>([]),loading=ref(true),loadError=ref(""),printerVisible=ref(false),periodVisible=ref(false);
const error=computed(()=>loadError.value||(from.value>to.value?"La hora inicial debe ser anterior a la hora final.":""));
function asDate(value:any){if(value instanceof Date)return value;const normalized=String(value||"").replace(" ","T");const date=new Date(normalized);return Number.isNaN(date.getTime())?null:date}
const filtered=computed(()=>payments.value.filter(item=>{const date=asDate(item.fecha);return date&&date>=from.value&&date<=to.value}));
const totalCollected=computed(()=>filtered.value.reduce((sum,item)=>sum+Number(item.cobramos||0),0));
const totalPaid=computed(()=>filtered.value.reduce((sum,item)=>sum+Number(item.pagamos||0),0));
const money=(value:any)=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(value||0));
const formatPeriod=(value:Date)=>new Intl.DateTimeFormat("es-MX",{dateStyle:"short",timeStyle:"medium"}).format(value);
function applyPeriod(startDate:Date,endDate:Date){from.value=startDate;to.value=endDate;periodVisible.value=false}
onMounted(async()=>{try{const data=await ps.getPagoConcepto();payments.value=Array.isArray(data)?data:[]}catch(e){console.error(e);loadError.value="No se pudieron cargar los movimientos."}finally{loading.value=false}});
</script>
<style scoped>
.cut-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:rgba(7,7,6,.84);backdrop-filter:blur(3px)}.cut-modal{width:min(74rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);overflow:auto;border:2px solid #0d0d0c;background:var(--br-control);color:#141413;box-shadow:12px 12px 0 #d0a928}.cut-modal>header{position:relative;padding:1.35rem 5rem 1.2rem 1.5rem;background:#141413;color:#fff}.cut-modal header p{margin:0 0 .35rem;color:#d0a928;font:800 .75rem "Courier New",monospace;letter-spacing:.1em}.cut-modal h2{margin:0;font:900 clamp(2rem,6vw,3.6rem)/.9 Arial,sans-serif;letter-spacing:-.06em;text-transform:uppercase}.cut-modal header button{position:absolute;right:0;top:0;width:4rem;height:4rem;border:0;border-left:2px solid #fff;border-bottom:2px solid #fff;background:#d0a928;color:#111;font-size:2rem;cursor:pointer}.cut-body{padding:1.5rem}.intro{max-width:58ch;font:700 .85rem/1.45 "Courier New",monospace}.range{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin:1.3rem 0}.range label>span,.metrics span{display:block;margin-bottom:.4rem;font:800 .72rem "Courier New",monospace;letter-spacing:.08em;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border-top:2px solid #141413;border-left:2px solid #141413}.metrics article{min-height:4.75rem;padding:.7rem .85rem;border-right:2px solid #141413;border-bottom:2px solid #141413}.metrics strong{font:900 clamp(1.1rem,2.1vw,1.7rem)/1 Arial,sans-serif}.metrics .balance{background:#141413;color:#fff}.preview{margin-top:1rem;border:2px solid #141413}.preview>div{display:flex;justify-content:space-between;padding:.75rem;background:#141413;color:#fff;font:700 .8rem "Courier New",monospace}.preview ol{list-style:none;margin:0;padding:0}.preview li{display:flex;justify-content:space-between;gap:1rem;padding:.7rem .8rem;border-top:1px solid #77736b;font:700 .78rem "Courier New",monospace}.error{border:1px solid #a52319;background:#f4c6bd;padding:.75rem;color:#761b14;font-weight:800}.cut-modal>footer{display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.5rem;border-top:2px solid #141413}@media(max-width:700px){.range,.metrics{grid-template-columns:1fr 1fr}.cut-modal{box-shadow:6px 6px 0 #d0a928}}
.cut-modal{background:var(--br-control);box-shadow:12px 12px 0 var(--br-accent)}.cut-modal header p{color:var(--br-accent)}.cut-modal header button{background:var(--br-accent);color:var(--br-accent-text)}@media(max-width:700px){.cut-modal{box-shadow:6px 6px 0 var(--br-accent)}}
.range-field{display:block;min-width:0;border:1px solid #77736b;background:#dedbd3;padding:.75rem}.range-field>span{display:block;margin-bottom:.5rem;font:800 .72rem "Courier New",monospace;letter-spacing:.08em;text-transform:uppercase}.range-field :deep(.dt-picker){display:block!important;width:100%!important;min-width:0!important}.range-field :deep(.dt-trigger){display:grid!important;visibility:visible!important;width:100%!important;height:3.5rem!important;min-height:3.5rem!important;grid-template-columns:minmax(0,1fr) 3.5rem!important;border:1px solid #141413!important;background:#fff!important;color:#141413!important;padding:0!important;opacity:1!important}.range-field :deep(.dt-value){display:flex!important;visibility:visible!important;align-items:center!important;min-width:0!important;color:#141413!important;padding:.8rem!important;font:800 .9rem "Courier New",monospace!important;opacity:1!important}.range-field :deep(.dt-icon){display:grid!important;visibility:visible!important;width:3.5rem!important;height:100%!important;place-items:center!important;background:#141413!important;color:#fff!important;opacity:1!important}.cut-body{overflow:visible}.metrics strong{overflow-wrap:anywhere}@media(max-width:560px){.range{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.metrics article{min-height:5.5rem}}
.cut-modal{width:min(64rem,calc(100vw - 2rem))}.cut-modal h2{font-size:clamp(2rem,5vw,3rem)}.period-summary{display:grid;grid-template-columns:1fr 1fr auto;align-items:stretch;margin:1.15rem 0;border:1px solid #141413;background:#141413;gap:1px}.period-summary>div{display:flex;min-width:0;flex-direction:column;justify-content:center;background:#f7f5ef;padding:.7rem .85rem}.period-summary span{font:800 .64rem "Courier New",monospace;letter-spacing:.08em;text-transform:uppercase}.period-summary strong{overflow:hidden;margin-top:.25rem;font:800 .82rem "Courier New",monospace;text-overflow:ellipsis;white-space:nowrap}.period-summary :deep(.app-button){height:100%;border:0!important}@media(max-width:700px){.cut-overlay{place-items:stretch;padding:0}.cut-modal{display:flex;width:100vw;max-width:none;height:100dvh;max-height:100dvh;flex-direction:column;border:0;box-shadow:none!important}.cut-modal>header,.cut-modal>footer{flex-shrink:0}.cut-body{min-height:0;flex:1;overflow:auto}.cut-modal>footer{display:grid;grid-template-columns:1fr}.period-summary{grid-template-columns:1fr}.period-summary strong{white-space:normal}}
</style>
