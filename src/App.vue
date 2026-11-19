<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { gsap } from 'gsap'
import StartupSplash from './shared/components/StartupSplash.vue'
import WarmTooltip from './shared/vueBits/WarmTooltip.vue'
import { WarmTooltipGroup } from './shared/vueBits/WarmTooltipGroup'
import { House, Columns3, IdCard, Wallet, Percent, BadgeCheck, Landmark, Settings2, NotebookPen, BookMarked, Mail, Building2, ShieldCheck, PanelLeftClose, PanelLeftOpen, ArrowUpRight, LogOut, UserRound, Power } from '@lucide/vue'
import ClientsPage from './modules/clients/ClientsPage.vue'
import { hasUnsavedClientDraft } from './modules/clients/clientDraft'
import ConfirmDialog from './shared/components/ConfirmDialog.vue'
import UserAvatar from './shared/components/UserAvatar.vue'
import ActionButton from './shared/components/ActionButton.vue'
import ApplicationVersion from './shared/components/ApplicationVersion.vue'
import { useSessionActivity } from './shared/useSessionActivity'
import NotesPage from './modules/notes/NotesPage.vue'
import FiscalPage from './modules/fiscal/FiscalPage.vue'
import CompliancePage from './modules/opinions/CompliancePage.vue'
import ReconciliationPage from './modules/bankReconciliation/ReconciliationPage.vue'
import SatCatalogsPage from './modules/catalogs/SatCatalogsPage.vue'
import MailPage from './modules/mail/MailPage.vue'
import HomePage from './modules/home/HomePage.vue'
import ConfigurationPage from './modules/settings/ConfigurationPage.vue'
import MovementsPage from './modules/movements/MovementsPage.vue'
import TasksPage from './modules/tasks/TasksPage.vue'
import LoginPage from './modules/workspace/LoginPage.vue'
import SetupPage from './modules/workspace/SetupPage.vue'
import AnimatedBackground from './shared/components/AnimatedBackground.vue'
import PatternBackground from './shared/components/PatternBackground.vue'
import type { CanvasPatternStyle } from './shared/components/backgroundPatterns'
import { applyAccentTokens, deriveAccentPalette } from './shared/styles/accentPalette'
import NotificationRegion from './shared/components/NotificationRegion.vue'
import DitherFocusRing from './shared/components/DitherFocusRing.vue'
import PdfViewer from './shared/components/PdfViewer.vue'
import PasswordConfirmDialog from './shared/components/PasswordConfirmDialog.vue'
import MailComposerHost from './modules/mail/MailComposerHost.vue'
import { effectiveTheme, isRestorablePage, loadPreferences, preferences, updatePreferences } from './modules/settings/localPreferencesState'
import { hasUnsavedNotes } from './modules/notes/notesState'
import { useOfficeBranding } from './modules/branding/officeBrandingState'
import { deviceMode, phase, prepareDeviceAtStartup, startupMessage, refreshWorkspaceAccess, sessionUser, signOut, verifySession, workspaceAccess } from './modules/workspace/sessionState'
import { useNotifications } from './shared/notifications/notificationStore'
import { discardNavigationRequest, navigationRequest } from './shared/navigation/navigationRequests'
import { startSatAutomationWatcher } from './modules/satDownloads/satAutomationWatcher'
import { startSatPortalRecoveryWatcher } from './modules/fiscal/satPortalRecoveryWatcher'
import type { WorkspaceAccess } from '../shared/contracts/workspace'
import type { RestorablePage } from '../shared/contracts/localPreferences'

/**
 * Marco de la aplicación, reorganizado como el sistema original:
 * instalación (una vez) → inicio de sesión → menú del despacho.
 * Menú: Inicio, Tareas, Clientes, Pagos, Fiscal, Cumplimiento, Conciliación y Catálogos SAT; Configuración al pie. La barra superior muestra el
 * despacho, el usuario, Notas y Cerrar sesión (el tema se cambia en Configuración o con Ctrl+Shift+L). Cada sección aparece sólo si el Host concede
 * su permiso a la sesión; las operaciones se vuelven a autorizar en Main o en el Host.
 */
