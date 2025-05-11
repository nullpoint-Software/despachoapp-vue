<template>
  <!-- Contenedor principal: Cubre la pantalla con fondo negro, texto blanco y layout en columna -->
  <div class="h-auto min-h-screen w-full bg-black text-white flex flex-col">

    <!-- Navbar: Barra superior de navegación -->
    <nav class="flex justify-between items-center p-4 shadow-lg z-50 bg-black fixed w-full">
      <!-- Sección izquierda del navbar: Incluye el botón de menú (visible en móviles) y el logo -->
      <div class="flex items-center space-x-2">
        <!-- Botón para alternar la visibilidad del menú móvil -->
        <button @click="toggleMenu" class="lg:hidden text-white text-2xl ml-4 cursor-pointer" aria-label="Abrir menú">
          <i class="pi pi-bars"></i>
        </button>
        <!-- Logo de la empresa: La fuente de la imagen se define de manera reactiva -->
        <img :src="mainImageSrc" alt="Logo de la Empresa" class="w-20 lg:w-20" />
      </div>

      <!-- Sección derecha del navbar: Muestra la información del usuario y los botones -->
      <div class="hidden lg:flex text-white space-x-3 items-center mr-4">
        <!-- Avatar del usuario con tooltip que muestra el nombre del perfil -->
        <Avatar v-tooltip.bottom="ProfileName" :image="profilePicture" shape="circle" />
        <!-- Nombre del perfil del usuario -->
        <div class="flex flex-col">
          <span class="font-bold">{{ ProfileName }}</span>
          <span class="text-xs text-gray-300">{{ ProfileType }}</span>
        </div>

        <!-- Separador vertical -->
        <Divider layout="vertical" />
        <!-- Botón para abrir el modal con el Tablero de Notas -->
        <Button icon="pi pi-book" class="p-button-rounded bg-yellow-500 hover:bg-yellow-600" @click="openNotesModal"
          aria-label="Abrir Tablero de Notas" />
        <!-- Botón para abrir LogsModal -->
        <Button v-if="isAdmin" icon="pi pi-list" class="p-button-rounded bg-green-500 hover:bg-green-600" @click="openLogs"
          aria-label="Ver Registros de Cambios" />
        <Button label="Cerrar sesión" icon="pi pi-sign-out" class="flex-auto cursor-pointer" severity="danger" text
          @click="logOut" />
      </div>
    </nav>

    <!-- Menú Deslizante para Móviles -->
    <transition name="slide-fade">
      <div v-if="menuOpen" class="lg:hidden fixed inset-0 z-50" @click.self="toggleMenu">
        <div class="w-64 h-full bg-gray-800 text-white p-4" @click.stop>
          <div class="flex items-start">
            <div class="flex flex-col mt-1">
              <Avatar :image="profilePicture" shape="circle" />
            </div>
            <div class="flex flex-col ml-3">
              <span class="font-bold">{{ ProfileName }}</span>
              <span class="text-xs text-gray-300">{{ ProfileType }}</span>
            </div>

          </div>
          <Divider />
          <ul class="mt-4">
            <li v-for="item in menuItems" :key="item.name" @click="toggleMenu" class="flex items-center p-2 space-x-2">
              <router-link :to="`/app/${item.name.toLowerCase()}`" class="flex items-center space-x-2 w-full">
                <i :class="item.icon"></i>
                <span>{{ item.name }}</span>
              </router-link>
            </li>


          </ul>

          <div class="flex flex-col space-y-4 mt-4" @click="toggleMenu">
            <router-link to="/app/settings">
              <Button label="Cuenta" icon="pi pi-user" class="w-full text-white bg-black hover:bg-gray-800" outlined />
            </router-link>
            <Button label="Cerrar sesión" icon="pi pi-sign-out" class="w-full bg-black hover:bg-gray-800"
              severity="danger" text @click="logOut" />
          </div>
          <br>

        </div>
      </div>
    </transition>

    <!-- Área principal: Incluye el menú lateral y la vista de rutas -->
    <div class="flex flex-grow bg-gray-700">
      <!-- Menú lateral (Side Menu) para Escritorio -->
      <aside
        class="hidden lg:flex fixed top-0 left-0 h-screen flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white 
         w-20 hover:w-64 transition-all duration-700 ease-out group overflow-hidden shadow-lg pl-2 group-hover:pl-4 z-40">

        <nav class="flex-1 mt-19 overflow-y-auto custom-scrollbar-hide">
          <Divider class="my-2 border-gray-700" />
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
      <Suspense>
        <template #default>
          <RouterView class="lg:ml-30 lg:mr-20 mt-20" />
        </template>
        <template #fallback>
          <Loader />
        </template>
      </Suspense>
    </div>

    <!-- Modal para abrir el Tablero de Notas -->
    <transition name="fade">
      <div v-if="showNotesModal" class="modal-overlay fixed inset-0 z-50" @click.self="closeNotesModal">
        <div class="modal-content relative bg-gray-50 p-4 rounded-md shadow-lg max-w-4xl mx-auto mt-20">
          <!-- Se renderiza el componente del Tablero de Notas -->
          <Suspense>
            <BoardNote />
          </Suspense>
        </div>
      </div>
    </transition>

    <!-- LogsModal: Componente aparte para registros de cambios -->
    <Suspense>
      <LogsModal :key="logsKey" :visible="showLogs" @close="closeLogs" />
    </Suspense>
  </div>

