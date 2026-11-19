import type { AssignedClient, ClientSummary } from '../../../shared/contracts/clients'

/**
 * Asociación de un CFDI con un cliente por RFC (6.1, decisión del usuario: automática por RFC).
 * - Si el RFC del emisor es de un cliente asignado, el CFDI es **emitido** por ese cliente; si lo es el
 *   del receptor, es **recibido**. Se prueba primero el emisor.
 * - Sin coincidencia queda "Sin cliente": no se rechaza ni se borra; sigue en la biblioteca del equipo.
 * Es una vista local con los RFC que el Host ya entrega de los clientes asignados (el Host impide RFC
 * duplicados). La asociación que valga para reportes la vuelve a verificar el Host en 6.2.
 */
export type CfdiDirection = 'issued' | 'received'
export interface CfdiClientMatch { clientId: string; clientName: string; direction: CfdiDirection }
export const cfdiDirectionLabels: Record<CfdiDirection, string> = { issued: 'Emitida', received: 'Recibida' }

/** RFC → cliente, sólo con clientes asignados que tienen RFC capturado. */
export function buildClientRfcIndex(clients: AssignedClient[], summaries: ClientSummary[]): Map<string, { clientId: string; clientName: string }> {
  const names = new Map(clients.map(client => [client.clientId, client.displayName]))
  const index = new Map<string, { clientId: string; clientName: string }>()
  for (const summary of summaries) {
    const name = names.get(summary.clientId)
    if (name && summary.rfc) index.set(summary.rfc.toUpperCase(), { clientId: summary.clientId, clientName: name })
  }
  return index
}

export function matchCfdiClient(record: { issuerRfc: string; receiverRfc: string }, index: Map<string, { clientId: string; clientName: string }>): CfdiClientMatch | null {
  const issuer = index.get(record.issuerRfc.toUpperCase())
  if (issuer) return { ...issuer, direction: 'issued' }
  const receiver = index.get(record.receiverRfc.toUpperCase())
  return receiver ? { ...receiver, direction: 'received' } : null
}
