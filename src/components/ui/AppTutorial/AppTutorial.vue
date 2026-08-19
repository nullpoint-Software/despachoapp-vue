<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

interface TutorialStep {
  target: string;
  eyebrow?: string;
  title: string;
  body: string;
}

interface AppTutorialProps {
  modelValue: boolean;
  title: string;
  steps: TutorialStep[];
  storageKey?: string;
}

const props = defineProps<AppTutorialProps>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "step-change": [index: number];
  finish: [];
}>();

const index = ref(0);
const spotlightStyle = ref<Record<string, string>>({ opacity: "0" });
const cardStyle = ref<Record<string, string>>({ bottom: "1rem" });
const card = ref<HTMLElement | null>(null);
const currentStep = computed(() => props.steps[index.value]);
const progress = computed(() => props.steps.length ? `${index.value + 1} / ${props.steps.length}` : "0 / 0");
let previousFocus: HTMLElement | null = null;

function rememberCompletion(): void {
  if (props.storageKey) localStorage.setItem(props.storageKey, "true");
}

function close(remember = true): void {
  if (remember) rememberCompletion();
  emit("update:modelValue", false);
}

function finish(): void {
  rememberCompletion();
  emit("finish");
  emit("update:modelValue", false);
}

async function updateTarget(): Promise<void> {
  const step = currentStep.value;
  if (!step) return;
  emit("step-change", index.value);
  await nextTick();
  const target = document.querySelector(step.target) as HTMLElement | null;
  if (!target) {
    spotlightStyle.value = { opacity: "0" };
    cardStyle.value = { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
    return;
  }
  target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  window.setTimeout(() => {
    const rect = target.getBoundingClientRect();
    const pad = 8;
    spotlightStyle.value = {
      opacity: "1",
      left: `${Math.max(8, rect.left - pad)}px`,
      top: `${Math.max(8, rect.top - pad)}px`,
      width: `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`,
      height: `${Math.min(window.innerHeight - 16, rect.height + pad * 2)}px`,
    };
    cardStyle.value = rect.top + rect.height / 2 > window.innerHeight / 2
      ? { left: "50%", top: "1rem", transform: "translateX(-50%)" }
      : { left: "50%", bottom: "1rem", transform: "translateX(-50%)" };
  }, 180);
}

function previous(): void {
  if (index.value > 0) index.value -= 1;
}

function next(): void {
  if (index.value >= props.steps.length - 1) finish();
  else index.value += 1;
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.modelValue) return;
  if (event.key === "Escape") close();
  if (event.key === "ArrowRight") next();
  if (event.key === "ArrowLeft") previous();
}

function onViewportChange(): void {
  if (props.modelValue) void updateTarget();
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement | null;
    index.value = 0;
    document.body.classList.add("tutorial-open");
    await updateTarget();
    await nextTick();
    card.value?.focus();
  } else {
    document.body.classList.remove("tutorial-open");
    spotlightStyle.value = { opacity: "0" };
    previousFocus?.focus();
  }
}, { immediate: true });

watch(index, () => void updateTarget());

window.addEventListener("keydown", onKeydown);
window.addEventListener("resize", onViewportChange);
window.addEventListener("scroll", onViewportChange, true);

