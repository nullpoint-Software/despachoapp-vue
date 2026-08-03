import { computed, onMounted, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { useRouter } from "vue-router";
import { resolveUserAvatar } from "@/constants/brandAssets";
import { ADMIN_NAVIGATION_ITEMS } from "@/constants/adminNavigation";
import { useMobileDetection } from "@/composables/useMobileDetection";
import { useNotesStore } from "@/composables/useNotesStore";
import { authService } from "@/service/adminApp/client";
import { logger } from "@/utils/logger";

function getProfilePicture(): string {
  const storedPhoto = localStorage.getItem("userphoto");
  return resolveUserAvatar(storedPhoto);
}

export function useAdminLayout() {
  const router = useRouter();
  const { isMobile } = useMobileDetection();
  const { togglePinnedWindow } = useNotesStore();
  const isMenuOpen = ref(false);
  const isMoreMenuOpen = ref(false);
  const isLogsModalOpen = ref(false);
  const isNotesModalOpen = ref(false);
  const logsRenderKey = ref(0);
  const profileName = localStorage.getItem("fullname") || "Usuario";
  const profileType = localStorage.getItem("level") || "Nivel";
  const profilePicture = getProfilePicture();
  const isAdmin = profileType === "Administrador";
  const navigationItems = ADMIN_NAVIGATION_ITEMS;
  const primaryNavigationItems = computed(() => navigationItems.slice(0, 3));
  const secondaryNavigationItems = computed(() => navigationItems.slice(3));
  const toggleMenu = () => (isMenuOpen.value = !isMenuOpen.value);
  const toggleMoreMenu = () => (isMoreMenuOpen.value = !isMoreMenuOpen.value);
  const closeMoreMenu = () => (isMoreMenuOpen.value = false);
  const openNotes = () => (isNotesModalOpen.value = true);
  const closeNotes = () => (isNotesModalOpen.value = false);
  const openLogs = () => (isLogsModalOpen.value = true);
  const closeLogs = () => (isLogsModalOpen.value = false);

  function syncOverlayTopOffset(): void {
    document.documentElement.style.setProperty("--admin-overlay-top", isMobile.value ? "0px" : "5rem");
  }

  function openNotesFromMoreMenu(): void { openNotes(); closeMoreMenu(); }
  function openLogsFromMoreMenu(): void { openLogs(); closeMoreMenu(); }
  function logout(): void { closeMoreMenu(); localStorage.clear(); void router.push("/"); }

  useEventListener(document, "keydown", (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isEditableTarget = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (event.key !== "/" || isEditableTarget) return;
    event.preventDefault();
    togglePinnedWindow();
  });
  watch(isLogsModalOpen, (isOpen) => { if (isOpen) logsRenderKey.value += 1; });
  watch(isMobile, syncOverlayTopOffset);
  onMounted(async () => {
    syncOverlayTopOffset();
    try {
      await authService.checkAuthRedirect(Boolean(localStorage.getItem("token")));
    } catch (error) {
      logger.error("No fue posible verificar la sesión", error);
      await router.push("/login");
    }
  });

  return { closeLogs, closeNotes, isAdmin, isLogsModalOpen, isMenuOpen, isMobile, isMoreMenuOpen, isNotesModalOpen, logsRenderKey, logout, navigationItems, openLogs, openLogsFromMoreMenu, openNotes, openNotesFromMoreMenu, primaryNavigationItems, profileName, profilePicture, profileType, secondaryNavigationItems, toggleMenu, toggleMoreMenu };
}
