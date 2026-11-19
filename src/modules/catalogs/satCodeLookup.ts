import { ref, watch } from 'vue'
import type { SatCatalogId } from '../../../shared/contracts/satCatalogs'
import { maximumDescribedCodes } from '../../../shared/contracts/satCatalogs'

/**
 * Significado de códigos SAT en otras pantallas (ADR-032), con los catálogos de este equipo:
 * - Pide a Main sólo los códigos que faltan, agrupados por catálogo, y los recuerda mientras la app está abierta.
 * - Un catálogo sin descargar simplemente no aporta descripción: la pantalla muestra el código solo.
 * - Al descargar o borrar un catálogo, `refreshSatCodeCatalogs` olvida lo aprendido y se vuelve a consultar.
 */
export interface SatCodeRequest { catalogId: SatCatalogId; code: string }
const known = ref(new Map<string, string>())
const catalogVersion = ref(0)
const keyOf = (catalogId: SatCatalogId, code: string) => catalogId + ':' + code

export function refreshSatCodeCatalogs(): void { known.value = new Map(); catalogVersion.value++ }

/** Devuelve una función que da la descripción de un código ('' si todavía no se sabe o no existe). */
export function useSatCodeDescriptions(requests: () => SatCodeRequest[]): (catalogId: SatCatalogId, code: string | null | undefined) => string {
  watch([requests, catalogVersion], async ([wanted]) => {
    const missing = new Map<SatCatalogId, Set<string>>()
    for (const { catalogId, code } of wanted) {
      if (!code || !/^[A-Za-z0-9]{1,10}$/.test(code) || known.value.has(keyOf(catalogId, code))) continue
      missing.set(catalogId, (missing.get(catalogId) ?? new Set()).add(code))
    }
    for (const [catalogId, codes] of missing) {
      const list = [...codes].slice(0, maximumDescribedCodes)
      try {
        const result = await window.contapp.manageSatCatalogs({ action: 'describe', catalogId, codes: list })
        if (result.action !== 'describe') continue
        const next = new Map(known.value)
        // Los códigos no encontrados quedan como '' para no volver a pedirlos.
        for (const code of list) next.set(keyOf(catalogId, code), '')
        for (const entry of result.entries) next.set(keyOf(catalogId, entry.code), entry.description)
        known.value = next
      } catch { /* Sin sesión o sin catálogo: se muestran sólo los códigos. */ }
    }
  }, { immediate: true, deep: true })
  return (catalogId, code) => code ? known.value.get(keyOf(catalogId, code)) ?? '' : ''
}
