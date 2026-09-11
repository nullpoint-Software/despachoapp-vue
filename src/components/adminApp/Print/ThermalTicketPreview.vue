<script setup lang="ts">
import { ref, watch } from 'vue'
import { rasterTicket } from '@/utils/ticketRaster'
import { ticketProfile } from '@/utils/ticketLayout'
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
    <p>
      Vista previa · {{ paperWidth }} mm · {{ ticketProfile(paperWidth).columns }} caracteres por
      línea
    </p>
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
.thermal-proof > p {
  font:
    700 0.75rem/1.5 'Courier New',
    monospace;
  color: var(--br-text);
}
.thermal-proof-scroll {
  max-height: 60vh;
  max-width: 100%;
  overflow: auto;
  background: var(--br-panel-2);
  border: 1px solid var(--br-line-strong);
  padding: 12px;
}
.thermal-proof-scroll img {
  display: block;
  max-width: none;
  height: auto;
  image-rendering: pixelated;
  margin: 0 auto 12px;
  background: white;
}
</style>
