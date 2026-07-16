<template><input :type="showTime ? 'datetime-local' : 'date'" :value="displayValue" :step="showSeconds ? 1 : 60" @input="update" /></template>
<script setup lang="ts">
import { computed } from "vue";
const props=defineProps<{modelValue?:Date|string|null;showTime?:boolean;showSeconds?:boolean|string}>();
const emit=defineEmits<{(event:"update:modelValue",value:Date|null):void}>();
const pad=(value:number)=>String(value).padStart(2,"0");
const displayValue=computed(()=>{if(!props.modelValue)return "";const date=props.modelValue instanceof Date?props.modelValue:new Date(String(props.modelValue).replace(" ","T"));if(Number.isNaN(date.getTime()))return "";const base=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;return props.showTime?`${base}T${pad(date.getHours())}:${pad(date.getMinutes())}${props.showSeconds?`:${pad(date.getSeconds())}`:""}`:base});
const update=(event:Event)=>{const value=(event.target as HTMLInputElement).value;emit("update:modelValue",value?new Date(value):null)};
</script>
<style scoped>input{width:100%;min-height:3rem;border:1px solid var(--br-line-strong,#77736b);border-radius:0;background:var(--br-control,#e7e4dc);color:#141413;padding:.65rem .75rem;font:700 .86rem "Courier New",monospace;color-scheme:light}input:focus{outline:2px solid var(--br-accent,#e34b32);outline-offset:2px}</style>
