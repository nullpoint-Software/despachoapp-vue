interface ClientDocumentsModalProps { client: Record<string, any> }

interface ClientDocumentsModalEmits { (event: "close"): void }

import { ref } from "vue";
import { cs } from "@/service/adminApp/client";
import { useAppDialog } from "@/composables/useAppDialog";
import { useAppToast } from "@/composables/useAppToast";

type ClientDocument = {
  id: number;
  tipo: string;
  nombre_original: string;
  tamano: number;
  creado_en: string;
};

const props = defineProps<ClientDocumentsModalProps>();
const emit = defineEmits<ClientDocumentsModalEmits>();
const documentTypes = [
  { label: "INE", value: "ine" },
  { label: "Opinión fiscal", value: "opinion_fiscal" },
  { label: "E.firma", value: "efirma" },
  { label: "Constancia de situación fiscal", value: "constancia_situacion_fiscal" },
  { label: "Otro documento", value: "otro" },
];
const documentType = ref("ine");
const documents = ref<ClientDocument[]>([]);
const pendingFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const loading = ref(false);
const uploading = ref(false);
const busyId = ref<number | null>(null);
const error = ref("");
const accessToken = ref("");
const verificationPassword = ref("");
const verifying = ref(false);
const { confirm: confirmDialog } = useAppDialog();
const toast = useAppToast();

function lockOnExpired(requestError: any) {
  if (requestError?.response?.status !== 401) return false;
  accessToken.value = "";
  documents.value = [];
  error.value = requestError.response?.data?.error || "La verificación venció.";
  return true;
}

async function unlock() {
  if (!verificationPassword.value) return;
  verifying.value = true;
  error.value = "";
  try {
    const response = await cs.verificarDocumentos(Number(props.client.id_cliente), verificationPassword.value);
    accessToken.value = response.accessToken;
    verificationPassword.value = "";
    await load();
  } catch (requestError: any) {
    error.value = requestError.response?.data?.error || "No fue posible verificar tu identidad.";
    verificationPassword.value = "";
  } finally {
    verifying.value = false;
  }
}

function typeLabel(value: string) {
  return documentTypes.find((item) => item.value === value)?.label || "Documento";
}
function fileSize(bytes: number) {
  const value = Number(bytes || 0);
  return value < 1024 * 1024
    ? `${(value / 1024).toFixed(1)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function validateFile(file?: File) {
  error.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf") || !["application/pdf", ""].includes(file.type)) {
    error.value = "Selecciona un archivo PDF válido.";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    error.value = "El PDF no puede superar 15 MB.";
    return;
  }
  pendingFile.value = file;
}
function selectFromInput(event: Event) {
  const input = event.target as HTMLInputElement;
  validateFile(input.files?.[0]);
  input.value = "";
}
function dropFile(event: DragEvent) {
  dragging.value = false;
  validateFile(event.dataTransfer?.files?.[0]);
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    documents.value = await cs.getDocumentos(Number(props.client.id_cliente), accessToken.value);
  } catch (requestError: any) {
    if (lockOnExpired(requestError)) return;
    error.value = requestError.response?.data?.error || "No se pudo abrir el expediente.";
  } finally {
    loading.value = false;
  }
}
async function upload() {
  if (!pendingFile.value) return;
  uploading.value = true;
  error.value = "";
  try {
    await cs.subirDocumento(Number(props.client.id_cliente), documentType.value, pendingFile.value, accessToken.value);
    pendingFile.value = null;
    await load();
  } catch (requestError: any) {
    if (lockOnExpired(requestError)) return;
    error.value = requestError.response?.data?.error || "No se pudo guardar el documento.";
  } finally {
    uploading.value = false;
  }
}
async function download(document: ClientDocument) {
  busyId.value = document.id;
  error.value = "";
  try {
    const blob = await cs.descargarDocumento(Number(props.client.id_cliente), document.id, accessToken.value);
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = document.nombre_original;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.add({ severity: "success", summary: "Documento preparado", detail: document.nombre_original, life: 2500 });
  } catch (requestError: any) {
    if (lockOnExpired(requestError)) return;
    error.value = requestError.response?.data?.error || "No se pudo descargar el documento.";
  } finally {
    busyId.value = null;
  }
}
async function remove(document: ClientDocument) {
  const confirmed = await confirmDialog({
    title: "Eliminar documento",
    message: `Se eliminará ${document.nombre_original}. Esta acción no se puede deshacer.`,
    tone: "danger",
    confirmLabel: "Eliminar",
  });
  if (!confirmed) return;
  busyId.value = document.id;
  error.value = "";
  try {
    await cs.eliminarDocumento(Number(props.client.id_cliente), document.id, accessToken.value);
    documents.value = documents.value.filter((item) => item.id !== document.id);
    toast.add({ severity: "success", summary: "Documento eliminado", detail: document.nombre_original, life: 2500 });
  } catch (requestError: any) {
    if (lockOnExpired(requestError)) return;
    error.value = requestError.response?.data?.error || "No se pudo eliminar el documento.";
  } finally {
    busyId.value = null;
  }
}
