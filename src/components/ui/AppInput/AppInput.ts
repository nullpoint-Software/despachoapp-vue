interface AppInputProps {modelValue?:string|number|null}


const handleInput = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
interface AppInputEmits {(event:"update:modelValue",value:string):void}

defineProps<AppInputProps>();const emit=defineEmits<AppInputEmits>();
