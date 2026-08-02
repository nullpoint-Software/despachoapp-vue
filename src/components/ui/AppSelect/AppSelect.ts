interface AppSelectProps { modelValue?: unknown; options?: any[]; optionLabel?: string; optionValue?: string; placeholder?: string }

interface AppSelectEmits { (event: "update:modelValue", value: unknown): void }

defineProps<AppSelectProps>();
const emit = defineEmits<AppSelectEmits>();

const handleChange = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
};
