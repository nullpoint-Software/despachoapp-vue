interface MobileSidebarProps {
  isOpen: boolean
  profileName?: string
  profilePicture?: string
  profileType?: string
  menuItems: MenuItem[]
}

import { gsap } from 'gsap'
import { onUnmounted } from 'vue'

interface MenuItem {
  name: string
  path: string
  icon: string
}

defineProps<MobileSidebarProps>()

defineEmits(['closeMenu', 'logout'])

let activeTimeline: gsap.core.Timeline | null = null

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function onEnter(element: Element, done: () => void) {
  const overlay = element as HTMLElement
  const panel = overlay.querySelector<HTMLElement>('.mobile-menu-panel')
  const items = Array.from(overlay.querySelectorAll<HTMLElement>('.mobile-animate'))
  if (!panel || prefersReducedMotion()) {
    gsap.set(overlay, { autoAlpha: 1, backgroundColor: 'rgba(10,10,9,.58)' })
    if (panel) gsap.set(panel, { xPercent: 0 })
    done()
    return
  }

  activeTimeline?.kill()
  activeTimeline = gsap.timeline({ onComplete: done })
  activeTimeline
    .fromTo(
      overlay,
      { autoAlpha: 0, backgroundColor: 'rgba(10,10,9,0)' },
      { autoAlpha: 1, backgroundColor: 'rgba(10,10,9,.58)', duration: 0.22, ease: 'power1.out' },
      0
    )
    .fromTo(panel, { xPercent: -105 }, { xPercent: 0, duration: 0.42, ease: 'expo.out' }, 0)
    .fromTo(
      items,
      { autoAlpha: 0, x: -16 },
      { autoAlpha: 1, x: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out' },
      0.12
    )
}

function onLeave(element: Element, done: () => void) {
  const overlay = element as HTMLElement
  const panel = overlay.querySelector<HTMLElement>('.mobile-menu-panel')
  const items = Array.from(overlay.querySelectorAll<HTMLElement>('.mobile-animate'))
  if (!panel || prefersReducedMotion()) {
    done()
    return
  }

  activeTimeline?.kill()
  activeTimeline = gsap.timeline({ onComplete: done })
  activeTimeline
    .to(items, { autoAlpha: 0, x: -8, duration: 0.1, stagger: 0.008, ease: 'power1.in' }, 0)
    .to(panel, { xPercent: -105, duration: 0.3, ease: 'power3.inOut' }, 0.03)
    .to(overlay, { backgroundColor: 'rgba(10,10,9,0)', duration: 0.22, ease: 'power1.in' }, 0.03)
}

onUnmounted(() => {
  activeTimeline?.kill()
})
