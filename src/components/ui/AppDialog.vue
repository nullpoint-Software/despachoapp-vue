<template>
  <Transition name="app-dialog">
    <div v-if="dialog" class="app-dialog-overlay" @mousedown.self="cancel">
      <form class="app-dialog-shell" :data-tone="dialog.tone || 'info'" role="dialog" aria-modal="true"
        aria-labelledby="app-dialog-title" @submit.prevent="accept">
        <header>
          <p>{{ eyebrow }}</p>
          <h2 id="app-dialog-title">{{ dialog.title }}</h2>
          <button type="button" aria-label="Cerrar" @click="cancel">×</button>
        </header>
        <div class="app-dialog-body">
          <p>{{ dialog.message }}</p>
          <label v-if="dialog.mode === 'prompt'">
            <span>{{ dialog.inputLabel || 'Dato requerido' }}</span>
            <AppInput v-model="inputValue" :type="dialog.inputType || 'text'"
              :autocomplete="dialog.inputType === 'password' ? 'current-password' : 'off'"
              :placeholder="dialog.placeholder || ''" autofocus />
          </label>
        </div>
        <footer>
          <AppButton v-if="dialog.mode !== 'alert'" type="button" :label="dialog.cancelLabel || 'Cancelar'" outlined @click="cancel" />
          <AppButton type="submit" :label="dialog.confirmLabel || (dialog.mode === 'alert' ? 'Entendido' : 'Confirmar')"
            :icon="dialog.mode === 'prompt' ? 'pi pi-lock' : 'pi pi-check'"
            :disabled="dialog.mode === 'prompt' && !inputValue" />
        </footer>
      </form>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import { useAppDialog } from "@/composables/useAppDialog";
const { dialog, settle } = useAppDialog();
const inputValue = ref("");
const eyebrow = computed(() => dialog.value?.tone === "danger" ? "ACCIÓN SENSIBLE" : "SISTEMA / AVISO");
watch(dialog, () => { inputValue.value = ""; });
function accept() { if (dialog.value) settle(dialog.value.mode === "prompt" ? inputValue.value : true); }
function cancel() { if (dialog.value) settle(dialog.value.mode === "prompt" ? null : false); }
function onKeydown(event: KeyboardEvent) { if (event.key === "Escape" && dialog.value) cancel(); }
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
.app-dialog-overlay{position:fixed;inset:0;z-index:1900;display:grid;place-items:center;padding:1rem;background:rgba(3,3,3,.86);backdrop-filter:blur(5px)}.app-dialog-shell{width:min(34rem,100%);border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:9px 9px 0 var(--br-accent)}.app-dialog-shell header{position:relative;padding:1.25rem 4.5rem 1.1rem 1.25rem;border-bottom:1px solid var(--br-line);background:var(--br-bg)}.app-dialog-shell header p{margin:0 0 .35rem;color:var(--br-accent);font:800 .68rem "Courier New",monospace;letter-spacing:.11em}.app-dialog-shell header h2{margin:0;font:900 clamp(1.55rem,5vw,2.35rem)/.95 Arial,sans-serif;letter-spacing:-.045em;text-wrap:balance}.app-dialog-shell header button{position:absolute;right:0;top:0;width:3.75rem;height:3.75rem;border:0;border-left:1px solid var(--br-line);border-bottom:1px solid var(--br-line);background:var(--br-accent);color:var(--br-accent-text);font-size:2rem;cursor:pointer}.app-dialog-shell[data-tone="danger"] header{border-left:5px solid var(--br-danger-line,#ef5d50)}.app-dialog-body{display:grid;gap:1rem;padding:1.25rem}.app-dialog-body>p{max-width:58ch;margin:0;color:var(--br-muted);font:700 .86rem/1.55 "Courier New",monospace;text-wrap:pretty}.app-dialog-body label{display:grid;gap:.45rem}.app-dialog-body label>span{font:800 .7rem "Courier New",monospace;letter-spacing:.06em;text-transform:uppercase}.app-dialog-shell footer{display:flex;justify-content:flex-end;gap:.7rem;padding:0 1.25rem 1.25rem}.app-dialog-enter-active,.app-dialog-leave-active{transition:opacity .18s ease}.app-dialog-enter-active .app-dialog-shell,.app-dialog-leave-active .app-dialog-shell{transition:transform .2s ease}.app-dialog-enter-from,.app-dialog-leave-to{opacity:0}.app-dialog-enter-from .app-dialog-shell{transform:translateY(12px)}.app-dialog-leave-to .app-dialog-shell{transform:translateY(6px)}@media(max-width:520px){.app-dialog-shell{box-shadow:5px 5px 0 var(--br-accent)}.app-dialog-shell footer{display:grid;grid-template-columns:1fr}.app-dialog-shell footer :deep(button){width:100%}}
</style>