useSessionActivity()
const { notify, dismiss } = useNotifications()
const { branding, refresh } = useOfficeBranding()
/** Contenido central: los avisos se anclan bajo el marco fijo para no tapar la barra superior ni el menú. */
/** Aviso de fin de sesión pendiente; deja de ser cierto en cuanto se vuelve a entrar. */
let sessionEndedNotificationId: number | null = null
const page = ref<RestorablePage>('home')
const pendingPage = ref<RestorablePage | null>(null)
const isSignOutPending = ref(false)
/** Confirmación de "Salir de Fiscenix": Main revisa además los borradores antes de detener el Host. */
const isQuitPending = ref(false)
async function quitApplication(): Promise<void> { isQuitPending.value = false; await window.contapp.quitApplication() }
const isReviewingConnection = ref(false)
let hasRestoredPage = false
const isBackgroundPaused = computed(() => preferences.value.isBackgroundPaused)
/** Fondo elegido (ADR-039): Dither es WebGL (AnimatedBackground); los patrones Canvas 2D van en PatternBackground; "none" no monta nada. */
const canvasPattern = computed<CanvasPatternStyle | null>(() => { const style = preferences.value.backgroundStyle; return style === 'dither' || style === 'none' ? null : style })
const isCollapsed = computed({ get: () => preferences.value.isSidebarCollapsed, set: value => { void updatePreferences({ isSidebarCollapsed: value }) } })
let brandingTimer: ReturnType<typeof setInterval> | undefined
/** Avisos de la descarga automática del SAT (2026-10-11): sólo con sesión en el despacho y el permiso `sat.download`. */
let satAutomationWatcher: ReturnType<typeof startSatAutomationWatcher> | undefined
/** Aviso de recuperación pendiente del portal de CFDI (2026-10-17): "escribe el captcha para recuperarla". */
let satPortalRecoveryWatcher: ReturnType<typeof startSatPortalRecoveryWatcher> | undefined
let sessionTimer: ReturnType<typeof setInterval> | undefined
let isReadingBranding = false

interface NavigationEntry { key: RestorablePage; title: string; icon: typeof House; capability: keyof WorkspaceAccess | null }
const navigationEntries: NavigationEntry[] = [
  { key: 'home', title: 'Inicio', icon: House, capability: null },
  { key: 'tasks', title: 'Tareas', icon: Columns3, capability: 'canReadTasks' },
  { key: 'clients', title: 'Clientes', icon: IdCard, capability: 'canReadClients' },
  { key: 'payments', title: 'Pagos', icon: Wallet, capability: 'canReadMovements' },
  { key: 'fiscal', title: 'Fiscal', icon: Percent, capability: 'canUseXml' },
  // Secciones propias desde el rediseño (antes eran pestañas de Fiscal), como "Cumplimiento" del original.
  { key: 'compliance', title: 'Cumplimiento', icon: BadgeCheck, capability: 'canReadOpinions' },
  { key: 'reconciliation', title: 'Conciliación', icon: Landmark, capability: 'canReadReports' },
  // Catálogos SAT (ADR-032): datos públicos guardados en este equipo; basta la sesión.
  { key: 'catalogs', title: 'Catálogos SAT', icon: BookMarked, capability: null },
  // Correo libre a cualquier dirección (2026-10-18, [[MAIL]]); el Host vuelve a exigir `mail.send` al enviar.
  { key: 'mail', title: 'Correo', icon: Mail, capability: 'canSendMail' }
]
const capabilityByPage: Record<RestorablePage, keyof WorkspaceAccess | null> = { home: null, tasks: 'canReadTasks', clients: 'canReadClients', payments: 'canReadMovements', fiscal: 'canUseXml', compliance: 'canReadOpinions', reconciliation: 'canReadReports', catalogs: null, mail: 'canSendMail', notes: 'canUseNotes', settings: null }
function canOpen(key: RestorablePage): boolean { const capability = capabilityByPage[key]; return capability === null || workspaceAccess.value[capability] }
const visibleEntries = computed(() => navigationEntries.filter(entry => canOpen(entry.key)))
/** Si el Host retira un permiso, la página abierta vuelve a Inicio. */
const currentPage = computed<RestorablePage>(() => canOpen(page.value) ? page.value : 'home')

