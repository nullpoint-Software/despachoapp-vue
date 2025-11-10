import { ref, onMounted } from 'vue';

export function useMobileDetection() {
  const isMobile = ref(false);

  onMounted(() => {
    // La expresión regular /Mobi/i busca la cadena "Mobi" (sin importar mayúsculas/minúsculas)
    // en el User-Agent. Esta es la forma más estándar de identificar teléfonos.
    isMobile.value = /Mobi/i.test(navigator.userAgent);
  });

  return { isMobile };
}