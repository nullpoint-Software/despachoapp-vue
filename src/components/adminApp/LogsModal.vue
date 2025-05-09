<!-- src/components/adminApp/LogsModal.vue -->
<template>
  <transition name="fade">
    <div
      v-if="visible"
      class="modal-overlay fixed inset-0 z-50 flex items-start justify-center"
      @click.self="closeModal"
    >
      <div class="modal-content bg-gray-50 p-6 rounded-md shadow-lg w-full max-w-3xl mt-10 max-h-[90vh] flex flex-col">
        <!-- Cabecera fija -->
        <div class="flex-none sticky top-0 bg-gray-50 pb-4 mb-4 z-10">
          <h2 class="text-2xl text-center text-black font-semibold mb-4">Registros de Cambios</h2>
          <div class="flex flex-col md:flex-row items-stretch md:space-x-4 space-y-4 md:space-y-0">
            <!-- Buscador -->
            <div class="relative w-full md:w-1/2">
              <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2 text-black"></i>
              <input
                v-model="searchId"
                type="text"
                placeholder="Buscar ID"
                class="w-full pl-10 pr-4 py-3 rounded-full bg-white text-black placeholder-gray-600 border-2 border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
              />
            </div>
            <!-- Dropdown filtros -->
            <div class="relative w-full md:w-1/2">
              <button
                @click="dropdownOpen = !dropdownOpen"
                class="w-full text-left bg-white border-2 border-red-600 rounded-full px-4 py-3 flex justify-between items-center focus:outline-none"
              >
                <span class="text-black">
                  {{ selectedTypes.length > 0
                     ? selectedLabels.join(', ')
                     : 'Seleccionar todos' }}
                </span>
                <i class="pi pi-chevron-down text-black"></i>
              </button>
              <div
                v-if="dropdownOpen"
                class="absolute mt-1 w-full bg-white border border-gray-200 rounded shadow-lg z-10 max-h-60 overflow-auto"
              >
                <ul>
                  <li
                    @click="selectAll"
                    class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                  >
                    <input type="checkbox" :checked="selectedTypes.length===0" class="mr-2"/>
                    <span class="text-black">Seleccionar todos</span>
                  </li>
                  <li
                    v-for="opt in typeOptions"
                    :key="opt.value"
                    @click="toggleType(opt.value)"
                    class="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                  >
                    <input type="checkbox" :checked="selectedTypes.includes(opt.value)" class="mr-2"/>
                    <span class="text-black">{{ opt.label }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <!-- Mostrar todos toggle -->
            <label class="flex-none flex items-center space-x-2 text-black">
              <input type="checkbox" v-model="showAll" class="form-checkbox h-5 w-5"/>
              <span>Mostrar todos</span>
            </label>
          </div>
        </div>

        <!-- Contenedor scrollable -->
        <div class="flex-1 overflow-y-auto pr-2">
          <div
            v-for="(log, i) in filteredLogs"
            :key="log.id"
            @click="toggleDetails(i)"
            class="flex flex-col p-4 mb-4 rounded border-l-4 cursor-pointer relative"
            :class="cardClasses(log)"
          >
            <div class="flex justify-between items-center">
              <div>
                <p class="font-semibold text-black">{{ humanizeType(log.type) }}</p>
                <p class="text-sm text-gray-700">{{ formatDate(log.timestamp) }} | ID: {{ log.aggregate_id }}</p>
              </div>
              <div class="flex items-center space-x-2">
                <i class="pi pi-chevron-down text-xl text-gray-700"></i>
                <Button
                  v-if="!log.payload.modificado"
                  icon="pi pi-undo"
                  class="p-button-text p-button-sm text-gray-700 hover:text-gray-500"
                  @click.stop="onUndo(log.id)"
                  aria-label="Deshacer cambio"
                />
              </div>
            </div>
            <div v-if="detailsVisible[i]" class="mt-4 w-full text-black">
              <table class="min-w-full table-auto border-collapse">
                <thead>
                  <tr>
                    <th class="px-4 py-2 border">Campo</th>
                    <th class="px-4 py-2 border">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(val, key) in log.payload" :key="key">
                    <td class="px-4 py-2 border">{{ key }}</td>
                    <td class="px-4 py-2 border">{{ val }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Botón cerrar -->
        <div class="flex-none flex justify-end mt-4">
          <Button
            label="Cerrar"
            icon="pi pi-times"
            class="p-button-text text-black hover:text-gray-600"
            @click="closeModal"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { ref, computed } from 'vue';
import Button from 'primevue/button';

export default {
  name: 'LogsModal',
  components: { Button },
  props: { visible: { type: Boolean, required: true } },
  emits: ['close','undo'],
  setup(_, { emit }) {
    const now = Date.now();
    const msDay = 864e5;
    const logs = ref(Array.from({ length: 15 }, (_, idx) => {
      const daysAgo = (idx * 6) % 90;
      return {
        id: idx + 1,
        type: ['PagoConceptoCreated','PagoConceptoUpdated','PagoConceptoDeleted'][idx % 3],
        aggregate_id: `ID-${1000 + idx}`,
        timestamp: new Date(now - daysAgo * msDay).toISOString(),
        payload: { ejemplo: `valor${idx + 1}` }
      };
    }));

    const detailsVisible = ref({});
    const searchId = ref('');
    const selectedTypes = ref([]);
    const dropdownOpen = ref(false);
    const showAll = ref(false);
    const typeOptions = [
      { label: 'Agregar', value: 'Created' },
      { label: 'Modificar', value: 'Updated' },
      { label: 'Eliminar', value: 'Deleted' }
    ];

    const filteredLogs = computed(() =>
      logs.value.filter(log => {
        if (!showAll.value) {
          const ts = Date.parse(log.timestamp);
          if (ts < now - 90 * msDay) return false;
        }
        if (!log.aggregate_id.toLowerCase().includes(searchId.value.toLowerCase())) return false;
        const suffix = log.type.match(/Created|Updated|Deleted/)[0];
        if (selectedTypes.value.length && !selectedTypes.value.includes(suffix)) return false;
        return true;
      })
    );

    function toggleType(val) {
      const i = selectedTypes.value.indexOf(val);
      if (i > -1) selectedTypes.value.splice(i, 1);
      else selectedTypes.value.push(val);
    }
    function selectAll() { selectedTypes.value = []; }
    const selectedLabels = computed(() =>
      selectedTypes.value.map(v => typeOptions.find(o => o.value === v).label)
    );

    function toggleDetails(i) { detailsVisible.value[i] = !detailsVisible.value[i]; }
    function closeModal() { emit('close'); dropdownOpen.value = false; }
    function onUndo(id) {
      const log = logs.value.find(l => l.id === id);
      log.payload.modificado = true;
      emit('undo', id);
    }
    function humanizeType(type) {
      if (type.endsWith("Created")) return "Pago concepto agregado";
      if (type.endsWith("Updated")) return "Pago concepto modificado";
      if (type.endsWith("Deleted")) return "Pago concepto eliminado";
      return type;
    }
    function formatDate(ts) { return new Date(ts).toLocaleString(); }
    function cardClasses(log) {
      if (log.payload.modificado) {
        return "bg-gray-400 border-gray-500 text-black";  // modificado usa gray-400
      }
      if (log.type.endsWith("Created")) return "bg-blue-100 border-blue-500 text-black";
      if (log.type.endsWith("Updated")) return "bg-yellow-100 border-yellow-500 text-black";
      if (log.type.endsWith("Deleted")) return "bg-red-100 border-red-500 text-black";
      return "";
    }

    return {
      searchId,
      selectedTypes,
      typeOptions,
      selectedLabels,
      dropdownOpen,
      showAll,
      filteredLogs,
      detailsVisible,
      toggleType,
      selectAll,
      toggleDetails,
      closeModal,
      onUndo,
      humanizeType,
      formatDate,
      cardClasses
    };
  }
};
</script>

<style>
.modal-overlay {
  backdrop-filter: blur(4px);
  background-color: rgba(0,0,0,0.5);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* Scrollbar styling */
.modal-content .overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}
.modal-content .overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}
.modal-content .overflow-y-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}
.modal-content .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