// Tema (Light/Dark) y color principal (ADR-039) se aplican juntos en <html>: el color elegido se ajusta al tema vigente
// para que se lea bien y sus tokens se escriben en línea, por encima de los valores base de base.css.
watchEffect(() => {
  const root = document.documentElement
  root.dataset.theme = effectiveTheme.value
  applyAccentTokens(root.style, deriveAccentPalette(preferences.value.accentColor)[effectiveTheme.value])
})
watch(currentPage, value => { if (phase.value === 'workspace' && hasRestoredPage && isRestorablePage(value)) void updatePreferences({ lastPage: value }) })
function hasUnsavedWork(): boolean { return hasUnsavedClientDraft.value || hasUnsavedNotes.value }
function navigate(key: RestorablePage): void {
  // Cada clic en el menú vuelve a consultar los permisos: un permiso nuevo o retirado se refleja al navegar.
  void refreshWorkspaceAccess()
  if (key === currentPage.value) return
  if (hasUnsavedClientDraft.value) pendingPage.value = key; else page.value = key
}
/**
 * Avisos que llevan a su elemento (2026-10-10): una solicitud de `navigationRequests` cambia de sección con las mismas
 * reglas que el menú (permisos y ficha sin guardar). La página destino la consume al montarse; si tras montar nadie la
 * reclamó, o la sección no se puede abrir, se descarta para que no se aplique más tarde. Con la confirmación de "Salir sin
 * guardar la ficha" abierta, la solicitud espera a esa decisión.
 */
async function discardUnclaimedNavigation(requestId: number): Promise<void> {
  await nextTick(); await nextTick()
  discardNavigationRequest(requestId)
}
watch(navigationRequest, request => {
  if (!request || phase.value !== 'workspace') return
  if (!canOpen(request.section)) { discardNavigationRequest(request.requestId); return }
  navigate(request.section)
  if (pendingPage.value !== request.section) void discardUnclaimedNavigation(request.requestId)
})
watch(pendingPage, (value, previous) => {
  const request = navigationRequest.value
  if (value === null && previous !== null && request) void discardUnclaimedNavigation(request.requestId)
})
function requestSignOut(): void { if (hasUnsavedWork()) isSignOutPending.value = true; else void confirmSignOut() }
async function confirmSignOut(): Promise<void> {
  isSignOutPending.value = false
  try { await signOut() } catch { notify('Sesión cerrada en este equipo', 'No se pudo confirmar el cierre en el Host; la sesión remota conserva su caducidad.', 'warning') }
}
async function loadBranding(): Promise<void> {
  if (isReadingBranding || phase.value !== 'workspace') return
  isReadingBranding = true
  try { await refresh() } catch { /* Una caída de red conserva la última identidad confirmada, sin caché persistente. */ }
  finally { isReadingBranding = false }
}
/**
 * Animaciones de inicio (rediseño 2026-10-02):
 * - **Arranque:** `StartupSplash` una vez por arranque; se retira cuando terminan la animación y la carga.
 * - **Al iniciar sesión:** barra superior, menú (escalonado) y contenido entran en 0.6 s. Sólo tras el
 *   inicio de sesión, no al navegar entre secciones (eso lo hace `v-motion="'reveal'"` de cada página).
 * Con `prefers-reduced-motion: reduce`, `gsap.matchMedia` no ejecuta nada.
 */
