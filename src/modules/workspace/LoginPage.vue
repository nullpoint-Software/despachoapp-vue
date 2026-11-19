<script setup lang="ts">
import SplitText from '../../shared/vueBits/SplitText.vue'
import { ref, onBeforeUnmount, onMounted } from 'vue'
import { Building2, LogIn, Eye, EyeOff } from '@lucide/vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import InlineNotice from '../../shared/components/InlineNotice.vue'
import ThemeToggle from '../../shared/components/ThemeToggle.vue'
import ApplicationVersion from '../../shared/components/ApplicationVersion.vue'
import ApplicationLogo from '../../shared/components/ApplicationLogo.vue'
import { isHostPendingAtLogin, signIn } from './sessionState'
import { useOfficeBranding } from '../branding/officeBrandingState'
import { StaggeredEntrance } from '../../shared/motion/staggeredEntrance'
import LoginBanner from './LoginBanner.vue'
import DemoAccessPanel from '../../demo/components/DemoAccessPanel.vue'

/**
 * Primera pantalla una vez instalado el equipo, como en el sistema original. Clientes, pagos,
 * tareas, notas y XML se abren sólo después de iniciar sesión; el Host decide qué ve cada usuario.
 * La contraseña se borra tras cada intento y nunca se guarda.
 * Diseño partido (ADR-039, como la referencia del usuario): a la izquierda la marca y el formulario; a la derecha el
 * mosaico `LoginBanner`. Las reglas responden al ancho del contenedor (container queries), no al de la ventana.
 * Sin barra de desplazamiento (2026-10-13): la columna izquierda usa espacios compactos para caber en 1280×800, 1366×768 y
 * 1920×1080; sólo en ventanas realmente pequeñas aparece el desplazamiento de la página.
 */
/**
 * Si el Host no terminó de prepararse durante la animación de arranque, se avisa aquí y se sigue
 * comprobando cada 3 s; al quedar listo el aviso desaparece y ya se puede iniciar sesión.
 */
let readinessTimer: ReturnType<typeof setInterval> | undefined
async function checkHostReadiness(): Promise<void> {
  if (!isHostPendingAtLogin.value) return
  try { if ((await window.contapp.getHostStatus()).state === 'pairingRequired') isHostPendingAtLogin.value = false } catch { /* Sigue preparándose. */ }
}
const { branding } = useOfficeBranding()
const username = ref(''), password = ref(''), isPasswordVisible = ref(false), isBusy = ref(false), error = ref('')

async function submit(): Promise<void> {
  if (isBusy.value || !username.value.trim() || !password.value) return
  isBusy.value = true; error.value = ''
  try { await signIn(username.value.trim(), password.value) }
  catch { error.value = 'No se pudo iniciar sesión. Revisa usuario, contraseña y la conexión con el Host. Tras cinco intentos fallidos espera quince minutos.' }
  finally { password.value = ''; isBusy.value = false }
}
/** Entrada del acceso: el lema y luego título, formulario y pie, escalonados (sólo sin movimiento reducido). */
const screenElement = ref<HTMLElement | null>(null)
const screenEntrance = new StaggeredEntrance({ selector: '.login-stage', distancePixels: 18, staggerSeconds: .07 })
onMounted(() => { void screenEntrance.play(() => screenElement.value); readinessTimer = setInterval(() => { void checkHostReadiness() }, 3000) })
onBeforeUnmount(() => clearInterval(readinessTimer))
onBeforeUnmount(() => { password.value = ''; screenEntrance.dispose() })
</script>

