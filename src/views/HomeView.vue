<template>
  <div class="relative bg-gray-900 text-gray-100 flex flex-col min-h-screen overflow-x-hidden">
    <!-- Animated background -->
    <div class="background">
      <span v-for="i in 20" :key="i"></span>
    </div>

    <!-- Navbar -->
    <nav class="fixed top-0 left-0 w-full bg-gray-800 text-white shadow-lg z-50">
      <div class="container mx-auto flex items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-4">
          <button @click="toggleMenu" class="lg:hidden text-3xl">
            <i class="pi pi-bars"></i>
          </button>
          <img :src="mainImageSrc" alt="Logo" class="w-28" />
        </div>
        <div class="hidden md:flex space-x-8 text-xl">
          <router-link to="/" class="hover:text-blue-400">Inicio</router-link>
          <a href="#" @click.prevent="scrollToFooter" class="hover:text-blue-400">Contacto</a>
          <a href="#" @click.prevent="scrollToValores" class="hover:text-blue-400">Sobre Nosotros</a>
        </div>
        <button
          class="hidden lg:block bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold px-6 py-2 rounded"
          @click="goLogin"
        >
          Iniciar Sesión
        </button>
      </div>
    </nav>

    <!-- Mobile Menu -->
    <transition name="slide-fade">
      <div
        v-if="menuOpen"
        class="fixed inset-0 z-40 lg:hidden flex"
        @click.self="toggleMenu"
      >
        <div class="w-64 h-full bg-gray-800 text-white p-6" @click.stop>
          <nav class="space-y-4">
            <router-link to="/" class="block text-lg py-2 hover:text-blue-300">Inicio</router-link>
            <a href="#" @click.prevent="scrollToFooter" class="block text-lg py-2 hover:text-blue-300">Contacto</a>
            <a href="#" @click.prevent="scrollToValores" class="block text-lg py-2 hover:text-blue-300">Sobre Nosotros</a>
          </nav>
        </div>
      </div>
    </transition>

    <div class="pt-24"></div>

    <!-- Hero Section -->
    <section
      class="relative z-10 bg-fixed bg-center bg-cover"
      style="background-image: url('@/assets/img/despacho.jpg')"
    >
      <div class="bg-transparent py-32 px-4 text-center">
        <h1 class="text-6xl md:text-7xl font-bold mb-6">DESPACHO CONTABLE Y FISCAL SÁNCHEZ</h1>
        <p class="text-2xl md:text-3xl mb-4 text-gray-300">
          Soluciones contables y fiscales integrales
        </p>
        <p class="text-xl md:text-2xl mb-8 text-gray-300">
          Más de 25 años de experiencia y atención experta
        </p>
        <button
          class="bg-blue-600 hover:bg-blue-700 text-white text-2xl font-semibold px-8 py-4 rounded"
          :class="isLogged ? 'bg-green-600' : 'bg-blue-600'"
            @click="goLogin"
          >
            {{ isLogged ? "Ingresar" : "Iniciar Sesión"}}
        </button>
      </div>
    </section>

    <!-- Funciones Principales -->
    <section class="py-16 px-4 md:px-12 relative z-10">
      <h2 class="text-4xl md:text-5xl font-bold text-center mb-12">Funciones Principales</h2>
      <div class="grid grid-cols-2 grid-rows-5 gap-4 m-4">
        <div class="col-start-1 row-start-1 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="kanbanImg" alt="Kanban" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Gestión de Tareas</h3>
          <p class="text-lg text-gray-300 text-center">
            Organiza tus pendientes de forma visual y mantén el control total.
          </p>
        </div>
        <div class="col-start-1 row-start-2 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="ticketsImg" alt="Tickets" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Impresión de Tickets</h3>
          <p class="text-lg text-gray-300 text-center">
            Genera comprobantes instantáneos para tus clientes.
          </p>
        </div>
        <div class="col-start-2 row-start-1 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="clientesImg" alt="Clientes" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Clientes</h3>
          <p class="text-lg text-gray-300 text-center">
            Consulta datos relevantes de forma rápida y centralizada.
          </p>
        </div>
        <div class="col-start-2 row-start-3 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="pagosConceptoImg" alt="Pagos" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Pagos y Conceptos</h3>
          <p class="text-lg text-gray-300 text-center">
            Revisa pagos filtrados por mes o concepto.
          </p>
        </div>
        <div class="col-start-1 row-start-4 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="gananciasImg" alt="Ganancias" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Ganancias</h3>
          <p class="text-lg text-gray-300 text-center">
            Visualiza ingresos por día, mes y año.
          </p>
        </div>
        <div class="col-start-2 row-start-4 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="markdownImg" alt="Markdown" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">Notas Markdown</h3>
          <p class="text-lg text-gray-300 text-center">
            Crea notas rápidas y estructuradas con Markdown.
          </p>
        </div>
      </div>
    </section>

    <!-- Sobre Nosotros -->
    <section id="valores" class="py-16 px-4 md:px-12 relative z-10">
      <h2 class="text-4xl md:text-5xl font-bold text-center mb-12">Sobre Nosotros</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 grid-rows-3 md:grid-rows-2 gap-4 m-4">
        <div class="col-start-1 row-start-1 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="valorImg" alt="Valores" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">VALORES</h3>
          <p class="text-lg text-gray-300 text-center">
            Confianza, integridad, respeto, honradez y profesionalismo.
          </p>
        </div>
        <div class="col-start-1 row-start-3 col-span-2 md:hidden bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="misionImg" alt="Misión" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">MISIÓN</h3>
          <p class="text-lg text-gray-300 text-center">
            Brindar servicios contables y fiscales de alta calidad con ética.
          </p>
        </div>
        <div class="col-start-2 row-start-1 row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center">
          <img :src="visionImg" alt="Visión" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">VISIÓN</h3>
          <p class="text-lg text-gray-300 text-center">
            Ser líderes en innovación contable, impactando positivamente.
          </p>
        </div>
        <div class="hidden md:flex md:col-start-3 md:row-start-1 md:row-span-2 bg-gray-700 border border-gray-700 rounded-lg p-4 flex-col items-center justify-center">
          <img :src="misionImg" alt="Misión" class="h-[200px] w-auto mb-4" />
          <h3 class="text-2xl font-semibold mb-2">MISIÓN</h3>
          <p class="text-lg text-gray-300 text-center">
            Brindar servicios contables y fiscales de alta calidad con ética.
          </p>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer
      id="footer"
      class="relative z-10 bg-gray-800 text-gray-200 py-12 px-6 md:px-12 mt-auto border-t border-gray-700"
    >
      <div class="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center space-x-4">
          <img :src="mainImageSrc" alt="Logo" class="w-24" />
          <span class="text-2xl font-bold text-center">Despacho Sánchez</span>
        </div>
        <div class="space-y-1 text-center md:text-left">
          <p class="text-lg text-center">L.C.P. Antonio Sánchez Gutiérrez</p>
          <hr>
          <a href="mailto:contador_sanchez@yahoo.com.mx" class="block text-center hover:text-white text-lg">
            contador_sanchez@yahoo.com.mx
          </a>
          <a href="tel:3163720279" class="block hover:text-white text-lg text-center">316 372 0279</a>
        </div>
        <div class="text-center">
          <small>© 2025 Despacho Contable y Fiscal Sánchez</small>
          <p class="text-sm">Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import kanbanImg from "@/assets/img/Kanban.svg";
