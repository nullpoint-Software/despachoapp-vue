<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content relative bg-gray-50">

        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div class="w-16 h-16" v-if="card.id_usuario">
            <img :src="!card.image ? defaultprofilePicture : card.image" alt="Foto del Usuario"
                 class="w-16 h-16 rounded-full object-cover" />
          </div>
          <div>
            <!-- ---------------------- Cambio: usar v-html con nombre procesado para insertar guiones suaves en palabras largas ---------------------- -->
            <h3 class="text-2xl font-bold text-gray-800" v-html="hyphenatedNombre"></h3>
            <!-- -------------------------------------------------------------------------------------------- -->
            <!-- ---------------------- Cambio: usar v-html con username procesado para insertar guiones suaves en palabras largas ---------------------- -->
            <p v-if="card.id_usuario" class="text-sm text-gray-500" v-html="hyphenatedUsername">
            </p>
            <!-- -------------------------------------------------------------------------------------------- -->
          </div>
        </div>

        <table class="w-full text-sm border border-gray-200 rounded-md overflow-hidden mb-6">
          <tbody>
            <tr class="border-b border-gray-200" :style="{ backgroundColor: getStatusColor(card.estado) }">
              <!-- ---------------------- Cambio: mostrar título truncado con opción "Mostrar más" y hyphenation ---------------------- -->
              <th colspan="2" class="px-4 py-2 text-center font-semibold text-black">
                <div v-if="isTituloLong" class="title-cell">
                  <div class="truncate-multiline" v-html="hyphenatedTituloTruncated"></div>
                  <button @click="openFullText(propsLabel('Título'), card.titulo)" class="mt-2 underline text-sm">Mostrar más</button>
                </div>
                <div v-else v-html="hyphenatedTitulo"></div>
              </th>
              <!-- -------------------------------------------------------------------------------------------- -->
            </tr>
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">ID Tarea</td>
              <td class="px-4 py-2 text-gray-600 text-center">{{ card.id_tarea }}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Descripción</td>
              <!-- ---------------------- Cambio: mostrar descripción truncada con opción "Mostrar más" y hyphenation ---------------------- -->
              <td class="px-4 py-2 text-gray-600 text-center">
                <div v-if="isDescripcionLong">
                  <div class="truncate-multiline" v-html="hyphenatedDescripcionTruncated"></div>
                  <button @click="openFullText(propsLabel('Descripción'), card.descripcion)" class="mt-2 underline text-sm">Mostrar más</button>
                </div>
                <div v-else v-html="hyphenatedDescripcion"></div>
              </td>
              <!-- -------------------------------------------------------------------------------------------- -->
            </tr>
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Fecha de creación</td>
              <td class="px-4 py-2 text-gray-600 text-center">{{ card.fecha_creacion || 'No disponible' }}</td>
            </tr>
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Fecha de finalización</td>
              <td class="px-4 py-2 text-gray-600 text-center">{{ card.fecha_vencimiento || 'No disponible' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="flex space-x-4">
          <button @click="editTask" class="cursor-pointer flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 rounded-md text-white font-semibold shadow hover:bg-blue-400 transition transform hover:scale-105 focus:outline-none">
            <i class="pi pi-pencil"></i>
            <span>Modificar</span>
          </button>
          <button @click="advanceState" :style="{ backgroundColor: getStatusColor(card.estado) }" class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-black font-semibold shadow hover:opacity-90 transition transform hover:scale-105 focus:outline-none border border-gray-300">
            <i :class="getStateIcon(card.estado)"></i>
            <!-- ---------------------- Cambio: usar v-html con estado procesado por si contiene palabras largas ---------------------- -->
            <span v-html="hyphenatedEstado"></span>
            <!-- -------------------------------------------------------------------------------------------- -->
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- ---------------------- Cambio: Modal secundario para mostrar texto completo (usa misma paleta que modal padre) ---------------------- -->
  <transition name="fade">
    <div v-if="showFullModal" class="modal-overlay" @click.self="closeFullModal">
      <!-- ---------------------- Cambio: aplicar clase 'modal-content full' para heredar paleta y estilos del padre ---------------------- -->
      <div class="modal-content full relative max-w-3xl w-[95%] p-6">
        <!-- -------------------------------------------------------------------------------------------- -->
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-semibold text-gray-800">{{ fullModalTitle }}</h2>
          <button @click="closeFullModal" class="text-gray-600 hover:text-gray-800 text-lg close-x">&times;</button>
        </div>
        <div class="full-text-content max-h-[60vh] overflow-auto whitespace-pre-wrap break-words" v-html="fullModalContentHyphenated"></div>
        <div class="mt-4 flex justify-end">
          <button @click="closeFullModal" class="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800">Cerrar</button>
        </div>
      </div>
    </div>
  </transition>
  <!-- -------------------------------------------------------------------------------------------- -->
</template>

<script setup>
import { defineProps, defineEmits, computed, ref } from 'vue';
import 'primeicons/primeicons.css';
import defaultprofilePicture from '@/assets/img/user.jpg';

const props = defineProps({
  card: { type: Object, required: true },
});
const emit = defineEmits(['advanceState', 'close', 'edit']);
const editTask = () => emit('edit', props.card);
const advanceState = () => emit('advanceState', props.card.id_tarea);
const getStatusColor = (status) => {
  switch (status) {
    case 'Disponible': return '#A7F3D0';
    case 'Pendiente': return '#FCD34D';
    case 'En Progreso': return '#93C5FD';
    case 'Terminado': return '#D1D5DB';
    default: return '#CCCCCC';
  }
};
const getStateIcon = (status) => {
  switch (status) {
    case 'Disponible': return 'pi pi-check-circle';
    case 'Pendiente': return 'pi pi-folder-open';
    case 'En Progreso': return 'pi pi-spinner pi-spin';
    case 'Terminado': return 'pi pi-check';
    default: return 'pi pi-question-circle';
  }
};

/* ---------------------- Cambio: funciones para escapar HTML y añadir guiones suaves (\u00AD) a palabras muy largas ----------------------
   - Evita romper el diseño cuando haya palabras largas sin espacios.
   - Inserta un guion suave cada `maxLen` caracteres en palabras continuas.
   - Escapa HTML para evitar inyección al usar v-html.
-------------------------------------------------------------------------------------------- */
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
  // Reemplaza secuencias largas (sin espacios) por la misma palabra con soft-hyphens cada maxLen
  const longWordRegex = new RegExp(`\\S{${maxLen},}`, "g");
  return escaped.replace(longWordRegex, (word) => {
    const parts = word.match(new RegExp(`.{1,${maxLen}}`, "g")) || [word];
    return parts.join("\u00AD");
  });
}
/* -------------------------------------------------------------------------------------------- */

/* ---------------------- Cambio: lógica de truncamiento y modal para "Mostrar más" ----------------------
   - Si el texto pasa de `truncateLimit` caracteres, se muestra truncado con "..."
   - Al hacer clic en "Mostrar más" se abre un modal con el texto completo.
-------------------------------------------------------------------------------------------- */
const truncateLimitTitle = 120; // caracteres antes de truncar el título
const truncateLimitDescription = 240; // caracteres antes de truncar la descripción

const showFullModal = ref(false);
const fullModalTitle = ref('');
const fullModalContent = ref('');

// helpers para etiquetas (para mantener consistencia al abrir modal)
const propsLabel = (label) => label;

// abrir modal con contenido completo
function openFullText(title, content) {
  fullModalTitle.value = title;
  // mostrar contenido hyphenated en el modal completo también (escapado e insertando soft-hyphens)
  fullModalContent.value = content ?? '';
  showFullModal.value = true;
}
function closeFullModal() {
  showFullModal.value = false;
  fullModalTitle.value = '';
  fullModalContent.value = '';
}

const fullModalContentHyphenated = computed(() => hyphenateText(fullModalContent.value, 20));
/* -------------------------------------------------------------------------------------------- */

/* ---------------------- Cambio: computeds para hyphenation y truncamiento ---------------------- */
const hyphenatedNombre = computed(() => {
  const nombre = props.card?.id_usuario ? (props.card.nombre ?? '') : 'No asignado';
  return hyphenateText(nombre, 20);
});
const hyphenatedUsername = computed(() => hyphenateText(props.card?.username ?? '', 18));
const hyphenatedTitulo = computed(() => hyphenateText(props.card?.titulo ?? '', 24));
const hyphenatedDescripcion = computed(() => hyphenateText(props.card?.descripcion ?? '', 18));
const hyphenatedEstado = computed(() => hyphenateText(props.card?.estado ?? '', 18));

const isTituloLong = computed(() => (props.card?.titulo ?? '').length > truncateLimitTitle);
const isDescripcionLong = computed(() => (props.card?.descripcion ?? '').length > truncateLimitDescription);

const hyphenatedTituloTruncated = computed(() => {
  const raw = props.card?.titulo ?? '';
  if (!raw) return '';
  if (raw.length <= truncateLimitTitle) return hyphenateText(raw, 24);
  const truncated = raw.slice(0, truncateLimitTitle).trim() + '...';
  return hyphenateText(truncated, 24);
});
const hyphenatedDescripcionTruncated = computed(() => {
  const raw = props.card?.descripcion ?? '';
  if (!raw) return '';
  if (raw.length <= truncateLimitDescription) return hyphenateText(raw, 18);
  const truncated = raw.slice(0, truncateLimitDescription).trim() + '...';
  return hyphenateText(truncated, 18);
});
/* -------------------------------------------------------------------------------------------- */
</script>

<style scoped>
/* ---------------------- Cambio: añadidas la propiedad estándar `line-clamp` y orden de vendor-prefixes para evitar la advertencia del linter ---------------------- */
.truncate-multiline {
  display: -webkit-box;            /* necesario para -webkit-line-clamp */
  -webkit-box-orient: vertical;    /* orienta el box en vertical */
  -webkit-line-clamp: 3;           /* prefijo WebKit (soporte amplio) */
  line-clamp: 3;                   /* ---------------------- Cambio: propiedad estándar añadida ---------------------- */
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-hyphens: auto;
  hyphens: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}
/* -------------------------------------------------------------------------------------------- */

/* ---------------------- Cambio: estilos para truncamiento y paleta del modal secundario (misma paleta que el padre) ----------------------
   - La clase .modal-content.full fuerza el mismo background y color de texto que el modal padre.
   - Además se ajustan botones y el close-x para que coincidan con la paleta.
-------------------------------------------------------------------------------------------- */
.modal-content.full {
  /* mismo fondo que .modal-content principal (#f9fafb) */
  background-color: #f9fafb;
  color: #1f2937; /* text-gray-800 */
  border-radius: .5rem;
  box-shadow: 0 0 20px rgba(0,0,0,.2);
}

/* Asegurar que el contenido largo use la misma paleta y sea legible */
.full-text-content {
  hyphens: auto;
  -webkit-hyphens: auto;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
  color: #1f2937; /* text-gray-800 */
  background: transparent; /* no fondo blanco */
  padding: 0.25rem 0;
}

/* Close button más visible en la paleta */
.modal-content.full .close-x {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

/* Cerrar botón y acciones heredan colores legibles */
.modal-content.full button {
  color: #1f2937;
}

/* ---------------------- Cambio: estilos para compatibilidad y paleta general ---------------------- */
.modal-overlay{position:fixed;inset:0;backdrop-filter:blur(4px);background-color:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;z-index:50}
.modal-content{background-color:#f9fafb;border-radius:.5rem;box-shadow:0 0 20px rgba(0,0,0,.2);width:100%;max-width:26rem;padding:1.5rem;position:relative;animation:slideDown .3s ease-out}
@keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
.fade-enter-active,.fade-leave-active{transition:opacity .3s}
.fade-enter-from,.fade-leave-to{opacity:0}
/* -------------------------------------------------------------------------------------------- */
</style>
