<!-- Note.vue -->
<template>
  <div class="note bg-gray-50 border border-gray-200 rounded-md shadow p-4">
    <!-- Título de la nota -->
    <h2 class="text-xl font-bold text-gray-800 mb-2">{{ note.titulo }}</h2>
    <!-- Contenido de la nota renderizado a HTML desde Markdown -->
    <div class="note-content text-gray-700" v-html="parsedMarkdown"></div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue'
// Se importa la librería "marked" para procesar markdown
import { marked } from 'marked'

const props = defineProps({
  note: {
    type: Object,
    required: true
    // Estructura: { id: Number, titulo: String, descripcion: String (markdown) }
  }
})

// Se convierte la descripción de la nota de markdown a HTML
const parsedMarkdown = computed(() => marked(props.note.descripcion))
</script>

<style scoped>
/* Estilos opcionales adicionales */
.note-content :global(p) {
  margin-bottom: 0.75rem;
}
</style>
