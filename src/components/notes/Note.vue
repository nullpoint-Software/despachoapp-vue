<!-- Note.vue -->
<template>
  <!-- Se asigna lang="es" para que el navegador utilice las reglas del español -->
  <div lang="es" class="note bg-gray-50 border border-gray-200 rounded-md shadow p-4">
    <!-- Título de la nota con la clase "note-title" -->
    <h2 class="note-title text-xl font-bold text-gray-800 mb-2">{{ note.title }}</h2>
    <!-- Contenido de la nota renderizado a HTML desde Markdown -->
    <div class="note-content text-gray-700" v-html="parsedMarkdown"></div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  note: {
    type: Object,
    required: true
    // Estructura: { id: Number, title: String, description: String (markdown) }
  }
})

// Convertimos la descripción de Markdown a HTML
const parsedMarkdown = computed(() => marked(props.note.description))
</script>

<style scoped>
/* Estilos opcionales para los párrafos dentro del contenido */
.note-content :global(p) {
  margin-bottom: 0.75rem;
}

/*
  nota para gilberto rodriguez, se que vas a leer esto.

  Propiedades para que tanto el título como el contenido de la nota
  realicen la separación de palabras de forma automática.
  
  Con hyphens: auto; el navegador insertará el guion (-) en el corte
  de línea cuando lo considere adecuado según las reglas del idioma.
  
  Si observas que en algunos cortes no aparece el guion (por ejemplo en nuevas palabras),
  es porque el algoritmo del navegador determina que no es necesario mostrarlo.
  Para un comportamiento uniforme (o sea, guiones en todos los saltos o sin guiones)
  tendrías que optar por inhabilitar la separación automática o insertar manualmente
  soft hyphens (&shy;) en el texto.
*/
.note-title,
.note-content {
  overflow-wrap: break-word;
  word-wrap: break-word;
  
  /* Aplica separación de palabras automática */
  hyphens: auto;
  -webkit-hyphens: auto;
  -moz-hyphens: auto;
}
</style>