const isSplashDone = ref(false)
const applicationHeader = ref<HTMLElement | null>(null)
let entranceMedia: gsap.MatchMedia | undefined
async function playWorkspaceEntrance(): Promise<void> {
  await nextTick()
  if (!applicationHeader.value) return
  entranceMedia?.revert()
  entranceMedia = gsap.matchMedia()
  entranceMedia.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } })
      .from('.application-header', { y: -14, opacity: 0, duration: .4 })
      .from('.sidebar .navigation-item', { x: -14, opacity: 0, duration: .35, stagger: .04 }, '-=.2')
      .from('main .page-content', { y: 18, opacity: 0, duration: .45 }, '-=.3')
  })
}
function protectDraft(event: BeforeUnloadEvent): void { if (hasUnsavedWork()) { event.preventDefault(); event.returnValue = '' } }

/**
 * Al entrar al despacho se restaura la última página si la sesión todavía puede abrirla y se retira el
 * aviso "Sesión terminada", que sólo describe la pantalla de acceso.
 */
watch(phase, (value, previous) => {
  if (value === 'workspace' && previous === 'login') void playWorkspaceEntrance()
  if (value === 'workspace') {
    const saved = preferences.value.lastPage
    page.value = saved && canOpen(saved) ? saved : 'home'
    hasRestoredPage = true
    if (sessionEndedNotificationId !== null) { dismiss(sessionEndedNotificationId); sessionEndedNotificationId = null }
    void loadBranding()
    void satAutomationWatcher?.checkNow()
  } else hasRestoredPage = false
  if (previous === 'workspace' && value === 'login') sessionEndedNotificationId = notify('Sesión terminada', 'Vuelve a iniciar sesión para continuar.', 'info')
  if (value !== 'setup') isReviewingConnection.value = false
})
/** Consulta de fondo cada 15 s (no prolonga la sesión) y permisos cada minuto. */
let tick = 0
async function watchSession(): Promise<void> {
  if (phase.value !== 'workspace') return
  if (await verifySession() && ++tick % 4 === 0) await refreshWorkspaceAccess()
}
/**
 * Tema sin botón en la barra (2026-10-06, pedido del usuario): se elige en Configuración › Preferencias o con
 * Ctrl+Shift+L, que alterna entre claro y oscuro (como el botón que había). Login e instalación conservan su botón.
 */
