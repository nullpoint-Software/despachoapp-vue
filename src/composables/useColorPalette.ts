import { ref } from "vue";

export const colorPalettes = [
  { id: "carbon", name: "Carbón rojo", colors: ["#10100f", "#e34b32", "#e7e4dc"] },
  { id: "cobalt", name: "Tinta cobalto", colors: ["#0c1420", "#4f7cff", "#e9edf5"] },
  { id: "forest", name: "Bosque ácido", colors: ["#0e1511", "#a8d65b", "#e7eadf"] },
  { id: "sand", name: "Arena editorial", colors: ["#1a1712", "#e0b95b", "#f1eadb"] },
] as const;
export type PaletteId = typeof colorPalettes[number]["id"];
const STORAGE_KEY = "appColorPalette";
const selectedPalette = ref<PaletteId>("carbon");

export function applyPalette(id: PaletteId) {
  const valid = colorPalettes.some(palette => palette.id === id) ? id : "carbon";
  selectedPalette.value = valid;
  document.documentElement.dataset.brPalette = valid;
  localStorage.setItem(STORAGE_KEY, valid);
}
export function initializePalette() {
  applyPalette((localStorage.getItem(STORAGE_KEY) || "carbon") as PaletteId);
}
export function useColorPalette() { return { palettes: colorPalettes, selectedPalette, applyPalette }; }
