import { useRouter } from 'vue-router'
const router = useRouter()

defineProps({
  profileName: String,
  profilePicture: String,
  profileType: String,
  isAdmin: Boolean,
  notesActive: Boolean,
  logsActive: Boolean
})

defineEmits(['toggleMenu', 'openNotes', 'openLogs', 'logout'])
