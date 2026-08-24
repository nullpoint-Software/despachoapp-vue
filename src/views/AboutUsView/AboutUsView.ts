import { ref } from 'vue'
import { useRouter } from 'vue-router'
import mainImageSrc from '@/assets/img/logsymbolwhite.png'

export default {
  setup() {
    const menuOpen = ref(false)
    const router = useRouter()

    const navigateTo = (path: string): void => {
      router.push(path)
      menuOpen.value = false
    }

    const scrollToFooter = () => {
      const footer = document.getElementById('footer')
      if (footer) {
        footer.scrollIntoView({ behavior: 'smooth' })
      }
    }

    return { menuOpen, navigateTo, scrollToFooter, mainImageSrc }
  }
}
