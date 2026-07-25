<template>
  <div class="documents-overlay" @click.self="emit('close')">
    <section class="documents-modal" role="dialog" aria-modal="true" aria-labelledby="documents-title">
      <header>
        <div>
          <p>EXPEDIENTE CIFRADO</p>
          <h2 id="documents-title">Documentos del cliente</h2>
          <span>{{ client.nombre }} - {{ client.rfc }}</span>
        </div>
        <AppButton icon="pi pi-times" aria-label="Cerrar" @click="emit('close')" />
      </header>

      <form v-if="!accessToken" class="documents-lock" @submit.prevent="unlock">
        <div class="lock-mark"><i class="pi pi-lock" aria-hidden="true"></i></div>
        <p>ACCESO PROTEGIDO</p>
        <h3>Verifica tu identidad</h3>
        <span>Escribe tu contraseña de acceso para abrir este expediente durante cinco minutos.</span>
        <label>
          <b>Tu contraseña</b>
          <AppInput v-model="verificationPassword" type="password" autocomplete="current-password"
            placeholder="Escribe tu contraseña" autofocus />
        </label>
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        <AppButton type="submit" label="Desbloquear expediente" icon="pi pi-lock-open"
          :disabled="!verificationPassword || verifying" />
      </form>

      <div v-else class="documents-body">
        <section class="upload-section" aria-labelledby="upload-title">
          <div class="section-heading">
            <div>
              <h3 id="upload-title">Agregar PDF</h3>
              <p>El archivo se cifra antes de quedar guardado en el servidor.</p>
            </div>
            <i class="pi pi-lock" aria-hidden="true"></i>
          </div>

          <label class="field-label">
            <span>Tipo de documento</span>
            <AppSelect
              v-model="documentType"
              :options="documentTypes"
              option-label="label"
              option-value="value"
            />
          </label>

          <div
            class="pdf-dropzone"
            :class="{ dragging, ready: pendingFile }"
            role="button"
            tabindex="0"
            @click="fileInput?.click()"
            @keydown.enter.prevent="fileInput?.click()"
            @keydown.space.prevent="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="dropFile"
          >
            <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="selectFromInput" />
            <i :class="pendingFile ? 'pi pi-file-pdf' : 'pi pi-cloud-upload'" aria-hidden="true"></i>
            <template v-if="pendingFile">
              <strong>{{ pendingFile.name }}</strong>
              <span>{{ fileSize(pendingFile.size) }}</span>
            </template>
            <template v-else>
              <strong>Arrastra un PDF aquí</strong>
              <span>o haz clic para seleccionarlo, máximo 15 MB</span>
            </template>
          </div>

          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <div class="upload-actions">
            <AppButton
              v-if="pendingFile"
              label="Quitar"
              outlined
              @click="pendingFile = null"
            />
            <AppButton
              label="Cifrar y guardar"
              icon="pi pi-lock"
              class="p-button-primary"
              :disabled="!pendingFile || uploading"
              @click="upload"
            />
          </div>
        </section>

        <section class="document-list" aria-labelledby="stored-title">
          <div class="section-heading">
            <div>
              <h3 id="stored-title">Archivos guardados</h3>
              <p>{{ documents.length }} documentos en este expediente.</p>
            </div>
            <AppButton icon="pi pi-refresh" aria-label="Actualizar documentos" :disabled="loading" @click="load" />
          </div>

          <div v-if="loading" class="document-loading" aria-label="Cargando documentos">
            <span v-for="item in 3" :key="item"></span>
          </div>
          <div v-else-if="!documents.length" class="document-empty">
            <i class="pi pi-folder-open" aria-hidden="true"></i>
            <strong>Expediente vacío</strong>
            <span>Agrega el primer PDF desde el panel de carga.</span>
          </div>
          <div v-else class="document-rows">
            <article v-for="document in documents" :key="document.id">
              <div class="document-icon"><i class="pi pi-file-pdf" aria-hidden="true"></i></div>
              <div class="document-copy">
                <span>{{ typeLabel(document.tipo) }}</span>
                <strong>{{ document.nombre_original }}</strong>
                <small>{{ fileSize(document.tamano) }} - {{ formatDate(document.creado_en) }}</small>
              </div>
              <div class="document-actions">
                <AppButton
                  icon="pi pi-download"
                  aria-label="Descargar documento"
                  :disabled="busyId === document.id"
                  @click="download(document)"
                />
                <AppButton
                  icon="pi pi-trash"
                  class="p-button-danger"
                  aria-label="Eliminar documento"
                  :disabled="busyId === document.id"
                  @click="remove(document)"
                />
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
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

const props = defineProps<{ client: Record<string, any> }>();
const emit = defineEmits<{ (event: "close"): void }>();
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
</script>

