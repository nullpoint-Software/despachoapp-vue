<template>
  <nav
    class="flex justify-between items-center p-4 shadow-lg z-50 bg-[var(--color-bg-secondary)] text-[var(--color-text)] fixed w-full border-b border-[var(--color-border)]"
  >
    <div class="flex items-center space-x-2">
      <button
        @click="$emit('toggleMenu')"
        class="lg:hidden text-[var(--color-text)] text-2xl ml-4 cursor-pointer"
        aria-label="Abrir menú"
      >
        <i class="pi pi-bars"></i>
      </button>
      <img
        src="@/assets/img/logsymbolwhite.png"
        alt="Logo de la Empresa"
        class="w-20 lg:w-20 cursor-pointer"
        @click="window.scrollTo({ top: 0, behavior: 'smooth' })"
      />
    </div>

    <div class="hidden lg:flex space-x-4 items-center mr-4">
      <router-link to="/app/settings" class="userInfo flex space-x-3 place-items-center cursor-pointer">
          <Avatar
            v-tooltip.bottom="profileName"
            :image="profilePicture"
            shape="circle"
          />
          <div class="flex flex-col">
            <span class="font-bold">{{ profileName }}</span>
            <span class="text-xs text-[var(--color-text-muted)]">{{
              profileType
            }}</span>
          </div>
      </router-link>

      <Divider
        layout="vertical"
        class="!before:border-[var(--color-border)]"
      />

      <Button
        icon="pi pi-book"
        class="p-button-rounded border-none text-white bg-[var(--obj-important-3)] hover:opacity-90"
        @click="$emit('openNotes')"
        aria-label="Abrir Tablero de Notas"
      />
      <Button
        v-if="isAdmin"
        icon="pi pi-list"
        class="p-button-rounded border-none text-white bg-[var(--obj-important-2)] hover:opacity-90"
        @click="$emit('openLogs')"
        aria-label="Ver Registros de Cambios"
      />

      <Button
        label="Cerrar sesión"
        icon="pi pi-sign-out"
        @click="$emit('logout')"
        class="flex-auto cursor-pointer border-none rounded-md px-3 py-2 bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] hover:bg-[var(--btn-danger-hover-bg)]"
      />
    </div>
  </nav>
</template>

<script setup>
import { useRouter } from 'vue-router';
import Avatar from "primevue/avatar";
import Divider from "primevue/divider";
import Button from "primevue/button";

const router = useRouter();

defineProps({
  profileName: String,
  profilePicture: String,
  profileType: String,
  isAdmin: Boolean,
});

defineEmits(['toggleMenu', 'openNotes', 'openLogs', 'logout']);
</script>