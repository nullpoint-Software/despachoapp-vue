<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-content relative bg-gray-50">
        <!-- Encabezado: cambia según el estado (editar o agregar) -->
        <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div>
            <!-- Si es edición, muestra icono de lápiz; si es agregar, de más -->
            <template v-if="isEdit">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </template>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
          </div>
          <h3 class="text-2xl font-bold text-black">
            {{ isEdit ? 'Editar Tarea' : 'Agregar Tarea' }}
          </h3>
        </div>

        <!-- Paso 1: Datos básicos -->
        <div v-if="step === 1" class="space-y-4 px-4">
          <!-- Título (obligatorio) -->
          <div>
            <label class="block font-semibold text-black">Título *</label>
            <input
              type="text"
              v-model="localTask.title"
              placeholder="Ingrese el título"
              :class="['w-full p-2 border rounded text-black', errors.title ? 'border-red-500' : 'border-gray-300']"
            />
            <p v-if="errors.title" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Descripción (obligatoria) -->
          <div>
            <label class="block font-semibold text-black">Descripción *</label>
            <textarea
              v-model="localTask.description"
              placeholder="Ingrese la descripción"
              rows="3"
              :class="['w-full p-2 border rounded text-black', errors.description ? 'border-red-500' : 'border-gray-300']"
            ></textarea>
            <p v-if="errors.description" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Cliente (obligatorio) -->
          <div>
            <label class="block font-semibold text-black">Cliente *</label>
            <input
              type="text"
              v-model="localTask.ClientName"
              placeholder="Ingrese el nombre del cliente"
              :class="['w-full p-2 border rounded text-black', errors.ClientName ? 'border-red-500' : 'border-gray-300']"
            />
            <p v-if="errors.ClientName" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Empleado Asignado (opcional) -->
          <div>
            <label class="block font-semibold text-black">Empleado Asignado</label>
            <select
              v-model="localTask.assignedEmployee"
              class="w-full p-2 border border-gray-300 rounded bg-white text-black"
            >
              <option :value="null">Ninguno</option>
              <!-- Nombres reales -->
              <option v-for="employee in employees" :key="employee.value" :value="employee.value">
                {{ employee.label }}
              </option>
            </select>
          </div>
          <!-- Botón para pasar al siguiente paso -->
          <div class="flex justify-end">
            <button @click="nextStep" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
              Siguiente <i class="fas fa-angle-right ml-1"></i>
            </button>
          </div>
        </div>

        <!-- Paso 2: Programación y archivos (opcional) -->
        <div v-if="step === 2" class="space-y-4 px-4 mt-6">
          <!-- Fecha de Inicio (obligatoria) con icono -->
          <div>
            <label class="block font-semibold text-black">Fecha de Inicio *</label>
            <div class="relative">
              <input
                type="date"
                v-model="localTask.startDate"
                lang="es"
                placeholder="Seleccione una fecha"
                :class="['w-full p-2 pl-10 border rounded text-black', errors.startDate ? 'border-red-500' : 'border-gray-300']"
              />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p v-if="errors.startDate" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Hora de Inicio (opcional) con icono -->
          <div>
            <label class="block font-semibold text-black">Hora de Inicio (opcional)</label>
            <div class="relative">
              <input
                type="time"
                v-model="localTask.startTime"
                lang="es"
                placeholder="Seleccione una hora"
                class="w-full p-2 pl-10 border border-gray-300 rounded text-black"
              />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <!-- Archivos Adjuntos (opcional) -->
          <div>
            <label class="block font-semibold text-black">Archivos Adjuntos (Opcional)</label>
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100"
              @dragover.prevent
              @drop="handleDrop"
              @click="triggerFileInput"
            >
              <input type="file" multiple class="hidden" @change="handleFileUpload" ref="fileInput" />
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <p class="text-sm text-gray-500 mt-2">Arrastra archivos aquí o haz clic para seleccionarlos</p>
            </div>
            <!-- Previsualización de archivos -->
            <div v-if="attachedFiles.length" class="mt-4">
              <p class="font-semibold text-black mb-1">Archivos Subidos:</p>
              <ul class="list-disc pl-5">
                <li v-for="(fileObj, index) in attachedFiles" :key="index" class="flex items-center space-x-2 text-blue-600 hover:underline cursor-pointer" @click="openFile(fileObj.file)">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6" />
                  </svg>
                  <span>{{ fileObj.name }}</span>
                </li>
              </ul>
            </div>
          </div>
          <!-- Botones de Navegación -->
          <div class="flex justify-end space-x-4">
            <button @click="step = 1" class="bg-gray-300 hover:bg-gray-400 text-black py-2 px-4 rounded">Anterior</button>
            <button @click="save" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
              Terminar 
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, defineProps, defineEmits } from "vue";

