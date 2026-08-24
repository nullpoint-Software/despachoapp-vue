import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

defineProps({
  contained: {
    type: Boolean,
    default: false
  }
})

const faceRows = [
  '00100000100',
  '00111111100',
  '01111111110',
  '11111111111',
  '11001110011',
  '11111111111',
  '11111001111',
  '11111111111',
  '01111111110',
  '00111111100'
]

const faceDots = faceRows.flatMap((row, rowIndex) =>
  [...row].map((value, columnIndex) => {
    let part = ''
    if (rowIndex === 4 && [2, 3, 7, 8].includes(columnIndex)) part = 'eye'
    if (rowIndex === 6 && [5, 6].includes(columnIndex)) part = 'mouth'

    return {
      key: `${rowIndex}-${columnIndex}`,
      active: value === '1',
      part
    }
  })
)

const loaderShell = ref<HTMLElement | null>(null)
let animationContext: gsap.Context | undefined
let handlePointerMove: ((event: PointerEvent) => void) | undefined
let handlePointerLeave: (() => void) | undefined

onMounted(() => {
  const shell = loaderShell.value
  if (!shell) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  animationContext = gsap.context(() => {
    const copy = shell.querySelector<HTMLElement>('.loader-copy')
    const matrix = shell.querySelector<HTMLElement>('.dot-face')
    const activeDots = gsap.utils.toArray('.face-dot--active')
    const idleDots = gsap.utils.toArray('.face-dot--idle:not(.face-dot--feature)')
    const eyes = gsap.utils.toArray('.face-dot--eye')
    const mouth = gsap.utils.toArray('.face-dot--mouth')

    gsap.set(copy, { textContent: 'Cargando' })

    if (reduceMotion) return

    gsap.fromTo(
      activeDots,
      { scale: 0.2, backgroundColor: '#303330' },
      {
        scale: 1,
        backgroundColor: '#f4f5f1',
        duration: 0.42,
        stagger: { grid: [10, 11], from: 'center', amount: 0.48 },
        ease: 'steps(3)'
      }
    )

    gsap.to(idleDots, {
      backgroundColor: '#4b4e4b',
      duration: 0.65,
      repeat: -1,
      repeatDelay: 0.2,
      yoyo: true,
      stagger: { amount: 0.8, from: 'random' },
      ease: 'steps(3)'
    })

    gsap
      .timeline({ repeat: -1, repeatDelay: 2 })
      .to(eyes, { scaleY: 0.15, duration: 0.07 })
      .to(eyes, { scaleY: 1, duration: 0.09 })

    gsap.to(mouth, {
      scaleY: 0.55,
      duration: 0.38,
      repeat: -1,
      repeatDelay: 0.35,
      yoyo: true,
      stagger: 0.05,
      ease: 'steps(2)'
    })

    gsap
      .timeline({ repeat: -1, repeatDelay: 0.55 })
      .set(copy, { textContent: 'C4RG#NDO' })
      .to(copy, {
        duration: 1.05,
        scrambleText: {
          text: 'Cargando',
          chars: '01<>/_#',
          revealDelay: 0.18,
          speed: 0.45
        },
        ease: 'none'
      })
      .to({}, { duration: 0.75 })

    const moveEyesX = gsap.quickTo(eyes, 'x', { duration: 0.15, ease: 'power2.out' })
    const moveEyesY = gsap.quickTo(eyes, 'y', { duration: 0.15, ease: 'power2.out' })
    const moveFaceX = gsap.quickTo(matrix, 'x', { duration: 0.22, ease: 'power2.out' })
    const moveFaceY = gsap.quickTo(matrix, 'y', { duration: 0.22, ease: 'power2.out' })

    handlePointerMove = (event: PointerEvent) => {
      const bounds = shell.getBoundingClientRect()
      const x = gsap.utils.clamp(-1, 1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1)
      const y = gsap.utils.clamp(-1, 1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1)

      moveEyesX(Math.round(x * 2))
      moveEyesY(Math.round(y * 2))
      moveFaceX(Math.round(x))
      moveFaceY(Math.round(y))
    }

    handlePointerLeave = () => {
      moveEyesX(0)
      moveEyesY(0)
      moveFaceX(0)
      moveFaceY(0)
    }

    shell.addEventListener('pointermove', handlePointerMove, { passive: true })
    shell.addEventListener('pointerleave', handlePointerLeave)
  }, shell)
})

onUnmounted(() => {
  const shell = loaderShell.value
  if (shell && handlePointerMove) shell.removeEventListener('pointermove', handlePointerMove)
  if (shell && handlePointerLeave) shell.removeEventListener('pointerleave', handlePointerLeave)
  animationContext?.revert()
})
