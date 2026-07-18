<template>
  <div class="dt-picker" :class="{ 'is-open': open }">
    <button class="dt-trigger" type="button" :aria-expanded="open" @click="toggle">
      <span class="dt-value">{{ formattedValue }}</span>
      <span class="dt-icon" aria-hidden="true">▣</span>
    </button>

    <Teleport to="body" :disabled="!modal">
    <div v-if="open" :class="modal ? 'dt-overlay' : 'dt-inline'" @mousedown.self="cancel">
    <div class="dt-panel" role="dialog" :aria-modal="modal || undefined" aria-label="Seleccionar fecha">
      <header v-if="modal" class="dt-modal-header">
        <div><span>CALENDARIO / REPORTE</span><strong>{{ title }}</strong></div>
        <button type="button" aria-label="Cerrar calendario" @click="cancel">×</button>
      </header>
      <div class="dt-month-nav">
        <button type="button" aria-label="Mes anterior" @click="changeMonth(-1)">←</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" aria-label="Mes siguiente" @click="changeMonth(1)">→</button>
      </div>

      <div class="dt-weekdays" aria-hidden="true">
        <span v-for="day in weekDays" :key="day">{{ day }}</span>
      </div>
      <div class="dt-calendar">
        <span v-for="blank in leadingBlanks" :key="`blank-${blank}`" class="dt-blank" />
        <button
          v-for="day in daysInMonth"
          :key="day"
          type="button"
          :class="{ selected: day === draft.getDate() }"
          @click="selectDay(day)"
        >{{ day }}</button>
      </div>

      <div v-if="showTime" class="dt-time">
        <label><span>Hora</span><div class="dt-spinner"><button type="button" aria-label="Restar hora" @click="spin('hours',-1)">−</button><input v-model.number="hours" type="number" min="0" max="23" @change="normalize('hours')"/><button type="button" aria-label="Sumar hora" @click="spin('hours',1)">+</button></div></label>
        <label><span>Minutos</span><div class="dt-spinner"><button type="button" aria-label="Restar minuto" @click="spin('minutes',-1)">−</button><input v-model.number="minutes" type="number" min="0" max="59" @change="normalize('minutes')"/><button type="button" aria-label="Sumar minuto" @click="spin('minutes',1)">+</button></div></label>
        <label><span>Segundos</span><div class="dt-spinner"><button type="button" aria-label="Restar segundo" @click="spin('seconds',-1)">−</button><input v-model.number="seconds" type="number" min="0" max="59" @change="normalize('seconds')"/><button type="button" aria-label="Sumar segundo" @click="spin('seconds',1)">+</button></div></label>
      </div>

      <div class="dt-actions">
        <button type="button" @click="cancel">Cancelar</button>
        <button type="button" class="apply" @click="apply">{{ showTime ? "Aplicar fecha y hora" : "Aplicar fecha" }}</button>
      </div>
    </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props=withDefaults(defineProps<{modelValue:Date;showTime?:boolean;modal?:boolean;title?:string}>(),{showTime:true,modal:false,title:"Seleccionar fecha"});