import clientesImg from "@/assets/img/Clientes.svg";
import pagosConceptoImg from "@/assets/img/Pay.svg";
import ticketsImg from "@/assets/img/Ticket.svg";
import gananciasImg from "@/assets/img/Ganancias.svg";
import markdownImg from "@/assets/img/Notes.svg";
import valorImg from "@/assets/img/valores.svg";
import visionImg from "@/assets/img/vision.svg";
import misionImg from "@/assets/img/Mision.svg";

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

    const scrollToFooter = () =>
      document.getElementById("footer")?.scrollIntoView({ behavior: "smooth" });
    const scrollToValores = () =>
      document.getElementById("valores")?.scrollIntoView({ behavior: "smooth" });

    const goLogin = () => {
      router.push("/login");
    };

    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    const goToSlide = (index) => {
      currentSlide.value = index;
    };

    // onMounted(() => {
    //   const fadeEls = document.querySelectorAll(".fade-section");
    //   const observer = new IntersectionObserver(
    //     (entries) => {
    //       entries.forEach((entry) => {
    //         if (entry.isIntersecting) {
    //           entry.target.classList.add("visible");
    //         } else {
    //           entry.target.classList.remove("visible");
    //         }
    //       });
    //     },
    //     { threshold: 0.4 }
    //   );
    //   fadeEls.forEach((el) => observer.observe(el));

    //   setInterval(() => {
    //     currentSlide.value =
    //       (currentSlide.value + 1) % serviceItems.value.length;
    //   }, 3000);
    // });

    return {
      isLogged,
      mainImageSrc,
      kanbanImg,
      clientesImg,
      pagosConceptoImg,
      ticketsImg,
      gananciasImg,
      markdownImg,
      valorImg,
      visionImg,
      misionImg,
      scrollToFooter,
      scrollToValores,
      goLogin,
      toggleMenu,
    };
  },
};
</script>

