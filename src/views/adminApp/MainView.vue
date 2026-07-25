<template>
  <div
    class="h-auto min-h-full w-full bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col"
  >
    <GridBackground />
    <PinnedNotesWindow />

    <template v-if="!isMobile">
      <TopNavbar
        :profile-name="ProfileName"
        :profile-picture="profilePicture"
        :profile-type="ProfileType"
        :is-admin="isAdmin"
        :notes-active="showNotesModal"
        :logs-active="showLogs"
        @toggle-menu="toggleMenu"
        @open-notes="openNotesModal"
        @open-logs="openLogs"
        @logout="logOut"
      />
      <DesktopSidebar :menu-items="menuItems" />
      <MobileSidebar
        :is-open="menuOpen"
        :profile-name="ProfileName"
        :profile-picture="profilePicture"
        :profile-type="ProfileType"
        :menu-items="menuItems"
        @close-menu="toggleMenu"
        @logout="logOut"
      />
    </template>

    <div class="relative">
      <div>
        <main
          class="z-30 w-full h-full"
          :class="{ 'pb-16': isMobile, 'lg:pl-20': !isMobile }"
        >
          <Suspense>
            <template #default>
              <RouterView class="p-4 lg:p-6" :class="{ 'mt-16': !isMobile }" />
            </template>
            <template #fallback>
              <Loader />
            </template>
          </Suspense>
        </main>
      </div>
      <div>
        <MobileBottomNav
          v-if="isMobile"
          :menu-items="mainNavItems"
          @open-more-menu="toggleMoreMenu"
        />
      </div>
    </div>

    <transition name="slide-up">
      <div
        v-if="isMobile && isMoreMenuOpen"
        class="mobile-more-simple fixed bottom-0 left-0 w-full pt-3 pb-8 bg-[var(--color-bg-secondary)] rounded-t-2xl z-50"
      >
        <div class="px-4">
          <header class="mobile-more-header">
            <div class="mobile-more-profile">
              <img :src="profilePicture" alt="" />
              <div>
                <strong>{{ ProfileName }}</strong>
                <span>{{ ProfileType }}</span>
              </div>
            </div>
            <button type="button" aria-label="Cerrar menú" @click="closeMoreMenu">×</button>
          </header>
          <h3 class="text-lg font-bold mb-4">Más Opciones</h3>
          <ul class="mobile-more-list">
            <li v-for="item in moreNavItems" :key="item.name">
              <RouterLink
                :to="item.path"
                @click="closeMoreMenu"
                class="flex items-center space-x-4 py-3 text-lg"
              >
                <i :class="item.icon"></i>
                <span>{{ item.name }}</span>
              </RouterLink>
            </li>
            <li>
              <button
                @click="openNotesAndClose"
                class="flex items-center space-x-4 py-3 text-lg cursor-pointer"
              >
                <i class="pi pi-book"></i>
                <span>Notas</span>
              </button>
            </li>
            <li v-if="isAdmin">
              <button
                @click="openLogsAndClose"
                class="flex items-center space-x-4 py-3 text-lg cursor-pointer"
              >
                <i class="pi pi-list"></i>
                <span>Registros</span>
              </button>
            </li>
            <li>
              <RouterLink to="/app/settings" @click="closeMoreMenu" class="flex items-center space-x-4 py-3 text-lg">
                <i class="pi pi-user"></i>
                <span>Cuenta</span>
              </RouterLink>
            </li>
            <li>
              <button class="flex items-center space-x-4 py-3 text-lg cursor-pointer text-[var(--btn-danger-bg)]" @click="logOut">
                <i class="pi pi-sign-out"></i>
                <span>Cerrar sesión</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showNotesModal"
        class="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeNotesModal"
      >
        <div class="notes-modal-frame">
          <button class="notes-modal-close" type="button" aria-label="Cerrar notas" @click="closeNotesModal">×</button>
          <Suspense>
            <BoardNote />
          </Suspense>
        </div>
      </div>
    </transition>
    <Suspense>
      <LogsModal :key="logsKey" :visible="showLogs" @close="closeLogs" />
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, Suspense } from "vue";
import { RouterView, useRouter } from "vue-router";
// import { useEventListener } from "@vueuse/core";
import defaultprofilePicture from "@/assets/img/user.jpg";
import { useMobileDetection } from "@/composables/useMobileDetection.ts";
import { useNotesStore } from "@/composables/useNotesStore.ts";
import TopNavbar from "@/components/adminApp/Menus/TopNavbar.vue";
import DesktopSidebar from "@/components/adminApp/Menus/DesktopSidebar.vue";
import MobileSidebar from "@/components/adminApp/Menus/MobileSidebar.vue";
import MobileBottomNav from "@/components/adminApp/Menus/MobileBottomNav.vue";
import GridBackground from "@/components/adminApp/Menus/GridBackground.vue";
import Loader from "@/components/adminApp/Menus/Loader.vue";
import PinnedNotesWindow from "@/components/adminApp/Menus/PinnedNotesWindow.vue";
import BoardNote from "@/components/notes/BoardNote.vue";
import LogsModal from "@/components/adminApp/EventTracker/LogsModal.vue";
import { as } from "@/service/adminApp/client";
import { useEventListener } from "@vueuse/core";

interface MenuItem {
  name: string;
  path: string;
  icon: string;
}

const { isMobile } = useMobileDetection();
const { togglePinnedWindow } = useNotesStore();
const router = useRouter();

const menuOpen = ref<boolean>(false);
const toggleMenu = () => (menuOpen.value = !menuOpen.value);

