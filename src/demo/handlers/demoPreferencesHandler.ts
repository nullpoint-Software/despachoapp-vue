import type { DesktopApi } from '../../../shared/contracts/desktop'
import { defaultPreferences, parseLocalPreferences, parsePreferencesPatch, type LocalPreferences } from '../../../shared/contracts/localPreferences'

export const demoPreferencesStorageKey = 'fiscenixWeb.localPreferences'

/**
 * Preferencias LOCAL del dispositivo (tema, fondo, acento...). Es lo único que sobrevive a una recarga de la demo.
 * Cualquier fallo del almacenamiento (nulo, bloqueado, dañado) degrada a los valores por omisión, nunca lanza.
 */
export function createDemoPreferencesHandler(storage: Pick<Storage, 'getItem' | 'setItem'> | null): Pick<DesktopApi, 'readLocalPreferences' | 'updateLocalPreferences' | 'listLocalPrinters'> {
  function readStoredPreferences(): LocalPreferences {
    try {
      const stored = storage?.getItem(demoPreferencesStorageKey)
      return stored ? parseLocalPreferences(JSON.parse(stored)) : { ...defaultPreferences }
    } catch { return { ...defaultPreferences } }
  }
  return {
    async readLocalPreferences() { return readStoredPreferences() },
    async updateLocalPreferences(patch) {
      const merged = { ...readStoredPreferences(), ...parsePreferencesPatch(patch) }
      try { storage?.setItem(demoPreferencesStorageKey, JSON.stringify(merged)) } catch { /* Sin almacenamiento: la preferencia vale sólo hasta recargar. */ }
      return merged
    },
    async listLocalPrinters() { return [] }
  }
}
