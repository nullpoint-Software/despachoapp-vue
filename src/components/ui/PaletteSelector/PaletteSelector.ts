import { ref } from 'vue'
import { useColorPalette, type ColorPalette, type PaletteId } from '@/composables/useColorPalette'

defineProps<{ inline?: boolean }>()

const { palettes, paletteColorLabels, selectedPalette, applyPalette } = useColorPalette()
const menu = ref<HTMLDetailsElement | null>(null)

function select(id: PaletteId): void {
  applyPalette(id)
  if (menu.value) menu.value.open = false
}

function paletteAriaLabel(palette: ColorPalette): string {
  return paletteColorLabels.map((label, index) => `${label}: ${palette.colors[index]}`).join(', ')
}
