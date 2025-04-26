<template>
  <!-- Contenedor principal -->
  <div v-if="loaded" class="flex flex-col h-full w-full">
    <!-- Encabezado responsivo con degradado de fondo -->
    <header class="w-full py-6 px-4 bg-transparent text-white text-center">
      <h1 class="font-extrabold text-3xl sm:text-4xl">Inicio</h1>
    </header>

    <!-- Contenedor principal para selector, gráfico y resumen -->

    <main class="flex-grow overflow-auto p-4 bg-transparent">
      <div class="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 flex flex-col gap-6">
        <!-- Selector de período -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <div class="period-control flex-row">
            <label for="periodo" class="mr-4 font-bold text-lg text-gray-700">Ver por:</label>
            <select v-model="periodo" id="periodo"
              class="p-2 rounded-md border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-400">
              <option value="dia">Día</option>
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
              <option value="anios">Años</option>
            </select>
          </div>

          <div class="flex sm:inline-flex flex-row sm:items-center sm:gap-4 chart-controls">
            <label class="mr-2 items-center space-x-2 text-gray-800 cursor-pointer">
              <input type="checkbox" class="form-checkbox text-blue-600" :checked="chartOptions.scales.y.stacked"
                @change="toggleStacked" />
              <span>Agrupar barras</span>
            </label>
            <label class="items-center space-x-2 text-gray-800 cursor-pointer">
              <input type="checkbox" class="form-checkbox text-blue-600"
                :checked="chartOptions.plugins.zoom.pan.enabled" @change="toggleZoom" />
              <span>Activar zoom</span>
            </label>
          </div>

        </div>
        <div class="info m-0 text-center -mb-7 -mt-4" v-if="chartOptions.plugins.zoom.pan.enabled">
          <p class="font-semibold italic px-0 text-gray-600">Ajustar zoom con rueda del mouse o deslizar con 2
            dedos</p>
        </div>
        <!-- Contenedor del gráfico: se adapta según el tamaño del contenedor -->
        <div class="relative w-full" :class="chartContainerClass">
          <Bar :data="chartData" :options="chartOptions" :key="chartKey" :ref="chartRef" :plugins="[emptyDataPlugin]" />
        </div>



        <!-- Resumen de ganancias en tarjetas -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-blue-500 hover:bg-blue-600 transition duration-300 text-white p-4 rounded-xl shadow">
            <div class="font-bold text-lg">Hoy</div>
            <div class="text-2xl font-semibold mt-2">${{ resumen.dia }}</div>
          </div>
          <div class="bg-green-500 hover:bg-green-600 transition duration-300 text-white p-4 rounded-xl shadow">
            <div class="font-bold text-lg">Este mes</div>
            <div class="text-2xl font-semibold mt-2">${{ resumen.mes }}</div>
          </div>
          <div class="bg-yellow-500 hover:bg-yellow-600 transition duration-300 text-white p-4 rounded-xl shadow">
            <div class="font-bold text-lg">Este año</div>
            <div class="text-2xl font-semibold mt-2">${{ resumen.anio }}</div>
          </div>
          <div class="bg-purple-500 hover:bg-purple-600 transition duration-300 text-white p-4 rounded-xl shadow">
            <div class="font-bold text-lg">Histórico</div>
            <div class="text-2xl font-semibold mt-2">${{ resumen.anios }}</div>
          </div>
        </div>
      </div>
    </main>
    <main class="flex-grow overflow-auto p-4 bg-transparent">
      <header class="w-full py-6 px-4 bg-transparent text-white text-center">
        <h1 class="font-extrabold text-3xl sm:text-4xl">Tareas pendientes</h1>
      </header>
      <div class="max-w-6xl mx-auto place-items-center bg-transparent rounded-xl p-2 flex flex-col gap-6">
        <KanbanBoard :showDisponible="false" :showTerminado="false" :showOwn="true" :mini="true"
          :showEnProgreso="false"></KanbanBoard>
      </div>
    </main>
  </div>
  <div v-else>
    <Loader></Loader>
  </div>


</template>

<script setup>
import { nextTick } from 'vue'
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { es } from '@/service/adminApp/client'
import KanbanBoard from '../kanbanComponents/KanbanBoard.vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom';
import Loader from './Loader.vue'
const loaded = ref(false)
// Registra los módulos de Chart.js
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, zoomPlugin)