onBeforeUnmount(() => {
  document.body.classList.remove("tutorial-open");
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onViewportChange);
  window.removeEventListener("scroll", onViewportChange, true);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="tutorial">
      <div v-if="modelValue && currentStep" class="app-tutorial" aria-live="polite">
        <div class="app-tutorial__spotlight" :style="spotlightStyle" aria-hidden="true"></div>
        <section ref="card" class="app-tutorial__card" :style="cardStyle" role="dialog" aria-modal="true" tabindex="-1" :aria-label="title">
          <header>
            <div><p>{{ currentStep.eyebrow || title }}</p><strong>{{ currentStep.title }}</strong></div>
            <button type="button" aria-label="Cerrar tutorial" @click="close()">&times;</button>
          </header>
          <div class="app-tutorial__body">
            <span>{{ progress }}</span>
            <p>{{ currentStep.body }}</p>
          </div>
          <footer>
            <button type="button" class="app-tutorial__skip" @click="close()">Omitir</button>
            <div>
              <button type="button" :disabled="index === 0" @click="previous">Anterior</button>
              <button type="button" class="app-tutorial__next" @click="next">{{ index === steps.length - 1 ? "Terminar" : "Siguiente" }}</button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
body.tutorial-open{overflow:hidden}
</style>

<style scoped>
.app-tutorial{position:fixed;inset:0;z-index:2600;background:transparent}.app-tutorial__spotlight{position:fixed;z-index:0;border:2px solid var(--br-accent);background:transparent;box-shadow:0 0 0 9999px color-mix(in srgb,var(--br-bg) 84%,transparent),8px 8px 0 var(--br-accent);pointer-events:none;transition:left .2s ease,top .2s ease,width .2s ease,height .2s ease,opacity .14s ease}.app-tutorial__card{position:fixed;z-index:1;width:min(31rem,calc(100vw - 2rem));border:2px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:10px 10px 0 var(--br-accent);outline:none}.app-tutorial__card>header{display:grid;grid-template-columns:minmax(0,1fr) 3.25rem;border-bottom:1px solid var(--br-line-strong);background:var(--br-bg);color:var(--br-text)}.app-tutorial__card>header>div{padding:1rem 1.1rem}.app-tutorial__card header p{margin:0 0 .35rem;color:var(--br-accent)!important;font:800 .62rem var(--font-family);letter-spacing:.1em;text-transform:uppercase}.app-tutorial__card header strong{display:block;color:var(--br-text)!important;font:900 1.35rem/1.05 var(--font-family);text-wrap:balance}.app-tutorial__card header button{border:0;border-left:1px solid var(--br-line-strong);border-bottom:1px solid var(--br-line-strong);background:var(--br-accent);color:var(--br-accent-text);font-size:1.7rem;cursor:pointer}.app-tutorial__body{padding:1.1rem}.app-tutorial__body>span{color:var(--br-accent)!important;font:900 .65rem var(--font-family)}.app-tutorial__body p{max-width:58ch;margin:.65rem 0 0;color:var(--br-text)!important;font:600 .86rem/1.55 var(--font-family);text-wrap:pretty}.app-tutorial__card>footer{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border-top:1px solid var(--br-line-strong);background:var(--br-panel);padding:.8rem 1rem}.app-tutorial__card footer>div{display:flex;gap:.55rem}.app-tutorial__card footer button{min-height:2.65rem;border:1px solid var(--br-line-strong);background:transparent;color:var(--br-text);padding:.55rem .8rem;font:800 .65rem var(--font-family);text-transform:uppercase;cursor:pointer}.app-tutorial__card footer button:disabled{opacity:.55}.app-tutorial__card footer .app-tutorial__next{border-color:var(--br-accent);background:var(--br-accent);color:var(--br-accent-text)}.app-tutorial__skip{border:0!important;border-bottom:1px solid var(--br-line-strong)!important;padding-inline:0!important}.tutorial-enter-active,.tutorial-leave-active{transition:opacity .18s ease}.tutorial-enter-from,.tutorial-leave-to{opacity:0}@media(max-width:560px){.app-tutorial__card{left:.5rem!important;right:.5rem!important;bottom:.5rem!important;top:auto!important;width:auto;transform:none!important;box-shadow:5px 5px 0 var(--br-accent)}.app-tutorial__card>footer{align-items:stretch;flex-direction:column}.app-tutorial__card footer>div{display:grid;grid-template-columns:1fr 1fr}.app-tutorial__skip{align-self:flex-start}}@media(prefers-reduced-motion:reduce){.app-tutorial__spotlight,.tutorial-enter-active,.tutorial-leave-active{transition:none}}
</style>