function toggleThemeShortcut(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'l' || event.repeat) return
  event.preventDefault()
  void updatePreferences({ theme: effectiveTheme.value === 'dark' ? 'light' : 'dark' })
}
onMounted(async () => {
  window.addEventListener('beforeunload', protectDraft)
  window.addEventListener('keydown', toggleThemeShortcut)
  await loadPreferences()
  await prepareDeviceAtStartup()
  brandingTimer = setInterval(() => { void loadBranding() }, 5000)
  sessionTimer = setInterval(() => { void watchSession() }, 15000)
  satAutomationWatcher = startSatAutomationWatcher({ canWatch: () => phase.value === 'workspace' && workspaceAccess.value.canDownloadSat, notify })
  void satAutomationWatcher.checkNow()
  satPortalRecoveryWatcher = startSatPortalRecoveryWatcher({ canWatch: () => phase.value === 'workspace' && workspaceAccess.value.canDownloadSat, notify })
})
onBeforeUnmount(() => { entranceMedia?.revert(); satAutomationWatcher?.stop(); satPortalRecoveryWatcher?.stop(); clearInterval(brandingTimer); clearInterval(sessionTimer); window.removeEventListener('beforeunload', protectDraft); window.removeEventListener('keydown', toggleThemeShortcut) })
</script>
<template>
  <AnimatedBackground
    v-if="preferences.backgroundStyle === 'dither'"
    :is-paused="isBackgroundPaused"
  />
  <PatternBackground
    v-else-if="canvasPattern"
    :pattern="canvasPattern"
    :is-paused="isBackgroundPaused"
  />
  <a
    class="skip-link"
    href="#main-content"
  >Saltar al contenido</a>
  <Transition name="splash">
    <StartupSplash
      v-if="phase === 'loading' || !isSplashDone"
      :status="startupMessage"
      @done="isSplashDone = true"
    />
  </Transition>
  <!-- Un solo grupo de tooltips (Warm Tooltip, Vue Bits) para toda la aplicación: la etiqueta se desliza entre botones vecinos. -->
  <WarmTooltipGroup>
    <template v-if="phase === 'loading'" />
    <SetupPage
      v-else-if="phase === 'setup' || isReviewingConnection"
      :is-reviewing="isReviewingConnection && phase === 'login'"
      @back="isReviewingConnection = false"
    />
    <LoginPage
      v-else-if="phase === 'login'"
      @review-connection="isReviewingConnection = true"
    />
    <div
      v-else
      class="application-shell"
      :class="{ 'sidebar-collapsed': isCollapsed }"
    >
      <ConfirmDialog
        :is-open="pendingPage !== null"
        title="Salir sin guardar la ficha"
        @close="pendingPage = null"
        @confirm="page = pendingPage ?? page; pendingPage = null"
      >
        <p>Los cambios de esta ficha se descartarán.</p>
      </ConfirmDialog>
      <!-- Salir de verdad (2026-10-04): cerrar la ventana sólo la oculta si el Host sigue en segundo plano. -->
      <ConfirmDialog
        :is-open="isQuitPending"
        title="Salir de Fiscenix"
        confirm-label="Salir"
        @close="isQuitPending = false"
        @confirm="quitApplication"
      >
        <p v-if="deviceMode === 'host'">
          Se cerrará Fiscenix y se detendrá el Host: los demás equipos dejarán de conectarse hasta que vuelvas a abrirlo.
        </p>
        <p v-else>
          Se cerrará Fiscenix en este equipo.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        :is-open="isSignOutPending"
        title="Cerrar sesión con cambios sin guardar"
        @close="isSignOutPending = false"
        @confirm="confirmSignOut"
      >
        <p>Hay una ficha o una nota sin guardar. Cerrar sesión la descartará.</p>
      </ConfirmDialog>
      <header
        ref="applicationHeader"
        class="application-header"
      >
        <div class="brand-identity">
          <span class="brand-symbol"><img
            v-if="branding.logoDataUrl"
            :src="branding.logoDataUrl"
            alt="Logo del despacho"
          ><Building2
            v-else
            :size="25"
            aria-hidden="true"
          /></span>
          <div><strong class="wordmark">{{ branding.officeName }}</strong><span class="brand-caption">ADMINISTRACIÓN DEL DESPACHO</span></div>
        </div>
        <div class="header-actions">
          <span class="connection-label"><ShieldCheck
            :size="15"
            aria-hidden="true"
          /> {{ deviceMode === 'host' ? 'Equipo Host' : 'Equipo Cliente' }}</span>
          <span
            class="user-label"
            data-testid="session-user"
          ><UserAvatar
            v-if="sessionUser"
            :user-id="sessionUser.userId"
            :display-name="sessionUser.displayName"
            size="small"
            is-decorative
          /><UserRound
            v-else
            :size="16"
            aria-hidden="true"
          /> {{ sessionUser?.displayName }}</span>
          <WarmTooltip
            v-if="workspaceAccess.canUseNotes"
            content="Notas de este equipo"
            side="bottom"
          >
            <ActionButton
              :aria-pressed="currentPage === 'notes'"
              aria-label="Notas"
              @click="navigate('notes')"
            >
              <NotebookPen
                :size="18"
                aria-hidden="true"
              /><span class="header-copy">Notas</span>
            </ActionButton>
          </WarmTooltip>
          <!-- En ventanas estrechas sólo queda el icono: el nombre accesible no depende del texto visible. -->
          <WarmTooltip
            content="Cerrar sesión en este equipo"
            side="bottom"
          >
            <ActionButton
              variant="danger"
              aria-label="Cerrar sesión"
              @click="requestSignOut"
            >
              <LogOut
                :size="18"
                aria-hidden="true"
              /><span class="header-copy">Cerrar sesión</span>
            </ActionButton>
          </WarmTooltip>
          <WarmTooltip
            :content="deviceMode === 'host' ? 'Salir de Fiscenix y detener el Host' : 'Salir de Fiscenix'"
            side="bottom"
          >
            <ActionButton
              aria-label="Salir de Fiscenix"
              @click="isQuitPending = true"
            >
              <Power
                :size="18"
                aria-hidden="true"
              />
            </ActionButton>
          </WarmTooltip>
        </div>
      </header>
      <div class="workspace-layout">
        <nav
          class="sidebar"
          aria-label="Navegación principal"
        >
          <div class="sidebar-heading">
            <p class="eyebrow sidebar-copy">
              DESPACHO
            </p><button
              class="icon-button collapse-toggle"
              :aria-label="isCollapsed ? 'Expandir navegación' : 'Contraer navegación'"
              :aria-expanded="!isCollapsed"
              @click="isCollapsed = !isCollapsed"
            >
              <PanelLeftOpen
                v-if="isCollapsed"
                :size="19"
                aria-hidden="true"
              /><PanelLeftClose
                v-else
                :size="19"
                aria-hidden="true"
              />
            </button>
          </div>
          <!-- Con el menú contraído sólo quedan iconos: el tooltip nombra cada sección (y se desliza entre ellas). -->
          <WarmTooltip
            v-for="item in visibleEntries"
            :key="item.key"
            class="navigation-tooltip"
            :content="item.title"
            side="right"
            :is-disabled="!isCollapsed"
          >
            <button
              class="navigation-item"
              :aria-label="item.title"
              :aria-current="currentPage === item.key ? 'page' : undefined"
              @click="navigate(item.key)"
            >
              <component
                :is="item.icon"
                :size="21"
                aria-hidden="true"
              /><span class="sidebar-copy">{{ item.title }}</span><ArrowUpRight
                v-if="currentPage === item.key"
                :size="15"
                class="nav-arrow sidebar-copy"
                aria-hidden="true"
              />
            </button>
          </WarmTooltip>
          <div class="sidebar-bottom">
            <WarmTooltip
              class="navigation-tooltip"
              content="Configuración"
              side="right"
              :is-disabled="!isCollapsed"
            >
              <button
                class="navigation-item"
                aria-label="Configuración"
                :aria-current="currentPage === 'settings' ? 'page' : undefined"
                @click="navigate('settings')"
              >
                <Settings2
                  :size="21"
                  aria-hidden="true"
                /><span class="sidebar-copy">Configuración</span>
              </button>
            </WarmTooltip>
          </div>
        </nav>
        <main
          id="main-content"
          tabindex="-1"
        >
          <div
            :key="currentPage"
            v-motion="'reveal'"
            class="page-content"
          >
            <HomePage
              v-if="currentPage === 'home'"
              @navigate="navigate($event as RestorablePage)"
            />
            <TasksPage v-else-if="currentPage === 'tasks'" />
            <ClientsPage v-else-if="currentPage === 'clients'" />
            <MovementsPage v-else-if="currentPage === 'payments'" />
            <FiscalPage v-else-if="currentPage === 'fiscal'" />
            <CompliancePage v-else-if="currentPage === 'compliance'" />
            <ReconciliationPage v-else-if="currentPage === 'reconciliation'" />
            <SatCatalogsPage v-else-if="currentPage === 'catalogs'" />
            <MailPage v-else-if="currentPage === 'mail'" />
            <NotesPage v-else-if="currentPage === 'notes'" />
            <ConfigurationPage v-else />
          </div>
        </main>
      </div>
      <footer><ApplicationVersion /><span>Fiscenix / Administración del despacho</span></footer>
    </div>
  </WarmTooltipGroup>
  <NotificationRegion />
  <DitherFocusRing />
  <!-- Visor de PDF de Fiscenix (2026-10-06): uno solo para toda la app; lo abren Fiscal, Reportes y Tareas. -->
  <PdfViewer />
  <!-- Confirmación de operaciones sensibles (ADR-038): un solo diálogo para toda la aplicación. -->
  <PasswordConfirmDialog />
  <!-- Redactor de correo a clientes (2026-10-17): uno solo; se monta sólo con sesión y permiso. -->
  <MailComposerHost v-if="phase === 'workspace' && workspaceAccess.canSendMail" />
</template>
