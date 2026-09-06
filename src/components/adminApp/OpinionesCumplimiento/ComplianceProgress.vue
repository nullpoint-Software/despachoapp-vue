<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  processed: number
  total: number
  active: boolean
  label: string
  failed?: number
}>()
const completed = computed(() => Math.max(0, Math.min(props.processed, props.total)))
const percent = computed(() =>
  props.total > 0 ? Math.round((completed.value / props.total) * 100) : 0
)
</script>
<template>
  <section class="compliance-progress" :aria-label="label">
    <div class="progress-heading">
      <div class="progress-copy">
        <span class="progress-kicker">{{
          active ? 'CONSULTA EN CURSO' : 'AVANCE DE CONSULTA'
        }}</span
        ><strong class="progress-title">{{ label }}</strong>
      </div>
      <output class="progress-percent">{{ total > 0 ? percent + '%' : '—' }}</output>
    </div>
    <progress
      :value="active && !total ? undefined : completed"
      :max="total || 1"
      :aria-label="label"
    />
    <div class="progress-metrics" role="status">
      <span
        ><b>{{ completed }} / {{ total }}</b> PROCESADOS</span
      >
      <span
        ><b>{{ Math.max(0, total - completed) }}</b> PENDIENTES</span
      >
      <span v-if="failed"
        ><b>{{ failed }}</b> CON ERROR</span
      >
      <span v-if="active && !total" class="progress-state">Preparando consulta…</span>
      <span v-else-if="active && completed === total" class="progress-state">Finalizando…</span>
    </div>
  </section>
</template>
<style scoped>
.compliance-progress {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  padding: 1rem 1.25rem;
  border: 1px solid var(--br-line-strong);
  border-left: 4px solid var(--br-accent);
  background: var(--br-panel);
  color: var(--br-text);
  --app-modal-ink: var(--br-text);
  --app-modal-muted: var(--br-muted);
}
.progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.progress-copy {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}
.compliance-progress .progress-kicker {
  color: var(--br-accent) !important;
  font:
    800 0.6rem/1.3 'Courier New',
    monospace;
  letter-spacing: 0.1em;
}
.progress-title {
  font: 900 clamp(0.9rem, 2vw, 1.15rem)/1.15 var(--font-family);
  text-transform: uppercase;
  letter-spacing: -0.025em;
}
.progress-percent {
  color: var(--br-accent);
  font:
    900 clamp(1.8rem, 4vw, 2.6rem)/1 Arial,
    sans-serif;
  letter-spacing: -0.06em;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
progress {
  display: block;
  appearance: none;
  width: 100%;
  height: 0.65rem;
  margin: 1rem 0;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  overflow: hidden;
  background: var(--br-bg);
  accent-color: var(--br-accent);
}
progress::-webkit-progress-bar {
  background: var(--br-bg);
}
progress::-webkit-progress-value {
  background: var(--br-accent);
  transition: width 0.25s ease;
}
progress::-moz-progress-bar {
  background: var(--br-accent);
}
.progress-metrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--br-line);
  font:
    700 0.6rem/1.5 'Courier New',
    monospace;
}
.progress-metrics > span {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}
.progress-metrics b {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.progress-state {
  margin-left: auto;
}
@media (max-width: 480px) {
  .compliance-progress {
    padding: 0.85rem;
  }
  .progress-state {
    margin-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  progress::-webkit-progress-value {
    transition: none;
  }
}
</style>
