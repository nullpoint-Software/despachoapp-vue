<template>
    <!-- Contenedor principal -->
    <div class="flex flex-col h-full w-full">
      <!-- Encabezado responsivo con degradado de fondo -->
      <header class="w-full py-6 px-4 bg-transparent text-white text-center">
        <h1 class="font-extrabold text-3xl sm:text-4xl">Inicio</h1>
      </header>
  
      <!-- Contenedor principal para selector, gráfico y resumen -->
      <main class="flex-grow overflow-auto p-4 bg-transparent">
        <div class="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6 flex flex-col gap-6">
          <!-- Selector de período -->
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <label for="periodo" class="font-bold text-lg text-gray-700">Ver por:</label>
            <select
              v-model="periodo"
              id="periodo"
              class="p-2 rounded-md border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-400"
            >
              <option value="dia">Día</option>
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
              <option value="anios">Años</option>
            </select>
          </div>
  
          <!-- Contenedor del gráfico: se adapta según el tamaño del contenedor -->
          <div class="relative w-full" :class="chartContainerClass">
            <Bar :data="chartData" :options="chartOptions" />
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
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue'
  import { Bar } from 'vue-chartjs'
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
  } from 'chart.js'
  
  // Registra los módulos de Chart.js
  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
  
  // Variable reactiva para el período seleccionado
  const periodo = ref('mes')
  
  // Datos de ejemplo para cada período
  const datos = {
    dia: [
      { nombre: '08:00', ganancia: 120 },
      { nombre: '12:00', ganancia: 230 },
      { nombre: '16:00', ganancia: 180 },
      { nombre: '20:00', ganancia: 90 }
    ],
    mes: [
      { nombre: '1 Abr', ganancia: 450 },
      { nombre: '2 Abr', ganancia: 700 },
      { nombre: '3 Abr', ganancia: 600 }
    ],
    anio: [
      { nombre: 'Enero', ganancia: 3000 },
      { nombre: 'Febrero', ganancia: 4200 },
      { nombre: 'Marzo', ganancia: 5100 }
    ],
    anios: [
      { nombre: '2022', ganancia: 20000 },
      { nombre: '2023', ganancia: 31000 },
      { nombre: '2024', ganancia: 37000 }
    ]
  }
  
  // Resumen de ganancias totales
  const resumen = computed(() => ({
    dia: datos.dia.reduce((acc, x) => acc + x.ganancia, 0),
    mes: datos.mes.reduce((acc, x) => acc + x.ganancia, 0),
    anio: datos.anio.reduce((acc, x) => acc + x.ganancia, 0),
    anios: datos.anios.reduce((acc, x) => acc + x.ganancia, 0)
  }))
  
  // Paleta de colores para cada barra
  const colores = ['#4ade80', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#f87171']
  
  // Configuración del chart (datos y opciones)
  const chartData = computed(() => {
    const d = datos[periodo.value]
    return {
      labels: d.map(x => x.nombre),
      datasets: [
        {
          label: 'Ganancias',
          data: d.map(x => x.ganancia),
          backgroundColor: d.map((_, i) => colores[i % colores.length]),
          borderColor: d.map((_, i) => colores[i % colores.length]),
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 40
        }
      ]
    }
  })
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#333' },
        grid: { color: '#e5e7eb' }  // gris claro para la cuadrícula
      },
      x: {
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
      }
    }
  }
  
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
  