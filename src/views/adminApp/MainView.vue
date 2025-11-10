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
        class="fixed bottom-0 left-0 w-full pt-3 pb-8 bg-[var(--color-bg-secondary)] rounded-t-2xl z-50"
      >
        <div class="px-4">
          <h3 class="text-lg font-bold mb-4">Más Opciones</h3>
          <ul>
            <li v-for="item in moreNavItems" :key="item.name">
              <RouterLink
                :to="item.path"
                @click="toggleMoreMenu"
                class="flex items-center space-x-4 py-3 text-lg"
              >
                <i :class="item.icon"></i>
                <span>{{ item.name }}</span>
              </RouterLink>
            </li>
            <li>
              <a
                @click="openNotesAndClose"
                class="flex items-center space-x-4 py-3 text-lg cursor-pointer"
              >
                <i class="pi pi-book"></i>
                <span>Notas</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showNotesModal"
        class="modal-overlay fixed inset-0 z-50"
        @click.self="closeNotesModal"
      >
        <div
          class="modal-content relative bg-[var(--color-bg)] p-4 rounded-lg shadow-2xl border border-[var(--color-border)] max-w-4xl w-full mx-4"
        >
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
]);

const mainNavItems = computed(() => menuItems.value.slice(0, 3));
const moreNavItems = computed(() => menuItems.value.slice(3));

const openNotesAndClose = () => {
  openNotesModal();
  toggleMoreMenu();
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
  localStorage.clear();
  router.push("/");
};

const openNotesModal = () => (showNotesModal.value = true);
const closeNotesModal = () => (showNotesModal.value = false);
const openLogs = () => (showLogs.value = true);
const closeLogs = () => (showLogs.value = false);
</script>