// Variable reactiva para el período seleccionado
const periodo = ref('mes')
const chartKey = ref(0);
// Datos de ejemplo para cada período
loaded.value = false;
const datos = await es.getDatos()
if (datos) {
  await nextTick(); // Wait for DOM update
  loaded.value = true;
}
// Chart reference to get instance for zoom control
const chartRef = ref(null);
// Resumen de ganancias totales
const resumen = computed(() => ({
  dia: datos.dia.reduce((acc, x) => acc + x.ganancia, 0),
  mes: datos.mes.reduce((acc, x) => acc + x.ganancia, 0),
  anio: datos.anio.reduce((acc, x) => acc + x.ganancia, 0),
  anios: datos.anios.reduce((acc, x) => acc + x.ganancia, 0)
}))

// Paleta de colores para cada barra
const colores = ['#4ade80', '#ff4757', '#1e90ff']

// Configuración del chart (datos y opciones)
const chartData = ref(computed(() => {
  const d = datos[periodo.value] || []
  return {
    labels: d.map(x => x.nombre),
    datasets: [
      {
        label: 'Ingresos',
        data: d.map(x => x.ingresos),
        backgroundColor: d.map((_, i) => colores[2]),  // Ingresos color
        borderColor: d.map((_, i) => colores[2]),
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 40
      },
      {
        label: 'Costos',
        data: d.map(x => x.costos),
        backgroundColor: d.map((_, i) => colores[1]),  // Costos color
        borderColor: d.map((_, i) => colores[1]),
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 40
      },
      {
        label: 'Ganancia',
        data: d.map(x => x.ganancia),
        backgroundColor: d.map((_, i) => colores[0]),  // Ganancia color
        borderColor: d.map((_, i) => colores[0]),
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 40
      }
    ]
  }
}))

const emptyDataPlugin = {
  id: 'emptyData',
  beforeDraw(chart) {
    const datasetsEmpty = chart.data.datasets.every(
      (dataset) =>
        !dataset.data || dataset.data.length === 0 || dataset.data.every(v => v === 0)
    );

    if (datasetsEmpty) {
      const { width, height } = chart;
      const ctx = chart.ctx;
      
      if (!ctx) return;

      ctx.save()
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText('No hay información para este periodo', width / 2, height / 2);
      ctx.restore();
    }
  }
};



const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      stacked: false,
      ticks: {
        color: 'null',
        callback: function (value) {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(value);
        },
        display: true
      },
      grid: { color: '#e5e7eb' }
    },
    x: {
      stacked: false,
      ticks: { color: '#333' },
      grid: { display: false }
    }
  },
  plugins: {
    legend: {
      labels: {
        color: '#333',
        font: { weight: '600' }
      }
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = context.dataset.label || '';
          const value = context.raw;
          return `${label}: ` + new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(value);
        }
      }
    },
    zoom: {
      pan: { enabled: true, mode: 'x' },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: 'x'
      }
    },
    emptyData: {}
  }
});
// Toggle the stacked option
const toggleStacked = () => {
  const stackedd = !chartOptions.value.scales.y.stacked;
  chartOptions.value.scales.y.stacked = stackedd;
  chartOptions.value.scales.y.ticks.display = !stackedd;
  chartOptions.value.scales.x.stacked = stackedd;
  chartKey.value++;
};

const toggleZoom = () => {
  const stackedd = !chartOptions.value.plugins.zoom.pan.enabled
  chartOptions.value.plugins.zoom.pan.enabled = stackedd;
  chartOptions.value.plugins.zoom.zoom.wheel.enabled = stackedd;
  chartOptions.value.plugins.zoom.zoom.pinch.enabled = stackedd;
  chartKey.value++;
};

// Clase dinámica para el contenedor del gráfico según el viewport
const chartContainerClass = computed(() => {
  // Se asignan distintas alturas según el ancho de ventana
  const width = window.innerWidth
  if (width < 640) return 'h-64'
  if (width >= 640 && width < 1024) return 'h-80'
  return 'h-96'
})
</script>

<style scoped>
/* Puedes agregar reglas adicionales de responsividad si es necesario */
</style>