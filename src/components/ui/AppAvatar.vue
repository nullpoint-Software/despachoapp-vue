<template><span class="app-avatar"><img v-if="image" :src="image" alt="" /><span v-else>{{ label?.slice(0,2).toUpperCase() }}</span></span></template>
<script setup lang="ts">defineProps<{image?:string|null;label?:string}>();</script>
<style scoped>.app-avatar{width:2.5rem;height:2.5rem;display:inline-grid;place-items:center;overflow:hidden;border:1px solid var(--br-line-strong,#77736b);background:var(--br-panel-2,#242321);color:var(--br-text,#eceae4);font:800 .75rem "Courier New",monospace}.app-avatar img{width:100%;height:100%;object-fit:cover}</style>
