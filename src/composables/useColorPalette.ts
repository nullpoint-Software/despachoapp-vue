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
  /** Fondo, componente, texto y acento; texto principal AAA y roles secundarios AA. */
  colors: readonly [string, string, string, string]
}

export const paletteColorLabels = ['Fondo', 'Componentes', 'Texto', 'Acento'] as const

export const colorPalettes: readonly ColorPalette[] = [
  {
    id: 'phantom',
    name: 'Obsidiana',
    description: 'Obsidiana cálida con coral rubí',
    colors: [
      'oklch(13.5% 0.012 20)',
      'oklch(19.5% 0.018 20)',
      'oklch(97% 0.006 20)',
      'oklch(73% 0.16 25)'
    ]
  },
  {
    id: 'darkhour',
    name: 'Atlántico',
    description: 'Azul tinta con acento glaciar',
    colors: [
      'oklch(13.5% 0.016 255)',
      'oklch(20% 0.022 255)',
      'oklch(97% 0.006 255)',
      'oklch(77% 0.105 235)'
    ]
  },
  {
    id: 'golden',
    name: 'Latón',
    description: 'Carbón oliva con latón luminoso',
    colors: [
      'oklch(14% 0.014 75)',
      'oklch(20% 0.02 75)',
      'oklch(97% 0.008 75)',
      'oklch(83% 0.13 85)'
    ]
  },
  {
    id: 'tachyon',
    name: 'Mora',
    description: 'Mora mineral con menta fresca',
    colors: [
      'oklch(13.5% 0.014 315)',
      'oklch(20% 0.022 315)',
      'oklch(97% 0.006 315)',
      'oklch(79% 0.105 165)'
    ]
  },
  {
    id: 'ledger',
    name: 'Jade',
    description: 'Verde bosque con jade sobrio',
    colors: [
      'oklch(13.5% 0.012 155)',
      'oklch(20% 0.018 155)',
      'oklch(97% 0.006 155)',
      'oklch(76% 0.125 155)'
    ]
  },
  {
    id: 'indigo',
    name: 'Ultramar',
    description: 'Índigo tinta con lavanda eléctrica',
    colors: [
      'oklch(13.5% 0.016 280)',
      'oklch(20% 0.023 280)',
      'oklch(97% 0.006 280)',
      'oklch(78% 0.105 285)'
    ]
  },
  {
    id: 'oled',
    name: 'OLED',
    description: 'Negro absoluto con lima digital',
    colors: ['oklch(0% 0 0)', 'oklch(8% 0.01 155)', 'oklch(97% 0.006 155)', 'oklch(82% 0.135 145)']
  },
  {
    id: 'ember',
    name: 'Cobre',
    description: 'Tierra tostada con cobre vivo',
    colors: [
      'oklch(14% 0.014 45)',
      'oklch(20% 0.02 45)',
      'oklch(97% 0.007 45)',
      'oklch(77% 0.14 45)'
    ]
  },
  {
    id: 'sakura',
    name: 'Bugambilia',
    description: 'Borgoña profundo con rosa bugambilia',
    colors: [
      'oklch(13.5% 0.016 350)',
      'oklch(20% 0.024 350)',
      'oklch(97% 0.006 350)',
      'oklch(78% 0.135 350)'
    ]
  },
  {
    id: 'steel',
    name: 'Glaciar',
    description: 'Pizarra fría con cian glaciar',
    colors: [
      'oklch(13.5% 0.012 220)',
      'oklch(20% 0.018 220)',
      'oklch(97% 0.006 220)',
      'oklch(80% 0.085 210)'
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
