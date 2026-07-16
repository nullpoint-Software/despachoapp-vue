<template>
  <Loader v-if="isLoading"></Loader>
  <div class="login-page relative flex justify-center items-center min-h-screen overflow-hidden">
    <!-- Partículas giratorias -->
    <div class="background" :class="{ react: reacting }">
      <span v-for="i in 20" :key="i"></span>
    </div>

    <!-- Capa de ondas -->
    <div class="absolute inset-0 z-10 bg-transparent overflow-hidden">
      <div class="wave-container" v-for="wave in waves" :key="wave.id" :style="{
        top: wave.y + 'px',
        left: wave.x + 'px',
        width: wave.size + 'px',
        height: wave.size + 'px'
      }"></div>
    </div>

    <!-- Contenido de login -->
    <div class="login-shell relative z-20 w-full">
      <aside class="login-brand"><p>DESPACHO / ACCESO</p><img :src="mainImageSrc" alt="Logo"/><h1>Control<br/>operativo</h1><span>Clientes · Pagos · Tareas · Notas</span></aside>
      <section class="login-form-panel">
        <div class="palette-position"><PaletteSelector /></div>
      <!-- Logo -->
      <div class="login-logo flex justify-center mb-4">
        <img :src="mainImageSrc" alt="Logo" class="w-16" />
      </div>

      <!-- Título y subtítulo -->
      <h2 class="text-3xl font-bold text-center mb-2">
        Iniciar Sesión
      </h2>
      <p class="login-copy text-center mb-6">
        Accede a tu cuenta
      </p>
      <div v-if="showError" class="relative bg-red-600 rounded-md mb-1">
        <p class="text-1xl font-bold text-white p-2 ">El usuario o contraseña es incorrecto!</p>
      </div>
      <!-- Formulario -->
      <form @submit.prevent="login">
        <div class="mb-4 relative">
          <label class="block text-white font-medium mb-1">Nombre de usuario o correo electrónico</label>
          <InputText v-model="email" type="text"
            class="w-full p-3 border border-white/50 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-300"
            placeholder="joseramirez@gmail.com" @input="handleInput" />
        </div>

        <div class="mb-4 relative">
          <label class="block text-white font-medium mb-1">
            Contraseña
          </label>
          <div class="relative">
            <input v-model="password" :type="showPassword ? 'text' : 'password'"
              class="w-full p-3 border border-white/50 rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-300"
              placeholder="••••••••" @input="handleInput" />
            <button type="button" class="password-toggle absolute right-3 top-3" @click="togglePassword">
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
        </div>
        <br>
        <!-- <div class="flex justify-between items-center mb-6">
          <label for="remember" class="flex items-center cursor-pointer text-white">
            <input type="checkbox" id="remember" class="hidden" v-model="rememberMe" />
            <div
              class="w-5 h-5 border-2 border-white rounded-md flex items-center justify-center transition-all duration-300"
              :class="{ 'bg-white': rememberMe }">
              <i v-if="rememberMe" class="pi pi-check text-blue-600 text-sm"></i>
            </div>
            <span class="ml-2 text-white text-sm select-none">
              Recuérdame
            </span>
          </label>
        </div> -->

        <!-- Botón de inicio -->
        <button type="submit"
          class="login-submit w-full py-3 font-semibold transition cursor-pointer">
          Iniciar Sesión
        </button>
      </form></section>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import InputText from "@/components/ui/AppInput.vue";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import { useRouter } from "vue-router";
import { as } from "@/service/adminApp/client";
import { useAppToast } from "@/composables/useAppToast";
import { useRoute } from "vue-router";
import Loader from "@/components/adminApp/Menus/Loader.vue";
import PaletteSelector from "@/components/ui/PaletteSelector.vue";

