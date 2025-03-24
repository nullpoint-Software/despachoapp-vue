<template>
  <!-- Contenedor principal: Cubre la pantalla con fondo negro, texto blanco y layout en columna -->
  <div class="h-auto min-h-screen w-full bg-black text-white flex flex-col">

    <!-- Navbar: Barra superior de navegación -->
    <nav class="flex justify-between items-center p-4 shadow-lg">
      <!-- Sección izquierda del navbar: Incluye el botón de menú (visible en móviles) y el logo -->
      <div class="flex items-center space-x-2">
        <!-- Botón para alternar la visibilidad del menú móvil -->
        <button @click="toggleMenu" class="lg:hidden text-white text-2xl ml-4 cursor-pointer" aria-label="Abrir menú">
          <i class="pi pi-bars"></i>
        </button>
        <!-- Logo de la empresa: La fuente de la imagen se define de manera reactiva -->
        <img :src="mainImageSrc" alt="Logo de la Empresa" class="w-20 lg:w-20" />
      </div>

      <!-- Sección derecha del navbar: Muestra la información del usuario y el botón de cerrar sesión, visible en pantallas grandes -->
      <div class="hidden lg:flex text-white space-x-3 items-center mr-4">
        <!-- Avatar del usuario con tooltip que muestra el nombre del perfil -->
        <Avatar v-tooltip.bottom="ProfileName" :image="profilePicture" shape="circle" />
        <!-- Nombre del perfil del usuario -->
        <span class="font-bold">{{ ProfileName }}</span>
        <!-- Separador vertical -->
        <Divider layout="vertical" />
        <!-- Botón para cerrar sesión -->
        <Button label="Cerrar sesión" icon="pi pi-sign-out" class="flex-auto cursor-pointer" severity="danger" text
          :onclick="logOut" />
      </div>
    </nav>

    <!-- Menú Deslizante para Móviles -->
    <transition name="slide-fade">
      <div v-if="menuOpen" class="lg:hidden fixed inset-0 z-50" @click.self="toggleMenu">
        <div class="w-64 h-full bg-gray-800 text-white p-4" @click.stop>
          <div class="flex items-center space-x-2 mb-4">
            <Avatar :image="profilePicture" shape="circle" />
            <span class="font-bold">{{ ProfileName }}</span>
          </div>
          <Divider />
          <ul class="mt-4">
            <li v-for="item in menuItems" :key="item.name" class="flex items-center p-2 space-x-2">
              <router-link :to="`/app/${item.name.toLowerCase()}`" class="flex items-center space-x-2 w-full">
                <i :class="item.icon"></i>
                <span>{{ item.name }}</span>
              </router-link>
            </li>
          </ul>
          <div class="flex flex-col space-y-4 mt-4">
            <Button label="Cuenta" icon="pi pi-user" class="w-full text-white bg-black hover:bg-gray-800" outlined />
            <Button label="Cerrar sesión" icon="pi pi-sign-out" class="w-full bg-black hover:bg-gray-800"
              severity="danger" text :onclick="logOut" />
          </div>
        </div>
      </div>
    </transition>

    <!-- Contenedor Principal para el contenido -->
    <div class="flex flex-grow bg-gray-700">
      <!-- Menú lateral (Side Menu) para Escritorio -->
      <aside
        class="hidden lg:flex flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white w-20 hover:w-64 transition-all duration-700 ease-out relative group overflow-hidden shadow-lg pl-2 group-hover:pl-4">
        <Divider class="my-2 border-gray-700" />
        <nav class="flex-1 overflow-y-auto custom-scrollbar-hide">
          <ul class="space-y-2">
            <li v-for="item in menuItems" :key="item.name">
              <router-link :to="`/app/${item.name.toLowerCase()}`"
                class="w-full flex items-center justify-center group px-4 py-3 hover:bg-gray-800 rounded-md transition-all duration-500 group-hover:justify-start group-hover:pl-8"
                aria-label="Ir a {{ item.name }}">
                <i :class="[item.icon, 'text-2xl']"></i>
                <span class="hidden group-hover:block ml-4 text-sm font-medium">
                  {{ item.name }}
                </span>
              </router-link>
            </li>
          </ul>
        </nav>
        <Divider class="my-2 border-gray-700" />
        <div class="p-4 border-t border-gray-700">
          <router-link to="/app/settings"
            class="flex items-center justify-center group px-4 py-2 hover:bg-gray-800 rounded-md transition-all duration-500 group-hover:justify-start group-hover:pl-8"
            aria-label="Ajustes">
            <i class="pi pi-cog text-2xl"></i>
            <span class="hidden group-hover:block ml-4 text-sm font-medium">
              Ajustes
            </span>
          </router-link>
        </div>
      </aside>
      <!-- Área principal para el contenido de cada ruta -->
      <!--suspense para operacion async-->
      <Suspense>
        <RouterView />
      </Suspense>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import "primeicons/primeicons.css";
import Button from "primevue/button";
import Divider from "primevue/divider";
import Avatar from "primevue/avatar";
import { Suspense } from "vue";
import defaultprofilePicture from "@/assets/img/havatar.jpg";
import { RouterView, RouterLink } from "vue-router";
import { useRouter } from "vue-router";
import { onMounted } from "vue";
import { as } from "@/service/adminApp/client";
export const isAdmin = (localStorage.getItem("level") === "Administrador" ? true : false)
export default {
  components: { Button, Avatar, Divider, RouterView, RouterLink },
  setup() {
    
    const menuOpen = ref(false);
    const router = useRouter();
    const ProfileName = localStorage.getItem("fullname")
    // Definir un ID de usuario de ejemplo
    const userId = ref("HM-001");
    const profilePicture = ref(localStorage.getItem("userphoto"));
    const menuItems = ref([
      { name: "Inicio", icon: "pi pi-home" },
      { name: "Tareas", icon: "pi pi-th-large" },
      { name: "Clientes", icon: "pi pi-id-card" },
      { name: "Pagos", icon: "pi pi-wallet" },
    ]);
    //checar si hay autenticacion
    onMounted(async () => {
      try {
        await as.checkAuthRedirect();
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login"); // Redirect to login if auth fails
      }
    });
    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    // Función para cerrar sesión y redirigir a la página principal.
    function logOut() {
      router.push("/");
      localStorage.clear();
    }

    // Se retornan las variables y funciones para su uso en el template.
    return { isAdmin, mainImageSrc, menuOpen, profilePicture, ProfileName, menuItems, toggleMenu, logOut };
  },
};
</script>

<style>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.3s ease-in-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-100%);
}

.custom-scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
