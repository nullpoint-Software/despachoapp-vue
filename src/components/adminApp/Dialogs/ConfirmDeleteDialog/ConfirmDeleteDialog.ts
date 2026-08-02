import { ref } from 'vue';
defineProps({
  element: String,
})
const agreed = ref(false);
const emit = defineEmits(['confirm', 'cancel']);

const confirm = () => {
  if (agreed.value) {
    emit('confirm');
    agreed.value = false;
  }
};

const cancel = () => {
  emit('cancel');
  agreed.value = false;
};
