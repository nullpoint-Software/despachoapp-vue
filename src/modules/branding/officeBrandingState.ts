import { ref, readonly } from 'vue'
import { defaultOfficeBranding } from '../../../shared/contracts/branding'
const branding = ref({ ...defaultOfficeBranding })
/** Vista EPHEMERAL de la identidad GLOBAL; se actualiza sólo tras confirmar lectura/escritura en Host. */
export function useOfficeBranding() {
  async function refresh(): Promise<void> { branding.value = await window.contapp.getOfficeBranding() }
  function apply(value: typeof branding.value): void { branding.value = value }
  return { branding: readonly(branding), refresh, apply }
}
