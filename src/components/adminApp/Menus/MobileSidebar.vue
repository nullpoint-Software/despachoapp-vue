<template>
  <transition name="slide-fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 lg:hidden"
      @click.self="$emit('closeMenu')"
    >
      <div
        class="w-64 h-full bg-[var(--color-bg-secondary)] text-[var(--color-text)] p-4 border-r border-[var(--color-border)]"
        @click.stop
      >
        <div class="flex items-start">
          <div class="flex flex-col mt-1">
            <Avatar :image="profilePicture" shape="circle" />
          </div>
          <div class="flex flex-col ml-3">
            <span class="font-bold">{{ profileName }}</span>
            <span class="text-xs text-[var(--color-text-muted)]">{{
              profileType
            }}</span>
          </div>
        </div>
        <Divider class="!before:border-[var(--color-border)] my-4" />
        <ul class="mt-4">
          <li v-for="item in menuItems" :key="item.name" @click="$emit('closeMenu')">
            <router-link
              :to="item.path"
              class="flex items-center space-x-3 w-full p-2 rounded-md hover:bg-[var(--btn-secondary-hover-bg)]"
            >
              <i :class="item.icon"></i>
              <span>{{ item.name }}</span>
            </router-link>
          </li>
        </ul>
        <div class="flex flex-col space-y-4 mt-8" @click="$emit('closeMenu')">
          <router-link to="/app/settings">
            <Button
              label="Cuenta"
              icon="pi pi-user"
              class="w-full bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)] border-[var(--color-border)]"
            />
          </router-link>
          <Button
            label="Cerrar sesión"
            icon="pi pi-sign-out"
            @click="$emit('logout')"
            class="w-full bg-[var(--btn-danger-bg)] text-[var(--btn-danger-text)] hover:bg-[var(--btn-danger-hover-bg)] border-none"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import Avatar from "primevue/avatar";
import Divider from "primevue/divider";
import Button from "primevue/button";

defineProps({
  isOpen: Boolean,
  profileName: String,
  profilePicture: String,
  profileType: String,
  menuItems: Array,
});

defineEmits(['closeMenu', 'logout']);
</script>