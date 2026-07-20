<template>
  <div class="app-autocomplete">
    <input
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="invalid ? 'true' : 'false'"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
      role="combobox"
      aria-autocomplete="list"
      autocomplete="off"
      @input="onInput"
      @focus="openList"
      @blur="closeList"
      @keydown="onKeydown"
    />
    <div v-if="open" :id="listId" class="app-autocomplete__list" role="listbox">
      <button
        v-for="(option, index) in filteredOptions"
        :id="optionId(index)"
        :key="option"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        :class="{ active: index === activeIndex }"
        @mousedown.prevent="selectOption(option)"
        @mouseenter="activeIndex = index"
      >
        {{ option }}
      </button>
      <span v-if="!filteredOptions.length" class="app-autocomplete__empty">Sin coincidencias. Puedes seguir escribiendo.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from "vue";

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{ modelValue?: string; options?: string[]; placeholder?: string; disabled?: boolean; invalid?: boolean; maxResults?: number }>(), {
  modelValue: "",
  options: () => [],
  placeholder: "",
  disabled: false,
  invalid: false,
  maxResults: 10,
});
const emit = defineEmits<{ (event: "update:modelValue", value: string): void; (event: "select", value: string): void }>();
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
</script>

<style scoped>
.app-autocomplete{position:relative;width:100%;min-width:0}
.app-autocomplete input{width:100%;min-height:3rem;border:1px solid var(--br-line-strong,#77736b);border-radius:0;background:var(--br-control,#e7e4dc);color:var(--br-control-text,#141413);padding:.7rem .8rem;font:700 .9rem/1.2 "Courier New",monospace}
.app-autocomplete input::placeholder{color:var(--br-control-muted,#4e4b45);opacity:1}
.app-autocomplete input:focus{outline:2px solid var(--br-accent,#e34b32);outline-offset:2px}
.app-autocomplete input:disabled{opacity:.62;cursor:not-allowed}
.app-autocomplete__list{position:absolute;z-index:20;top:calc(100% + 4px);right:0;left:0;max-height:14rem;overflow:auto;border:1px solid var(--br-line-strong,#56534c);background:var(--br-control,#e7e4dc);color:var(--br-control-text,#141413);box-shadow:6px 6px 0 var(--br-accent,#e34b32)}
.app-autocomplete__list button{display:block;width:100%;border:0;border-bottom:1px solid var(--br-line,#aaa69c);background:transparent;color:inherit;padding:.7rem .8rem;text-align:left;font:700 .82rem/1.25 "Courier New",monospace;cursor:pointer;transition:background-color .16s ease,color .16s ease}
.app-autocomplete__list button:last-of-type{border-bottom:0}
.app-autocomplete__list button:hover,.app-autocomplete__list button.active{background:var(--br-accent,#141413);color:var(--br-accent-text,#fff)}
.app-autocomplete__empty{display:block;padding:.8rem;color:var(--br-control-muted,#4e4b45);font:700 .75rem/1.3 "Courier New",monospace}
</style>
