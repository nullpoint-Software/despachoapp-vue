interface StorageDrawerProps { notes: NoteType[]; open?: boolean }

interface StorageDrawerEmits {
  (e: "close"): void;
  (e: "unstore-note", id: number): void;
}

import { marked } from "marked";
import type { Note as NoteType } from "@/composables/useNotesStore";
const props = defineProps<StorageDrawerProps>();
const emit = defineEmits<StorageDrawerEmits>();

const onDragStart = (e: DragEvent, note: NoteType) => {
  if (!e.dataTransfer) return;
  e.dataTransfer.setData("text/plain", String(note.id));
  try { e.dataTransfer.effectAllowed = "copyMove"; } catch {}
};

const renderMarkdown = (md?: string) => {
  if (!md) return "";
  const rendered = marked(md) as unknown as string;
  return rendered.replace(/^<p>|<\/p>$/g, "");
};
