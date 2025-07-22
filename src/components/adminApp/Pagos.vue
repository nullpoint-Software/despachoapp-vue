<template>
  <!-- Contenedor principal de la vista de Pagos -->
  <div class="pagos-container">
    <!-- Título -->
    <div class="pagos-title">
      Pagos
    </div>

    <!-- Pestañas con estilo de ventanas de navegador -->
    <div class="tabs">
      <router-link
        to="/app/pagos/historial"
        class="tab"
        active-class="active-tab"
      >
        Historial
      </router-link>
      <router-link
        to="/app/pagos/concepto"
        class="tab"
        active-class="active-tab"
      >
        Concepto
      </router-link>
      <!-- <router-link
        to="/app/pagos/mensual"
        class="tab"
        active-class="active-tab"
      >
        Mensual
      </router-link> -->
    </div>

    <!-- Contenedor para cargar la tabla correspondiente -->
    <div class="tab-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup>
// No se requieren variables adicionales en el contenedor
</script>

<style scoped>
/* Contenedor principal: fondo transparente */
.pagos-container {
  width: 100%;
  height: 100%;
  padding: 1rem;
  background-color: transparent;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Título: texto blanco para resaltar */
.pagos-title {
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 1.5rem;
  color: white;
}

/* Pestañas: estilo de ventana de navegador */
.tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  border-bottom: 2px solid #d1d5db; /* gray-300 */
}

.tab {
  padding: 0.75rem 1.5rem;
  margin: 0 0.5rem;
  background-color: #e0e0eb;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 0.5rem 0.5rem 0 0;
  text-decoration: none;
  color: #374151; /* gray-700 */
  font-weight: 600;
  transition: background-color 0.3s, color 0.3s;
}

.tab:hover {
  background-color: #2563eb; /* blue-600 */
  color: white;
}

/* Pestaña activa: fondo azul con animación de resaltado */
.active-tab {
  background-color: #007bff; /* blue-500 */
  color: white;
  border-color: #007bff;
  animation: pulseHighlight 2s infinite;
}

/* Animación de pulsado para la pestaña activa */
@keyframes pulseHighlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(0, 123, 255, 0.7);
  }
}

/* Contenedor del contenido de la pestaña */
.tab-content {
  background-color: white;
  padding: 1rem;
  border: 1px solid #d1d5db; /* gray-300 */
  border-radius: 0 0.5rem 0.5rem 0.5rem;
}
</style>
