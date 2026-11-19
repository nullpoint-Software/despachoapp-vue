import { ref } from 'vue'
import type { TicketPreview } from '../../../shared/contracts/printing'
import { useNotifications } from '../notifications/notificationStore'
import { readIpcErrorMessage } from '../ipcErrorMessage'

/**
 * Estado de la vista previa de un ticket para una página (Pagos, Preferencias). `openTicket` pide a Main
 * que prepare el ticket (Main consulta al Host) y muestra la vista previa; si Main no puede prepararlo,
 * avisa con su mensaje. Imprimir lo hace TicketPreviewDialog con el `ticketId` de la vista previa.
 */
export function useTicketPrinting() {
  const { notify } = useNotifications()
  const preview = ref<TicketPreview | null>(null)
  const isPreparing = ref(false)
  async function openTicket(prepare: () => Promise<TicketPreview>): Promise<void> {
    if (isPreparing.value) return
    isPreparing.value = true
    try { preview.value = await prepare() }
    catch (error) { notify('No se pudo preparar el ticket', readIpcErrorMessage(error, 'Revisa tu sesión y la conexión con el Host, y vuelve a intentarlo.'), 'error') }
    finally { isPreparing.value = false }
  }
  function closeTicket(): void { preview.value = null }
  return { preview, isPreparing, openTicket, closeTicket }
}