const emit=defineEmits<{(event:"update:modelValue",value:Date):void}>();
const open=ref(false);
const draft=ref(new Date(props.modelValue));
const hours=ref(draft.value.getHours());
const minutes=ref(draft.value.getMinutes());
const seconds=ref(draft.value.getSeconds());
const months=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const weekDays=["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
const pad=(value:number)=>String(value).padStart(2,"0");
const dateLabel=computed(()=>`${pad(props.modelValue.getDate())}/${pad(props.modelValue.getMonth()+1)}/${props.modelValue.getFullYear()}`);
const formattedValue=computed(()=>props.showTime?`${dateLabel.value} — ${pad(props.modelValue.getHours())}:${pad(props.modelValue.getMinutes())}:${pad(props.modelValue.getSeconds())}`:dateLabel.value);
const monthLabel=computed(()=>`${months[draft.value.getMonth()]} ${draft.value.getFullYear()}`);
const daysInMonth=computed(()=>new Date(draft.value.getFullYear(),draft.value.getMonth()+1,0).getDate());
const leadingBlanks=computed(()=>{const day=new Date(draft.value.getFullYear(),draft.value.getMonth(),1).getDay();return day===0?6:day-1});
watch(()=>props.modelValue,value=>{if(!open.value)syncDraft(value)});
function syncDraft(value:Date){draft.value=new Date(value);hours.value=draft.value.getHours();minutes.value=draft.value.getMinutes();seconds.value=draft.value.getSeconds()}
function toggle(){if(!open.value)syncDraft(props.modelValue);open.value=!open.value}
function changeMonth(step:number){const next=new Date(draft.value);next.setDate(1);next.setMonth(next.getMonth()+step);draft.value=next}
function selectDay(day:number){const next=new Date(draft.value);next.setDate(day);draft.value=next}
function limitFor(unit:"hours"|"minutes"|"seconds"){return unit==="hours"?23:59}
function valueRef(unit:"hours"|"minutes"|"seconds"){return unit==="hours"?hours:unit==="minutes"?minutes:seconds}
function spin(unit:"hours"|"minutes"|"seconds",step:number){const target=valueRef(unit),max=limitFor(unit);target.value=(Number(target.value)+step+max+1)%(max+1)}
function normalize(unit:"hours"|"minutes"|"seconds"){const target=valueRef(unit),max=limitFor(unit);target.value=Math.min(max,Math.max(0,Number(target.value)||0))}
function cancel(){syncDraft(props.modelValue);open.value=false}
function apply(){const next=new Date(draft.value);if(props.showTime)next.setHours(hours.value,minutes.value,seconds.value,0);else next.setHours(0,0,0,0);emit("update:modelValue",next);open.value=false}
</script>

<style scoped>
.dt-picker{position:relative;min-width:0}.dt-trigger{display:grid;width:100%;min-height:3.25rem;grid-template-columns:1fr 3.25rem;align-items:stretch;border:1px solid #56534c;border-radius:0;background:#fff;color:#141413;padding:0;text-align:left;cursor:pointer}.dt-value{display:flex;align-items:center;padding:.75rem;font:800 .88rem "Courier New",monospace}.dt-icon{display:grid;place-items:center;border-left:1px solid #56534c;background:#141413;color:#fff;font-size:1.1rem}.dt-trigger:focus{outline:2px solid var(--br-accent);outline-offset:2px}.dt-panel{margin-top:-1px;border:1px solid #141413;background:#f8f7f2;padding:.75rem;box-shadow:5px 5px 0 var(--br-accent)}.dt-month-nav{display:grid;grid-template-columns:2.5rem 1fr 2.5rem;align-items:center;border:1px solid #141413;background:#141413;color:#fff}.dt-month-nav strong{text-align:center;font:800 .78rem "Courier New",monospace;text-transform:uppercase}.dt-month-nav button{height:2.5rem;border:0;border-radius:0;background:transparent;color:#fff;font-size:1.1rem;cursor:pointer}.dt-month-nav button:hover{background:var(--br-accent);color:var(--br-accent-text)}.dt-weekdays,.dt-calendar{display:grid;grid-template-columns:repeat(7,1fr)}.dt-weekdays{border-left:1px solid #77736b}.dt-weekdays span{padding:.45rem .1rem;border-right:1px solid #77736b;border-bottom:1px solid #77736b;text-align:center;font:800 .62rem "Courier New",monospace;text-transform:uppercase}.dt-calendar{border-left:1px solid #77736b}.dt-calendar button,.dt-blank{display:grid;min-height:2rem;place-items:center;border:0;border-right:1px solid #77736b;border-bottom:1px solid #77736b;border-radius:0;background:#fff;color:#141413;font:800 .72rem "Courier New",monospace}.dt-calendar button{cursor:pointer}.dt-calendar button:hover,.dt-calendar button.selected{background:var(--br-accent);color:var(--br-accent-text)}.dt-blank{background:#e2dfd7}.dt-time{display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:.5rem;margin-top:.75rem}.dt-time label span{display:block;margin-bottom:.25rem;font:800 .6rem "Courier New",monospace;text-transform:uppercase}.dt-spinner{display:grid;grid-template-columns:2rem minmax(0,1fr) 2rem;height:2.7rem;border:1px solid #56534c;background:#fff}.dt-spinner button{display:grid;min-height:0!important;place-items:center;border:0;border-radius:0;background:#141413;color:#fff;padding:0;font:900 1rem Arial,sans-serif;cursor:pointer}.dt-spinner button:hover{background:var(--br-accent);color:var(--br-accent-text)}.dt-spinner input{min-width:0;width:100%;height:100%;border:0!important;border-radius:0!important;background:#fff!important;color:#141413!important;padding:.35rem!important;text-align:center;font:800 .78rem "Courier New",monospace!important;-moz-appearance:textfield}.dt-spinner input::-webkit-inner-spin-button,.dt-spinner input::-webkit-outer-spin-button{margin:0;opacity:1}.dt-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid #77736b}.dt-actions button{min-height:2.6rem;border:1px solid #141413;border-radius:0;background:transparent;color:#141413;padding:.55rem .7rem;font:800 .68rem "Courier New",monospace;text-transform:uppercase;cursor:pointer}.dt-actions .apply{background:var(--br-accent);color:var(--br-accent-text);border-color:var(--br-accent)}@media(max-width:520px){.dt-time{grid-template-columns:1fr}.dt-value{font-size:.76rem}.dt-actions{display:grid;grid-template-columns:1fr}.dt-actions button{width:100%}}
.dt-inline .dt-panel{margin-top:-1px}.dt-overlay{position:fixed;inset:0;z-index:1250;display:grid;place-items:center;padding:1rem;background:rgba(7,8,8,.86);backdrop-filter:blur(3px)}.dt-overlay .dt-panel{width:min(25rem,calc(100vw - 2rem));margin:0;padding:0;color:#141413;box-shadow:9px 9px 0 var(--br-accent)}.dt-overlay .dt-panel>:not(.dt-modal-header){margin-left:.85rem;margin-right:.85rem}.dt-overlay .dt-panel>.dt-month-nav{margin-top:.85rem}.dt-overlay .dt-panel>.dt-actions{margin-bottom:.85rem}.dt-modal-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;background:#141413;color:#fff}.dt-modal-header div{padding:1rem 1.1rem}.dt-modal-header span,.dt-modal-header strong{display:block}.dt-modal-header span{margin-bottom:.25rem;color:var(--br-accent);font:800 .62rem "Courier New",monospace;letter-spacing:.09em}.dt-modal-header strong{font:900 1.35rem Arial,sans-serif;text-transform:uppercase}.dt-modal-header button{align-self:stretch;width:3.5rem;border:0;border-left:1px solid #f8f7f2;background:var(--br-accent);color:var(--br-accent-text);font-size:1.7rem;cursor:pointer}.dt-spinner input{-moz-appearance:textfield!important;appearance:textfield!important}.dt-spinner input::-webkit-inner-spin-button,.dt-spinner input::-webkit-outer-spin-button{-webkit-appearance:none!important;appearance:none!important;margin:0!important;display:none!important}
</style>
