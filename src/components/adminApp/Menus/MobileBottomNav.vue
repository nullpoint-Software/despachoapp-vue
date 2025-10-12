<template>
  <nav class="fixed bottom-0 text-center left-0 z-40 w-full h-16 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
    <div class="grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
      <router-link
        v-for="item in menuItems"
        :key="item.name"
        :to="item.path"
        class="inline-flex flex-col items-center justify-center px-5 hover:bg-[var(--btn-secondary-hover-bg)] group"
      >
        <i
          :class="[item.icon, 'w-6 h-6 mb-1 text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]']"
        ></i>
        <span class="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
          {{ item.name }}
        </span>
      </router-link>

      <button
        @click.prevent="$emit('openMoreMenu')"
        class="inline-flex flex-col items-center justify-center px-5 hover:bg-[var(--btn-secondary-hover-bg)] group"
      >
        <i class="pi pi-ellipsis-h w-6 h-6 mb-1 text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]"></i>
        <span class="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">Más</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  menuItems: Array,
});
defineEmits(['openMoreMenu']);
</script>

<style scoped>
/* Resalta el ícono y texto del enlace activo */
.router-link-active i,
.router-link-active span {
  color: var(--obj-important-1);
}
</style>