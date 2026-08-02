interface AppAutocompleteProps { modelValue?: string; options?: string[]; placeholder?: string; disabled?: boolean; invalid?: boolean; maxResults?: number }

interface AppAutocompleteEmits { (event: "update:modelValue", value: string): void; (event: "select", value: string): void }

import { computed, getCurrentInstance, ref, watch } from "vue";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<AppAutocompleteProps>(), {
  modelValue: "",
  options: () => [],
  placeholder: "",
  disabled: false,
  invalid: false,
  maxResults: 10,
});
const emit = defineEmits<AppAutocompleteEmits>();
const uid = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2);
const listId = `app-autocomplete-${uid}`;
const open = ref(false);
const activeIndex = ref(-1);
const normalize = (value: unknown) => String(value || "").trim().toLocaleLowerCase("es-MX");
const filteredOptions = computed(() => {
  const term = normalize(props.modelValue);
  return props.options.filter(option => !term || normalize(option).includes(term)).slice(0, props.maxResults);
});

watch(filteredOptions, () => { activeIndex.value = -1; });
function optionId(index: number) { return `${listId}-option-${index}`; }
function openList() { if (!props.disabled) { open.value = true; activeIndex.value = -1; } }
function closeList() { window.setTimeout(() => { open.value = false; activeIndex.value = -1; }, 100); }
function selectOption(option: string) { emit("update:modelValue", option); emit("select", option); open.value = false; activeIndex.value = -1; }
function onInput(event: Event) { emit("update:modelValue", (event.target as HTMLInputElement).value); open.value = true; }
function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown" && filteredOptions.value.length) { event.preventDefault(); if (!open.value) openList(); activeIndex.value = Math.min(activeIndex.value + 1, filteredOptions.value.length - 1); }
  else if (event.key === "ArrowUp" && filteredOptions.value.length) { event.preventDefault(); if (!open.value) { openList(); activeIndex.value = filteredOptions.value.length; } activeIndex.value = Math.max(activeIndex.value - 1, 0); }
  else if (event.key === "Enter" && open.value && activeIndex.value >= 0) { event.preventDefault(); selectOption(filteredOptions.value[activeIndex.value]); }
  else if (event.key === "Escape") { event.preventDefault(); open.value = false; activeIndex.value = -1; }
}
