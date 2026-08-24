import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import mainImageSrc from '@/assets/img/logsymbolwhite.png'
import FaultyTerminal from './FaultyTerminal/FaultyTerminal.vue'
import AsciiOrb from './AsciiOrb/AsciiOrb.vue'

gsap.registerPlugin(ScrollTrigger)

type Feature = {
  number: string
  title: string
  summary: string
  how: string
  benefit: string
  details: string[]
  icon: string
}

type WorkflowStep = {
  label: string
  title: string
  text: string
  result: string
  icon: string
}

type SecurityFeature = {
  title: string
  text: string
  result: string
  icon: string
}

type NavItem = {
  label: string
  href: string
  section: string
}

export default {
  components: { FaultyTerminal, AsciiOrb },
  setup() {
    const router = useRouter()
    const pageRef = ref<HTMLElement | null>(null)
    const menuOpen = ref(false)
    const rotatingIndex = ref(0)
    const activeFeatureIndex = ref(0)
    const securityRotation = ref(0)
    const securityDragging = ref(false)
    const securityAutoplayPaused = ref(false)
    const securityTrackRef = ref<HTMLElement | null>(null)
    const securityGalleryRef = ref<HTMLElement | null>(null)
    const activeNavIndex = ref(0)
    const navHoverIndex = ref<number | null>(null)
    const isLogged = computed(() => Boolean(localStorage.getItem('token')))
    const accessLabel = computed(() => (isLogged.value ? 'Ir a la aplicación' : 'Iniciar sesión'))
    const currentYear = new Date().getFullYear()
    let rotationTimer: number | undefined
    let featureTimer: number | undefined
    let securityTimer: number | undefined
    let revealObserver: IntersectionObserver | undefined
    let sectionObserver: IntersectionObserver | undefined
    let motionPreference: MediaQueryList | undefined
    let stackContext: { revert: () => void } | undefined
    let securityPointerId: number | undefined
    let securityPointerInside = false
    let securityDragStartX = 0
    let securityDragStartRotation = 0
    let securityDragRotation = 0
    let navScrollTimer: number | undefined
    let navScrollTargetIndex: number | null = null

    const rotatingPhrases = ['Una vista.', 'Todo conectado.', 'Bajo control.', 'Sin duplicados.']

    const navItems: NavItem[] = [
      { label: 'Funciones', href: '#funciones', section: 'funciones' },
      { label: 'Cómo funciona', href: '#flujo', section: 'flujo' },
      { label: 'Seguridad', href: '#seguridad', section: 'seguridad' },
      { label: 'Contacto', href: '#contacto', section: 'contacto' }
    ]

    const features: Feature[] = [
      {
        number: '01',
        title: 'Resumen operativo',
        summary:
          'Reúne ingresos registrados, clientes activos, tareas pendientes y actividad fiscal para decidir qué atender primero.',
        how: 'Lee pagos, expedientes, tareas y reportes del periodo, y los ordena por prioridad y actividad reciente.',
        benefit:
          'El equipo empieza el día con pendientes claros y accesos directos al registro que necesita.',
        details: [
          'Indicadores por día, mes y año',
          'Pendientes agrupados por responsable',
          'Accesos a clientes, pagos y tareas',
          'Lectura de la actividad reciente'
        ],
        icon: 'pi pi-chart-bar'
      },
      {
        number: '02',
        title: 'Tareas y seguimiento',
        summary:
          'Organiza el trabajo del equipo con responsables, fechas, prioridades y avance visible en un tablero Kanban.',
        how: 'Cada tarea conserva estado, responsable, fecha límite, detalle y reportes relacionados durante todo el seguimiento.',
        benefit:
          'Reduce pendientes sin dueño y permite detectar bloqueos antes de que se conviertan en urgencias.',
        details: [
          'Estados y prioridades configurables',
          'Asignación a usuarios del despacho',
          'Fechas límite y seguimiento',
          'Detalle y reportes por tarea'
        ],
        icon: 'pi pi-th-large'
      },
      {
        number: '03',
        title: 'Expedientes de clientes',
        summary:
          'Concentra identidad, contacto, situación fiscal, documentos y credenciales protegidas dentro de cada expediente.',
        how: 'Pagos, CFDI, tareas, notas y archivos conservan el vínculo con el cliente que originó la operación.',
        benefit:
          'Evita reconstruir el contexto desde carpetas, mensajes y hojas distintas cada vez que se atiende un asunto.',
        details: [
          'Búsqueda y filtros por cliente',
          'Documentos vinculados al expediente',
          'Datos fiscales disponibles al operar',
          'Revelado seguro de datos sensibles'
        ],
        icon: 'pi pi-id-card'
      },
      {
        number: '04',
        title: 'Pagos y cobranza',
        summary:
          'Registra cada cobro por cliente y concepto, consulta periodos y conserva un historial claro de movimientos.',
        how: 'Los movimientos quedan relacionados con su cliente, fecha, concepto y comprobante para consultarlos desde distintos filtros.',
        benefit:
          'Permite confirmar qué se pagó, qué falta y de dónde proviene cada importe sin rehacer cortes manuales.',
        details: [
          'Conceptos y movimientos de cobro',
          'Filtros por fecha, cliente o periodo',
          'Cortes e historial de pagos',
          'Comprobantes desde el registro'
        ],
        icon: 'pi pi-wallet'
      },
      {
        number: '05',
        title: 'Operación fiscal',
        summary:
          'Relaciona facturas, conceptos e impuestos con el cliente para preparar consultas y reportes fiscales por periodo.',
        how: 'Importa y desglosa CFDI, organiza proveedores e impuestos, y reutiliza esos datos en reportes mensuales y DIOT.',
        benefit:
          'Disminuye la recaptura en hojas externas y mantiene el origen de cada cifra disponible para revisión.',
        details: [
          'Importación y consulta de CFDI',
          'Conceptos e impuestos desglosados',
          'Reportes fiscales por periodo',
          'Proveedores y datos para DIOT'
        ],
        icon: 'pi pi-percentage'
      },
      {
        number: '06',
        title: 'Catálogos SAT',
        summary:
          'Busca claves, descripciones y vigencias del SAT mientras se captura información dentro del sistema.',
        how: 'Centraliza los catálogos fiscales y permite consultarlos o seleccionarlos desde los formularios donde se necesitan.',
        benefit:
          'Reduce errores de captura y evita interrumpir el trabajo para buscar referencias en fuentes separadas.',
        details: [
          'Búsqueda por clave o descripción',
          'Vigencias disponibles',
          'Selección directa desde formularios',
          'Referencias fiscales centralizadas'
        ],
        icon: 'pi pi-search'
      },
      {
        number: '07',
        title: 'Cumplimiento',
        summary:
          'Revisa opiniones de cumplimiento y detecta qué contribuyentes requieren atención con filtros y estados claros.',
        how: 'Agrupa resultados, permite filtrar por régimen y conserva el detalle ligado al expediente de cada contribuyente.',
        benefit:
          'Ayuda a identificar asuntos que necesitan seguimiento antes de que una fecha o una obligación se pierda de vista.',
        details: [
          'Resumen agrupado por estado',
          'Filtros por régimen fiscal',
          'Detalle por contribuyente',
          'Pendientes visibles para seguimiento'
        ],
        icon: 'pi pi-verified'
      },
      {
        number: '08',
        title: 'Notas de trabajo',
        summary:
          'Conserva acuerdos, recordatorios y contexto operativo en documentos Markdown organizados por directorios.',
        how: 'La edición visual actualiza el resultado al instante y mantiene imágenes, tablas, listas, fórmulas, citas y resaltados.',
        benefit:
          'El usuario documenta lo importante sin cambiar de herramienta y puede mantener una nota anclada mientras trabaja.',
        details: [
          'Edición visual con salida Markdown',
          'Imágenes, tablas, listas y fórmulas',
          'Fragmentos importantes resaltados',
          'Notas ancladas sobre cualquier modal'
        ],
        icon: 'pi pi-file-edit'
      },
      {
        number: '09',
        title: 'Documentos y salidas',
        summary:
          'Genera comprobantes, tickets, vistas previas y archivos de trabajo con la información ya capturada.',
        how: 'Toma datos de clientes, pagos y operaciones para componer salidas consistentes sin volver a escribirlos.',
        benefit:
          'Acelera la entrega de documentos y reduce diferencias entre el registro interno y el archivo que recibe el cliente.',
        details: [
          'Impresión térmica de comprobantes',
          'Reportes con vista previa',
          'Exportaciones a Excel',
          'Salidas ligadas a los registros'
        ],
        icon: 'pi pi-print'
      },
      {
        number: '10',
        title: 'Acceso y configuración',
        summary:
          'Administra cuentas, permisos y preferencias para adaptar el sistema a cada integrante del despacho.',
        how: 'Valida acciones sensibles por rol, registra actividad y ofrece passkeys, recuperación de acceso y ajustes visuales.',
        benefit:
          'Protege la información sin obligar a todos los usuarios a trabajar con los mismos permisos o preferencias.',
        details: [
          'Roles y permisos por usuario',
          'Passkeys y recuperación de acceso',
          'Bitácora de cambios y actividad',
          'Paletas, fuente y escala de interfaz'
        ],
        icon: 'pi pi-cog'
      },
      {
        number: '11',
        title: 'Copias de seguridad',
        summary:
          'Protege la base de datos, los CFDI y los documentos con respaldos manuales o programados.',
        how: 'Empaqueta la información en archivos de respaldo, aplica reglas de retención y crea una copia preventiva antes de restaurar.',
        benefit:
          'Mantiene una ruta de recuperación verificable cuando un archivo, un registro o una instalación necesita volver atrás.',
        details: [
          'Programación diaria, semanal o mensual',
          'Descarga e importación de archivos .tar.gz',
          'Retención por antigüedad y cantidad',
          'Respaldo preventivo antes de restaurar'
        ],
        icon: 'pi pi-database'
      }
    ]

    const capabilityGroups = [
      {
        title: 'Trabajo diario',
        description:
          'Prioriza pendientes, coordina responsables y conserva notas dentro del mismo contexto operativo.',
        features: [features[0], features[1], features[7]]
      },
      {
        title: 'Clientes y cobranza',
        description:
          'Relaciona el expediente con los cobros y con cada documento que sale del despacho.',
        features: [features[2], features[3], features[8]]
      },
      {
        title: 'Fiscal y cumplimiento',
        description:
          'Conecta CFDI, catálogos fiscales y revisiones de cumplimiento para reducir recapturas.',
        features: [features[4], features[5], features[6]]
      },
      {
        title: 'Control y continuidad',
        description:
          'Define quién puede hacer cada acción y mantiene una ruta de recuperación para la información.',
        features: [features[9], features[10]]
      }
    ]

    const workflow: WorkflowStep[] = [
      {
        label: 'Punto de partida',
        title: 'Registra',
        text: 'Crea el expediente del cliente y concentra identidad, contacto, datos fiscales y documentos.',
        result: 'El expediente se vuelve la fuente común para las siguientes operaciones.',
        icon: 'pi pi-id-card'
      },
      {
        label: 'Coordinación',
        title: 'Organiza',
        text: 'Asigna tareas, fechas, prioridades y responsables para que cada pendiente tenga seguimiento.',
        result: 'El equipo comparte responsables, fechas y contexto sin duplicar capturas.',
        icon: 'pi pi-sitemap'
      },
      {
        label: 'Operación',
        title: 'Trabaja',
        text: 'Captura pagos, consulta CFDI, prepara reportes y revisa el cumplimiento de cada cliente.',
        result: 'Cada movimiento permanece relacionado con su cliente y periodo.',
        icon: 'pi pi-cog'
      },
      {
        label: 'Salida',
        title: 'Entrega',
        text: 'Genera comprobantes, imprime tickets o exporta la información que necesita el despacho.',
        result: 'Las salidas reutilizan información validada en lugar de volver a escribirla.',
        icon: 'pi pi-send'
      },
      {
        label: 'Continuidad',
        title: 'Respalda',
        text: 'Programa copias de la base de datos, CFDI y documentos para conservar una ruta de recuperación.',
        result: 'La operación mantiene una copia verificable antes de una restauración.',
        icon: 'pi pi-database'
      }
    ]

    const securityFeatures: SecurityFeature[] = [
      {
        title: 'Acceso protegido',
        text: 'Contraseña y recuperación de acceso ofrecen una ruta clara para volver a entrar sin compartir credenciales.',
        result: 'La identidad se valida antes de abrir la operación del despacho.',
        icon: 'pi pi-lock'
      },
      {
        title: 'Passkeys',
        text: 'Las passkeys permiten verificar la identidad con un dispositivo autorizado y reducir la dependencia de contraseñas.',
        result:
          'El acceso cotidiano gana una comprobación adicional sin agregar pasos innecesarios.',
        icon: 'pi pi-key'
      },
      {
        title: 'Permisos por usuario',
        text: 'Cada cuenta recibe capacidad de consulta, edición o eliminación según su responsabilidad dentro del equipo.',
        result: 'Cada persona ve y modifica únicamente lo necesario para su trabajo.',
        icon: 'pi pi-users'
      },
      {
        title: 'Bitácora de actividad',
        text: 'La actividad registrada ayuda a revisar qué cambió, quién realizó la acción y cuándo ocurrió.',
        result:
          'El despacho puede reconstruir el contexto de un cambio sin depender de la memoria.',
        icon: 'pi pi-history'
      },
      {
        title: 'Información sensible',
        text: 'Los datos protegidos permanecen ocultos hasta que una acción autorizada solicita mostrarlos.',
        result: 'La información delicada no queda expuesta durante la navegación normal.',
        icon: 'pi pi-eye-slash'
      },
      {
        title: 'Interfaz adaptable',
        text: 'Paletas con contraste, escala de texto y fuente editable permiten ajustar la lectura a cada usuario.',
        result:
          'La aplicación conserva claridad sin imponer la misma configuración visual a todos.',
        icon: 'pi pi-palette'
      }
    ]

    const securityStep = 360 / securityFeatures.length
    const navIndicatorIndex = computed(() => navHoverIndex.value ?? activeNavIndex.value)
    const activeFeature = computed(() => features[activeFeatureIndex.value] || features[0])
    const featureDeck = computed(() => [
      { feature: features[(activeFeatureIndex.value + 2) % features.length], position: 'back' },
      { feature: features[(activeFeatureIndex.value + 1) % features.length], position: 'middle' },
      { feature: activeFeature.value, position: 'active' }
    ])
    const securityActiveIndex = computed(() => normalizeSecurityIndex(securityRotation.value))
    const activeSecurity = computed(
      () => securityFeatures[securityActiveIndex.value] || securityFeatures[0]
    )
    const securityGalleryStyle = computed<Record<string, string>>(() => ({
      '--gallery-rotation': securityRotation.value + 'deg'
    }))

    function goLogin(): void {
      router.push(isLogged.value ? '/app/inicio' : '/login')
    }

    function closeMenu(): void {
      menuOpen.value = false
    }

    function getNavOffset(): number {
      const header =
        pageRef.value?.querySelector<HTMLElement>('.home-header') ??
        document.querySelector<HTMLElement>('.home-header')
      return Math.ceil(header?.getBoundingClientRect().height ?? 72) + 18
    }

    function resolveActiveSection(fallbackIndex = activeNavIndex.value): void {
      const scrollingElement = document.scrollingElement ?? document.documentElement
      const reachedBottom = window.scrollY + window.innerHeight >= scrollingElement.scrollHeight - 4
      if (reachedBottom) {
        activeNavIndex.value = navItems.length - 1
        return
      }

      const activationLine = getNavOffset() + window.innerHeight * 0.18
      let resolvedIndex = fallbackIndex
      navItems.forEach((item, index) => {
        const section = document.getElementById(item.section)
        if (section && section.getBoundingClientRect().top <= activationLine) resolvedIndex = index
      })
      activeNavIndex.value = resolvedIndex
    }

    function isNavTargetSettled(index: number): boolean {
      const scrollingElement = document.scrollingElement ?? document.documentElement
      if (index === navItems.length - 1) {
        return window.scrollY + window.innerHeight >= scrollingElement.scrollHeight - 4
      }
      const section = document.getElementById(navItems[index]?.section ?? '')
      return Boolean(section && Math.abs(section.getBoundingClientRect().top - getNavOffset()) <= 3)
    }

    function completeNavScroll(): void {
      window.clearTimeout(navScrollTimer)
      window.removeEventListener('scrollend', handleNavScrollEnd)
      const fallbackIndex = navScrollTargetIndex ?? activeNavIndex.value
      navScrollTargetIndex = null
      resolveActiveSection(fallbackIndex)
    }

    function handleNavScrollEnd(): void {
      if (navScrollTargetIndex !== null && !isNavTargetSettled(navScrollTargetIndex)) {
        window.addEventListener('scrollend', handleNavScrollEnd, { once: true })
        return
      }
      completeNavScroll()
    }

    function navigateToSection(item: NavItem, index: number, event?: Event): void {
      event?.preventDefault()
      const section = document.getElementById(item.section)
      if (!section) return

      window.clearTimeout(navScrollTimer)
      window.removeEventListener('scrollend', handleNavScrollEnd)
      navScrollTargetIndex = index
      activeNavIndex.value = index
      navHoverIndex.value = null
      closeMenu()

      if (window.location.hash !== item.href) window.history.pushState(null, '', item.href)
      else window.history.replaceState(null, '', item.href)

      const targetTop = Math.max(
        0,
        section.getBoundingClientRect().top + window.scrollY - getNavOffset()
      )
      const reduceMotion = Boolean(motionPreference?.matches)
      window.addEventListener('scrollend', handleNavScrollEnd, { once: true })
      window.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' })
      navScrollTimer = window.setTimeout(completeNavScroll, reduceMotion ? 0 : 1400)
    }

    function stepFeature(): void {
      activeFeatureIndex.value = (activeFeatureIndex.value + 1) % features.length
    }

    function syncFeatureAutoplay(): void {
      window.clearInterval(featureTimer)
      if (motionPreference?.matches || document.hidden) return
      featureTimer = window.setInterval(stepFeature, 3900)
    }

    function syncRotation(): void {
      window.clearInterval(rotationTimer)
      if (motionPreference?.matches || document.hidden) return
      rotationTimer = window.setInterval(() => {
        rotatingIndex.value = (rotatingIndex.value + 1) % rotatingPhrases.length
      }, 2800)
    }

    function normalizeSecurityIndex(rotation: number): number {
      const index = Math.round(-rotation / securityStep) % securityFeatures.length
      return (index + securityFeatures.length) % securityFeatures.length
    }

    function securityCardStyle(index: number): Record<string, string> {
      return { '--gallery-angle': index * securityStep + 'deg' }
    }

    function stepSecurity(direction = 1): void {
      securityRotation.value -= securityStep * direction
    }

    function syncSecurityAutoplay(): void {
      window.clearInterval(securityTimer)
      const focusInside = Boolean(securityGalleryRef.value?.contains(document.activeElement))
      if (
        motionPreference?.matches ||
        document.hidden ||
        securityAutoplayPaused.value ||
        securityDragging.value ||
        securityPointerInside ||
        focusInside
      )
        return
      securityTimer = window.setInterval(() => stepSecurity(1), 4200)
    }

    function controlSecurity(direction: number): void {
      stepSecurity(direction)
      syncSecurityAutoplay()
    }

    function toggleSecurityAutoplay(): void {
      securityAutoplayPaused.value = !securityAutoplayPaused.value
      syncSecurityAutoplay()
    }

    function pauseSecurityAutoplay(): void {
      window.clearInterval(securityTimer)
    }

    function handleSecurityPointerEnter(): void {
      securityPointerInside = true
      pauseSecurityAutoplay()
    }

    function handleSecurityPointerLeave(): void {
      securityPointerInside = false
      if (!securityDragging.value) syncSecurityAutoplay()
    }

    function beginSecurityDrag(event: PointerEvent): void {
      const target = event.currentTarget as HTMLElement
      securityPointerId = event.pointerId
      securityDragging.value = true
      securityDragStartX = event.clientX
      securityDragStartRotation = securityRotation.value
      securityDragRotation = securityRotation.value
      target.setPointerCapture?.(event.pointerId)
      pauseSecurityAutoplay()
    }

    function moveSecurityDrag(event: PointerEvent): void {
      if (!securityDragging.value || securityPointerId !== event.pointerId) return
      securityDragRotation = securityDragStartRotation + (event.clientX - securityDragStartX) * 0.26
      securityTrackRef.value?.style.setProperty('--gallery-rotation', securityDragRotation + 'deg')
    }

    function finishSecurityDrag(event: PointerEvent): void {
      if (!securityDragging.value || securityPointerId !== event.pointerId) return
      const target = event.currentTarget as HTMLElement
      if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
      securityPointerId = undefined
      securityDragging.value = false
      const snappedRotation = Math.round(securityDragRotation / securityStep) * securityStep
      nextTick(() => {
        securityRotation.value = snappedRotation
        securityTrackRef.value?.style.setProperty('--gallery-rotation', snappedRotation + 'deg')
        syncSecurityAutoplay()
      })
    }

    function handleSecurityFocusOut(event: FocusEvent): void {
      const wrapper = event.currentTarget as HTMLElement
      if (event.relatedTarget instanceof Node && wrapper.contains(event.relatedTarget)) return
      syncSecurityAutoplay()
    }

    function syncCurvedLoop(): void {
      const loop = pageRef.value?.querySelector<SVGSVGElement>('.home-curved-loop')
      if (!loop) return
      if (motionPreference?.matches || document.hidden) loop.pauseAnimations()
      else loop.unpauseAnimations()
    }

    function setupScrollStack(): void {
      stackContext?.revert()
      stackContext = undefined
      if (!pageRef.value || motionPreference?.matches) return
      const container = pageRef.value.querySelector<HTMLElement>('.home-scroll-stack')
      if (!container) return
      const cards = Array.from(container.querySelectorAll<HTMLElement>('.home-stack-card'))
      if (cards.length < 2) return

      stackContext = gsap.context(() => {
        cards.forEach((card, index) => {
          const surface = card.querySelector<HTMLElement>('.home-stack-card__surface')
          const nextCard = cards[index + 1]
          if (!surface || !nextCard) return
          const restingTop = 100 + index * 12

          gsap.to(surface, {
            y: -8 - index * 2,
            scale: 0.91 + index * 0.012,
            rotationX: -1.2,
            autoAlpha: 0.62,
            ease: 'none',
            scrollTrigger: {
              id: 'home-stack-compress-' + index,
              trigger: nextCard,
              start: 'top bottom-=12%',
              end: () => 'top ' + restingTop + 'px',
              scrub: true,
              invalidateOnRefresh: true
            }
          })
        })
      }, container)

      ScrollTrigger.refresh()
    }

    function syncMotionSystems(): void {
      syncRotation()
      syncFeatureAutoplay()
      syncSecurityAutoplay()
      syncCurvedLoop()
      nextTick(setupScrollStack)
    }

    function handleVisibilityChange(): void {
      syncMotionSystems()
    }

    function setupRevealObserver(): void {
      if (!pageRef.value) return
      const targets = pageRef.value.querySelectorAll<HTMLElement>('[data-reveal]')
      if (motionPreference?.matches || !('IntersectionObserver' in window)) {
        targets.forEach((target) => target.classList.add('is-visible'))
        return
      }
      targets.forEach((target) => {
        const bounds = target.getBoundingClientRect()
        if (bounds.top < window.innerHeight * 0.94) target.classList.add('is-visible')
      })
      pageRef.value.classList.add('is-reveal-ready')
      revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          })
        },
        { threshold: 0.18, rootMargin: '0px 0px -8%' }
      )
      targets.forEach((target) => revealObserver?.observe(target))
    }

    function setupSectionObserver(): void {
      if (!('IntersectionObserver' in window)) return
      const topMargin = getNavOffset()
      sectionObserver = new IntersectionObserver(
        () => {
          if (navScrollTargetIndex !== null) {
            activeNavIndex.value = navScrollTargetIndex
            return
          }
          resolveActiveSection()
        },
        { threshold: [0, 0.01, 0.15, 0.4, 0.7], rootMargin: '-' + topMargin + 'px 0px -8% 0px' }
      )
      navItems.forEach((item) => {
        const section = document.getElementById(item.section)
        if (section) sectionObserver?.observe(section)
      })
      resolveActiveSection(0)
    }

    onMounted(() => {
      document.title = 'Despacho Sánchez | Control contable y fiscal'
      motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
      motionPreference.addEventListener('change', syncMotionSystems)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      nextTick(() => {
        setupRevealObserver()
        setupSectionObserver()
        syncMotionSystems()
      })
    })

    onUnmounted(() => {
      window.clearInterval(rotationTimer)
      window.clearInterval(featureTimer)
      window.clearInterval(securityTimer)
      window.clearTimeout(navScrollTimer)
      window.removeEventListener('scrollend', handleNavScrollEnd)
      revealObserver?.disconnect()
      sectionObserver?.disconnect()
      stackContext?.revert()
      motionPreference?.removeEventListener('change', syncMotionSystems)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })

    return {
      pageRef,
      mainImageSrc,
      menuOpen,
      accessLabel,
      currentYear,
      rotatingPhrases,
      rotatingIndex,
      navItems,
      activeNavIndex,
      navHoverIndex,
      navIndicatorIndex,
      navigateToSection,
      features,
      capabilityGroups,
      activeFeature,
      activeFeatureIndex,
      featureDeck,
      workflow,
      securityFeatures,
      securityStep,
      securityTrackRef,
      securityGalleryRef,
      securityDragging,
      securityAutoplayPaused,
      securityActiveIndex,
      activeSecurity,
      securityGalleryStyle,
      securityCardStyle,
      controlSecurity,
      toggleSecurityAutoplay,
      pauseSecurityAutoplay,
      handleSecurityPointerEnter,
      handleSecurityPointerLeave,
      beginSecurityDrag,
      moveSecurityDrag,
      finishSecurityDrag,
      handleSecurityFocusOut,
      syncSecurityAutoplay,
      goLogin,
      closeMenu
    }
  }
}
