<template>
  <div class="h-auto min-h-screen w-full bg-black text-gray-100 flex flex-col">
    <!-- Navbar (sin cambios) -->
    <nav class="flex justify-between items-center p-4 bg-black shadow-lg">
      <div class="flex items-center space-x-2">
        <button
          @click="toggleMenu"
          class="lg:hidden text-white text-2xl ml-4 cursor-pointer"
          aria-label="Abrir menú"
        >
          <i class="pi pi-bars"></i>
        </button>
        <img :src="mainImageSrc" alt="Company Logo" class="w-20 lg:w-20" />
      </div>
      <div class="hidden md:flex text-amber-50 space-x-6">
        <router-link to="/" class="hover:text-blue-300">Inicio</router-link>
        <a href="#" @click.prevent="scrollToFooter" class="hover:text-blue-300"
          >Contacto</a
        >
        <router-link to="/aboutus" class="hover:text-blue-300"
          >Sobre Nosotros</router-link
        >
      </div>
    </nav>

    <!-- Menú Deslizante para Móviles (sin cambios) -->
    <transition name="slide-fade">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-50 lg:hidden flex"
        @click.self="toggleMenu"
      >
        <div
          class="w-64 h-full bg-gray-800 text-white p-6 flex flex-col"
          @click.stop
        >
          <nav class="space-y-2">
            <router-link
              to="/"
              class="block text-lg py-2 hover:text-blue-300 transition-colors duration-200"
            >
              Inicio
            </router-link>
            <a
              href="#"
              @click.prevent="scrollToFooter"
              class="block text-lg py-2 hover:text-blue-300 transition-colors duration-200"
            >
              Contacto
            </a>
            <router-link
              to="/aboutus"
              class="block text-lg py-2 hover:text-blue-300 transition-colors duration-200"
            >
              Sobre Nosotros
            </router-link>
          </nav>
          <div class="mt-6">
            <button
              class="w-full bg-white px-4 py-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors duration-200"
              @click="goLogin"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Hero Section -->
    <!-- Se eliminó el espacio entre el navbar y el bg-image agregando "pt-0" para anular el padding-top del contenedor -->
    <section class="bg-gray-900 text-white py-16 pt-0 px-6">
      <!-- Encabezado y botón de Iniciar Sesión -->
      <!-- Se conserva el estilo inline para que el fondo abarque todo el ancho de la página -->
      <div
        class="text-center bg-[url(../assets/img/carrCont.jpg)] bg-no-repeat bg-center bg-cover bg-fixed p-24"
        style="width: 100vw; margin-left: calc(-50vw + 50%)"
      >
        <h2 class="text-3xl md:text-5xl font-bold mb-4">
          DESPACHO CONTABLE Y FISCAL SÁNCHEZ
        </h2>
        <p class="mb-8 text-xl text-gray-300">
          Soluciones contables y fiscales integrales para potenciar tu negocio.
        </p>
        <div class="mt-12">
          <button
            class="text-white font-semibold px-6 py-3 rounded-lg text-lg shadow-md hover:bg-blue-700 transition duration-300"
            :class="isLogged ? 'bg-green-600' : 'bg-blue-600'"
            @click="goLogin"
          >
            {{ isLogged ? "Ingresar" : "Iniciar Sesión"}}
          </button>
        </div>
      </div>

      <!-- Cards en una sola columna, con imagen a la izquierda y descripción a la derecha -->
      <!-- Cards en una sola columna, con imagen a la izquierda y descripción a la derecha -->
      <!-- Cambio: se añadió 'md:grid-cols-2' para que en pantallas medianas o mayores se muestren 2 columnas, manteniendo 1 columna en móviles -->
      <div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <!-- Card 1 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-row items-center space-x-6"
        >
          <!-- Imagen a la izquierda (más grande) -->
          <img
            :src="adminImg"
            alt="Panel Administrativo"
            class="w-64 h-64 object-cover rounded-lg"
          />
          <!-- Descripción a la derecha (texto más grande y placeholder) -->
          <div class="flex-1 text-center">
            <p class="text-xl leading-relaxed">
              Administra todo con facilidad desde nuestro completo panel de
              control.<br />
              Asigna Tareas, Crea notas, y revisa la informacion de tus clientes
              de manera sencilla.
            </p>
          </div>
        </div>

        <!-- Card 2 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-row items-center space-x-6"
        >
          <div class="flex-1 text-left">
            <p class="text-xl leading-relaxed">
              Interfaz intuitiva que mejora la experiencia de tus clientes.
              Phasellus ac venenatis nisi, eu convallis magna. Integer molestie
              neque a fermentum vestibulum. Cras et diam sem. Duis a lacus quis
              lacus convallis interdum eu eu justo. Fusce lacinia orci vel lorem
              euismod maximus.
            </p>
          </div>
          <img
            :src="clientImg"
            alt="Panel de Clientes"
            class="w-64 h-64 object-cover rounded-lg"
          />
        </div>

        <!-- Card 3 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-row items-center space-x-6"
        >
          <img
            :src="desktopImg"
            alt="Vista de Escritorio"
            class="w-64 h-64 object-cover rounded-lg"
          />
          <div class="flex-1 text-left">
            <p class="text-xl leading-relaxed">
              Disfruta de una experiencia optimizada en escritorio con funciones
              avanzadas. In hac habitasse platea dictumst. Nulla sed est mauris.
              Maecenas nec metus sed lacus fermentum hendrerit. Etiam fermentum,
              sem ac volutpat congue, elit nisi dignissim leo, a aliquet arcu
              nunc sit amet augue.
            </p>
          </div>
        </div>

        <!-- Card 4 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-row items-center space-x-6"
        >
          <div class="flex-1 text-left">
            <p class="text-xl leading-relaxed">
              Realiza pagos seguros y rápidos desde cualquier dispositivo. Cras
              efficitur ligula id mauris varius facilisis. Donec efficitur nisi
              at justo iaculis, et fringilla nisi tempus. Fusce commodo, ipsum
              sit amet hendrerit pretium, nisl velit vehicula lorem, eget dictum
              lacus enim ac lacus.
            </p>
          </div>
          <img
            :src="payImg"
            alt="Pago Online"
            class="w-64 h-64 object-cover rounded-lg"
          />
        </div>
      </div>
    </section>

    <!-- Sección de Servicios con Carrusel Manual Mejorado -->
    <section class="mt-12" id="services">
      <h3 class="text-2xl font-bold mb-6 text-center">Nuestros Servicios</h3>
      <div class="relative w-full overflow-hidden rounded-lg">
        <!-- Carrusel manual: se ajustó el tamaño para que sea un cuadrado pequeño y centrado -->
        <!-- Se modificó el div interno para usar un tamaño fijo de 300px x 300px y se agregó "mx-auto" para centrar -->
        <div
          class="relative mx-auto"
          style="width: 300px; height: 300px; aspect-ratio: 1 / 1"
        >
          <div
            v-for="(service, index) in serviceItems"
            :key="index"
            class="absolute inset-0 transition-opacity duration-700 ease-in-out"
            :class="currentSlide === index ? 'opacity-100' : 'opacity-0'"
          >
            <!-- Fondo con imagen y overlay de gradiente -->
            <div
              class="w-full h-full bg-center bg-fixed"
              :style="{
                backgroundImage: 'url(' + service.image + ')',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
              }"
            >
              <div
                class="w-full h-full bg-gradient-to-t from-gray-600 via-transparent to-transparent flex flex-col justify-end p-6"
              >
                <h4 class="text-2xl font-semibold text-white">
                  {{ service.title }}
                </h4>
                <p class="text-base text-gray-300">{{ service.description }}</p>
              </div>
            </div>
          </div>
        </div>
        <!-- Indicadores del carrusel -->
        <div
          class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2"
        >
          <span
            v-for="(service, index) in serviceItems"
            :key="index"
            class="w-3 h-3 rounded-full cursor-pointer"
            :class="currentSlide === index ? 'bg-yellow-400' : 'bg-gray-400'"
            @click="goToSlide(index)"
          ></span>
        </div>
      </div>
    </section>

    <!-- Footer (sin cambios estructurales) -->
    <footer
      id="footer"
      class="flex flex-col w-full bg-black text-gray-200 px-6 md:px-48 py-9 text-center md:text-left"
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
          >
            contador_sanchez@yahoo.com.mx
          </a>
          <a href="tel:3163720279" class="text-sm hover:underline">
            316 372 0279
          </a>
        </div>
      </div>
      <div class="w-full border-t border-gray-400 my-6 md:my-8"></div>
      <div class="text-sm text-gray-300 text-center">
        © 2025 Despacho Contable y Fiscal Sánchez - Todos los derechos
        reservados.
      </div>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
