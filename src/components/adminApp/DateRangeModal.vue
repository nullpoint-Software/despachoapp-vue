<template>
  <Teleport to="body">
    <div class="period-overlay" @mousedown.self="emit('close')">
      <section class="period-modal" role="dialog" aria-modal="true" aria-labelledby="period-title">
        <header>
          <p>CAJA / PERIODO</p>
          <h2 id="period-title">Definir corte</h2>
          <button type="button" aria-label="Cerrar" @click="emit('close')">×</button>
        </header>
        <div class="period-body">
          <p>Selecciona la fecha y hora exactas de inicio y fin.</p>
          <div class="period-grid">
            <section><span>01 / Inicio</span><DateTimePicker v-model="draftFrom" /></section>
            <section><span>02 / Fin</span><DateTimePicker v-model="draftTo" /></section>
          </div>
          <p v-if="invalid" class="period-error">La fecha inicial debe ser anterior a la fecha final.</p>
        </div>
        <footer><AppButton label="Cancelar" outlined @click="emit('close')"/><AppButton label="Aplicar periodo" icon="pi pi-check" class="p-button-primary" :disabled="invalid" @click="apply"/></footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import DateTimePicker from "@/components/ui/DateTimePicker.vue";
const props=defineProps<{from:Date;to:Date}>();
const emit=defineEmits<{close:[];apply:[from:Date,to:Date]}>();
const draftFrom=ref(new Date(props.from)),draftTo=ref(new Date(props.to));
const invalid=computed(()=>draftFrom.value>=draftTo.value);
function apply(){if(!invalid.value)emit("apply",new Date(draftFrom.value),new Date(draftTo.value))}
</script>

<style scoped>
.period-overlay{position:fixed;inset:0;z-index:1150;display:grid;place-items:center;padding:1rem;background:rgba(7,7,6,.9)}.period-modal{width:min(48rem,100%);max-height:calc(100vh - 2rem);overflow:auto;border:2px solid #141413;background:var(--br-control);color:#141413;box-shadow:9px 9px 0 var(--br-accent)}header{position:relative;padding:1.2rem 4.5rem 1.1rem 1.4rem;background:var(--br-bg);color:var(--br-text)}header p{margin:0 0 .3rem;color:var(--br-accent);font:800 .7rem "Courier New",monospace;letter-spacing:.09em}h2{margin:0;color:var(--br-text);font:900 clamp(1.8rem,5vw,2.8rem)/.9 Arial,sans-serif;letter-spacing:-.05em;text-transform:uppercase}header>button{position:absolute;right:0;top:0;width:3.7rem;height:3.7rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);border-radius:0;background:var(--br-accent);color:var(--br-accent-text);font-size:1.8rem;cursor:pointer}.period-body{padding:1.25rem}.period-body>p:first-child{margin:0 0 1rem;font:700 .8rem "Courier New",monospace}.period-grid{display:grid;grid-template-columns:1fr;gap:1rem}.period-grid>section{min-width:0;border:1px solid #77736b;background:#dedbd3;padding:.8rem}.period-grid>section>span{display:block;margin-bottom:.5rem;font:800 .7rem "Courier New",monospace;letter-spacing:.08em;text-transform:uppercase}.period-grid :deep(.dt-time){display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:.5rem!important}.period-grid :deep(.dt-spinner){display:grid!important;visibility:visible!important;grid-template-columns:2rem minmax(0,1fr) 2rem!important;width:100%!important;height:2.7rem!important;border:1px solid #56534c!important;background:#fff!important}.period-grid :deep(.dt-spinner button){display:grid!important;visibility:visible!important;width:2rem!important;height:100%!important;min-height:0!important;place-items:center!important;background:#141413!important;color:#fff!important;padding:0!important;opacity:1!important}.period-grid :deep(.dt-spinner input){display:block!important;visibility:visible!important;width:100%!important;height:100%!important;background:#fff!important;color:#141413!important;opacity:1!important}.period-error{margin:1rem 0 0;border:1px solid #9c2e25;background:#f4c6bd;padding:.7rem;color:#761b14;font:800 .72rem "Courier New",monospace}footer{display:flex;justify-content:flex-end;gap:.7rem;padding:1rem 1.25rem;border-top:2px solid #141413}footer :deep(.app-button--outlined){border-color:#141413!important;color:#141413!important}@media(max-width:700px){.period-overlay{place-items:stretch;padding:0}.period-modal{display:flex;width:100vw;max-height:100dvh;height:100dvh;flex-direction:column;border:0;box-shadow:none}header,footer{flex-shrink:0}.period-body{min-height:0;flex:1;overflow:auto}.period-grid :deep(.dt-time){grid-template-columns:1fr!important}footer{display:grid;grid-template-columns:1fr 1fr}}
</style>
