<template>
  <div class="grid-background fixed inset-0 z-0"></div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import gsap from 'gsap';

let animation;

onMounted(() => {
  animation = gsap.to('.grid-background', {
    backgroundPosition: '+=25px +=25px', // Mueve el fondo en un bucle perfecto con el tamaño del grid
    repeat: -1, // Repetir infinitamente
    ease: 'none', // Movimiento constante y lineal
    duration: 5, // Duración lenta para un efecto sutil
  });
});

onUnmounted(() => {
  // Limpia la animación para evitar fugas de memoria
  if (animation) {
    animation.kill();
  }
});
</script>

<style scoped>
.grid-background {
  /* Toma dinámicamente el color del borde del tema y le aplica transparencia */
  --grid-dot-color: color-mix(in srgb, var(--color-border), transparent 1%);
  --grid-size: 25px;
  --dot-size: 1px;
  
  /* Crea el patrón de puntos usando un degradado radial */
  background-image: radial-gradient(circle at center, var(--grid-dot-color) var(--dot-size), transparent var(--dot-size));
  background-size: var(--grid-size) var(--grid-size);
}
</style>