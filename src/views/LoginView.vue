<template>
    <div class="flex justify-center items-center min-h-screen bg-blue-100">
      <div class="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <!-- Logo -->
        <div class="flex justify-center mb-4">
          <img :src="mainImageSrc" alt="Logo" class="w-16" />
        </div>
  
        <!-- Título -->
        <h2 class="text-2xl font-bold text-blue-700 text-center">Iniciar Sesión</h2>
        <p class="text-gray-500 text-center mb-6">Accede a tu cuenta</p>
  
        <!-- Formulario -->
        <form @submit.prevent="login">
          <div class="mb-4">
            <label class="block text-gray-700 font-medium mb-1">Correo Electrónico</label>
            <InputText 
              v-model="email" 
              type="email" 
              class="w-full p-3 border rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="usuario@example.com"
            />
          </div>
  
          <div class="mb-4">
            <label class="block text-gray-700 font-medium mb-1">Contraseña</label>
            <Password 
              v-model="password" 
              toggleMask 
              class="w-full p-3 border rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
  
          <!-- Recordar y Recuperar -->
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center">
              <input type="checkbox" id="remember" class="mr-2" v-model="rememberMe" />
              <label for="remember" class="text-gray-700 text-sm">Recuérdame</label>
            </div>
            <a href="#" class="text-blue-500 text-sm hover:underline">¿Olvidaste tu contraseña?</a>
          </div>
  
          <!-- Botón de inicio -->
          <button 
            type="submit"
            class="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition"
          >
            Iniciar Sesión
          </button>
        </form>
  
        <!-- Registro -->
        <p class="text-center text-gray-600 text-sm mt-4">
          ¿No tienes una cuenta? <a href="#" class="text-blue-500 hover:underline">Regístrate aquí</a>
        </p>
      </div>
    </div>
  </template>
  
  <script>
  import { ref } from "vue";
  import InputText from "primevue/inputtext";
  import Password from "primevue/password";
  import mainImageSrc from "@/assets/img/logsymbolwhite.png";
  
  export default {
    components: { InputText, Password },
    setup() {
      const email = ref("");
      const password = ref("");
      const rememberMe = ref(false);
  
      const login = () => {
        console.log("Iniciar sesión con:", { email: email.value, password: password.value });
      };
  
      return { email, password, rememberMe, login, mainImageSrc };
    },
  };
  </script>
  
  <style scoped>
  /* Personalización de PrimeVue */
  .p-inputtext {
    outline: none;
  }
  </style>
  