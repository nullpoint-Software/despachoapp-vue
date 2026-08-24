import { ref, watch, onMounted, computed, Suspense } from 'vue'
import { RouterView, useRouter } from 'vue-router'
// import { useEventListener } from "@vueuse/core";
import { USER_AVATAR_PLACEHOLDER as defaultprofilePicture } from '@/constants/brandAssets'
import { useMobileDetection } from '@/composables/useMobileDetection.ts'
import { useNotesStore } from '@/composables/useNotesStore.ts'
import { as } from '@/service/adminApp/client'
import { useEventListener } from '@vueuse/core'

interface MenuItem {
  name: string
  path: string
  icon: string
}

const { isMobile } = useMobileDetection()
const { togglePinnedWindow } = useNotesStore()
const router = useRouter()

const menuOpen = ref<boolean>(false)
const toggleMenu = () => (menuOpen.value = !menuOpen.value)

const isMoreMenuOpen = ref<boolean>(false)
const toggleMoreMenu = () => (isMoreMenuOpen.value = !isMoreMenuOpen.value)
const closeMoreMenu = () => (isMoreMenuOpen.value = false)

const showLogs = ref<boolean>(false)
const logsKey = ref<number>(0)
const showNotesModal = ref<boolean>(false)
const ProfileName = ref<string>(localStorage.getItem('fullname') || 'Usuario')
const ProfileType = ref<string>(localStorage.getItem('level') || 'Nivel')
const isAdmin = ref<boolean>(localStorage.getItem('level') === 'Administrador')
const storedPhoto = localStorage.getItem('userphoto')
const profilePicture = ref<string>(
  storedPhoto && storedPhoto !== 'data:image/png;base64,null' ? storedPhoto : defaultprofilePicture
)

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (
    e.key === '/' &&
    (e.target as HTMLElement).tagName !== 'INPUT' &&
    (e.target as HTMLElement).tagName !== 'TEXTAREA'
  ) {
    e.preventDefault()
    togglePinnedWindow()
  }
})

watch(showLogs, (val) => {
  if (val) logsKey.value++
})

const menuItems = ref<MenuItem[]>([
  { name: 'Inicio', path: '/app/inicio', icon: 'pi pi-home' },
  { name: 'Tareas', path: '/app/tareas', icon: 'pi pi-th-large' },
  { name: 'Clientes', path: '/app/clientes', icon: 'pi pi-id-card' },
  { name: 'Pagos', path: '/app/pagos', icon: 'pi pi-wallet' },
  { name: 'Fiscal', path: '/app/fiscal', icon: 'pi pi-percentage' },
  { name: 'Códigos SAT', path: '/app/catalogos-sat', icon: 'pi pi-search' },
  { name: 'Cumplimiento', path: '/app/cumplimiento', icon: 'pi pi-verified' }
])

const mainNavItems = computed(() => menuItems.value.slice(0, 3))
const moreNavItems = computed(() => menuItems.value.slice(3))

const openNotesAndClose = () => {
  openNotesModal()
  closeMoreMenu()
}

const openLogsAndClose = () => {
  openLogs()
  closeMoreMenu()
}

onMounted(async () => {
  try {
    const isAuthenticated = !!localStorage.getItem('token')
    await as.checkAuthRedirect(isAuthenticated)
  } catch (error) {
    console.error('Auth check failed:', error)
    router.push('/login')
  }
})

const logOut = () => {
  closeMoreMenu()
  localStorage.clear()
  router.push('/')
}

const openNotesModal = () => (showNotesModal.value = true)
const closeNotesModal = () => (showNotesModal.value = false)
const openLogs = () => (showLogs.value = true)
const closeLogs = () => (showLogs.value = false)
