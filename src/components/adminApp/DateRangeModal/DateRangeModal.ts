interface DateRangeModalProps {
  from: Date
  to: Date
}

interface DateRangeModalEmits {
  close: []
  apply: [from: Date, to: Date]
}

import { computed, ref } from 'vue'
const props = defineProps<DateRangeModalProps>()
const emit = defineEmits<DateRangeModalEmits>()
const draftFrom = ref(new Date(props.from)),
  draftTo = ref(new Date(props.to))
const invalid = computed(() => draftFrom.value >= draftTo.value)
function apply() {
  if (!invalid.value) emit('apply', new Date(draftFrom.value), new Date(draftTo.value))
}
