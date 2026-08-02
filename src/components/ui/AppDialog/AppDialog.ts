import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAppDialog } from "@/composables/useAppDialog";
const { dialog, settle } = useAppDialog();
const inputValue = ref("");
const eyebrow = computed(() => dialog.value?.tone === "danger" ? "ACCIÓN SENSIBLE" : "SISTEMA / AVISO");
watch(dialog, () => { inputValue.value = dialog.value?.initialValue || ""; });
function accept() { if (dialog.value) settle(dialog.value.mode === "prompt" ? inputValue.value : true); }
function cancel() { if (dialog.value) settle(dialog.value.mode === "prompt" ? null : false); }
function onKeydown(event: KeyboardEvent) { if (event.key === "Escape" && dialog.value) cancel(); }
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
