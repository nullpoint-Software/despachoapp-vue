interface ThirdPartyComplianceModalEmits { close: []; complete: [message: string] }

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { cos } from "@/service/adminApp/client";
import type { ThirdPartySessionState } from "@/service/adminApp/cumplimientoService";

const emit = defineEmits<ThirdPartyComplianceModalEmits>();
const state = ref<ThirdPartySessionState | null>(null);
const sessionId = ref("");
const starting = ref(false);
const syncing = ref(false);
const closing = ref(false);
const errorMessage = ref("");
const typedText = ref("");
const loginRfc = ref("");
const loginPassword = ref("");
const loginCaptcha = ref("");
const submittingLogin = ref(false);
let loginSubmittedAt = 0;
const viewport = ref<HTMLElement | null>(null);
const keyboardInput = ref<HTMLInputElement | null>(null);
const progress = ref({ processed: 0, total: 0, documents: 0 });
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
let autoSyncStarted = false;
let inputQueue = Promise.resolve();
let textBuffer = "";
let textTimer: ReturnType<typeof setTimeout> | null = null;
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let scrollDelta = 0;

const currentPhase = computed(() => state.value?.phase || "loading");
const statusTitle = computed(() => ({
  loading: "Preparando portal",
  login: "Inicia sesión en el SAT",
  ready: "Acceso confirmado",
  syncing: "Consultando opiniones",
  error: "No se pudo abrir el SAT",
})[currentPhase.value]);
const statusDetail = computed(() => ({
  loading: "La conexión continúa en segundo plano; esta ventana no está bloqueada.",
  login: "Selecciona un campo en la pantalla y captura RFC, contraseña y CAPTCHA.",
  ready: "El formulario de terceros fue detectado. La consulta comenzará automáticamente.",
  syncing: "Estamos recorriendo los RFC registrados en clientes.",
  error: state.value?.message || "El SAT tardó demasiado en responder.",
})[currentPhase.value]);

function errorText(error: unknown, fallback: string) {
  const candidate = error as { code?: string; message?: string; response?: { status?: number; data?: { error?: string } } };
  if (candidate?.response?.data?.error) return candidate.response.data.error;
  if (candidate?.response?.status === 404) return "El servidor remoto todavía no tiene instalada la actualización de consulta por terceros.";
  if (candidate?.code === "ECONNABORTED") return "El servidor remoto tardó demasiado en responder. Reinicia el backend con la imagen actualizada.";
  if (!candidate?.response && candidate?.message === "Network Error") return "No hay conexión con el servidor remoto.";
  return fallback;
}

async function start() {
  starting.value = true;
  errorMessage.value = "";
  try {
    state.value = await cos.iniciarSesionTerceros();
    sessionId.value = state.value.id;
    pollTimer = setInterval(refresh, 1400);
    await nextTick();
  } catch (error) {
    errorMessage.value = errorText(error, "No se pudo crear la sesión remota del SAT.");
  } finally {
    starting.value = false;
  }
}

async function refresh() {
  if (!sessionId.value || polling || syncing.value || closing.value) return;
  polling = true;
  try {
    state.value = await cos.obtenerSesionTerceros(sessionId.value);
    errorMessage.value = "";
    if (submittingLogin.value && state.value.phase !== "login") submittingLogin.value = false;
    else if (submittingLogin.value && Date.now() - loginSubmittedAt > 6500) {
      submittingLogin.value = false;
      errorMessage.value = "El SAT no aceptó los datos. Revisa RFC, contraseña y el nuevo CAPTCHA.";
      loginCaptcha.value = "";
    }
    if (state.value.ready && !autoSyncStarted) {
      autoSyncStarted = true;
      void syncClients();
    }
  } catch (error) {
    errorMessage.value = errorText(error, "No se pudo actualizar la vista del SAT.");
  } finally {
    polling = false;
  }
}

async function retryPortal() {
  if (!sessionId.value || starting.value) return;
  starting.value = true;
  errorMessage.value = "";
  autoSyncStarted = false;
  try {
    state.value = await cos.recargarSesionTerceros(sessionId.value);
  } catch (error) {
    errorMessage.value = errorText(error, "No se pudo volver a cargar el portal del SAT.");
  } finally {
    starting.value = false;
  }
}

