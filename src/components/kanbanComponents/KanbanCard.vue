<template>
  <div
    :id="`card-${card.id_tarea}`"
    class="kanban-card bg-white rounded-2xl shadow-lg p-4 mb-3 cursor-pointer border border-gray-300 hover:shadow-xl transition-all duration-300 flex items-start gap-3"
    :class="{ highlighted: card.highlight }"
    draggable="true"
    @dragstart="dragStart($event, card)"
  >
    <img
      :src="!card.image && card.estado != 'Disponible' ? defaultProfilePicture : card.image || logo"
      alt="Miniatura"
      class="w-12 h-12 rounded-lg object-cover"
    />

    <div class="flex-1">
      <!-- Título (con guiones suaves para palabras largas y truncamiento visual a 5 líneas) -->
      <h3 class="text-lg font-semibold text-gray-800 truncate-multiline" v-html="hyphenatedTitle"></h3>

      <!-- Descripción (con guiones suaves para palabras largas y truncamiento visual a 5 líneas) -->
      <p class="text-sm text-gray-600 truncate-multiline" v-html="hyphenatedDescription"></p>

      <p class="text-xs text-gray-500 mt-1 truncate-multiline">Inicio: {{ card.fecha_creacion }}</p>
      <p class="text-xs text-gray-500 truncate-multiline">Fin: {{ card.fecha_vencimiento || "N/A" }}</p>

      <div class="flex items-center mt-2">
        <span class="w-3 h-3 rounded-full" :class="statusColor"></span>
        <span class="ml-2 text-sm text-gray-700 truncate-multiline">{{ card.estado }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/*
  Componente KanbanCard (SFC)
  - No elimines funciones/hyphenation si dependes de v-html: necesarias para evitar que palabras largas rompan el layout.
  - La clase `truncate-multiline` limita visualmente a 5 renglones (CSS). El truncamiento es puramente visual.
*/

import { defineProps, computed } from "vue";
import defaultProfilePicture from '@/assets/img/user.jpg';
import logo from '@/assets/img/logsymbolblack.png';

const props = defineProps({
  card: { type: Object, required: true },
  highlight: { type: Boolean, default: false },
});

/* Drag start: coloca el id de la tarea en dataTransfer */
const dragStart = (event, card) => {
  try {
    event.dataTransfer.setData("text/plain", String(card.id_tarea));
  } catch (e) {
    // Si el navegador bloquea, no romper la app
    console.warn("dragStart: ", e);
  }
};

/* Color de estado (clases utilitarias Tailwind-like) */
const statusColor = computed(() => {
  switch (props.card.estado) {
    case "Disponible": return "bg-green-300";
    case "Pendiente": return "bg-yellow-300";
    case "En Progreso": return "bg-blue-300";
    case "Terminado": return "bg-gray-300";
    default: return "bg-gray-400";
  }
});

/* ---------------------- Hyphenation + escape HTML ----------------------
   Evita romper el layout con palabras sin espacios y permite usar v-html
   con seguridad básica (escape). No elimines esto si usas v-html.
------------------------------------------------------------------------- */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hyphenateText(raw = "", maxLen = 20) {
  if (raw == null) return "";
  const escaped = escapeHtml(String(raw));
  const longWordRegex = new RegExp(`\\S{${maxLen},}`, "g");
  return escaped.replace(longWordRegex, (word) => {
    const parts = word.match(new RegExp(`.{1,${maxLen}}`, "g")) || [word];
    return parts.join("\u00AD"); // soft hyphen
  });
}
/* ---------------------------------------------------------------------- */

const hyphenatedTitle = computed(() => hyphenateText(props.card?.titulo ?? "", 20));
const hyphenatedDescription = computed(() => hyphenateText(props.card?.descripcion ?? "", 18));
</script>

<style scoped>
/* Truncamiento multilinea: 5 renglones visuales + fallback ellipsis para navegadores sin -webkit-line-clamp */
.truncate-multiline{
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5; /* soporte WebKit/Blink */
  line-clamp: 5;
  overflow: hidden;
  text-overflow: ellipsis;
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
  line-height: 1.4;
  max-height: calc(1.4em * 5); /* fallback */
  position: relative;
}

/* Pseudo-ellipsis para navegadores que NO soportan -webkit-line-clamp */
.truncate-multiline::after{
  content: '...';
  position: absolute;
  right: 0.4rem;
  bottom: 0;
  padding-left: 0.25rem;
  background: linear-gradient(90deg, transparent, #ffffff 65%);
  pointer-events: none;
  display: none;
}

@supports not (-webkit-line-clamp: 5){
  .truncate-multiline::after{ display: block; }
}

/* Mantener comportamiento de hyphen/word-break por si se usa fuera de la clase truncate */
.kanban-card h3,
.kanban-card p {
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}

/* Estilos del componente (ligeramente repetidos para asegurar consistencia) */
.kanban-card{
  /* ya aplicados como utilidades en template; aquí quedan estilos base por si se usan sin Tailwind */
  background-color: #ffffff;
  border-radius: 1rem;
}

/* animación destacada */
@keyframes pulseGlow{0%{box-shadow:0 0 10px rgba(0,102,255,.5)}50%{box-shadow:0 0 20px rgba(0,102,255,.8)}100%{box-shadow:0 0 10px rgba(0,102,255,.5)}}
.highlighted{animation:pulseGlow 1.5s infinite alternate;border-color:rgba(0,102,255,.8)}
</style>
