import { ref } from "vue";

export const fontFamilies = [
  { id: "system", name: "Sistema", description: "Clara y familiar", value: '"Segoe UI Variable", "Segoe UI", Arial, sans-serif' },
  { id: "humanist", name: "Humanista", description: "Amplia y muy legible", value: 'Verdana, Geneva, sans-serif' },
  { id: "classic", name: "Clásica", description: "Serif para lectura pausada", value: 'Georgia, "Times New Roman", serif' },
] as const;

export type FontFamilyId = typeof fontFamilies[number]["id"];

const STORAGE_KEY = "appFontFamily";
const DEFAULT_FONT: FontFamilyId = "system";
const selectedFontFamily = ref<FontFamilyId>(DEFAULT_FONT);

function resolveFont(id: string | null): FontFamilyId {
  return fontFamilies.some((font) => font.id === id) ? id as FontFamilyId : DEFAULT_FONT;
}

export function applyFontFamily(id: FontFamilyId): void {
  const valid = resolveFont(id);
  const font = fontFamilies.find((item) => item.id === valid) ?? fontFamilies[0];
  selectedFontFamily.value = valid;
  document.documentElement.style.setProperty("--font-family", font.value);
  document.documentElement.dataset.appFont = valid;
  localStorage.setItem(STORAGE_KEY, valid);
}

export function initializeFontFamily(): void {
  applyFontFamily(resolveFont(localStorage.getItem(STORAGE_KEY)));
}

export function useFontFamily() {
  return { fontFamilies, selectedFontFamily, applyFontFamily };
}