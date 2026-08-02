interface AppDateInputProps {modelValue?:Date|string|null;showTime?:boolean;showSeconds?:boolean|string}

interface AppDateInputEmits {(event:"update:modelValue",value:Date|null):void}

import { computed } from "vue";
const props=defineProps<AppDateInputProps>();
const emit=defineEmits<AppDateInputEmits>();
const pad=(value:number)=>String(value).padStart(2,"0");
const displayValue=computed(()=>{if(!props.modelValue)return "";const date=props.modelValue instanceof Date?props.modelValue:new Date(String(props.modelValue).replace(" ","T"));if(Number.isNaN(date.getTime()))return "";const base=`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;return props.showTime?`${base}T${pad(date.getHours())}:${pad(date.getMinutes())}${props.showSeconds?`:${pad(date.getSeconds())}`:""}`:base});
const update=(event:Event)=>{const value=(event.target as HTMLInputElement).value;emit("update:modelValue",value?new Date(value):null)};
