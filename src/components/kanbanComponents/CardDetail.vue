<!-- CardDetail.vue -->
<template>
  <!-- Contenedor Principal (Modal Overlay) con efecto blur y animación -->
  <transition name="fade">
    <div class="modal-overlay" @click.self="$emit('close')">
      <!-- Contenedor del Modal con fondo gris bajito -->
      <div class="modal-content relative bg-gray-50">
        
        <!-- Encabezado: Foto del usuario y nombre -->
        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div class="w-16 h-16">
            <template v-if="card.image">
              <img
                :src="card.image"
                alt="Foto del Usuario"
                class="w-16 h-16 rounded-full object-cover"
              />
            </template>
            <template v-else>
              <!-- Cambio: Se aumenta el tamaño del icono cambiando text-6xl a text-7xl -->
              <i
                :class="card.userIcon || ''"
                class="w-16 h-16 text-gray-400 items-center justify-center"
              ></i>
            </template>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-gray-800">
              {{ card.username && card.status !== 'Disponible' ? card.nombre : 'No asignado' }}
            </h3>
            <h2 class="text-1xl font-bold text-gray-600">{{card.username +" (ID: "+card.id_usuario+")"}}</h2>
          </div>
        </div>

        <!-- Tabla de Información -->
        <table class="w-full text-sm border border-gray-200 rounded-md overflow-hidden mb-6">
          <tbody>
            <!-- Título de la tarea -->
            <tr
              class="border-b border-gray-200"
              :style="{ backgroundColor: getStatusColor(card.status) }"
            >
              <th colspan="2" class="px-4 py-2 text-center font-semibold text-black">
                {{ card.title }}
              </th>
            </tr>

            <!-- Cliente -->
            <!-- <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Cliente</td>
              <td class="px-4 py-2 text-gray-600 text-center">
                {{ card.ClientName || 'Cliente no disponible' }}
              </td>
            </tr> -->

            <!-- Descripción -->
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Descripción</td>
              <td class="px-4 py-2 text-gray-600 text-center">
                {{ card.descripcion }}
              </td>
            </tr>

            <!-- 
              Cambio: Se eliminó el bloque de "Archivo(s) Adjunto(s)" para quitar los archivos
              adjuntos de la interfaz.
            -->

            <!-- Fecha -->
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Fecha</td>
              <td class="px-4 py-2 text-gray-600 text-center">
                {{ card.fecha_creacion ? formatFechaHoraFullSQL(card.fecha_creacion) : 'No disponible' }}
              </td>
            </tr>

            <!-- Fecha Finalización -->
            <tr class="border-b border-gray-200">
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Fecha Finalizacion</td>
              <td class="px-4 py-2 text-gray-600 text-center">
                {{ card.fecha_vencimiento ? formatFechaHoraFullSQL(card.fecha_vencimiento) : 'No disponible' }}
              </td>
            </tr>

            <!-- Horario -->
            <!-- <tr>
              <td class="px-4 py-2 font-medium text-gray-700 text-center">Horario</td>
              <td class="px-4 py-2 text-gray-600 text-center">
                <div>Inicio: {{ card.startTime ? card.startTime : 'No disponible' }}</div>
                <div>Fin: {{ card.endTime ? card.endTime : 'No disponible' }}</div>
              </td>
            </tr> -->
          </tbody>
        </table>

        <!-- Botones -->
        <div class="flex space-x-4">
          <!-- Botón Modificar -->
          <button
            @click="editTask"
            
            class="cursor-pointer flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 rounded-md text-white font-semibold shadow hover:bg-blue-400 transition transform hover:scale-105 focus:outline-none"
          >
            <i class="pi pi-pencil"></i>
            <span>Modificar</span>
          </button>

          <!-- Botón Estado -->
          <button
            @click="advanceState"
            :style="{ backgroundColor: getStatusColor(card.estado) }"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-black font-semibold shadow hover:opacity-90 transition transform hover:scale-105 focus:outline-none border border-gray-300"
          >
            <i :class="getStateIcon(card.estado)"></i>
            <span>{{ card.estado }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import 'primeicons/primeicons.css';
import { formatFechaHoraFullSQL } from '@/service/adminApp/client';
import { hasPermission } from '@/service/adminApp/permissionsService';
import { Toast, useToast } from 'primevue';
const toast = useToast();
const props = defineProps({
  card: {
    type: Object,
    required: true,
  },
});
// Cambio: Se agrega el evento 'edit' para que el botón Modificar pueda emitirlo
const emit = defineEmits(['advanceState', 'close', 'edit']);

// Función para emitir el evento 'edit' con la tarea (card) como argumento
const editTask = async () => {
  if(await hasPermission('canEditCard')){
    emit('edit', props.card);
  }else{
    console.log("no permission de mover!!");
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No tienes permiso para editar esta tarea!",
      life: 2000,
    });
  }
  
};

const advanceState = () => {
  emit('advanceState', props.card.id);
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Disponible':
      return '#A7F3D0';
    case 'Pendiente':
      return '#FCD34D';
    case 'En Progreso':
      return '#93C5FD';
    case 'Terminado':
      return '#D1D5DB';
    default:
      return '#CCCCCC';
  }
};

const getStateIcon = (status) => {
  switch (status) {
    case 'Disponible':
      return 'pi pi-check-circle';
    case 'Pendiente':
      return 'pi pi-folder-open';
    case 'En Progreso':
      return 'pi pi-spinner pi-spin';
    case 'Terminado':
      return 'pi pi-check';
    default:
      return 'pi pi-question-circle';
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-content {
  background-color: #f9fafb; /* Fondo gris bajito */
  border-radius: 0.5rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 26rem;
  padding: 1.5rem;
  position: relative;
  animation: slideDown 0.3s ease-out;
}

/* Animación de aparición */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transición fade para entrada y salida */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Animación de salida */
.fade-leave-active {
  animation: slideUp 0.3s ease-out forwards;
}

@keyframes slideUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* Centrar el contenido de todas las celdas de la tabla */
table td,
table th {
  text-align: center;
}
</style>
