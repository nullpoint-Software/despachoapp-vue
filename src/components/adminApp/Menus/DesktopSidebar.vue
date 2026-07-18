<template>
  <aside
    class="hidden lg:flex fixed top-0 left-0 h-screen flex-col bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg)] text-[var(--color-text)] w-20 hover:w-64 transition-all duration-300 ease-out group overflow-hidden border-r border-[var(--color-border)] pt-20 z-40"
  >
    <nav class="flex-1 overflow-y-auto custom-scrollbar-hide">
      <ul class="space-y-2 p-2">
        <li v-for="item in menuItems" :key="item.name">
          <router-link
            :to="item.path"
            class="w-full flex items-center justify-center group px-4 py-3 hover:bg-[var(--btn-secondary-hover-bg)] rounded-md transition-colors duration-200 group-hover:justify-start"
            :aria-label="'Ir a ' + item.name"
          >
            <i
              :class="[
                item.icon,
                'text-2xl text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors',
              ]"
            ></i>
            <span class="hidden group-hover:block ml-4 text-sm font-medium">
              {{ item.name }}
            </span>
          </router-link>
        </li>
      </ul>
    </nav>
    <div class="p-4 border-t border-[var(--color-border)]">
      <router-link
        to="/app/settings"
        class="flex items-center justify-center group px-4 py-2 hover:bg-[var(--btn-secondary-hover-bg)] rounded-md transition-colors duration-200 group-hover:justify-start"
        aria-label="Ajustes"
      >
        <i
          class="pi pi-cog text-2xl text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors"
        ></i>
        <span class="hidden group-hover:block ml-4 text-sm font-medium">
          Ajustes
        </span>
      </router-link>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  menuItems: Array,
});
</script>

<style scoped>
aside{box-shadow:none!important}
aside a{margin:0 .3rem .35rem 0;box-shadow:none!important;transition:background-color .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}
aside a:hover{box-shadow:5px 5px 0 var(--br-control)!important;transform:translate(-1px,-1px)}
aside a:active{transform:translate(1px,1px);box-shadow:2px 2px 0 var(--br-control)!important}
</style>