<style scoped>
.documents-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:1rem;background:rgba(5,5,5,.78);backdrop-filter:blur(5px)}
.documents-modal{width:min(68rem,100%);max-height:min(88dvh,54rem);overflow:hidden;border:1px solid var(--br-line-strong);background:var(--br-panel);color:var(--br-text);box-shadow:10px 10px 0 var(--br-accent)}
.documents-modal>header{display:flex;align-items:flex-start;justify-content:space-between;gap:2rem;padding:1.25rem;border-bottom:1px solid var(--br-line-strong);background:var(--br-panel-2)}
.documents-lock{display:grid;justify-items:start;gap:.65rem;width:min(31rem,calc(100% - 2rem));margin:clamp(2rem,7vh,5rem) auto;padding:1.5rem;border:1px solid var(--br-line-strong);background:var(--br-bg)}.lock-mark{display:grid;width:3.5rem;height:3.5rem;place-items:center;margin-bottom:.25rem;background:var(--br-accent);color:var(--br-accent-text);font-size:1.35rem}.documents-lock>p:not(.inline-error){margin:0;color:var(--br-accent);font:800 .68rem "Courier New",monospace;letter-spacing:.11em}.documents-lock h3{margin:0;font:900 1.8rem/1 Arial,sans-serif;text-transform:uppercase}.documents-lock>span{max-width:48ch;color:var(--br-muted);font:700 .78rem/1.5 "Courier New",monospace}.documents-lock label{display:grid;width:100%;gap:.45rem;margin-top:.65rem}.documents-lock label b{font:800 .7rem "Courier New",monospace;text-transform:uppercase}.documents-lock :deep(.app-button){margin-top:.35rem}
.documents-modal header p{margin:0 0 .35rem;color:var(--br-accent);font:800 .68rem "Courier New",monospace;letter-spacing:.12em}.documents-modal header h2{margin:0;font:900 clamp(1.6rem,4vw,2.7rem)/.95 Arial,sans-serif;text-transform:uppercase}.documents-modal header span{display:block;margin-top:.55rem;color:var(--br-muted);font:700 .78rem "Courier New",monospace}
.documents-body{display:grid;grid-template-columns:minmax(18rem,.8fr) minmax(24rem,1.2fr);max-height:calc(88dvh - 7.5rem);overflow:auto}.upload-section,.document-list{min-width:0;padding:1.25rem}.upload-section{border-right:1px solid var(--br-line)}
.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.1rem}.section-heading h3{margin:0;font:900 1.15rem Arial,sans-serif;text-transform:uppercase}.section-heading p{margin:.3rem 0 0;color:var(--br-muted);font:700 .72rem/1.45 "Courier New",monospace}.section-heading>i{color:var(--br-accent);font-size:1.5rem}
.field-label{display:grid;gap:.45rem;margin-bottom:1rem}.field-label>span{font:800 .7rem "Courier New",monospace;text-transform:uppercase}
.pdf-dropzone{min-height:14rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.65rem;padding:1.5rem;border:1px dashed var(--br-line-strong);background:var(--br-bg);text-align:center;cursor:pointer;transition:background-color .15s,border-color .15s,transform .15s}.pdf-dropzone:hover,.pdf-dropzone:focus-visible,.pdf-dropzone.dragging{outline:none;border-color:var(--br-accent);background:var(--br-accent-soft);transform:translateY(-2px)}.pdf-dropzone.ready{border-style:solid}.pdf-dropzone i{color:var(--br-accent);font-size:2.2rem}.pdf-dropzone strong{max-width:100%;overflow-wrap:anywhere;font:900 .9rem Arial,sans-serif}.pdf-dropzone span{color:var(--br-muted);font:700 .7rem "Courier New",monospace}
.upload-actions{display:flex;justify-content:flex-end;gap:.65rem;margin-top:1rem}.inline-error{margin:.8rem 0 0;padding:.7rem;border-left:4px solid var(--br-danger-line,#e06a5c);background:var(--br-danger,#96382e);color:var(--br-danger-text,#fff);font:700 .75rem/1.4 "Courier New",monospace}
.document-loading{display:grid;gap:.65rem}.document-loading span{height:5.2rem;background:linear-gradient(90deg,var(--br-panel-2),var(--br-control),var(--br-panel-2));background-size:200% 100%;animation:document-shimmer 1.1s infinite}.document-empty{min-height:18rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.65rem;border:1px solid var(--br-line);text-align:center}.document-empty i{color:var(--br-accent);font-size:2rem}.document-empty strong{font:900 1rem Arial,sans-serif;text-transform:uppercase}.document-empty span{color:var(--br-muted);font:700 .72rem "Courier New",monospace}
.document-rows{display:grid;gap:.55rem}.document-rows article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.8rem;padding:.75rem;border:1px solid var(--br-line);background:var(--br-bg)}.document-icon{width:2.8rem;height:2.8rem;display:grid;place-items:center;border:1px solid var(--br-line-strong);color:var(--br-accent)}.document-copy{min-width:0}.document-copy span,.document-copy small{display:block;color:var(--br-muted);font:700 .66rem "Courier New",monospace}.document-copy span{text-transform:uppercase}.document-copy strong{display:block;overflow:hidden;margin:.2rem 0;text-overflow:ellipsis;white-space:nowrap;font:800 .85rem Arial,sans-serif}.document-actions{display:flex;gap:.4rem}
@keyframes document-shimmer{to{background-position:-200% 0}}
@media(max-width:760px){.documents-overlay{align-items:stretch;place-items:stretch;padding:0}.documents-modal{display:flex;width:100vw;max-height:100dvh;height:100dvh;flex-direction:column;border:0;box-shadow:none}.documents-modal>header{flex-shrink:0;gap:1rem}.documents-lock{width:100%;min-height:0;flex:1;margin:0;border:0;border-top:1px solid var(--br-line);place-content:center;padding:1.25rem}.documents-body{min-height:0;flex:1;grid-template-columns:1fr;max-height:none;overflow:auto}.upload-section{border-right:0;border-bottom:1px solid var(--br-line)}.document-rows article{grid-template-columns:auto minmax(0,1fr)}.document-actions{grid-column:1/-1;justify-content:flex-end}}
@media(prefers-reduced-motion:reduce){.pdf-dropzone{transition:none}.document-loading span{animation:none}}
</style>
