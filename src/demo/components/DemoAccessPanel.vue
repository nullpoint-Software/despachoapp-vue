<script setup lang="ts">
import { ref } from 'vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import { signIn } from '../../modules/workspace/sessionState'
import { demoPassword, demoProfiles, type DemoProfile } from '../demoProfiles'

/**
 * One-click entry to the demo: each button signs in with a fixed profile through the same `signIn` the typed form
 * uses, so the simulated Host validates it like any other login. Failures show Fiscenix's own error notice.
 */
const busyProfileId = ref<DemoProfile['profileId'] | null>(null), errorMessage = ref('')

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
      <ActionButton
        v-for="profile in demoProfiles"
        :key="profile.profileId"
        :data-testid="'demo-profile-' + profile.profileId"
        :is-loading="busyProfileId === profile.profileId"
        @click="enterAs(profile)"
      >
        {{ profile.roleName }} · {{ profile.displayName }}
      </ActionButton>
    </div>
    <p class="field-help">
      Contraseña de la demo: {{ demoPassword }} (se pide para confirmar acciones sensibles).
    </p>
  </section>
</template>

<style scoped>
.demo-access { display: grid; gap: var(--spaceSmall); }
.demo-access h2 { margin: 0; }
.demo-access-profiles { display: flex; flex-wrap: wrap; gap: var(--spaceSmall); }
</style>
