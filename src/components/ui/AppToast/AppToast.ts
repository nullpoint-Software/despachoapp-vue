import { useAppToast } from "@/composables/useAppToast";
const { messages, remove } = useAppToast();
const iconFor = (severity?: string) => ({ success:"pi pi-check", error:"pi pi-times", warn:"pi pi-exclamation-triangle", info:"pi pi-info-circle" }[severity || "info"]);
