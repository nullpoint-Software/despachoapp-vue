<!-- TaskFormModal.vue -->
<template>
  <transition name="fade">
    <div class="modal-overlay" @click.self="close">
      <div class="modal-content relative bg-gray-50">
        <!-- Encabezado: cambia según el estado (editar o agregar) -->
        <div class="task-modal-header flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
          <div class="task-modal-icon">
            <!-- Si es edición, muestra icono de lápiz; si es agregar, de más -->
            <template v-if="isEdit">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </template>
            <template v-else>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
          </div>
          <div><p class="modal-kicker">REGISTRO / TAREAS</p><h3 class="text-2xl font-bold text-black">{{ isEdit ? 'Editar tarea' : 'Nueva tarea' }}</h3><span class="modal-description">Define el trabajo y la información necesaria para completarlo.</span></div>
          <button type="button" class="modal-close-button" aria-label="Cerrar" @click="close">×</button>
        </div>

        <!-- Paso 1: Datos básicos -->
        <div class="space-y-4 px-4">
          <!-- Título (obligatorio) -->
          <div>
            <label class="block font-semibold text-black">Título *</label>
            <input type="text" v-model="localTask.titulo" placeholder="Ingrese el título"
              :class="['w-full p-2 border rounded text-black', errors.titulo ? 'border-red-500' : 'border-gray-300']" />
            <p v-if="errors.titulo" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Descripción (obligatoria) -->
          <div>
            <label class="block font-semibold text-black">Descripción *</label>
            <textarea v-model="localTask.descripcion" placeholder="Ingrese la descripción" rows="3"
              :class="['w-full p-2 border rounded text-black', errors.descripcion ? 'border-red-500' : 'border-gray-300']"></textarea>
            <p v-if="errors.descripcion" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div>
          <!-- Cliente (obligatorio) -->
          <!-- <div>
            <label class="block font-semibold text-black">Cliente *</label>
            <select v-model="localTask.ClientName"
              :class="['w-full p-2 border rounded bg-white text-black', errors.ClientName ? 'border-red-500' : 'border-gray-300']">
              <option :value="null" disabled>Seleccione un cliente</option>
              <option v-for="client in clients" :key="client.value" :value="client.value">
                {{ client.nombre +  }}
              </option>
            </select>
            <p v-if="errors.ClientName" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div> -->
          <!-- Empleado Asignado (opcional) -->

          <!-- Botón para pasar al siguiente paso -->
          <div class="task-modal-actions flex justify-end">
            <button @click="emit('close')"
              class="cursor-pointer mr-4 items-center justify-center gap-2 px-4 py-2 bg-gray-500 rounded-md text-white font-semibold shadow hover:bg-gray-400 transition transform hover:scale-105 focus:outline-none">Cancelar</button>
            <button @click="save" class="cursor-pointer items-center justify-center gap-2 px-4 py-2 bg-blue-500 rounded-md text-white font-semibold shadow hover:bg-blue-400 transition transform hover:scale-105 focus:outline-none">
              Terminar
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline ml-1" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Paso 2: Programación -->
        <!-- <div v-if="step === 2" class="space-y-4 px-4 mt-6"> -->
        <!-- Fecha de Inicio (obligatoria) con icono -->
        <!-- <div>
            <label class="block font-semibold text-black">Fecha de Inicio *</label>
            <div class="relative">
              <input type="date" v-model="localTask.startDate" lang="es" placeholder="Seleccione una fecha"
                :class="['w-full p-2 pl-10 border rounded text-black', errors.startDate ? 'border-red-500' : 'border-gray-300']" />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p v-if="errors.startDate" class="text-red-500 text-sm">Este campo es obligatorio.</p>
          </div> -->
        <!-- Hora de Inicio (opcional) con icono -->
        <!-- <div>
            <label class="block font-semibold text-black">Hora de Inicio (opcional)</label>
            <div class="relative">
              <input type="time" v-model="localTask.startTime" lang="es" placeholder="Seleccione una hora"
                class="w-full p-2 pl-10 border border-gray-300 rounded text-black" />
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div> -->
        <!-- 
            Cambio: Se eliminó la sección de "Archivos Adjuntos" para quitar la funcionalidad de carga de archivos.
          -->
        <!-- Botones de Navegación -->
        <!-- </div> -->
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, defineProps, defineEmits, onMounted } from "vue";
import { cs, formatFechaHoraFullSQL } from "@/service/adminApp/client";
import { us } from "@/service/adminApp/client";
import { ts } from "@/service/adminApp/client";
import { loadProgressively } from "@/service/adminApp/progressiveLoader";
const isAdmin = (localStorage.getItem("level") == 'Administrador')

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
      estado: "Disponible",
      assignedEmployee: null,
      attachmentName: [] // Se mantiene la propiedad, pero ya no se usa para archivos adjuntos
    })
  }
});
const emit = defineEmits(["close", "save"]);
const clients = ref([])
// "isEdit" es verdadero si la tarea tiene un id (modo edición)
const isEdit = computed(() => !!props.task.id_tarea);

// Se crea una copia reactiva local para editar la tarea
const localTask = ref({ ...props.task, assignedEmployee: props.task.id_usuario ?? null });
watch(() => props.task, (newTask) => {
  localTask.value = { ...newTask };
});

// Variable para controlar el paso actual (1 o 2)

// Errores de validación para campos obligatorios
const errors = ref({
  titulo: false,
  descripcion: false,
});

