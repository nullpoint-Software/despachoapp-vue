import jsQR from 'jsqr'

/**
 * Decodificación de un código QR a partir de píxeles RGBA (2026-10-11, [[changes/CSF-QR-SCANNER]]).
 *
 * Usa jsQR (Apache-2.0, JavaScript puro, versión fija 1.4.0) en lugar de `BarcodeDetector` de Chromium, que no existe
 * en Electron para Windows. No toca el DOM: recibe un búfer RGBA (de un `<canvas>`, un cuadro de la cámara o una
 * imagen generada en una prueba) y devuelve el texto del QR o `null`.
 *
 * `attemptBoth` prueba también la imagen invertida (QR claro sobre fondo oscuro, fotos con contraste raro); cuesta
 * el doble, pero las imágenes que se le dan ya están acotadas por `maximumQrDecodeDimension`.
 */
export interface QrPixels { data: Uint8ClampedArray; width: number; height: number }

/** Lado máximo (px) de la imagen que se entrega a jsQR: suficiente para un QR legible y acota el trabajo por cuadro. */
export const maximumQrDecodeDimension = 2000

export function decodeQrPixels(pixels: QrPixels): string | null {
  if (pixels.width <= 0 || pixels.height <= 0 || pixels.data.length !== pixels.width * pixels.height * 4) return null
  const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })
  return code && code.data ? code.data : null
}
