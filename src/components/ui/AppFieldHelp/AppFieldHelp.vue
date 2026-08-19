<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface AppFieldHelpProps {
  label: string;
  text: string;
}

defineProps<AppFieldHelpProps>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const popoverStyle = ref<Record<string, string>>({});
const tooltipId = `field-help-${Math.random().toString(36).slice(2)}`;

function updatePosition(): void {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const viewportPadding = 16;
  const gap = 10;
  const width = Math.min(320, window.innerWidth - viewportPadding * 2);
  const height = popover.value?.offsetHeight ?? 96;
  let left = rect.right + gap;

  if (left + width > window.innerWidth - viewportPadding) {
    left = Math.max(viewportPadding, rect.left - width - gap);
  }

  const centeredTop = rect.top + rect.height / 2 - height / 2;
  const top = Math.min(
    Math.max(viewportPadding, centeredTop),
    Math.max(viewportPadding, window.innerHeight - height - viewportPadding),
  );

  popoverStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` };
}

function onViewportChange(): void {
  if (open.value) updatePosition();
}

function close(): void {
  open.value = false;
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  updatePosition();
});

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onViewportChange);
  window.removeEventListener("scroll", onViewportChange, true);
});
</script>

<template>
  <span ref="root" class="app-field-help">
    <button
      ref="trigger"
      type="button"
      class="app-field-help__trigger"
      :aria-label="`Ayuda sobre ${label}`"
      :aria-expanded="open"
      :aria-describedby="open ? tooltipId : undefined"
      @click.stop="open = !open"
    >?</button>
    <Teleport to="body">
      <Transition name="field-help">
        <span v-if="open" :id="tooltipId" ref="popover" class="app-field-help__popover" :style="popoverStyle" role="tooltip">
          <strong>{{ label }}</strong>
          <span>{{ text }}</span>
        </span>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.app-field-help{position:relative;display:inline-flex;align-items:center;margin-left:.35rem;vertical-align:middle;text-transform:none}.app-field-help__trigger{display:grid;width:1.35rem;min-width:1.35rem;height:1.35rem;min-height:1.35rem;place-items:center;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;padding:0;font:900 .7rem/1 var(--font-family);cursor:help}.app-field-help__trigger:hover,.app-field-help__trigger:focus-visible{border-color:var(--br-accent);background:var(--br-accent);color:var(--br-accent-text);outline:2px solid var(--br-accent);outline-offset:2px}.app-field-help__popover{position:fixed;z-index:12000;display:grid;gap:.3rem;border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:6px 6px 0 var(--br-accent);padding:.7rem .8rem;text-align:left}.app-field-help__popover strong{color:var(--br-accent)!important;font:900 .68rem/1.2 var(--font-family)!important;text-transform:uppercase}.app-field-help__popover>span{color:var(--br-text)!important;font:600 .72rem/1.45 var(--font-family)!important;letter-spacing:0!important;text-transform:none!important}.field-help-enter-active,.field-help-leave-active{transition:opacity .14s ease,transform .14s ease}.field-help-enter-from,.field-help-leave-to{opacity:0;transform:translateX(-.35rem)}@media(max-width:640px){.app-field-help__popover{left:1rem!important;right:1rem;top:auto!important;bottom:1rem;width:auto!important}.field-help-enter-from,.field-help-leave-to{transform:translateY(.35rem)}}@media(prefers-reduced-motion:reduce){.field-help-enter-active,.field-help-leave-active{transition:none}}
</style>
