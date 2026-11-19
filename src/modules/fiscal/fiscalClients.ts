import type { ClientAccess } from '../../../shared/contracts/clients'

/** Cliente que puede elegirse en Fiscal: necesita RFC para encontrar sus XML (emisor o receptor). */
export interface FiscalClient { clientId: string; displayName: string; rfc: string; access: ClientAccess; isActive: boolean }

/**
 * Clientes asignados con su RFC, por páginas de 50 del Host (hasta 40 páginas), para el selector de Fiscal
 * (2026-10-04). Los que no tienen RFC se devuelven con `rfc` vacío para avisar que falta capturarlo en Clientes.
 */
export async function loadFiscalClients(): Promise<FiscalClient[]> {
  const clients: FiscalClient[] = []
  let afterClientId: string | null = null
  for (let page = 0; page < 40; page++) {
    const result = await window.contapp.manageClients({ action: 'list', afterClientId })
    const rfcs = new Map((result.summaries ?? []).map(summary => [summary.clientId, summary.rfc.toUpperCase()]))
    for (const client of result.clients) clients.push({ clientId: client.clientId, displayName: client.displayName, rfc: rfcs.get(client.clientId) ?? '', access: client.access, isActive: client.isActive })
    afterClientId = result.nextClientId
    if (!afterClientId) break
  }
  return clients.filter(client => client.isActive).sort((first, second) => first.displayName.localeCompare(second.displayName, 'es-MX'))
}
