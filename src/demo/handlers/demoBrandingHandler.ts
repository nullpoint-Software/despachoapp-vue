import type { DesktopApi } from '../../../shared/contracts/desktop'
import type { DemoStore } from '../demoStore'

/** Marca del despacho de la demo, leída del store sembrado (copia: la vista no muta el store). */
export function createDemoBrandingHandler(store: DemoStore): Pick<DesktopApi, 'getOfficeBranding'> {
  return { async getOfficeBranding() { return { ...store.branding } } }
}
