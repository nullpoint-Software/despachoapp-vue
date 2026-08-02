interface AppFilterModalProps {
  visible: boolean;
  title: string;
  eyebrow: string;
  titleId: string;
}

interface AppFilterModalEmits {
  close: [];
  reset: [];
  apply: [];
}

import { nextTick, ref, watch } from "vue";
const props = defineProps<AppFilterModalProps>();

defineEmits<AppFilterModalEmits>();

const modal = ref<HTMLElement | null>(null);

watch(() => props.visible, async (visible) => {
  if (!visible) return;
  await nextTick();
  modal.value?.focus();
});
