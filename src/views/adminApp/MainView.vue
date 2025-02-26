<template>
  <div class="h-auto min-h-screen w-full bg-black text-white flex flex-col">
    <!-- Navbar: Barra superior de navegación -->
    <nav class="flex justify-between items-center p-4 shadow-lg">
      <!-- Sección izquierda: Botón de menú para móviles y logo -->
      <div class="flex items-center space-x-2">
        <!-- Botón para abrir/cerrar menú en móviles -->
        <button 
          @click="toggleMenu" 
          class="lg:hidden text-white text-2xl ml-4 cursor-pointer"
          aria-label="Abrir menú">
          <i class="pi pi-bars"></i>
        </button>
        <!-- Logo de la empresa -->
        <img :src="mainImageSrc" alt="Logo de la Empresa" class="w-20 lg:w-20" />
      </div>
      <!-- Sección derecha: Información del usuario y botón de cerrar sesión (visible en pantallas grandes) -->
      <div class="hidden lg:flex text-white space-x-3 items-center mr-4">
        <!-- Avatar con tooltip que muestra el nombre de perfil -->
        <Avatar v-tooltip.bottom="ProfileName" :image="profilePicture" shape="circle" />
        <!-- Nombre de perfil -->
        <span class="font-bold">{{ ProfileName }}</span>
        <!-- Separador vertical -->
        <Divider layout="vertical" />
        <!-- Botón de cerrar sesión -->
        <Button
          label="Cerrar sesión"
          icon="pi pi-sign-out"
          class="flex-auto cursor-pointer"
          severity="danger"
          text
          :onclick="logOut"
        />
      </div>
    </nav>

    <!-- Menú Deslizante para Móviles -->
    <!-- Se utiliza una transición para animar el menú al abrir/cerrar -->
    <transition name="slide-fade">
      <div 
        v-if="menuOpen" 
        class="lg:hidden fixed inset-0 z-50" 
        @click.self="toggleMenu">
        <!-- Contenedor del menú móvil con fondo gris oscuro -->
        <div class="w-64 h-full bg-gray-800 text-white p-4" @click.stop>
          <!-- Encabezado del menú móvil: Avatar y nombre de perfil -->
          <div class="flex items-center space-x-2 mb-4">
            <Avatar :image="profilePicture" shape="circle" />
            <span class="font-bold">{{ ProfileName }}</span>
          </div>
          <Divider />
          <!-- Lista de opciones del menú móvil -->
          <ul class="mt-4">
            <li 
              v-for="item in menuItems" 
              :key="item.name" 
              class="flex items-center p-2 space-x-2">
              <!-- Enlace de navegación para cada ítem -->
              <router-link 
                :to="`/app/${item.name.toLowerCase()}`" 
                class="flex items-center space-x-2 w-full">
                <i :class="item.icon"></i>
                <span>{{ item.name }}</span>
              </router-link>
            </li>
          </ul>
          <!-- Botones adicionales en el menú móvil -->
          <div class="flex flex-col space-y-4 mt-4">
            <Button
              label="Cuenta"
              icon="pi pi-user"
              class="w-full text-white bg-black hover:bg-gray-800"
              outlined
            />
            <Button
              label="Cerrar sesión"
              icon="pi pi-sign-out"
              class="w-full bg-black hover:bg-gray-800"
              severity="danger"
              text
              :onclick="logOut"
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- Contenedor Principal -->
    <div class="flex flex-grow bg-gray-700">
      <!-- Side Menu para Escritorio -->
      <aside 
        class="hidden lg:flex flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white w-20 hover:w-64 transition-all duration-700 ease-out relative group overflow-hidden shadow-lg pl-2 group-hover:pl-4">
        <!-- Separador superior del menú -->
        <Divider class="my-2 border-gray-700" />
        <!-- Lista de opciones del menú lateral -->
        <nav class="flex-1 overflow-y-auto custom-scrollbar-hide">
          <ul class="space-y-2">
            <!-- Por cada ítem del menú se crea un enlace -->
            <li v-for="item in menuItems" :key="item.name">
              <router-link
                :to="`/app/${item.name.toLowerCase()}`"
                class="w-full flex items-center justify-center group px-4 py-3 hover:bg-gray-800 rounded-md transition-all duration-500 group-hover:justify-start group-hover:pl-8"
                aria-label="Ir a {{ item.name }}">
                <!-- Ícono del ítem -->
                <i :class="[item.icon, 'text-2xl']"></i>
                <!-- Texto del ítem: se oculta por defecto y se muestra cuando el menú está expandido -->
                <span class="hidden group-hover:block ml-4 text-sm font-medium">
                  {{ item.name }}
                </span>
              </router-link>
            </li>
          </ul>
        </nav>
        <!-- Separador inferior del menú -->
        <Divider class="my-2 border-gray-700" />
        <!-- Footer del menú lateral: Botón de Ajustes -->
        <div class="p-4 border-t border-gray-700">
          <router-link
            to="/app/settings"
            class="flex items-center justify-center group px-4 py-2 hover:bg-gray-800 rounded-md transition-all duration-500 group-hover:justify-start group-hover:pl-8"
            aria-label="Ajustes">
            <i class="pi pi-cog text-2xl"></i>
            <!-- Texto "Ajustes": oculto por defecto y visible al expandir el menú -->
            <span class="hidden group-hover:block ml-4 text-sm font-medium">
              Ajustes
            </span>
          </router-link>
        </div>
      </aside>
      <!-- Área para el contenido principal -->
      <RouterView />
    </div>
  </div>
</template>

<script>
// Importación de funcionalidades de Vue y componentes necesarios
import { ref } from "vue";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import "primeicons/primeicons.css";
import Button from "primevue/button";
import Divider from "primevue/divider";
import Avatar from "primevue/avatar";
import profilePicture from "@/assets/img/havatar.jpg";
import { RouterView, RouterLink } from "vue-router";
import { useRouter } from "vue-router";

export default {
  components: { Button, Avatar, Divider, RouterView, RouterLink },
  setup() {
    // Estado para controlar la visibilidad del menú móvil
    const menuOpen = ref(false);
    // Objeto de enrutamiento de Vue Router para redirecciones
    const router = useRouter();
    // Nombre del perfil del usuario (se utiliza en tooltips y displays)
    const ProfileName = ref("Hachikuji Mayoi");
    // Lista de elementos del menú con su nombre e ícono
    const menuItems = ref([
      { name: "Inicio", icon: "pi pi-home" },
      { name: "Tareas", icon: "pi pi-th-large" },
      { name: "Clientes", icon: "pi pi-id-card" },
      { name: "Pagos", icon: "pi pi-wallet" },
    ]);

    // Función para alternar la visibilidad del menú móvil
    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    // Función para cerrar sesión y redirigir a la página principal
    function logOut() {
      router.push("/");
    }

    // Se retornan las variables y funciones al template
    return { mainImageSrc, menuOpen, profilePicture, ProfileName, menuItems, toggleMenu, logOut };
  },
};
</script>

<style>
/* Animación de transición para el menú deslizante */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.3s ease-in-out;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-100%);
}

/* Oculta la scrollbar en el menú lateral */
.custom-scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