export default {
  components: { InputText, Loader, PaletteSelector },
  setup() {
    const email = ref("");
    const password = ref("");
    const rememberMe = ref(false);
    const showPassword = ref(false);
    const waves = ref([]);
    const reacting = ref(false);
    const router = useRouter();
    const route = useRoute();
    const showError = ref(false);
    const isLoading = ref(false);
    // Alternar visibilidad de la contraseña
    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };
    const toast = useAppToast();
    //checar si hay autenticacion
    onMounted(async () => {
      isLoading.value = true

      try {
        const token = localStorage.getItem("token")
        if (token) {
          await as.checkAuthRedirect(true);
        }

        const errorType = route.query.error;
        if (errorType === 'server') {

          toast.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: 'No se pudo obtener la información del usuario.',
            life: 6000,
          });
          router.push("/login")
        } else if (errorType === 'token') {
          toast.add({
            severity: 'warn',
            summary: 'Sesión caducada o no válida',
            detail: 'Por favor, inicia sesión nuevamente.',
            life: 6000,
          });
          router.push("/login")
        }
      } catch (error) {
        console.error(error);

      } finally {
        isLoading.value = false
      }


    });
    // Crear onda en posiciones aleatorias dentro del fondo

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

    const login = async () => {
      isLoading.value = true
      console.log("Iniciar sesión con:", {
        email: email.value,
        password: password.value,
      });
      showError.value = false;

      const isLoggedIn = await as.loginUser({ username: email.value, password: password.value });
      if (isLoggedIn) {
        // If loginUser is successful, run goLogin
        goLogin();
      } else {
        console.log("Login failed");
        showError.value = true;
        isLoading.value = false
      }

    };


    function goLogin() {
      router.push('/app')
    }

    return {
      email,
      isLoading,
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
      showError
    };
  },
};
</script>

<!-- Estilos globales para el fondo de partículas -->
<style>
@keyframes move {
  100% {
    transform: translate3d(0, 0, 1px) rotate(360deg);
  }
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
  box-shadow: -40vmin 0 5.7vmin currentColor;
  opacity: 0.2;
  transition: opacity 0.3s ease;
}

/* Reacción al escribir */
.background.react span {
  opacity: 0.6;
}

/* Ocultar scrollbar */
</style>

<!-- Estilos scoped para las ondas -->
<style scoped>
.login-page{padding:1rem;background:var(--br-bg);color:var(--br-text)}.login-shell{display:grid;grid-template-columns:1.08fr .92fr;width:min(70rem,100%);min-height:39rem;border:2px solid var(--br-control);background:var(--br-panel);box-shadow:14px 14px 0 var(--br-accent)}.login-brand{display:flex;flex-direction:column;justify-content:flex-end;padding:2rem;border-right:2px solid var(--br-control);background:repeating-linear-gradient(0deg,var(--br-bg) 0,var(--br-bg) 4px,var(--br-panel) 5px)}.login-brand p{margin:auto 0 0;color:var(--br-accent);font:800 .75rem "Courier New",monospace;letter-spacing:.12em}.login-brand img{width:4rem;margin-bottom:auto}.login-brand h1{margin:1rem 0;font:900 clamp(3.4rem,7vw,6rem)/.78 Arial,sans-serif;letter-spacing:-.075em;text-transform:uppercase}.login-brand span{color:var(--br-muted);font:800 .75rem "Courier New",monospace;text-transform:uppercase}.login-form-panel{position:relative;display:flex;flex-direction:column;justify-content:center;padding:clamp(1.5rem,4vw,3.5rem);background:var(--br-control);color:#141413}.palette-position{position:absolute;right:1rem;top:1rem}.login-logo{display:none}.login-form-panel h2{font:900 clamp(2rem,5vw,3.5rem)/1 Arial,sans-serif;letter-spacing:-.055em;text-align:left!important;text-transform:uppercase}.login-copy{color:#5e5a52!important;text-align:left!important;font:700 .82rem "Courier New",monospace}.login-form-panel label{color:#141413!important;font:800 .72rem "Courier New",monospace;text-transform:uppercase}.login-form-panel :deep(input),.login-form-panel>form input{border:1px solid #555!important;border-radius:0!important;background:#fff!important;color:#141413!important}.password-toggle{color:#141413}.login-submit{border:1px solid #141413;border-radius:0;background:var(--br-accent);color:var(--br-accent-text);font:900 .78rem "Courier New",monospace;text-transform:uppercase}.login-submit:hover{filter:brightness(.9);transform:translateY(-1px)}:global(.background){background:var(--br-bg)!important}:global(.background span){border-radius:0!important;color:var(--br-accent)!important;opacity:.06!important}@media(max-width:760px){.login-shell{grid-template-columns:1fr;box-shadow:6px 6px 0 var(--br-accent)}.login-brand{min-height:14rem;border-right:0;border-bottom:2px solid var(--br-control)}.login-brand h1{font-size:3.2rem}.login-brand img{display:none}.login-form-panel{min-height:28rem}.palette-position{position:static;margin-bottom:1rem}}
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
