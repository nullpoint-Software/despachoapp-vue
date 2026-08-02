import { ref } from "vue";

const paletteIds = ["phantom", "darkhour", "golden", "tachyon", "ledger", "indigo", "oled", "ember", "sakura", "steel"] as const;
export type PaletteId = typeof paletteIds[number];

export interface ColorPalette {
  id: PaletteId;
  name: string;
  description: string;
  /** Fondo, componente, texto y acento; combinaciones revisadas para contraste AA. */
  colors: readonly [string, string, string, string];
}

export const paletteColorLabels = ["Fondo", "Componentes", "Texto", "Acento"] as const;

export const colorPalettes: readonly ColorPalette[] = [
  { id: "phantom", name: "Ladrones Fantasma", description: "Rojo editorial y negro cálido", colors: ["#120F11", "#1D181B", "#F4F1ED", "#E43D4F"] },
  { id: "darkhour", name: "Hora Oscura", description: "Azul eléctrico y profundidad nocturna", colors: ["#081526", "#0D223B", "#EEF7FF", "#39A7FF"] },
  { id: "golden", name: "Investigación dorada", description: "Amarillo gráfico y carbón cálido", colors: ["#18150A", "#26210D", "#FFF7CE", "#F1D33A"] },
  { id: "tachyon", name: "Laboratorio Tachyon", description: "Menta experimental y ciruela", colors: ["#17131A", "#221C27", "#F5F0F4", "#62D4B1"] },
  { id: "ledger", name: "Libro mayor", description: "Verde sobrio para trabajo prolongado", colors: ["#0D1715", "#14231F", "#EEF5F2", "#6CC39A"] },
  { id: "indigo", name: "Índigo ejecutivo", description: "Azul violeta de enfoque profesional", colors: ["#11131D", "#1A1D2B", "#F0F1F6", "#8EA2FF"] },
  { id: "oled", name: "OLED absoluto", description: "Negro real y verde de alta eficiencia", colors: ["#000000", "#070A08", "#F2F7F4", "#46E38D"] },
  { id: "ember", name: "Brasa operativa", description: "Naranja cálido sobre grafito", colors: ["#15110F", "#211A17", "#F6EFEA", "#FF7448"] },
  { id: "sakura", name: "Sakura nocturna", description: "Rosa nítido y berenjena profunda", colors: ["#190F18", "#281824", "#F8EEF4", "#F06BA5"] },
  { id: "steel", name: "Acero frío", description: "Cian técnico y gris mineral", colors: ["#0F161A", "#172329", "#EDF4F5", "#65C7D6"] },
] as const;

const legacyPaletteMap: Record<string, PaletteId> = {
  carbon: "phantom", cobalt: "darkhour", forest: "ledger", sand: "golden",
};
const STORAGE_KEY = "appColorPalette";
const DEFAULT_PALETTE: PaletteId = "ledger";
const selectedPalette = ref<PaletteId>(DEFAULT_PALETTE);

function resolvePalette(value: string | null): PaletteId {
  if (!value) return DEFAULT_PALETTE;
  if (paletteIds.includes(value as PaletteId)) return value as PaletteId;
  return legacyPaletteMap[value] ?? DEFAULT_PALETTE;
}

export function applyPalette(id: PaletteId): void {
  const valid = resolvePalette(id);
  selectedPalette.value = valid;
  document.documentElement.dataset.brPalette = valid;
  localStorage.setItem(STORAGE_KEY, valid);
}

export function initializePalette(): void {
  applyPalette(resolvePalette(localStorage.getItem(STORAGE_KEY)));
}

export function useColorPalette() {
  return { palettes: colorPalettes, paletteColorLabels, selectedPalette, applyPalette };
}