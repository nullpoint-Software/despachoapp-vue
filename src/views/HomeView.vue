<template>
  <div class="h-auto min-h-screen w-full bg-green-100 text-green-900 flex flex-col">
    <!-- Navbar -->
    <nav class="flex justify-between items-center p-4 bg-green-800 shadow-lg">
      <div class="flex items-center space-x-2">
        <img :src="mainImageSrc" alt="Company Logo" class="w-20" />
        <span class="text-lg font-bold text-green-300">Despacho Contable Sanchez</span>
      </div>
      <div class="hidden md:flex text-amber-50 space-x-6">
        <a href="#" class="hover:text-green-400">Inicio</a>
        <a href="#" class="hover:text-green-400">Contacto</a>
        <a href="#" class="hover:text-green-400">Sobre Nosotros</a>
      </div>
      <button class="bg-green-500 px-4 py-2 rounded-lg text-white hover:bg-green-600">
        Iniciar Sesión
      </button>
    </nav>
    
    <!-- Hero -->
    <div class="flex flex-col items-center justify-center text-center py-10 px-4 flex-grow bg-green-300">
      <h1 class="text-5xl font-bold text-green-700">Despacho Contable Sanchez</h1>
      <p class="text-green-900 max-w-2xl mt-4">
        Expertos en Contabilidad, Fiscalidad, Administración, Pensiones, Afores, Laboral y Seguridad Social (IMSS).
        <br /><br />
        Atención personalizada con el L.C.P. Antonio Sánchez y un equipo comprometido con tu tranquilidad financiera.
      </p>
      <div class="mt-6 space-x-4">
        <button class="bg-green-600 px-6 py-3 rounded-lg text-white text-lg hover:bg-green-700">
          Iniciar Sesión
        </button>
      </div>
    </div>

    <!-- Carrusel -->
    <div class="w-full flex items-center justify-center bg-green-300 py-12">
      <Carousel
        :value="carouselItems"
        :numVisible="1"
        :numScroll="1"
        circular
        :autoplayInterval="4000"
        class="w-[90%] md:w-[80%] lg:w-[70%]"
      >
        <template #item="slotProps">
          <div class="relative w-full h-[500px] flex justify-center items-center">
            <img :src="slotProps.data.image" class="w-full h-full object-cover rounded-lg shadow-xl" />
            <div class="absolute bottom-0 bg-green-700 text-white p-6 w-full text-center rounded-b-lg">
              <h3 class="text-2xl font-bold text-green-200">{{ slotProps.data.title }}</h3>
              <p class="text-md">{{ slotProps.data.description }}</p>
            </div>
          </div>
        </template>
      </Carousel>
    </div>

    <!-- Footer -->
    <footer class="flex flex-col w-full bg-green-900 text-green-200 px-8 md:px-48 py-11 mt-0">
      <div class="flex flex-col md:flex-row">
        <div class="flex flex-col gap-2 justify-center md:w-[35%]">
          <div class="flex items-center w-full gap-4">
            <img :src="mainImageSrc" alt="Logo" class="w-20" />
            <div class="text-xl text-green-200">Despacho Contable Sanchez</div>
            <a href="#"><i class="pi pi-facebook text-xl" style="font-size: 1.5rem"></i></a>
          </div>
        </div>
        <div class="flex flex-row md:w-[65%] justify-end gap-16 text-nowrap">
          <div class="grid grid-cols-1 gap-12">
            <div class="flex flex-col gap-2">
              <div class="font-bold uppercase text-green-400 pb-3">Contacto</div>
              <p>Lic. Antonio Sanchez</p>
              <a class="hover:underline">Correo@gmail.com</a>
              <a href="#xxx" class="hover:underline">73727737</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import { ref } from "vue";
import Carousel from "primevue/carousel";
import mainImageSrc from "@/assets/img/logobig.png";
import carr1 from "@/assets/img/carrCont.jpg";
import carr2 from "@/assets/img/carrPagReg.jpg";
import carr3 from "@/assets/img/carrActiReg.jpg";
import 'primeicons/primeicons.css';

export default {
  components: { Carousel },
  setup() {
    const carouselItems = ref([
      { image: carr1, title: "Consultoría Contable", description: "Soluciones integrales para tu negocio." },
      { image: carr2, title: "Declaraciones Fiscales", description: "Te ayudamos a cumplir con tus obligaciones fiscales." },
      { image: carr3, title: "Auditoría y Finanzas", description: "Optimización financiera con expertos." },
    ]);

    return { carouselItems, mainImageSrc };
  },
};
</script>
