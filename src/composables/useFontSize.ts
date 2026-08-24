import { ref } from 'vue'

export type TextScale = number

export const MIN_TEXT_SCALE = 85
export const MAX_TEXT_SCALE = 120
export const TEXT_SCALE_STEP = 5

const BASE_FONT_SIZE_PX = 16
const STORAGE_KEY = 'appFontSize'
const DEFAULT_TEXT_SCALE = 100
const legacyScaleMap: Record<string, TextScale> = {
  small: 90,
  compact: 90,
  medium: 100,
  comfortable: 100,
  large: 110,
  accessible: 120
}
const selectedTextScale = ref<TextScale>(DEFAULT_TEXT_SCALE)

function normalizeTextScale(value: number): TextScale {
  const finiteValue = Number.isFinite(value) ? value : DEFAULT_TEXT_SCALE
  const steppedValue = Math.round(finiteValue / TEXT_SCALE_STEP) * TEXT_SCALE_STEP
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, steppedValue))
}

function resolveStoredScale(value: string | null): TextScale {
  if (!value) return DEFAULT_TEXT_SCALE
  if (legacyScaleMap[value] !== undefined) return legacyScaleMap[value]
  return normalizeTextScale(Number(value))
}

export function applyTextScale(value: TextScale): void {
  const validScale = normalizeTextScale(value)
  selectedTextScale.value = validScale
  document.documentElement.style.setProperty(
    '--font-size-base',
    `${(BASE_FONT_SIZE_PX * validScale) / 100}px`
  )
  document.documentElement.dataset.appTextScale = String(validScale)
  delete document.documentElement.dataset.appFontSize
  localStorage.setItem(STORAGE_KEY, String(validScale))
}

export function initializeFontSize(): void {
  applyTextScale(resolveStoredScale(localStorage.getItem(STORAGE_KEY)))
}

export function useFontSize() {
  const decreaseTextScale = (): void => applyTextScale(selectedTextScale.value - TEXT_SCALE_STEP)
  const increaseTextScale = (): void => applyTextScale(selectedTextScale.value + TEXT_SCALE_STEP)

  return {
    selectedTextScale,
    minTextScale: MIN_TEXT_SCALE,
    maxTextScale: MAX_TEXT_SCALE,
    textScaleStep: TEXT_SCALE_STEP,
    applyTextScale,
    decreaseTextScale,
    increaseTextScale
  }
}
