<template>
  <div class="h-auto min-h-screen w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white flex flex-col">
    <!-- Barra de Navegación -->
    <nav class="flex justify-between items-center p-4 bg-blue-900 shadow-lg">
      <div class="flex items-center space-x-2">
        <button @click="toggleMenu" class="md:hidden text-white text-2xl ml-4 cursor-pointer">
          <i class="pi pi-bars"></i>
        </button>
        <img :src="mainImageSrc" alt="Logo de la Empresa" class="w-20 md:w-20" />
      </div>
      <div class="hidden md:flex text-white space-x-3 items-center mr-4">
        <Avatar v-tooltip.bottom="ProfileName" :image="profilePicture" shape="circle" />
        <span class="font-bold">{{ ProfileName }}</span>
        <Divider layout="vertical"></Divider>
        <Button label="Cerrar sesión" icon="pi pi-sign-out" class="flex-auto cursor-pointer" severity="danger" text></Button>
      </div>
    </nav>

    <!-- Menú Deslizante para Móviles -->
    <transition name="slide-fade">
      <div v-if="menuOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50" @click.self="toggleMenu">
        <div class="w-64 bg-blue-800 text-white h-full flex flex-col p-6 transform transition-transform duration-300 ease-in-out" :class="{'-translate-x-full': !menuOpen, 'translate-x-0': menuOpen}">
          <button @click="toggleMenu" class="self-end text-white text-2xl">
            <i class="pi pi-times"></i>
          </button>
          <ul>
            <li v-for="item in menuItems" :key="item.name" class="flex items-center p-2 space-x-2">
              <i :class="item.icon"></i>
              <span>{{ item.name }}</span>
            </li>
          </ul>
          <div class="mt-auto flex flex-col space-y-4">
            <div class="flex items-center space-x-2">
              <Avatar :image="profilePicture" shape="circle" />
              <span class="font-bold">{{ ProfileName }}</span>
            </div>
            <Button label="Cuenta" icon="pi pi-user" class="w-full text-white bg-blue-600 hover:bg-blue-700" outlined></Button>
            <Button label="Cerrar sesión" icon="pi pi-sign-out" class="w-full bg-blue-600 hover:bg-blue-700" severity="danger" text></Button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Contenedor Principal -->
    <div class="flex flex-grow">
      <!-- Barra Lateral para Escritorio -->
      <div class="hidden md:flex flex-col p-4 bg-blue-900 text-white w-16 hover:w-64 transition-all duration-300 ease-in-out relative group">
        <ul>
          <li v-for="item in menuItems" :key="item.name" class="flex items-center p-2 space-x-2">
            <i :class="item.icon"></i>
            <span class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white menu-text">{{ item.name }}</span>
          </li>
        </ul>
      </div>
      <!-- Contenido Principal -->
      <div class="flex-grow p-6">
        <RouterView />
      </div>
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
import profilePicture from "@/assets/img/havatar.jpg";
import { RouterView } from "vue-router";

export default {
  components: { Button, Avatar, Divider, RouterView },
  setup() {
    const menuOpen = ref(false);
    const ProfileName = ref("Hachikuji Mayoi");
    const menuItems = ref([
      { name: "Inicio", icon: "pi pi-home" },
      { name: "Perfil", icon: "pi pi-user" },
      { name: "Configuración", icon: "pi pi-cog" },
      { name: "Ayuda", icon: "pi pi-question" },
    ]);

    const toggleMenu = () => {
      menuOpen.value = !menuOpen.value;
    };

    return { mainImageSrc, menuOpen, profilePicture, ProfileName, menuItems, toggleMenu };
  },
};
</script>

<style>
/* Animación compartida para Menú Deslizante en Móviles y Barra Lateral en Escritorio */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* Estilos para la Barra Lateral en Escritorio */
.group:hover .menu-text {
  opacity: 1;
}
.menu-text {
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}
</style>
