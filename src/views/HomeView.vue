<template>
  <div
    class="h-auto min-h-screen w-full bg-blue-200 text-green-900 flex flex-col"
  >
    <!-- Navbar -->
    <nav class="flex justify-between items-center p-4 bg-blue-900 shadow-lg">
      <div class="flex items-center space-x-2">
        <img :src="mainImageSrc" alt="Company Logo" class="w-20" />
        <span class="text-lg font-bold text-amber-50"
          >DESPACHO CONTABLE Y FISCAL SÁNCHEZ</span
        >
      </div>
      <div class="hidden md:flex text-amber-50 space-x-6">
        <a href="#" class="hover:text-blue-800">Inicio</a>
        <a href="#" class="hover:text-blue-800">Contacto</a>
        <a href="#" class="hover:text-blue-800">Sobre Nosotros</a>
      </div>
      <button
        class="bg-white px-4 py-2 rounded-lg text-blue-600 hover:bg-blue-100"
      >
        Iniciar Sesión
      </button>
    </nav>

    <!-- Hero -->
    <div
      class="flex flex-col items-center justify-center text-center py-16 px-6 flex-grow bg-blue-500 text-white"
    >
      <h1 class="text-5xl font-extrabold drop-shadow-lg">
        DESPACHO CONTABLE Y FISCAL SÁNCHEZ
      </h1>
      <p class="max-w-3xl mt-6 text-lg leading-relaxed opacity-90">
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
          class="bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg text-lg shadow-md hover:bg-blue-100 transition duration-300"
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
            class="relative w-full h-[500px] flex justify-center items-center"
          >
            <img
              :src="slotProps.data.image"
              class="w-full h-full object-cover rounded-lg shadow-xl"
            />
            <div
              class="absolute bottom-0 bg-blue-700 text-white p-6 w-full text-center rounded-b-lg"
            >
              <h3 class="text-2xl font-bold text-white-200">
                {{ slotProps.data.title }}
              </h3>
              <p class="text-md">{{ slotProps.data.description }}</p>
            </div>
          </div>
        </template>
      </Carousel>
    </div>

    <!-- Footer -->
    <footer
      class="flex flex-col w-full h-fit bg-blue-900 text-gray-200 px-8 md:px-48 py-9"
    >
      <div class="flex flex-row items-center justify-between">
        <!-- Logo, Nombre de la Empresa e Icono de Facebook -->
        <div class="flex items-center gap-4 w-[35%]">
          <img :src="mainImageSrc" alt="Logo" class="w-20" />
          <div class="flex items-center gap-3">
            <span class="text-lg md:text-xl font-semibold uppercase"
              >Despacho Contable y Fiscal Sánchez</span
            >
            <a href="#" class="text-gray-300 hover:text-white">
              <i class="pi pi-facebook text-2xl"></i>
            </a>
          </div>
        </div>

        <!-- Sección de Contacto -->
        <div class="flex flex-row w-[65%] justify-end gap-16 text-nowrap">
          <div class="grid grid-cols-1 gap-0">
            <div class="flex flex-col gap-2">
              <div class="font-bold uppercase text-gray-300 pb-3 text-lg">
                Contacto
              </div>
              <p>L.C.P. Antonio Sánchez Gutiérrez</p>
              <a
                href="mailto:contador_sanchez@yahoo.com.mx"
                class="hover:underline"
              >
                contador_sanchez@yahoo.com.mx
              </a>
              <a href="tel:3163720279" class="hover:underline">316 372 0279</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Línea divisoria -->
      <div class="w-full border-t border-gray-400 my-8"></div>

      <!-- Derechos reservados -->
      <div class="text-center text-sm text-gray-300">
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

    return { carouselItems, mainImageSrc };
  },
};
</script>
