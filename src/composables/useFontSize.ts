import { ref } from "vue";

export const fontSizeOptions = [
  { id: "small", name: "Pequeño", sample: "A" },
  { id: "medium", name: "Normal", sample: "A" },
  { id: "large", name: "Grande", sample: "A" },
] as const;

export type FontSizeId = typeof fontSizeOptions[number]["id"];

const STORAGE_KEY = "appFontSize";
const selectedFontSize = ref<FontSizeId>("medium");

export function applyFontSize(id: FontSizeId) {
  const valid = fontSizeOptions.some(option => option.id === id) ? id : "medium";
  selectedFontSize.value = valid;
  document.documentElement.dataset.appFontSize = valid;
  localStorage.setItem(STORAGE_KEY, valid);
}

export function initializeFontSize() {
  applyFontSize((localStorage.getItem(STORAGE_KEY) || "medium") as FontSizeId);
}

export function useFontSize() {
  return { fontSizeOptions, selectedFontSize, applyFontSize };
}
