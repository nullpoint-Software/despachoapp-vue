<template>
  <div class="relative flex justify-center items-center min-h-screen overflow-hidden">
    <!-- Partículas giratorias -->
    <div class="background" :class="{ react: reacting }">
      <span v-for="i in 20" :key="i"></span>
    </div>

    <!-- Capa de ondas -->
    <div class="absolute inset-0 z-10 bg-transparent overflow-hidden">
      <div
        class="wave-container"
        v-for="wave in waves"
        :key="wave.id"
        :style="{
          top: wave.y + 'px',
          left: wave.x + 'px',
          width: wave.size + 'px',
          height: wave.size + 'px'
        }"
      ></div>
    </div>

    <!-- Contenido de login -->
    <div class="relative z-20 bg-white/30 backdrop-blur-md shadow-lg rounded-lg p-8 w-full max-w-md">
      <!-- Logo -->
      <div class="flex justify-center mb-4">
        <img :src="mainImageSrc" alt="Logo" class="w-16" />
      </div>

      <!-- Título y subtítulo -->
      <h2 class="text-3xl font-bold text-white text-center mb-2">
        Iniciar Sesión
      </h2>
      <p class="text-white/80 text-center mb-6">
        Accede a tu cuenta
      </p>

      <!-- Formulario -->
      <form @submit.prevent="login">
        <div class="mb-4 relative">
          <label class="block text-white font-medium mb-1">
            Correo Electrónico
          </label>
          <InputText
            v-model="email"
            type="email"
            class="w-full p-3 border border-white/50 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-300"
            placeholder="joseramirez@gmail.com"
            @input="handleInput"
          />
        </div>

        <div class="mb-4 relative">
          <label class="block text-white font-medium mb-1">
            Contraseña
          </label>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full p-3 border border-white/50 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-300"
              placeholder="••••••••"
              @input="handleInput"
            />
            <button
              type="button"
              class="absolute right-3 top-3 text-white/80"
              @click="togglePassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
        </div>

        <div class="flex justify-between items-center mb-6">
          <label for="remember" class="flex items-center cursor-pointer text-white">
            <input type="checkbox" id="remember" class="hidden" v-model="rememberMe" />
            <div
              class="w-5 h-5 border-2 border-white rounded-md flex items-center justify-center transition-all duration-300"
              :class="{ 'bg-white': rememberMe }"
            >
              <i v-if="rememberMe" class="pi pi-check text-blue-600 text-sm"></i>
            </div>
            <span class="ml-2 text-white text-sm select-none">
              Recuérdame
            </span>
          </label>
        </div>

        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition"
          @click="goLogin"
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
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import { useRouter } from "vue-router";

export default {
  components: { InputText },
  setup() {
    const email = ref("");
    const password = ref("");
    const rememberMe = ref(false);
    const showPassword = ref(false);
    const waves = ref([]);
    const reacting = ref(false);
    const router = useRouter();

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    // Cuando el usuario escribe: onda + reacción de partículas
    const handleInput = () => {
      createWave();
      // activa reacción de partículas
      reacting.value = true;
      setTimeout(() => {
        reacting.value = false;
      }, 300);
    };

    const createWave = () => {
      const size = Math.random() * 100 + 50;
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      waves.value.push({ id: Date.now(), x, y, size });
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

    const goLogin = () => {
      router.push("/app");
    };

    return {
      email,
      password,
      rememberMe,
      showPassword,
      togglePassword,
      waves,
      reacting,
      handleInput,
      login,
      goLogin,
      mainImageSrc,
    };
  },
};
</script>

<!-- Estilos globales para el fondo de partículas -->
<style>
@keyframes move {
  100% { transform: translate3d(0,0,1px) rotate(360deg); }
}
.background {
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0; left: 0;
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
  box-shadow: -40vmin 0 5.7vmin currentColor;
  opacity: 0.2;
  transition: opacity 0.3s ease;
}
/* Reacción al escribir */
.background.react span {
  opacity: 0.6;
}

/* Ocultar scrollbar */
::-webkit-scrollbar { width: 0; height: 0; }
html { -ms-overflow-style: none; scrollbar-width: none; }
</style>

<!-- Estilos scoped para las ondas -->
<style scoped>
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
