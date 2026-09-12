<script setup lang="ts">
import { ref, watch } from 'vue'
import { rasterTicket } from '@/utils/ticketRaster'
const props = defineProps<{ text: string; logo: string; barcode: string; paperWidth: 58 | 80 }>()
const pages = ref<string[]>([]),
  error = ref(''),
  loading = ref(false)
let revision = 0
watch(
  () => [props.text, props.logo, props.barcode, props.paperWidth],
  async () => {
    const current = ++revision
    loading.value = true
    error.value = ''
    pages.value = []
    try {
      const result = await rasterTicket(
        { title: '', text: props.text, logo: props.logo, barcode: props.barcode },
        props.paperWidth
      )
      if (current === revision) pages.value = result
    } catch (e) {
      if (current === revision) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (current === revision) loading.value = false
    }
  },
  { immediate: true }
)
</script>
<template>
  <section class="thermal-proof">
    <div class="thermal-proof-heading">
      <strong>Vista previa</strong><span>Así se imprimirá tu ticket</span>
    </div>
    <p v-if="loading" role="status">Preparando ticket…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="thermal-proof-scroll">
      <img
        v-for="(page, index) in pages"
        :key="index"
        :src="'data:image/png;base64,' + page"
        :alt="'Ticket, página ' + (index + 1) + '. Código de barras: ' + barcode"
        :style="{ width: paperWidth * 8 + 'px' }"
      />
    </div>
  </section>
</template>
<style scoped>
.thermal-proof {
  min-width: 0;
  max-width: 100%;
  margin: 1rem 0;
}
.thermal-proof-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
}
.thermal-proof-heading span {
  font-size: 0.75rem;
}
.thermal-proof > p {
  font:
    700 0.75rem/1.5 'Courier New',
    monospace;
  color: var(--br-text);
}
.thermal-proof-scroll {
  max-width: 100%;
  min-width: 0;
  background: color-mix(in srgb, var(--br-control) 85%, var(--br-line-strong));
  border: 1px solid var(--br-line-strong);
  padding: clamp(0.5rem, 2vw, 1.25rem);
}
.thermal-proof-scroll img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto 1rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  background: white;
}
.thermal-proof-scroll img:last-child {
  margin-bottom: 0;
}
</style>