// Importación de imágenes desde assets
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import carr1 from "@/assets/img/carrActiReg.jpg";
import carr2 from "@/assets/img/carrCont.jpg";
import carr3 from "@/assets/img/carrPagReg.jpg";
import adminImg from "@/assets/img/AdminHome.png";
import clientImg from "@/assets/img/ClientHome.png";
import desktopImg from "@/assets/img/DesktopHome.png";
import payImg from "@/assets/img/payHome.png";
import { as } from "@/service/adminApp/client";

export default {
  setup() {
    const router = useRouter();
    const menuOpen = ref(false);
    const currentSlide = ref(0);
    const token = localStorage.getItem("token");
    const isLogged = ref(false);
    if (token){
      isLogged.value = true;
    }
    // Definición de los items de "Nuestros Servicios"
    const serviceItems = ref([
      {
        image: carr1,
        title: "Consultoría Contable",
        description:
          "Asesoría experta y personalizada para la gestión contable de tu negocio.",
      },
      {
        image: carr2,
        title: "Declaraciones Fiscales",
        description:
          "Cumple con tus obligaciones fiscales de manera eficiente y segura.",
      },
      {
        image: carr3,
        title: "Auditoría y Finanzas",
        description:
          "Optimiza tu estrategia financiera con análisis y auditorías de precisión.",
      },
    ]);

    const scrollToFooter = () => {
      const footer = document.getElementById("footer");
      if (footer) {
        footer.scrollIntoView({ behavior: "smooth" });
      }
    };

    const goLogin = () => {
      router.push("/login");
    };

    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    const goToSlide = (index) => {
      currentSlide.value = index;
    };

    onMounted(() => {
      const fadeEls = document.querySelectorAll(".fade-section");
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
            } else {
              entry.target.classList.remove("visible");
            }
          });
        },
        { threshold: 0.4 }
      );
      fadeEls.forEach((el) => observer.observe(el));

      setInterval(() => {
        currentSlide.value =
          (currentSlide.value + 1) % serviceItems.value.length;
      }, 3000);
    });

    return {
      isLogged,
      router,
      menuOpen,
      currentSlide,
      serviceItems,
      mainImageSrc,
      adminImg,
      clientImg,
      desktopImg,
      payImg,
      scrollToFooter,
      goLogin,
      toggleMenu,
      goToSlide,
    };
  },
};
</script>

<style>
/* Transición para el menú deslizante */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Animación fade para elementos con clase "fade-section" */
@keyframes fadeInUpBounce {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  60% {
    opacity: 1;
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0);
  }
}
.fade-section {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}
.fade-section.visible {
  opacity: 1;
  animation: fadeInUpBounce 0.8s ease forwards;
}
</style>
