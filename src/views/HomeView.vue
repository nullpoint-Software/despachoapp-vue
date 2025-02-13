<template>
  <div
    class="h-auto min-h-screen w-full bg-blue-200 text-green-900 flex flex-col"
  >
    <!-- Navbar -->
    <nav class="flex justify-between items-center p-4 bg-blue-900 shadow-lg">
      <div class="flex items-center space-x-2">
        <img :src="mainImageSrc" alt="Company Logo" class="w-14 md:w-20" />
        <span class="hidden md:block text-lg font-bold text-amber-50">
          DESPACHO CONTABLE Y FISCAL SÁNCHEZ
        </span>
      </div>
      <div class="hidden md:flex text-amber-50 space-x-6">
        <a href="#" class="hover:text-blue-300">Inicio</a>
        <a href="#" class="hover:text-blue-300">Contacto</a>
        <a href="#" class="hover:text-blue-300">Sobre Nosotros</a>
        <p></p>
      </div>

      <!-- Botón Menú en Móviles -->
      <button @click="menuOpen = true" class="md:hidden text-white text-2xl">
        <i class="pi pi-bars"></i>
      </button>
    </nav>

    <!-- Sidebar Menú -->
    <div
      v-if="menuOpen"
      class="fixed inset-0 bg-black bg-opacity-50 z-50"
      @click.self="menuOpen = false"
    >
      <div class="w-64 bg-blue-900 h-full flex flex-col p-6">
        <button @click="menuOpen = false" class="self-end text-white text-2xl">
          <i class="pi pi-times"></i>
        </button>
        <a href="#" class="text-white text-lg py-2 hover:text-blue-300"
          >Inicio</a
        >
        <a href="#" class="text-white text-lg py-2 hover:text-blue-300"
          >Contacto</a
        >
        <a href="#" class="text-white text-lg py-2 hover:text-blue-300"
          >Sobre Nosotros</a
        >
        <button
          class="mt-4 bg-white px-4 py-2 rounded-lg text-blue-600 hover:bg-blue-100"
        >
          Iniciar Sesión
        </button>
      </div>
    </div>

    <!-- Hero -->
    <div
      class="flex flex-col items-center justify-center text-center py-16 px-6 flex-grow bg-blue-500 text-white"
    >
      <h1 class="text-3xl md:text-5xl font-extrabold drop-shadow-lg">
        DESPACHO CONTABLE Y FISCAL SÁNCHEZ
      </h1>
      <p class="max-w-3xl mt-6 text-sm md:text-lg leading-relaxed opacity-90">
        Soluciones estratégicas en
        <span class="font-semibold"
          >Contabilidad, Fiscalidad, Pensiones, Afores y Seguridad Social
          (IMSS).</span
        >
        <br /><br />
        Atención personalizada con el
        <span class="font-semibold">L.C.P. Antonio Sánchez Gutiérrez</span> y un
        equipo comprometido con tu tranquilidad financiera.
      </p>
      <div class="mt-8">
        <button
          class="bg-white text-blue-700 font-semibold px-6 md:px-8 py-2 md:py-3 rounded-lg text-sm md:text-lg shadow-md hover:bg-blue-100 transition duration-300"
        >
          Iniciar Sesión
        </button>
      </div>
    </div>

    <!-- Carrusel -->
    <div class="w-full flex items-center justify-center bg-blue-500 py-12">
      <Carousel
        :value="carouselItems"
        :numVisible="1"
        :numScroll="1"
        circular
        :autoplayInterval="4000"
        class="w-[90%] md:w-[80%] lg:w-[70%]"
      >
        <template #item="slotProps">
          <div
            class="relative w-full h-[300px] md:h-[500px] flex justify-center items-center"
          >
            <img
              :src="slotProps.data.image"
              class="w-full h-full object-cover rounded-lg shadow-xl"
            />
            <div
              class="absolute bottom-0 bg-blue-700 text-white p-4 md:p-6 w-full text-center rounded-b-lg"
            >
              <h3 class="text-lg md:text-2xl font-bold text-white-200">
                {{ slotProps.data.title }}
              </h3>
              <p class="text-sm md:text-md">{{ slotProps.data.description }}</p>
            </div>
          </div>
        </template>
      </Carousel>
    </div>

    <!-- Footer -->
    <footer
      class="flex flex-col w-full bg-blue-900 text-gray-200 px-6 md:px-48 py-9 text-center md:text-left"
    >
      <div
        class="flex flex-col md:flex-row items-center md:justify-between gap-6 md:gap-0"
      >
        <div class="flex flex-col items-center gap-4 text-center">
          <img :src="mainImageSrc" alt="Logo" class="w-16 md:w-20 mx-auto" />
          <div class="flex flex-col items-center gap-3">
            <span class="text-sm md:text-lg font-semibold uppercase">
              Despacho Contable y Fiscal Sánchez
            </span>
            <a href="#" class="text-gray-300 hover:text-white">
              <i class="pi pi-facebook text-xl md:text-2xl"></i>
            </a>
          </div>
        </div>

        <!-- Contacto -->
        <div class="flex flex-col gap-2">
          <div
            class="font-bold text-center uppercase text-gray-300 text-sm md:text-lg"
          >
            Contacto
          </div>
          <p class="text-sm">L.C.P. Antonio Sánchez Gutiérrez</p>
          <a
            href="mailto:contador_sanchez@yahoo.com.mx"
            class="text-sm hover:underline"
            >contador_sanchez@yahoo.com.mx</a
          >
          <a href="tel:3163720279" class="text-sm hover:underline"
            >316 372 0279</a
          >
        </div>
      </div>

      <!-- Línea divisoria -->
      <div class="w-full border-t border-gray-400 my-6 md:my-8"></div>

      <!-- Derechos reservados -->
      <div class="text-sm text-gray-300 text-center">
        © 2025 Despacho Contable y Fiscal Sánchez - Todos los derechos
        reservados.
      </div>
    </footer>
  </div>
</template>

<script>
import { ref } from "vue";
import Carousel from "primevue/carousel";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import carr1 from "@/assets/img/carrCont.jpg";
import carr2 from "@/assets/img/carrPagReg.jpg";
import carr3 from "@/assets/img/carrActiReg.jpg";
import "primeicons/primeicons.css";

export default {
  components: { Carousel },
  setup() {
    const menuOpen = ref(false);
    const carouselItems = ref([
      {
        image: carr1,
        title: "Consultoría Contable",
        description: "Soluciones integrales para tu negocio.",
      },
      {
        image: carr2,
        title: "Declaraciones Fiscales",
        description: "Te ayudamos a cumplir con tus obligaciones fiscales.",
      },
      {
        image: carr3,
        title: "Auditoría y Finanzas",
        description: "Optimización financiera con expertos.",
      },
    ]);

    return { carouselItems, mainImageSrc, menuOpen };
  },
};
</script>