<style>
/* Animated background circles */
@keyframes move {
  100% { transform: translate3d(0,0,1px) rotate(360deg); }
}
.background {
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background: #1c1c1c;
  overflow: hidden;
  z-index: 0;
}
.background span {
  position: absolute;
  width: 20vmin;
  height: 20vmin;
  border-radius: 50%;
  backface-visibility: hidden;
  animation: move linear infinite;
}
.background span:nth-child(1)  { color:#4400ff; top:18%; left:98%; animation-duration:32s; animation-delay:-12s; transform-origin:2vw 14vh;  box-shadow:-40vmin 0 5.7vmin currentColor; }
.background span:nth-child(2)  { color:#4400ff; top:3%;  left:39%; animation-duration:53s; animation-delay:-6s;  transform-origin:17vw 20vh; box-shadow:40vmin 0 5.8vmin currentColor; }
.background span:nth-child(3)  { color:#4400ff; top:25%; left:32%; animation-duration:50s; animation-delay:-5s;  transform-origin:18vw -3vh;  box-shadow:-40vmin 0 5.2vmin currentColor; }
.background span:nth-child(4)  { color:#4400ff; top:79%; left:38%; animation-duration:38s; animation-delay:-42s; transform-origin:-22vw 0vh;   box-shadow:-40vmin 0 5.4vmin currentColor; }
.background span:nth-child(5)  { color:#4400ff; top:72%; left:4%;  animation-duration:37s; animation-delay:-11s; transform-origin:-18vw -15vh; box-shadow:-40vmin 0 5.6vmin currentColor; }
.background span:nth-child(6)  { color:#4400ff; top:62%; left:58%; animation-duration:8s;  animation-delay:-45s; transform-origin:19vw 23vh; box-shadow:-40vmin 0 5.9vmin currentColor; }
.background span:nth-child(7)  { color:#4400ff; top:40%; left:81%; animation-duration:49s; animation-delay:-5s;  transform-origin:-12vw -6vh;  box-shadow:40vmin 0 5.6vmin currentColor; }
.background span:nth-child(8)  { color:#4400ff; top:54%; left:26%; animation-duration:43s; animation-delay:-47s; transform-origin:-5vw 16vh;  box-shadow:40vmin 0 5.8vmin currentColor; }
.background span:nth-child(9)  { color:#4400ff; top:91%; left:33%; animation-duration:6s;  animation-delay:-44s; transform-origin:-3vw 14vh;  box-shadow:40vmin 0 5.6vmin currentColor; }
.background span:nth-child(10) { color:#4400ff; top:13%; left:99%; animation-duration:52s; animation-delay:-39s;transform-origin:22vw -12vh;  box-shadow:40vmin 0 5.2vmin currentColor; }
.background span:nth-child(11) { color:#4400ff; top:77%; left:100%;animation-duration:24s; animation-delay:-9s; transform-origin:-16vw 16vh; box-shadow:40vmin 0 5.4vmin currentColor; }
.background span:nth-child(12) { color:#4400ff; top:61%; left:54%; animation-duration:22s; animation-delay:-5s; transform-origin:-23vw -16vh;box-shadow:-40vmin 0 5.3vmin currentColor; }
.background span:nth-child(13) { color:#4400ff; top:22%; left:84%; animation-duration:8s;  animation-delay:-32s; transform-origin:14vw -16vh; box-shadow:40vmin 0 5.8vmin currentColor; }
.background span:nth-child(14) { color:#4400ff; top:19%; left:28%; animation-duration:48s; animation-delay:-42s;transform-origin:-13vw -13vh; box-shadow:40vmin 0 5.9vmin currentColor; }
.background span:nth-child(15) { color:#4400ff; top:59%; left:38%; animation-duration:55s; animation-delay:-20s;transform-origin:-6vw -21vh; box-shadow:40vmin 0 5.8vmin currentColor; }
.background span:nth-child(16) { color:#4400ff; top:75%; left:6%;  animation-duration:33s; animation-delay:-41s;transform-origin:-3vw -5vh; box-shadow:40vmin 0 5.0vmin currentColor; }
.background span:nth-child(17) { color:#4400ff; top:70%; left:53%; animation-duration:16s; animation-delay:-41s;transform-origin:-22vw 25vh;box-shadow:40vmin 0 5.8vmin currentColor; }
.background span:nth-child(18) { color:#4400ff; top:94%; left:9%;  animation-duration:27s; animation-delay:-12s;transform-origin:12vw -6vh; box-shadow:40vmin 0 5.0vmin currentColor; }
.background span:nth-child(19) { color:#4400ff; top:64%; left:45%; animation-duration:11s; animation-delay:-46s;transform-origin:12vw 20vh;box-shadow:40vmin 0 5.2vmin currentColor; }
.background span:nth-child(20) { color:#4400ff; top:7%;  left:39%; animation-duration:27s; animation-delay:-35s;transform-origin:22vw -21vh;box-shadow:40vmin 0 5.3vmin currentColor; }

/* Hide scrollbar but allow scroll */
::-webkit-scrollbar { width: 0; height: 0; }
html { -ms-overflow-style: none; scrollbar-width: none; }
</style>