</template>

<script>
import { ref, watch } from "vue";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import "primeicons/primeicons.css";
import Button from "primevue/button";
import { ProgressSpinner } from "primevue";
import Divider from "primevue/divider";
import Avatar from "primevue/avatar";
import Loader from "@/components/adminApp/Loader.vue"
import { onMounted } from "vue";
import { Suspense } from "vue";
import defaultprofilePicture from "@/assets/img/user.jpg";
import { RouterView, RouterLink } from "vue-router";
import { useRouter } from "vue-router";
// Cambio: Importación del componente BoardNote (Tablero de Notas)
import BoardNote from "@/components/notes/BoardNote.vue";
import { as } from "@/service/adminApp/client";
import LogsModal from "@/components/adminApp/LogsModal.vue";
export default {
  components: { Button, Avatar, Divider, RouterView, RouterLink, BoardNote, ProgressSpinner, Loader, LogsModal },
  setup() {

    const buildTime = ref('')
    const menuOpen = ref(false);
    const showLogs = ref(false);       // controla visibilidad de LogsModal
    const router = useRouter();
    const logsKey = ref(0);
    const ProfileName = ref(localStorage.getItem("fullname"))
    const ProfileType = localStorage.getItem("level")
    const isAdmin = (localStorage.getItem("level") == "Administrador")
    const userId = ref(localStorage.getItem("userid"));
    const storedPhoto = localStorage.getItem("userphoto");
    const profilePicture = ref(
      storedPhoto && storedPhoto !== "data:image/png;base64,null"
        ? storedPhoto
        : defaultprofilePicture
    );
    watch(ProfileName, (newVal) => {
      console.log('Immediate update:', newVal);
    }, { immediate: true });
    watch(showLogs, (val) => {
      if (val) {
        logsKey.value++;  // Triggers re-render of LogsModal
      }
    });
    const menuItems = ref([
      { name: "Inicio", icon: "pi pi-home" },
      { name: "Tareas", icon: "pi pi-th-large" },
      { name: "Clientes", icon: "pi pi-id-card" },
      { name: "Pagos", icon: "pi pi-wallet" },
    ]);
    //checar si hay autenticacion
    onMounted(async () => {
      try {
        if (localStorage.getItem("token")) {
          await as.checkAuthRedirect(true);
        } else {
          await as.checkAuthRedirect(false);
        }

        // await this.getUserInfo()

      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login"); // Redirect to login if auth fails
        buildTime.value = 'No disponible'
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

    // Al iniciar, almacenar los datos del usuario en localStorage

    // Notas modal
    const showNotesModal = ref(false);
    const openNotesModal = () => {
      showNotesModal.value = true;
    };
    const closeNotesModal = () => {
      showNotesModal.value = false;
    };
    // Cambio: Estado y funciones para LogsModal
    
    const openLogs = () => {           // abre LogsModal
      showLogs.value = true;
    };
    const closeLogs = () => {          // cierra LogsModal
      showLogs.value = false;
    };

    return {
      mainImageSrc,
      buildTime,
      menuOpen,
      profilePicture,
      ProfileType,
      ProfileName,
      menuItems,
      toggleMenu,
      logOut,
      userId,
      showNotesModal,
      openNotesModal,
      closeNotesModal,
      isAdmin,
      showLogs,
      logsKey,       // Cambio: retorna showLogs
      openLogs,       // Cambio: retorna openLogs
      closeLogs       // Cambio: retorna closeLogs
    };
  },
};
</script>

<style scoped>
footer {
  position: relative;
  width: 100%;
}

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

/* Estilos para el modal de Tablero de Notas y LogsModal */
.modal-overlay {
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.5);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
