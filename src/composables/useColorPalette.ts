import { ref } from 'vue'

const paletteIds = [
  'phantom',
  'darkhour',
  'golden',
  'tachyon',
  'ledger',
  'indigo',
  'oled',
  'ember',
  'sakura',
  'steel'
] as const
export type PaletteId = (typeof paletteIds)[number]

export interface ColorPalette {
  id: PaletteId
  name: string
  description: string
  /** Fondo, componente, texto y acento; combinaciones revisadas para contraste AA. */
  colors: readonly [string, string, string, string]
}

export const paletteColorLabels = ['Fondo', 'Componentes', 'Texto', 'Acento'] as const

export const colorPalettes: readonly ColorPalette[] = [
  {
    id: 'phantom',
    name: 'Grafito',
    description: 'Grafito cálido con carmín nítido',
    colors: [
      'oklch(14.5% 0.018 8)',
      'oklch(20% 0.024 8)',
      'oklch(96% 0.010 8)',
      'oklch(69% 0.185 18)'
    ]
  },
  {
    id: 'darkhour',
    name: 'Azul noche',
    description: 'Azul profundo de lectura prolongada',
    colors: [
      'oklch(14.5% 0.025 250)',
      'oklch(20% 0.035 250)',
      'oklch(97% 0.012 250)',
      'oklch(76% 0.145 245)'
    ]
  },
  {
    id: 'golden',
    name: 'Ámbar',
    description: 'Carbón cálido con ámbar luminoso',
    colors: [
      'oklch(15% 0.025 95)',
      'oklch(20.5% 0.035 95)',
      'oklch(97% 0.035 95)',
      'oklch(84% 0.155 95)'
    ]
  },
  {
    id: 'tachyon',
    name: 'Ciruela',
    description: 'Ciruela mineral con menta precisa',
    colors: [
      'oklch(15% 0.025 315)',
      'oklch(20.5% 0.035 315)',
      'oklch(96% 0.015 315)',
      'oklch(78% 0.120 165)'
    ]
  },
  {
    id: 'ledger',
    name: 'Libro mayor',
    description: 'Verde sobrio para concentración',
    colors: [
      'oklch(15% 0.025 165)',
      'oklch(20.5% 0.035 165)',
      'oklch(96% 0.015 165)',
      'oklch(76% 0.115 160)'
    ]
  },
  {
    id: 'indigo',
    name: 'Índigo',
    description: 'Índigo profesional de contraste sereno',
    colors: [
      'oklch(15% 0.025 275)',
      'oklch(20.5% 0.035 275)',
      'oklch(96% 0.012 275)',
      'oklch(77% 0.125 275)'
    ]
  },
  {
    id: 'oled',
    name: 'OLED',
    description: 'Negro real con verde eficiente',
    colors: ['oklch(0% 0 0)', 'oklch(8% 0.014 160)', 'oklch(97% 0.012 160)', 'oklch(79% 0.160 155)']
  },
  {
    id: 'ember',
    name: 'Terracota',
    description: 'Grafito cálido con naranja encendido',
    colors: [
      'oklch(15% 0.022 45)',
      'oklch(20.5% 0.032 45)',
      'oklch(96% 0.018 45)',
      'oklch(74% 0.175 45)'
    ]
  },
  {
    id: 'sakura',
    name: 'Granate',
    description: 'Granate oscuro con rosa editorial',
    colors: [
      'oklch(15% 0.028 345)',
      'oklch(20.5% 0.040 345)',
      'oklch(96% 0.018 345)',
      'oklch(75% 0.165 350)'
    ]
  },
  {
    id: 'steel',
    name: 'Acero',
    description: 'Gris mineral con cian técnico',
    colors: [
      'oklch(15% 0.018 220)',
      'oklch(20.5% 0.028 220)',
      'oklch(96% 0.012 220)',
      'oklch(78% 0.110 215)'
    ]
  }
] as const

const legacyPaletteMap: Record<string, PaletteId> = {
  carbon: 'phantom',
  cobalt: 'darkhour',
  forest: 'ledger',
  sand: 'golden'
}
const STORAGE_KEY = 'appColorPalette'
const DEFAULT_PALETTE: PaletteId = 'ledger'
const selectedPalette = ref<PaletteId>(DEFAULT_PALETTE)

function resolvePalette(value: string | null): PaletteId {
  if (!value) return DEFAULT_PALETTE
  if (paletteIds.includes(value as PaletteId)) return value as PaletteId
  return legacyPaletteMap[value] ?? DEFAULT_PALETTE
}

export function applyPalette(id: PaletteId): void {
  const valid = resolvePalette(id)
  selectedPalette.value = valid
  document.documentElement.dataset.brPalette = valid
  localStorage.setItem(STORAGE_KEY, valid)
}

export function initializePalette(): void {
  applyPalette(resolvePalette(localStorage.getItem(STORAGE_KEY)))
}

export function useColorPalette() {
  return { palettes: colorPalettes, paletteColorLabels, selectedPalette, applyPalette }
}
