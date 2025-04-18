<template>
  <div
    class="relative flex justify-center items-center min-h-screen overflow-hidden"
  >
    <!-- Fondo Animado -->
    <div
      class="absolute inset-0 bg-gradient-to-b from-blue-200 to-blue-900 overflow-hidden"
    >
      <div
        class="wave-container"
        v-for="wave in waves"
        :key="wave.id"
        :style="{
          top: wave.y + 'px',
          left: wave.x + 'px',
          width: wave.size + 'px',
          height: wave.size + 'px',
        }"
      ></div>
    </div>

    <!-- Contenido -->
    <div
      class="relative bg-white shadow-lg rounded-lg p-8 w-full max-w-md z-10"
    >
      <!-- Logo -->
      <div class="flex justify-center mb-4">
        <img :src="mainImageSrc" alt="Logo" class="w-16" />
      </div>

      <!-- Título -->
      <h2 class="text-2xl font-bold text-blue-700 text-center">
        Iniciar Sesión
      </h2>
      <p class="text-gray-500 text-center mb-6">Accede a tu cuenta</p>

      <!-- Formulario -->
      <form @submit.prevent="login">
        <div class="mb-4 relative">
          <label class="block text-gray-700 font-medium mb-1"
            >Correo Electrónico</label
          >
          <InputText
            v-model="email"
            type="email"
            class="w-full p-3 border rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            placeholder="joseramirez@gmail.com"
            @input="createWave"
          />
        </div>

        <div class="mb-4 relative">
          <label class="block text-gray-700 font-medium mb-1">Contraseña</label>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full p-3 border rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              @input="createWave"
            />
            <button
              type="button"
              class="absolute right-3 top-3 text-gray-500"
              @click="togglePassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
        </div>

        <!-- Recordar y Recuperar -->
        <div class="flex justify-between items-center mb-6">
          <label for="remember" class="flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="remember"
              class="hidden"
              v-model="rememberMe"
            />
            <div
              class="w-5 h-5 border-2 border-blue-500 rounded-md flex items-center justify-center transition-all duration-300"
              :class="{ 'bg-blue-500': rememberMe }"
            >
              <i v-if="rememberMe" class="pi pi-check text-white text-sm"></i>
            </div>
            <span class="ml-2 text-gray-700 text-sm select-none"
              >Recuérdame</span
            >
          </label>
        </div>

        <!-- Botón de inicio -->
        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition cursor-pointer" :onclick="goLogin"
        >
          Iniciar Sesión
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import InputText from "primevue/inputtext";
import mainImageSrc from "@/assets/img/logsymbolblack.png";
import { RouterLink } from "vue-router";
import { useRouter } from "vue-router";


export default {
  components: { InputText },
  setup() {
    const email = ref("");
    const password = ref("");
    const rememberMe = ref(false);
    const showPassword = ref(false);
    const waves = ref([]);
    const router = useRouter();
    // Alternar visibilidad de la contraseña
    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    // Crear onda en posiciones aleatorias dentro del fondo
    const createWave = () => {
      const size = Math.random() * 100 + 50; // Tamaño aleatorio entre 50px y 150px
      const x = Math.random() * window.innerWidth; // Posición aleatoria en el ancho
      const y = Math.random() * window.innerHeight; // Posición aleatoria en el alto

      waves.value.push({ id: Date.now(), x, y, size });

      // Eliminar onda después de la animación
      setTimeout(() => {
        waves.value.shift();
      }, 800);
    };

    const login = () => {
      console.log("Iniciar sesión con:", {
        email: email.value,
        password: password.value,
      });
    };

    function goLogin(){
      router.push('/app')
    }

    return {
      email,
      password,
      rememberMe,
      login,
      mainImageSrc,
      showPassword,
      togglePassword,
      waves,
      createWave,
      goLogin,
    };
  },
};
</script>

<style scoped>
/* Fondo animado con ondas */
.wave-container {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: scale(0);
  animation: ripple 0.8s linear;
  pointer-events: none;
}

@keyframes ripple {
  to {
    transform: scale(6);
    opacity: 0;
  }
}
</style>
