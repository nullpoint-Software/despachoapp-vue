<template>
  <nav
    class="flex justify-between items-center p-4 z-50 bg-[var(--color-bg-secondary)] text-[var(--color-text)] fixed w-full border-b border-[var(--color-border)]"
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
      <router-link to="/app/settings" class="nav-item userInfo flex space-x-3 place-items-center cursor-pointer">
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

      <PaletteSelector />
      <Divider
        layout="vertical"
        class="!before:border-[var(--color-border)]"
      />

      <Button
        icon="pi pi-book"
        class="nav-item p-button-rounded border-none text-white bg-[var(--obj-important-3)] hover:opacity-90"
        :class="{ 'is-selected': notesActive }"
        :aria-pressed="notesActive"
        @click="$emit('openNotes')"
        aria-label="Abrir Tablero de Notas"
      />
      <Button
        v-if="isAdmin"
        icon="pi pi-list"
        class="nav-item p-button-rounded border-none text-white bg-[var(--obj-important-2)] hover:opacity-90"
        :class="{ 'is-selected': logsActive }"
        :aria-pressed="logsActive"
        @click="$emit('openLogs')"
        aria-label="Ver Registros de Cambios"
      />

      <Button
        label="Cerrar sesión"
        icon="pi pi-sign-out"
        @click="$emit('logout')"
        class="nav-item flex-auto cursor-pointer border-none rounded-md px-3 py-2 bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] hover:bg-[var(--btn-danger-hover-bg)]"
      />
    </div>
  </nav>
</template>

<script setup>
import { useRouter } from 'vue-router';
import Avatar from "@/components/ui/AppAvatar.vue";
import Divider from "@/components/ui/AppDivider.vue";
import Button from "@/components/ui/AppButton.vue";
import PaletteSelector from "@/components/ui/PaletteSelector.vue";

const router = useRouter();

defineProps({
  profileName: String,
  profilePicture: String,
  profileType: String,
  isAdmin: Boolean,
  notesActive: Boolean,
  logsActive: Boolean,
});

defineEmits(['toggleMenu', 'openNotes', 'openLogs', 'logout']);
</script>

<style scoped>
.nav-item{transition:box-shadow .18s ease,transform .18s ease,background-color .18s ease}
.nav-item.router-link-active,.nav-item.is-selected{box-shadow:none!important}
.nav-item:hover{box-shadow:5px 5px 0 var(--br-control)!important;transform:translate(-1px,-1px)}
.nav-item:active{box-shadow:2px 2px 0 var(--br-control)!important;transform:translate(1px,1px)}
</style>