async function submitNativeLogin() {
  if (!sessionId.value || submittingLogin.value) return;
  submittingLogin.value = true;
  loginSubmittedAt = Date.now();
  errorMessage.value = "";
  try {
    state.value = await cos.iniciarAccesoTerceros(sessionId.value, { rfc: loginRfc.value, password: loginPassword.value, captcha: loginCaptcha.value });
    loginPassword.value = "";
  } catch (error) {
    submittingLogin.value = false;
    loginPassword.value = "";
    errorMessage.value = errorText(error, "No se pudo enviar el acceso al SAT.");
  }
}

function queueInput(event: { type: "click"; x: number; y: number } | { type: "text"; text: string } | { type: "key"; key: string } | { type: "scroll"; deltaY: number }) {
  if (!sessionId.value || syncing.value) return;
  inputQueue = inputQueue.then(async () => {
    state.value = await cos.enviarEntradaTerceros(sessionId.value, event);
  }).catch((error) => {
    errorMessage.value = errorText(error, "No se pudo interactuar con el portal del SAT.");
  });
}

function clickViewport(event: MouseEvent) {
  if (!state.value?.image || currentPhase.value === "error" || syncing.value) return;
  const image = (event.currentTarget as HTMLElement).querySelector("img");
  if (!image) return;
  const rect = image.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
  queueInput({ type: "click", x: (event.clientX - rect.left) * state.value.width / rect.width, y: (event.clientY - rect.top) * state.value.height / rect.height });
  keyboardInput.value?.focus();
}

function scrollViewport(event: WheelEvent) {
  if (!state.value?.image) return;
  scrollDelta += event.deltaY;
  if (scrollTimer) return;
  scrollTimer = setTimeout(() => {
    queueInput({ type: "scroll", deltaY: scrollDelta });
    scrollDelta = 0;
    scrollTimer = null;
  }, 80);
}
function flushText() { if (textBuffer) { const text = textBuffer; textBuffer = ""; queueInput({ type: "text", text }); } }
function sendTypedText() { textBuffer += typedText.value; typedText.value = ""; if (textTimer) clearTimeout(textTimer); textTimer = setTimeout(flushText, 110); }
function sendKey(event: KeyboardEvent) {
  const allowed = new Set(["Enter", "Tab", "Backspace", "Delete", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", " "]);
  if (!allowed.has(event.key)) return;
  event.preventDefault();
  if (textTimer) clearTimeout(textTimer);
  flushText();
  queueInput({ type: "key", key: event.key === " " ? "Space" : event.key });
}

async function syncClients() {
  if (!sessionId.value || !state.value?.ready) return;
  syncing.value = true;
  errorMessage.value = "";
  progress.value = { processed: 0, total: 0, documents: 0 };
  try {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const response = await cos.sincronizarTerceros(sessionId.value, { offset, limit: 5 });
      progress.value = { processed: response.processed, total: response.total, documents: progress.value.documents + response.documents };
      if (response.processed <= offset && response.hasMore) throw new Error("La consulta no avanzó.");
      offset = response.processed;
      hasMore = response.hasMore;
    }
    emit("complete", `Consulta por terceros terminada: ${progress.value.processed} clientes revisados y ${progress.value.documents} PDF nuevos archivados.`);
    await close(false);
  } catch (error) {
    errorMessage.value = errorText(error, "No fue posible completar la consulta por terceros.");
    await refresh();
  } finally {
    syncing.value = false;
  }
}

function requestClose() { void close(); }
async function close(emitClose = true) {
  if (closing.value) return;
  closing.value = true;
  if (pollTimer) clearInterval(pollTimer);
  if (sessionId.value) await cos.cerrarSesionTerceros(sessionId.value).catch(() => {});
  sessionId.value = "";
  if (emitClose) emit("close");
  closing.value = false;
}

onMounted(start);
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (textTimer) clearTimeout(textTimer);
  if (scrollTimer) clearTimeout(scrollTimer);
  if (sessionId.value) cos.cerrarSesionTerceros(sessionId.value).catch(() => {});
});
