import { shallowRef } from 'vue'
import type { PdfResult, PdfView } from '../../../shared/contracts/pdfViewer'

/**
 * Estado del visor de PDF de Fiscenix (2026-10-06). Hay un solo visor, montado en App.vue; cualquier vista lo abre
 * con el resultado de su IPC (`openReportPdf`, `openCfdiPdf`, `openCompletedTasksPdf`).
 * - `openedPdf`: el PDF abierto (bytes en memoria de esta ventana). Al abrir otro, el anterior se libera en Main.
 * - `closePdf`: cierra el visor y pide a Main que libere su copia.
 */
export const openedPdf = shallowRef<PdfView | null>(null)

export function showPdf(view: PdfView): void {
  const previous = openedPdf.value
  if (previous && previous.viewId !== view.viewId) void window.contapp.releasePdfView(previous.viewId).catch(() => undefined)
  openedPdf.value = view
}

export function closePdf(): void {
  const current = openedPdf.value
  openedPdf.value = null
  if (current) void window.contapp.releasePdfView(current.viewId).catch(() => undefined)
}

/** Abre el visor si el resultado es para ver. Devuelve si se guardó, para el aviso de "PDF guardado". */
export function handlePdfResult(result: PdfResult): boolean {
  if (result.status === 'viewed') showPdf(result.view)
  return result.status === 'saved'
}
