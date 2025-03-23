<template>
  <div class="h-auto min-h-screen w-full bg-black text-gray-100 flex flex-col">
    <!-- Navbar con posición fixed, ancho completo y z-index elevado -->
    <nav
      class="fixed top-0 left-0 z-50 flex justify-between items-center p-4 bg-black shadow-lg w-full"
    >
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

    <!-- Spacer para compensar la altura del navbar fijo -->
    <div class="pt-16"></div>

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
    <!-- Se agregó la clase 'responsive-hero' para ajustar el padding en móviles sin eliminar el p-60 original -->
    <!-- Se añadió la clase 'desktop-hero' para reducir ligeramente la altura en pantallas de escritorio -->
    <section class="bg-gray-900 text-white">
      <div class="text-center bg-[url(../assets/img/despacho.jpg)] bg-center bg-no-repeat bg-cover bg-fixed p-60 responsive-hero desktop-hero" style="">
        <div class="flex justify-center items-center">
          <img :src="mainImageSrc" alt="Company Logo" class="w-80 lg:w-80" />
        </div>
        <h2 class="text-3xl md:text-5xl font-bold mb-4">
          DESPACHO CONTABLE Y FISCAL SÁNCHEZ
        </h2>
        <p class="mb-8 text-xl text-gray-300">
          Soluciones contables y fiscales integrales para potenciar tu negocio.
        </p>
        <!-- Texto adicional agregado para mayor información en el hero -->
        <p class="mb-8 text-lg text-gray-300">
          Con más de 25 años de experiencia, brindamos soluciones personalizadas que combinan tecnología de vanguardia y atención experta, impulsando el crecimiento de tu empresa.
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

      <!-- Cards con diseño responsivo: se cambió la dirección del flex a column en móviles -->
      <div class="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
        <!-- Card 1 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-col md:flex-row items-center space-x-0 md:space-x-6"
        >
          <!-- Imagen con clases responsivas: ocupa el 100% en móviles y dimensiones fijas en md -->
          <img
            :src="adminImg"
            alt="Panel Administrativo"
            class="w-full md:w-64 h-auto md:h-64 object-cover rounded-lg"
          />
          <div class="flex-1 text-center mt-4 md:mt-0">
            <p class="text-xl leading-relaxed text-center">
              <!-- Texto mejorado y ampliado para mayor detalle -->
              Administra todo con facilidad desde nuestro completo panel de control. Con una interfaz intuitiva, asigna tareas, crea notas y revisa la información de tus clientes de manera sencilla. Además, disfruta de herramientas para personalizar y optimizar tu experiencia.
            </p>
          </div>
        </div>

        <!-- Card 2 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-col md:flex-row items-center space-x-0 md:space-x-6"
        >
          <!-- Se añadió 'text-center md:text-left' para centrar el texto en móviles -->
          <div class="flex-1 text-center md:text-left mb-4 md:mb-0">
            <p class="text-xl leading-relaxed text-center">
              <!-- Texto mejorado y ampliado para mayor detalle -->
              Gestiona la información de tus clientes de manera integral y eficiente. Accede a datos relevantes en cualquier momento y mantén el control total de tus interacciones con una plataforma amigable.
            </p>
          </div>
          <img
            :src="clientImg"
            alt="Panel de Clientes"
            class="w-full md:w-64 h-auto md:h-64 object-cover rounded-lg"
          />
        </div>

        <!-- Card 3 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-col md:flex-row items-center space-x-0 md:space-x-6"
        >
          <img
            :src="desktopImg"
            alt="Vista de Escritorio"
            class="w-full md:w-64 h-auto md:h-64 object-cover rounded-lg"
          />
          <!-- Se añadió 'text-center md:text-left' para centrar el texto en móviles -->
          <div class="flex-1 text-center md:text-left mt-4 md:mt-0">
            <p class="text-xl leading-relaxed text-center">
              <!-- Texto mejorado y ampliado para mayor detalle -->
              Monitorea el desempeño de tu empresa con reportes detallados de ganancias mensuales y anuales. Toma decisiones informadas y gestiona todos los aspectos financieros con facilidad, gracias a nuestras herramientas.
            </p>
          </div>
        </div>

        <!-- Card 4 -->
        <div
          class="bg-gray-800 rounded-xl shadow-lg p-6 w-full flex flex-col md:flex-row items-center space-x-0 md:space-x-6"
        >
          <!-- Se añadió 'text-center md:text-left' para centrar el texto en móviles -->
          <div class="flex-1 text-center md:text-left mb-4 md:mb-0">
            <p class="text-xl leading-relaxed text-center">
              <!-- Texto mejorado y ampliado para mayor detalle -->
              Controla todos los pagos y genera tiquets de forma instantánea para tus clientes, asegurando transparencia y eficiencia en cada transacción. Facilita la gestión y el seguimiento de tus operaciones financieras.
            </p>
          </div>
          <img
            :src="payImg"
            alt="Pago Online"
            class="w-full md:w-64 h-auto md:h-64 object-cover rounded-lg"
          />
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
import carr1 from "@/assets/img/WorkHome.png";
import carr2 from "@/assets/img/WorkHome.png";
import carr3 from "@/assets/img/WorkHome.png";
import adminImg from "@/assets/img/kanbanHome.png";
import clientImg from "@/assets/img/ClientHome.png";
import desktopImg from "@/assets/img/kanbanHome2.png";
import payImg from "@/assets/img/payHome2.png";
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

/* Media query para que la imagen de fondo no se fije en móviles */
@media (max-width: 768px) {
  .bg-fixed {
    background-attachment: scroll !important;
  }
  /* Clase responsive-hero para ajustar el padding del hero en móviles sin eliminar el p-60 original */
  .responsive-hero {
    padding: 2rem !important;
  }
}

/* Media query para tablets: ajustar padding intermedio */
@media (min-width: 769px) and (max-width: 1024px) {
  .responsive-hero {
    padding: 4rem !important;
  }
}

/* Nueva media query para reducir la altura del hero en escritorio sin eliminar p-60 */
/* Se reduce el padding de 15rem (p-60) a 10rem para hacerlo un poquito más chiquito */
@media (min-width: 1025px) {
  .desktop-hero {
    padding: 10rem !important;
  }
}
</style>