// Lista de empleados con nombres reales
const employees = ref([]);
onMounted(async()=>{const [clientResult,employeeResult]=await Promise.allSettled([loadProgressively({pageSize:40,fetchPage:(page)=>cs.getClientes(page),onUpdate:(items)=>{clients.value=items}}),us.getUsuarios()]);if(clientResult.status==="rejected")console.error("No se cargaron los clientes",clientResult.reason);if(employeeResult.status==="fulfilled")employees.value=Array.isArray(employeeResult.value)?employeeResult.value:[]});

// Validar campos del Paso 1 y avanzar al Paso 2
const nextStep = () => {
  errors.value.titulo = !localTask.value.titulo;
  errors.value.descripcion = !localTask.value.descripcion;
  // errors.value.ClientName = !localTask.value.ClientName;
  if (errors.value.titulo || errors.value.descripcion) return;

};

// Validar el Paso 2 y emitir el evento save con la tarea (incluye id si es edición)
const save = async () => {
  errors.value.titulo = !localTask.value.titulo;
  errors.value.descripcion = !localTask.value.descripcion;
  if (errors.value.titulo || errors.value.descripcion) return;
  if (localTask.value.id_usuario||localTask.value.id_tarea) { //para tareas que EXISTEN en la BD(que tienen un usuario asignado o existen en la columna Disponible pero sin usuario asignado)
    
    console.log("edit!");
    console.log("current task: " + localTask.value.id_tarea);
   
    console.log("current estado: " + localTask.value.estado);

    // const emp = employees.value.find(e => e.value.id_usuario === localTask.assignedEmployee.id_usuario);
    if (!localTask.value.assignedEmployee) {
      console.log("cambiando a disp");
      await ts.updateTarea(localTask.value.id_tarea, null, "Disponible",null,localTask.value.titulo, localTask.value.descripcion)
      window.location.reload();
      return
    } if(localTask.value.estado == "Terminado"){
      console.log("had finished");
      await ts.updateTarea(localTask.value.id_tarea, localTask.value.assignedEmployee, localTask.value.estado,formatFechaHoraFullSQL(localTask.value.fecha_vencimiento),localTask.value.titulo,localTask.value.descripcion)
      window.location.reload();
      return
    }
    else {
      console.log("assignedEmployee value:", localTask.value.assignedEmployee);
      await ts.updateTarea(localTask.value.id_tarea, localTask.value.assignedEmployee, localTask.value.assignedEmployee && localTask.value.estado == "Disponible" ? "Pendiente" : localTask.value.estado,null,localTask.value.titulo,localTask.value.descripcion)
      window.location.reload();
      return
    }
  } else {
    
    console.log("new");

    localTask.value.estado = "Disponible";
    if (!localTask.value.assignedEmployee) {
      await ts.addTarea(localTask.value);
    }else{ //si se le asigna usuario manualmente desde el dropdown cuando esta disponible
      if(!localTask.value.id_tarea){ //si la tarea es nueva
        await ts.addTarea(localTask.value, localTask.value.assignedEmployee)
      }else{ //si la tarea ya existe
        await ts.updateTarea(localTask.value.id_tarea, localTask.value.assignedEmployee, "Pendiente")
      }
      
    }
    window.location.reload();
  }
  // Se emite la tarea sin archivos adjuntos
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
.modal-content{max-width:48rem;padding:0!important;border:2px solid #0e0e0d!important;border-radius:0!important;background:var(--br-control)!important;box-shadow:12px 12px 0 var(--br-accent)!important}.task-modal-header{position:relative;display:block!important;margin:0!important;padding:1.4rem 4.5rem 1.25rem 1.5rem!important;border:0!important;border-bottom:2px solid #141413!important;border-radius:0!important;background:#141413!important;color:var(--br-text)!important}.task-modal-icon{display:none}.modal-kicker{margin:0 0 .45rem;color:var(--br-accent);font:800 .75rem "Courier New",monospace;letter-spacing:.09em}.task-modal-header h3{margin:0;color:var(--br-text)!important;font:900 clamp(1.8rem,5vw,3.2rem)/.95 Arial,sans-serif!important;letter-spacing:-.055em;text-transform:uppercase}.modal-description{display:block;margin-top:.65rem;color:var(--br-muted);font:600 .82rem/1.3 "Courier New",monospace}.modal-close-button{position:absolute;right:0;top:0;width:3.75rem;height:3.75rem;border:0;border-left:2px solid var(--br-control);border-bottom:2px solid var(--br-control);background:var(--br-accent);color:var(--br-accent-text);font:400 2rem/1 Arial;cursor:pointer}.modal-content>.space-y-4{padding:1.5rem!important}.modal-content input,.modal-content textarea{min-height:3rem;border:1px solid #56534c!important;border-radius:0!important;background:#fff!important;color:#141413!important;padding:.75rem!important;font:700 .9rem "Courier New",monospace}.task-modal-actions{gap:.75rem;padding-top:1rem;border-top:1px solid #77736b}.task-modal-actions button{min-height:3rem;border:1px solid #141413!important;border-radius:0!important;background:transparent!important;color:#141413!important;padding:.7rem 1rem!important;font:800 .78rem "Courier New",monospace!important;text-transform:uppercase;box-shadow:none!important;transform:none!important}.task-modal-actions button:last-child{background:var(--br-accent)!important;color:var(--br-accent-text)!important;border-color:var(--br-accent)!important}@media(max-width:640px){.modal-content{box-shadow:6px 6px 0 var(--br-accent)!important}}
</style>