// Definición de propiedades con datos iniciales de la tarea
const props = defineProps({
  task: {
    type: Object,
    default: () => ({
      id_tarea: null,
      titulo: "",
      descripcion: "",
      ClientName: "",
      startDate: "",
      startTime: "",
      status: "Disponible",
      assignedEmployee: null,
      attachmentName: [] // Almacenará objetos { name, file }
    })
  }
});
const emit = defineEmits(["close", "save"]);

// "isEdit" es verdadero si la tarea tiene un id (modo edición)
const isEdit = computed(() => !!props.task.id_tarea);

// Se crea una copia reactiva local para editar la tarea
const localTask = ref({ ...props.task });
watch(() => props.task, (newTask) => {
  localTask.value = { ...newTask };
});

// Variable para controlar el paso actual (1 o 2)
const step = ref(1);

// Errores de validación para campos obligatorios
const errors = ref({
  title: false,
  description: false,
  ClientName: false,
  startDate: false,
});

// Para manejo de archivos
const fileInput = ref(null);
const localFiles = ref([]);
const attachedFiles = computed(() =>
  localFiles.value.map(file => ({ name: file.name, file }))
);
watch(localFiles, (newFiles) => {
  localTask.value.attachmentName = newFiles.map(file => ({ name: file.name, file }));
});

// Lista de empleados con nombres reales
const employees = ref([
  { label: "Juan Pérez", value: "juan.perez" },
  { label: "María López", value: "maria.lopez" },
  { label: "Carlos García", value: "carlos.garcia" },
]);

// Función para abrir un archivo en nueva pestaña
const openFile = (file) => {
  const fileURL = URL.createObjectURL(file);
  window.open(fileURL, "_blank");
};

// Función para manejar carga de archivos desde input
const handleFileUpload = (event) => {
  const files = Array.from(event.target.files);
  localFiles.value.push(...files);
};

// Función para manejar archivos mediante drag & drop
const handleDrop = (event) => {
  event.preventDefault();
  const files = Array.from(event.dataTransfer.files);
  localFiles.value.push(...files);
};

// Función para disparar click en el input oculto
const triggerFileInput = () => {
  fileInput.value.click();
};

// Validar campos del Paso 1 y avanzar al Paso 2
const nextStep = () => {
  errors.value.title = !localTask.value.title;
  errors.value.description = !localTask.value.description;
  errors.value.ClientName = !localTask.value.ClientName;
  if (errors.value.title || errors.value.description || errors.value.ClientName) return;
  step.value = 2;
};

// Validar el Paso 2 y emitir el evento save con la tarea (incluye id si es edición)
const save = () => {
  errors.value.startDate = !localTask.value.startDate;
  if (errors.value.startDate) return;
  // Cambio realizado: Se ajusta el valor de status a "Por Hacer" (con H mayúscula) para que coincida con el kanbanboard
  localTask.value.status = localTask.value.assignedEmployee ? "Por Hacer" : "Disponible";
  localTask.value.attachmentName = attachedFiles.value;
  emit("save", { ...localTask.value });
};

// Función para cerrar el modal
const close = () => {
  emit("close");
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
  background-color: #f9fafb;
  border-radius: 0.5rem;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 30rem;
  padding: 1.5rem;
  position: relative;
  animation: slideDown 0.3s ease-out;
}
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
