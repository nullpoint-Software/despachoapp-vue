import { ref, onMounted } from "vue";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import { useRouter } from "vue-router";
import { as } from "@/service/adminApp/client";
import { useAppToast } from "@/composables/useAppToast";
import { useRoute } from "vue-router";
interface LoginWave {
  id: number;
  x: number;
  y: number;
  size: number;
}

export default {
  setup() {
    const email = ref("");
    const password = ref("");
    const rememberMe = ref(false);
    const showPassword = ref(false);
    const waves = ref<LoginWave[]>([]);
    const reacting = ref(false);
    const router = useRouter();
    const route = useRoute();
    const showError = ref(false);
    const isLoading = ref(false);
    const resetPanelOpen = ref(false);
    const resetMode = ref("request");
    const resetToken = ref("");
    const resetIdentifier = ref("");
    const resetPassword = ref("");
    const resetPasswordConfirm = ref("");
    const resetLoading = ref(false);
    const resetMessage = ref("");
    const resetMessageType = ref("info");
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
        const routeResetToken = route.query.resetToken;
        if (typeof routeResetToken === "string" && routeResetToken) {
          resetToken.value = routeResetToken;
          resetMode.value = "confirm";
          resetPanelOpen.value = true;
        }
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
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo preparar la pantalla de acceso.',
          life: 5000,
        });

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
      showError.value = false;

      const isLoggedIn = await as.loginUser({ username: email.value, password: password.value });
      if (isLoggedIn) {
        // If loginUser is successful, run goLogin
        goLogin();
      } else {
        showError.value = true;
        window.setTimeout(() => document.getElementById("login-identifier")?.focus(), 0);
        isLoading.value = false
      }

    };

    const openResetRequest = () => {
      resetMode.value = "request";
      resetIdentifier.value = email.value;
      resetMessage.value = "";
      resetMessageType.value = "info";
      resetPanelOpen.value = true;
    };

    const closeResetPanel = () => {
      resetPanelOpen.value = false;
      resetMessage.value = "";
      resetPassword.value = "";
      resetPasswordConfirm.value = "";
    };

    const requestResetEmail = async () => {
      if (!resetIdentifier.value.trim()) {
        resetMessage.value = "Ingresa tu usuario o correo.";
        resetMessageType.value = "error";
        return;
      }
      resetLoading.value = true;
      resetMessage.value = "";
      try {
        const response = await as.requestPasswordReset(resetIdentifier.value.trim());
        resetMessage.value = response.message || "Revisa tu correo para continuar.";
        resetMessageType.value = "info";
      } catch (error) {
        resetMessage.value = "No fue posible enviar el enlace. Intenta otra vez.";
        resetMessageType.value = "error";
      } finally {
        resetLoading.value = false;
      }
    };

    const confirmResetPassword = async () => {
      if (resetPassword.value.length < 8) {
        resetMessage.value = "La contraseña debe tener al menos 8 caracteres.";
        resetMessageType.value = "error";
        return;
      }
      if (resetPassword.value !== resetPasswordConfirm.value) {
        resetMessage.value = "Las contraseñas no coinciden.";
        resetMessageType.value = "error";
        return;
      }
      resetLoading.value = true;
      resetMessage.value = "";
      try {
        const response = await as.confirmPasswordReset(resetToken.value, resetPassword.value);
        resetMessage.value = response.message || "Contraseña actualizada.";
        resetMessageType.value = "info";
        resetPassword.value = "";
        resetPasswordConfirm.value = "";
        router.replace("/login");
      } catch (error) {
        resetMessage.value = "El enlace no es válido o ya expiró.";
        resetMessageType.value = "error";
      } finally {
        resetLoading.value = false;
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
      openResetRequest,
      closeResetPanel,
      requestResetEmail,
      confirmResetPassword,
      goLogin,
      mainImageSrc,
      showError,
      resetPanelOpen,
      resetMode,
      resetIdentifier,
      resetPassword,
      resetPasswordConfirm,
      resetLoading,
      resetMessage,
      resetMessageType
    };
  },
};
