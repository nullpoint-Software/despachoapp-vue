interface AppFilterOptionsProps {
  legend: string;
  name: string;
  modelValue: string;
  options: readonly { label: string; value: string }[];
}

interface AppFilterOptionsEmits {
  "update:modelValue": [value: string];
}

defineProps<AppFilterOptionsProps>();

defineEmits<AppFilterOptionsEmits>();
