interface AdminMobileMoreMenuProps {
  isOpen: boolean
  profileName: string
  profilePicture: string
  profileType: string
  isAdmin: boolean
  menuItems: NavigationItem[]
}

interface AdminMobileMoreMenuEmits {
  close: []
  openNotes: []
  openLogs: []
  logout: []
}

import { RouterLink } from 'vue-router'
import type { NavigationItem } from '@/types/navigation'

defineProps<AdminMobileMoreMenuProps>()

const emit = defineEmits<AdminMobileMoreMenuEmits>()