const isMoreMenuOpen = ref<boolean>(false);
const toggleMoreMenu = () => (isMoreMenuOpen.value = !isMoreMenuOpen.value);
const closeMoreMenu = () => (isMoreMenuOpen.value = false);

const showLogs = ref<boolean>(false);
const logsKey = ref<number>(0);
const showNotesModal = ref<boolean>(false);
const ProfileName = ref<string>(localStorage.getItem("fullname") || "Usuario");
const ProfileType = ref<string>(localStorage.getItem("level") || "Nivel");
const isAdmin = ref<boolean>(localStorage.getItem("level") === "Administrador");
const storedPhoto = localStorage.getItem("userphoto");
const profilePicture = ref<string>(
  storedPhoto && storedPhoto !== "data:image/png;base64,null"
    ? storedPhoto
    : defaultprofilePicture
);

useEventListener(document, "keydown", (e: KeyboardEvent) => {
  if (
    e.key === "/" &&
    (e.target as HTMLElement).tagName !== "INPUT" &&
    (e.target as HTMLElement).tagName !== "TEXTAREA"
  ) {
    e.preventDefault();
    togglePinnedWindow();
  }
});

watch(showLogs, (val) => {
  if (val) logsKey.value++;
});

const menuItems = ref<MenuItem[]>([
  { name: "Inicio", path: "/app/inicio", icon: "pi pi-home" },
  { name: "Tareas", path: "/app/tareas", icon: "pi pi-th-large" },
  { name: "Clientes", path: "/app/clientes", icon: "pi pi-id-card" },
  { name: "Pagos", path: "/app/pagos", icon: "pi pi-wallet" },
  { name: "Fiscal", path: "/app/fiscal", icon: "pi pi-percentage" },
  { name: "Cumplimiento", path: "/app/cumplimiento", icon: "pi pi-verified" },
]);

const mainNavItems = computed(() => menuItems.value.slice(0, 3));
const moreNavItems = computed(() => menuItems.value.slice(3));

const openNotesAndClose = () => {
  openNotesModal();
  closeMoreMenu();
};

const openLogsAndClose = () => {
  openLogs();
  closeMoreMenu();
};

onMounted(async () => {
  try {
    const isAuthenticated = !!localStorage.getItem("token");
    await as.checkAuthRedirect(isAuthenticated);
  } catch (error) {
    console.error("Auth check failed:", error);
    router.push("/login");
  }
});

const logOut = () => {
  closeMoreMenu();
  localStorage.clear();
  router.push("/");
};

const openNotesModal = () => (showNotesModal.value = true);
const closeNotesModal = () => (showNotesModal.value = false);
const openLogs = () => (showLogs.value = true);
const closeLogs = () => (showLogs.value = false);
</script>
<style scoped>
	.notes-modal-frame{position:relative;width:min(96rem,calc(100vw - 3rem));height:calc(100vh - 5rem);min-width:0;overflow:hidden;border:2px solid var(--br-control);background:var(--br-bg);box-shadow:12px 12px 0 var(--br-accent)}.notes-modal-close{position:absolute;right:0;top:0;z-index:80;width:3.2rem;height:3.2rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);background:var(--br-accent);color:var(--br-accent-text);font-size:1.8rem;cursor:pointer}.notes-modal-frame :deep(.notes-directory){box-sizing:border-box;width:100%;height:100%;min-width:0;min-height:0;padding:1rem;overflow:hidden}.notes-modal-frame :deep(.directory-layout){min-width:0}.notes-modal-frame :deep(.tree-panel),.notes-modal-frame :deep(.directory-content){min-width:0}@media(max-width:800px){.modal-overlay{align-items:stretch!important;justify-content:stretch!important;padding:0!important}.notes-modal-frame{width:100vw;height:100dvh;border:0;box-shadow:none}.notes-modal-frame :deep(.notes-directory){padding:.35rem;overflow:auto}}
	.notes-modal-close{right:.65rem;top:.65rem;display:grid;width:2.5rem;height:2.5rem;place-items:center;border:1px solid var(--br-control);background:var(--br-accent);padding:0;font:400 1.45rem/1 Arial;transition:transform .18s ease,filter .18s ease}.notes-modal-close:hover{filter:brightness(1.12)}.notes-modal-close:active{transform:translateY(1px)}
  .mobile-more-simple{max-height:min(78dvh,34rem);overflow:auto;padding-bottom:calc(2rem + env(safe-area-inset-bottom))}.mobile-more-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem;border-bottom:1px solid var(--color-border);padding-bottom:.85rem}.mobile-more-profile{display:flex;min-width:0;align-items:center;gap:.7rem}.mobile-more-profile img{width:2.5rem;height:2.5rem;flex:0 0 auto;border:1px solid var(--color-border);border-radius:50%;object-fit:cover}.mobile-more-profile strong,.mobile-more-profile span{display:block;overflow:hidden;max-width:15rem;text-overflow:ellipsis;white-space:nowrap}.mobile-more-profile strong{font-weight:800}.mobile-more-profile span{color:var(--color-text-muted);font-size:.75rem}.mobile-more-header>button{display:grid;width:2.25rem;height:2.25rem;place-items:center;border:1px solid var(--color-border);border-radius:.45rem;background:transparent;color:var(--color-text);font-size:1.3rem;line-height:1}.mobile-more-list{margin:0;padding:0;list-style:none}.mobile-more-list button{width:100%;border:0;background:transparent;color:inherit;text-align:left}.mobile-more-list a,.mobile-more-list button{min-height:3rem}.mobile-more-list i{width:1.5rem;text-align:center}
	</style>
