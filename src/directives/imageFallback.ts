import type { Directive } from 'vue'
import { USER_AVATAR_PLACEHOLDER } from '@/constants/brandAssets'

type ImageWithFallback = HTMLImageElement & {
  __imageFallbackHandler?: () => void
}

function fallbackUrl(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : USER_AVATAR_PLACEHOLDER
}

function applyFallback(image: ImageWithFallback, fallback: string): void {
  if (image.src !== new URL(fallback, window.location.href).href) image.src = fallback
  image.classList.add('is-image-placeholder')
}

function syncPlaceholderState(image: ImageWithFallback, fallback: string): void {
  const resolvedFallback = new URL(fallback, window.location.href).href
  if (!image.getAttribute('src') || image.src === resolvedFallback) {
    applyFallback(image, fallback)
    return
  }
  image.classList.remove('is-image-placeholder')
}

export const imageFallbackDirective: Directive<ImageWithFallback, string | undefined> = {
  mounted(image, binding) {
    const fallback = fallbackUrl(binding.value)
    const handler = () => applyFallback(image, fallback)
    image.__imageFallbackHandler = handler
    image.addEventListener('error', handler)
    syncPlaceholderState(image, fallback)
  },
  updated(image, binding) {
    syncPlaceholderState(image, fallbackUrl(binding.value))
  },
  unmounted(image) {
    if (image.__imageFallbackHandler)
      image.removeEventListener('error', image.__imageFallbackHandler)
    delete image.__imageFallbackHandler
  }
}
