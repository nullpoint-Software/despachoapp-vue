import { computed, ref } from 'vue'
import { defaultPreferences, restorablePages, type ListPageSize, type LocalPreferences, type LocalPreferencesPatch, type PagedList, type RestorablePage } from '../../../shared/contracts/localPreferences'

/**
 * Estado compartido de las preferencias LOCAL. Se leen una vez al iniciar y cada cambio se envía a
 * Main de inmediato como parche; si Main no responde, la vista conserva el cambio en esta sesión y
 * avisa en Configuración. El tema efectivo resuelve `system` con `prefers-color-scheme`.
 */
export const preferences = ref<LocalPreferences>(structuredClone(defaultPreferences))
export const isPreferencesSaveFailed = ref(false)
const systemDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const isSystemDark = ref(systemDark?.matches ?? false)
systemDark?.addEventListener('change', event => { isSystemDark.value = event.matches })
export const effectiveTheme = computed<'light' | 'dark'>(() => preferences.value.theme === 'system' ? (isSystemDark.value ? 'dark' : 'light') : preferences.value.theme)

export function isRestorablePage(value: string): value is RestorablePage { return (restorablePages as readonly string[]).includes(value) }

export async function loadPreferences(): Promise<LocalPreferences> {
  try { preferences.value = await window.contapp.readLocalPreferences() } catch { /* Se usan los valores base sin bloquear la aplicación. */ }
  return preferences.value
}
/** Tamaño de página de una lista (Tareas, Clientes, Pagos), recordado en este equipo (2026-10-17). */
export function pageSizeFor(list: PagedList): ListPageSize { return preferences.value.pageSizes[list] }
export function setPageSize(list: PagedList, size: ListPageSize): Promise<void> {
  return updatePreferences({ pageSizes: { ...preferences.value.pageSizes, [list]: size } })
}
/** Aplica primero en la vista y luego persiste; el parche viaja como objeto plano. */
export async function updatePreferences(patch: LocalPreferencesPatch): Promise<void> {
  preferences.value = { ...preferences.value, ...structuredClone(patch) }
  try { preferences.value = await window.contapp.updateLocalPreferences(JSON.parse(JSON.stringify(patch)) as LocalPreferencesPatch); isPreferencesSaveFailed.value = false }
  catch { isPreferencesSaveFailed.value = true }
}
