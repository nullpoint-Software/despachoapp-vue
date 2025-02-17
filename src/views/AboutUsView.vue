<template>
    <div class="h-auto min-h-screen w-full bg-blue-200 text-green-900 flex flex-col">
      <!-- Navbar -->
      <nav class="flex justify-between items-center p-4 bg-blue-900 shadow-lg">
        <div class="flex items-center space-x-2">
          <img :src="mainImageSrc" alt="Company Logo" class="w-14 md:w-20" />
          <span class="hidden md:block text-lg font-bold text-amber-50">
            DESPACHO CONTABLE Y FISCAL SÁNCHEZ
          </span>
        </div>
        <div class="hidden md:flex text-amber-50 space-x-6">
          <a href="#" @click.prevent="navigateTo('/')" class="hover:text-blue-300">Inicio</a>
          <a href="#" @click.prevent="scrollToFooter" class="hover:text-blue-300">Contacto</a>
          <a href="#" @click.prevent="navigateTo('/aboutus')" class="hover:text-blue-300">Sobre Nosotros</a>
        </div>
        <button @click="menuOpen = true" class="md:hidden text-white text-2xl">
          <i class="pi pi-bars"></i>
        </button>
      </nav>
  
      <!-- Sección Sobre Nosotros -->
      <div class="flex flex-col items-center text-center flex-grow py-16 px-6 bg-blue-500 text-white">
        <h1 class="text-3xl md:text-5xl font-extrabold drop-shadow-lg">Sobre Nosotros</h1>
        <p class="max-w-3xl mt-6 text-sm md:text-lg leading-relaxed opacity-90">
          Somos un despacho contable con más de 17 años de experiencia en la prestación de servicios en
          <span class="font-semibold">Contabilidad, Fiscalidad, Pensiones, Afores y Seguridad Social (IMSS).</span>
        </p>
        <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <div class="bg-blue-700 p-6 rounded-lg shadow-lg">
            <h3 class="text-lg font-bold">Misión</h3>
            <p class="text-sm">Brindar soluciones contables y fiscales con un enfoque estratégico para asegurar la estabilidad financiera de nuestros clientes.</p>
          </div>
          <div class="bg-blue-700 p-6 rounded-lg shadow-lg">
            <h3 class="text-lg font-bold">Visión</h3>
            <p class="text-sm">Ser el despacho contable líder en la región, reconocido por nuestra excelencia y compromiso con cada cliente.</p>
          </div>
          <div class="bg-blue-700 p-6 rounded-lg shadow-lg">
            <h3 class="text-lg font-bold">Valores</h3>
            <p class="text-sm">Compromiso, Transparencia, Profesionalismo e Innovación en cada servicio que ofrecemos.</p>
          </div>
        </div>
      </div>
  
      <!-- Footer -->
      <footer id="footer" class="flex flex-col w-full bg-blue-900 text-gray-200 px-6 md:px-48 py-9 text-center md:text-left">
        <div class="flex flex-col md:flex-row items-center md:justify-between gap-6 md:gap-0">
          <div class="flex flex-col items-center gap-4 text-center">
            <img :src="mainImageSrc" alt="Logo" class="w-16 md:w-20 mx-auto" />
            <span class="text-sm md:text-lg font-semibold uppercase">Despacho Contable y Fiscal Sánchez</span>
          </div>
          <div class="flex flex-col gap-2">
            <div class="font-bold text-center uppercase text-gray-300 text-sm md:text-lg">Contacto</div>
            <p class="text-sm">L.C.P. Antonio Sánchez Gutiérrez</p>
            <a href="mailto:contador_sanchez@yahoo.com.mx" class="text-sm hover:underline">contador_sanchez@yahoo.com.mx</a>
            <a href="tel:3163720279" class="text-sm hover:underline">316 372 0279</a>
          </div>
        </div>
        <div class="w-full border-t border-gray-400 my-6 md:my-8"></div>
        <div class="text-sm text-gray-300 text-center">© 2025 Despacho Contable y Fiscal Sánchez - Todos los derechos reservados.</div>
      </footer>
    </div>
</template>
  
<script>
import { ref } from "vue";
import { useRouter } from "vue-router";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";

export default {
  setup() {
    const menuOpen = ref(false);
    const router = useRouter();

    const navigateTo = (path) => {
      router.push(path);
      menuOpen.value = false;
    };

    const scrollToFooter = () => {
      const footer = document.getElementById("footer");
      if (footer) {
        footer.scrollIntoView({ behavior: "smooth" });
      }
    };

    return { menuOpen, navigateTo, scrollToFooter, mainImageSrc };
  },
};
</script>
