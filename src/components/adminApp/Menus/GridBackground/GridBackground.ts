import { onMounted, onUnmounted } from 'vue';
import gsap from 'gsap';

let animation: gsap.core.Tween | undefined;

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
