import { readonly, ref } from "vue";

export interface ToastMessage {
  id?: number;
  severity?: "success" | "info" | "warn" | "error";
  summary?: string;
  detail?: string;
  life?: number;
}

type StoredToast = ToastMessage & { id: number };
const messages = ref<StoredToast[]>([]);
let nextId = 1;

const add = (message: ToastMessage) => {
  const id = nextId++;
  const item = { severity: "info" as const, life: 3000, ...message, id };
  messages.value.push(item);
  window.setTimeout(() => remove(id), item.life);
};
const remove = (id: number) => {
  messages.value = messages.value.filter((message) => message.id !== id);
};

export function useAppToast() {
  return { messages: readonly(messages), add, remove };
}
