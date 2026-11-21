<script setup lang="ts">
import { ref, type Component } from 'vue'
import { ArrowRight, Calculator, ClipboardList, ShieldCheck } from '@lucide/vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { signIn } from '../../modules/workspace/sessionState'
import { demoPassword, demoProfiles, type DemoProfile, type DemoProfileId } from '../demoProfiles'
import administratorPhotoUrl from '../assets/avatarAdministrator.svg'
import accountantPhotoUrl from '../assets/avatarAccountant.svg'
import assistantPhotoUrl from '../assets/avatarAssistant.svg'

/**
 * One-click entry to the demo: each card signs in with a fixed profile through the same `signIn` the typed form
 * uses, so the simulated Host validates it like any other login. Failures show Fiscenix's own error notice.
 * Cards lead with the role (what the visitor will be able to do), not the fictional person's name; the portraits are
 * bundled illustrations, so nothing is downloaded and no real person is shown.
 */
const profileVisuals: Record<DemoProfileId, { photoUrl: string; icon: Component }> = {
  administrator: { photoUrl: administratorPhotoUrl, icon: ShieldCheck },
  accountant: { photoUrl: accountantPhotoUrl, icon: Calculator },
  assistant: { photoUrl: assistantPhotoUrl, icon: ClipboardList }
}
const busyProfileId = ref<DemoProfileId | null>(null), errorMessage = ref('')

async function enterAs(profile: DemoProfile): Promise<void> {
  if (busyProfileId.value) return
  busyProfileId.value = profile.profileId; errorMessage.value = ''
  try { await signIn(profile.username, demoPassword) }
  catch { errorMessage.value = 'No se pudo entrar con este perfil de la demo. Recarga la página e inténtalo de nuevo.' }
  finally { busyProfileId.value = null }
}
</script>

<template>
  <section
    class="demo-access"
    data-testid="demo-access"
    aria-labelledby="demo-access-title"
  >
    <h2 id="demo-access-title">
      Entrar a la demo
    </h2>
    <InlineNotice
      v-if="errorMessage"
      title="Acceso no confirmado"
      tone="error"
    >
      <p data-testid="demo-access-error">
        {{ errorMessage }}
      </p>
    </InlineNotice>
    <div class="demo-access-profiles">
      <button
        v-for="profile in demoProfiles"
        :key="profile.profileId"
        type="button"
        class="demo-profile"
        :data-testid="'demo-profile-' + profile.profileId"
        :disabled="busyProfileId !== null"
        :aria-busy="busyProfileId === profile.profileId || undefined"
        @click="enterAs(profile)"
      >
        <span class="demo-profile-photo">
          <img
            :src="profileVisuals[profile.profileId].photoUrl"
            alt=""
            width="48"
            height="48"
          >
          <span
            class="demo-profile-badge"
            aria-hidden="true"
          >
            <component
              :is="profileVisuals[profile.profileId].icon"
              :size="14"
            />
          </span>
        </span>
        <span class="demo-profile-role">{{ profile.roleName }}</span>
        <span class="demo-profile-summary">{{ profile.roleSummary }}</span>
        <ArrowRight
          class="demo-profile-arrow"
          :size="16"
          aria-hidden="true"
        />
      </button>
    </div>
    <p class="field-help">
      Contraseña de la demo: {{ demoPassword }} (se pide para confirmar acciones sensibles).
    </p>
  </section>
</template>

<style scoped>
.demo-access { display: grid; gap: var(--spaceSmall); container-type: inline-size; }
.demo-access h2 { margin: 0; }
.demo-access-profiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
/* Tarjeta de perfil: papel con marco de 2 px y sombra dura; al presionar se hunde como un sello (DESIGN.md). */
.demo-profile { position: relative; display: grid; align-content: start; gap: 6px; min-width: 0; padding: 10px; border: 2px solid var(--borderColor); border-radius: var(--radiusCard); background: var(--surfaceColor); color: var(--textColor); text-align: left; cursor: pointer; box-shadow: var(--buttonShadow); transition-property: background-color, transform, box-shadow; transition-duration: var(--durationQuick); transition-timing-function: var(--easeSmoothOut); }
.demo-profile:hover:not(:disabled) { background: var(--hoverColor); }
.demo-profile:active:not(:disabled) { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--shadowInk); }
.demo-profile:disabled { cursor: progress; opacity: .6; }
.demo-profile[aria-busy='true'] { opacity: 1; background: var(--hoverColor); }
.demo-profile-photo { position: relative; width: 48px; height: 48px; border: 2px solid var(--borderColor); }
.demo-profile-photo img { display: block; width: 100%; height: 100%; }
.demo-profile-badge { position: absolute; right: -8px; bottom: -8px; display: grid; place-items: center; width: 22px; height: 22px; border: 2px solid var(--borderColor); background: var(--primaryBackgroundColor); color: var(--primaryTextColor); }
.demo-profile-role { margin-top: 4px; font-size: 14px; font-weight: 800; letter-spacing: -.01em; }
.demo-profile-summary { font-size: 12px; line-height: 1.35; color: var(--mutedTextColor); }
.demo-profile-arrow { position: absolute; top: 10px; right: 10px; color: var(--mutedTextColor); }
.demo-profile:hover:not(:disabled) .demo-profile-arrow { color: var(--textColor); }
/* Columna angosta (teléfono): una tarjeta por fila, foto a la izquierda, para que el rol no se parta a media palabra. */
@container (max-width: 400px) {
  .demo-access-profiles { grid-template-columns: 1fr; }
  .demo-profile { grid-template-columns: 48px minmax(0, 1fr); column-gap: 16px; align-items: center; padding-right: 36px; }
  .demo-profile-photo { grid-row: span 2; }
  .demo-profile-role { margin-top: 0; align-self: end; }
  .demo-profile-summary { align-self: start; }
  .demo-profile-arrow { top: 50%; transform: translateY(-50%); }
}
@media (prefers-reduced-motion: reduce) { .demo-profile { transition: none; } }
</style>
