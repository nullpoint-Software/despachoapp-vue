<!-- Board.vue -->
<template>
    <div class="board p-4 bg-gray-50 min-h-screen">
      <!-- Encabezado del Tablero -->
      <div class="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <h1 class="text-3xl font-extrabold text-gray-800">Tablero de Notas</h1>
        <!-- Controles: Buscador, Slider y Botón de Añadir Nota -->
        <div class="flex flex-col md:flex-row md:items-center md:space-x-6 w-full md:w-auto space-y-3 md:space-y-0">
          <!-- Buscador de notas -->
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar notas..."
              class="w-full md:w-72 pl-10 pr-4 py-2 border border-gray-300 rounded-full text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <i class="pi pi-search absolute left-3 top-2.5 text-gray-500"></i>
          </div>
          <!-- Slider para ajustar el número de columnas -->
          <div class="flex items-center space-x-2">
            <label for="columns" class="text-gray-700 font-medium">Columnas:</label>
            <input
              id="columns"
              type="range"
              min="1"
              max="5"
              v-model.number="gridColumns"
              class="w-32"
            />
            <span class="text-gray-700 font-semibold">{{ gridColumns }}</span>
          </div>
          <!-- Botón para añadir nueva nota (diseño modificado para círculo perfecto) -->
          <button
            @click="openAddModal"
            class="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 transition transform hover:scale-105 shadow-lg text-white flex items-center justify-center"
            aria-label="Añadir Nota"
          >
            <i class="pi pi-plus text-2xl"></i>
          </button>
        </div>
      </div>
  
      <!-- Grid de notas -->
      <div
        class="notes-grid gap-6"
        :style="{'display': 'grid', 'grid-template-columns': `repeat(${gridColumns}, minmax(0, 1fr))`}"
      >
        <Note v-for="note in filteredNotes" :key="note.id" :note="note" />
      </div>
  
      <!-- Modal para agregar una nueva nota -->
      <transition name="fade">
        <div
          v-if="showAddModal"
          class="fixed inset-0 modal-overlay flex items-center justify-center z-50"
          @click.self="closeAddModal"
        >
          <div class="modal-content relative bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full">
            <!-- Botón para cerrar el modal -->
            <button
              @click="closeAddModal"
              class="absolute top-3 right-3 text-gray-600 hover:text-gray-800 transition"
              aria-label="Cerrar"
            >
              <i class="pi pi-times text-2xl"></i>
            </button>
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Añadir Nota</h2>
            <!-- Formulario para la nueva nota -->
            <form @submit.prevent="addNote">
              <div class="mb-5">
                <label class="block text-gray-700 font-semibold mb-2" for="notetitulo">Título</label>
                <input
                  id="notetitulo"
                  v-model="newNote.titulo"
                  type="text"
                  placeholder="Ingresa el título"
                  class="w-full p-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div class="mb-6">
                <label class="block text-gray-700 font-semibold mb-2" for="notedescripcion">Descripción (Markdown)</label>
                <textarea
                  id="notedescripcion"
                  v-model="newNote.descripcion"
                  rows="5"
                  placeholder="Ingresa la descripción en Markdown"
                  class="w-full p-3 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                ></textarea>
              </div>
              <!-- Botones de acción -->
              <div class="flex justify-end space-x-4">
                <button
                  type="button"
                  @click="closeAddModal"
                  class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-xl transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from "vue";
  import Note from "./Note.vue";
import { ns } from "@/service/adminApp/client";
  
  // Array reactivo con las notas existentes
  const notes = ref(await ns.getNotas());
  
  // Ref para el buscador de notas
  const searchQuery = ref("");
  
  // Computed para filtrar notas según el texto de búsqueda
  const filteredNotes = computed(() =>
    notes.value.filter(
      (note) =>
        note.titulo.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        note.descripcion.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  );
  
  // Ref para el número de columnas del grid
  const gridColumns = ref(3);
  
  // Ref para controlar la visibilidad del modal de agregar nota
  const showAddModal = ref(false);
  
  // Ref para los datos del formulario de una nueva nota
  const newNote = ref({
    titulo: "",
    descripcion: ""
  });
  
  // Función para abrir el modal
  const openAddModal = () => {
    showAddModal.value = true;
  };
  
  // Función para cerrar el modal y resetear el formulario
  const closeAddModal = () => {
    showAddModal.value = false;
    newNote.value = { titulo: "", descripcion: "" };
  };
  
  // Función para agregar la nueva nota
  const addNote = async () => {
    const newId =
      notes.value.length > 0 ? Math.max(...notes.value.map((n) => n.id)) + 1 : 1;
    notes.value.push({ id: newId, ...newNote.value });
    await ns.addNota(newNote.value)
    closeAddModal();
  };
  </script>
  
  <style scoped>
  .board {
    background-color: #f9fafb;
  }
  
  /* Estilos para el modal */
  .modal-overlay {
    backdrop-filter: blur(4px);
    background-color: rgba(0, 0, 0, 0.45);
  }
  
  .modal-content {
    animation: slideDown 0.3s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Transición para modal */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  </style>
  