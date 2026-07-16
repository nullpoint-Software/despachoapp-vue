<template>
  <aside class="app-toast-stack" aria-live="polite" aria-atomic="false">
    <transition-group name="toast-list">
      <article v-for="message in messages" :key="message.id" class="app-toast" :data-severity="message.severity">
        <i :class="iconFor(message.severity)" aria-hidden="true"></i>
        <div><strong>{{ message.summary }}</strong><p v-if="message.detail">{{ message.detail }}</p></div>
        <button type="button" aria-label="Cerrar aviso" @click="remove(message.id)">×</button>
      </article>
    </transition-group>
  </aside>
</template>
<script setup lang="ts">
import { useAppToast } from "@/composables/useAppToast";
const { messages, remove } = useAppToast();
const iconFor = (severity?: string) => ({ success:"pi pi-check", error:"pi pi-times", warn:"pi pi-exclamation-triangle", info:"pi pi-info-circle" }[severity || "info"]);
</script>
<style scoped>
.app-toast-stack{position:fixed;right:1rem;top:5rem;z-index:400;display:grid;width:min(26rem,calc(100vw - 2rem));gap:.55rem}.app-toast{display:grid;grid-template-columns:1.5rem 1fr 2rem;gap:.7rem;align-items:start;border:1px solid var(--br-line,#4d4b46);border-left:5px solid var(--br-accent,#e34b32);background:var(--br-panel,#191918);color:var(--br-text,#eceae4);padding:.85rem;font:700 .82rem/1.35 "Courier New",monospace;box-shadow:6px 6px 0 rgba(0,0,0,.35)}.app-toast[data-severity="success"]{border-left-color:#7ea77f}.app-toast[data-severity="warn"]{border-left-color:#d6a744}.app-toast strong{text-transform:uppercase}.app-toast p{margin:.25rem 0 0;color:var(--br-muted,#aaa79f);font-weight:400}.app-toast button{border:0;background:transparent;color:inherit;font-size:1.4rem}.toast-list-enter-active,.toast-list-leave-active{transition:opacity .2s ease,transform .2s ease}.toast-list-enter-from,.toast-list-leave-to{opacity:0;transform:translateX(1rem)}
</style>
