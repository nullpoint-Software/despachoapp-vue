import { USER_AVATAR_PLACEHOLDER } from '@/constants/brandAssets'

interface AppAvatarProps {
  image?: string | null
  label?: string
}

defineProps<AppAvatarProps>()