<template>
  <div
    ref="screenElement"
    class="login-screen"
    data-testid="login-page"
  >
    <div class="login-layout">
      <div class="login-column">
        <aside class="login-aside login-stage">
          <span class="login-symbol"><img
            v-if="branding.logoDataUrl"
            :src="branding.logoDataUrl"
            alt="Logo del despacho"
          ><Building2
            v-else
            :size="40"
            aria-hidden="true"
          /></span>
          <!-- Split Text (Vue Bits): el lema entra letra por letra al abrir la pantalla de acceso. -->
          <p class="login-claim">
            <SplitText
              class="login-claim-line"
              tag="span"
              text="Control"
            />
            <SplitText
              class="login-claim-line"
              tag="span"
              text="operativo"
              :delay-seconds=".25"
            />
          </p>
          <span class="login-areas">Clientes · Pagos · Tareas · Fiscal · Notas</span>
        </aside>
        <section
          class="login-panel"
          aria-labelledby="login-title"
        >
          <div class="login-top login-stage">
            <h1 id="login-title">
              Iniciar sesión
            </h1>
            <ThemeToggle />
          </div>
          <InlineNotice
            v-if="isHostPendingAtLogin"
            title="El servicio del despacho todavía se está preparando"
            tone="warning"
          >
            <p data-testid="login-host-pending">
              Espera un momento y vuelve a intentarlo.
            </p>
          </InlineNotice>
          <InlineNotice
            v-if="error"
            title="Acceso no confirmado"
            tone="error"
          >
            <p data-testid="login-error">
              {{ error }}
            </p>
          </InlineNotice>
          <DemoAccessPanel class="login-stage" />
          <form
            class="login-form login-stage"
            @submit.prevent="submit"
          >
            <div class="field">
              <label for="login-username">Usuario</label>
              <input
                id="login-username"
                v-model="username"
                type="text"
                autocomplete="username"
                :disabled="isBusy"
                required
              >
            </div>
            <div class="field">
              <label for="login-password">Contraseña</label>
              <div class="password-field">
                <input
                  id="login-password"
                  v-model="password"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  autocomplete="current-password"
                  :disabled="isBusy"
                  required
                >
                <button
                  type="button"
                  class="icon-button"
                  :aria-label="isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="isPasswordVisible"
                  @click="isPasswordVisible = !isPasswordVisible"
                >
                  <EyeOff
                    v-if="isPasswordVisible"
                    :size="18"
                    aria-hidden="true"
                  /><Eye
                    v-else
                    :size="18"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
            <ActionButton
              type="submit"
              variant="primary"
              :is-loading="isBusy"
            >
              <LogIn
                :size="18"
                aria-hidden="true"
              /> Iniciar sesión
            </ActionButton>
          </form>
          <p class="field-help">
            La sesión de la demo dura 8 horas; recargar la página la cierra y borra los datos.
          </p>
          <div class="login-footer login-stage">
            <!-- Marca de la app (ADR-042); arriba, la del despacho. -->
            <ApplicationLogo />
            <span><ApplicationVersion /></span>
          </div>
        </section>
      </div>
      <!-- Banner (ADR-039): mosaico geométrico decorativo; se oculta en contenedores angostos. -->
      <LoginBanner class="login-banner-area" />
    </div>
  </div>
</template>

<style scoped>
.login-screen { min-height: calc(100dvh - var(--demoBannerHeight, 0px)); container-type: inline-size; background: var(--canvasColor); }
.login-layout { min-height: calc(100dvh - var(--demoBannerHeight, 0px)); display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); }
.login-column { display: flex; flex-direction: column; min-width: 0; }
.login-aside { border-bottom: 1px solid var(--borderColor); background: var(--sidebarColor); padding: 12px 48px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px var(--spaceLarge); }
.login-symbol { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--radiusCard); overflow: hidden; background: var(--primaryBackgroundColor); color: var(--primaryTextColor); flex-shrink: 0; }
.login-symbol:has(img) { background: var(--surfaceColor); border: 2px solid var(--borderColor); border-radius: var(--radiusNested); }
.login-symbol img { width: 100%; height: 100%; object-fit: contain; }
.login-claim { font-size: clamp(26px, 3vw, 34px); line-height: 1.05; letter-spacing: -.05em; font-weight: 600; margin: 0; }
.login-claim-line { display: block; }
.login-areas { font-size: 14px; color: var(--mutedTextColor); flex-basis: 100%; }
/* Padding vertical corto: con el aviso de error, todo cabe en una ventana de ~720 px sin barra (2026-10-13). */
.login-panel { padding: 12px 48px; display: flex; flex: 1; flex-direction: column; justify-content: center; max-width: 560px; width: 100%; align-self: center; gap: 10px; }
.login-panel h1 { margin: 0; }
/* Los márgenes globales del lema y de los avisos duplicaban el espacio del flex. */
.login-panel .lede, .login-panel .inline-notice, .login-panel .field-help { margin: 0; }
.login-panel .field-help { font-size: 12px; }
.login-top { display: flex; justify-content: space-between; align-items: center; gap: var(--spaceMedium); }
.login-form { display: grid; gap: 12px; }
.password-field { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.password-field .icon-button { height: var(--controlHeight); width: var(--controlHeight); border: 2px solid var(--borderColor); border-radius: var(--radiusControl); }
.login-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--spaceMedium); border-top: 1px solid var(--borderColor); padding-top: 12px; font-size: 12px; color: var(--mutedTextColor); }
.login-banner-area { min-height: 100%; }
/* Contenedor angosto: el mosaico sobra y el formulario ocupa todo el ancho. */
@container (max-width: 860px) {
  .login-layout { grid-template-columns: minmax(0, 1fr); }
  .login-banner-area { display: none; }
}
@container (max-width: 560px) {
  .login-aside { padding: 24px 16px; gap: var(--spaceMedium); }
  .login-symbol { width: 56px; height: 56px; }
  .login-claim { font-size: 32px; }
  .login-panel { padding: 24px 16px; }
}
</style>
