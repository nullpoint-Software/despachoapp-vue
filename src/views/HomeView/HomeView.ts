import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import logoMarkSrc from '@/assets/img/logsymbolblack.png'
import mainImageSrc from '@/assets/img/home-assets/brand-scales.png'
import heroBuildingSrc from '@/assets/img/home-assets/building.png'
import clipboardComplianceSrc from '@/assets/img/home-assets/clipboard-compliance.png'
import calculatorAssetSrc from '@/assets/img/home-assets/calculator.png'
import accountingBriefcaseSrc from '@/assets/img/home-assets/accounting-briefcase.png'
import collageGrowthSrc from '@/assets/img/home-assets/collage-growth.png'
import collageDirectionSrc from '@/assets/img/home-assets/collage-direction.png'
import collageBrandSrc from '@/assets/img/home-assets/collage-brand.png'
import reportGrowthSrc from '@/assets/img/home-assets/report-growth.png'

type NavItem = {
  label: string
  href: string
  section: string
}

type CapabilityGroup = {
  title: string
  description: string
  features: string[]
}

type WorkflowStep = {
  title: string
  text: string
}

type SecurityFeature = {
  title: string
  text: string
}

type DemoStatus = 'pending' | 'progress' | 'done'

type DemoTask = {
  id: string
  title: string
  area: string
  owner: string
  status: DemoStatus
}

const demoLanes: ReadonlyArray<{ id: DemoStatus; label: string }> = [
  { id: 'pending', label: 'Por hacer' },
  { id: 'progress', label: 'En proceso' },
  { id: 'done', label: 'Completadas' }
]

function createDemoTasks(): DemoTask[] {
  return [
    {
      id: 'cumplimiento',
      title: 'Revisar opinión de cumplimiento',
      area: 'Expediente fiscal',
      owner: 'Equipo fiscal',
      status: 'pending'
    },
    {
      id: 'conciliacion',
      title: 'Conciliar pago recibido',
      area: 'Cobranza',
      owner: 'Administración',
      status: 'pending'
    },
    {
      id: 'reporte',
      title: 'Preparar reporte mensual',
      area: 'Control contable',
      owner: 'Contabilidad',
      status: 'progress'
    },
    {
      id: 'cfdi',
      title: 'Validar CFDI del periodo',
      area: 'Documentación',
      owner: 'Revisión',
      status: 'done'
    }
  ]
}

export default {
  setup() {
    const router = useRouter()
    const pageRef = ref<HTMLElement | null>(null)
    const menuOpen = ref(false)
    const activeNavIndex = ref(0)
    const isLogged = computed(() => Boolean(localStorage.getItem('token')))
    const accessLabel = computed(() => (isLogged.value ? 'Ir a la aplicación' : 'Iniciar sesión'))
    const currentYear = new Date().getFullYear()
    const demoTasks = ref<DemoTask[]>(createDemoTasks())
    const demoDraggedTaskId = ref<string | null>(null)
    const demoFeedback = ref('Selecciona una tarea para avanzar su estado.')
    let revealObserver: IntersectionObserver | undefined
    let sectionObserver: IntersectionObserver | undefined
    let motionPreference: MediaQueryList | undefined

    const navItems: NavItem[] = [
      { label: 'Funciones', href: '#funciones', section: 'funciones' },
      { label: 'Cómo funciona', href: '#flujo', section: 'flujo' },
      { label: 'Seguridad', href: '#seguridad', section: 'seguridad' },
      { label: 'Contacto', href: '#contacto', section: 'contacto' }
    ]

    const outcomes = [
      {
        title: 'Ubica la prioridad',
        text: 'Cobros, tareas y actividad fiscal muestran qué requiere atención.'
      },
      {
        title: 'Conserva el contexto',
        text: 'Cada movimiento mantiene cliente, periodo, responsable y documentos.'
      },
      {
        title: 'Entrega sin recapturar',
        text: 'Comprobantes y reportes reutilizan información ya registrada.'
      }
    ]

    const capabilityGroups: CapabilityGroup[] = [
      {
        title: 'Trabajo diario',
        description: 'Prioriza pendientes y mantiene al equipo sobre la misma operación.',
        features: ['Resumen operativo', 'Tareas y seguimiento', 'Notas de trabajo']
      },
      {
        title: 'Clientes y cobranza',
        description: 'Relaciona el expediente con cada cobro y documento de salida.',
        features: ['Expedientes de clientes', 'Pagos y cobranza', 'Documentos y salidas']
      },
      {
        title: 'Fiscal y cumplimiento',
        description: 'Conecta CFDI, referencias fiscales y revisiones por contribuyente.',
        features: ['Operación fiscal', 'Catálogos SAT', 'Cumplimiento']
      },
      {
        title: 'Control y continuidad',
        description: 'Define accesos y conserva una ruta verificable de recuperación.',
        features: ['Acceso y configuración', 'Copias de seguridad']
      }
    ]

    const workflow: WorkflowStep[] = [
      {
        title: 'Registra',
        text: 'Crea el expediente y concentra identidad, datos fiscales y documentos.'
      },
      {
        title: 'Organiza',
        text: 'Asigna responsables, fechas y prioridades a cada pendiente.'
      },
      {
        title: 'Trabaja',
        text: 'Captura pagos, consulta CFDI y revisa el cumplimiento.'
      },
      {
        title: 'Entrega',
        text: 'Genera comprobantes, tickets y archivos con datos validados.'
      },
      {
        title: 'Respalda',
        text: 'Protege base de datos, CFDI y documentos para recuperar la operación.'
      }
    ]

    const securityFeatures: SecurityFeature[] = [
      {
        title: 'Acceso protegido',
        text: 'Contraseña, recuperación y passkeys validan la identidad antes de abrir la operación.'
      },
      {
        title: 'Permisos por usuario',
        text: 'Cada cuenta consulta o modifica únicamente lo necesario para su responsabilidad.'
      },
      {
        title: 'Bitácora de actividad',
        text: 'Los cambios conservan quién realizó la acción y cuándo ocurrió.'
      },
      {
        title: 'Información sensible',
        text: 'Los datos protegidos permanecen ocultos hasta que una acción autorizada los solicita.'
      }
    ]

    function demoTasksFor(status: DemoStatus): DemoTask[] {
      return demoTasks.value.filter((task) => task.status === status)
    }

    function moveDemoTask(taskId: string, status: DemoStatus): void {
      const task = demoTasks.value.find((item) => item.id === taskId)
      if (!task || task.status === status) return

      task.status = status
      const lane = demoLanes.find((item) => item.id === status)
      demoFeedback.value = `${task.title} pasó a ${lane?.label.toLowerCase()}.`
    }

    function advanceDemoTask(taskId: string): void {
      const task = demoTasks.value.find((item) => item.id === taskId)
      if (!task) return

      const currentIndex = demoLanes.findIndex((lane) => lane.id === task.status)
      const nextLane = demoLanes[(currentIndex + 1) % demoLanes.length]
      moveDemoTask(taskId, nextLane.id)
    }

    function startDemoDrag(taskId: string): void {
      demoDraggedTaskId.value = taskId
      demoFeedback.value = 'Suelta la tarea en otra columna.'
    }

    function dropDemoTask(status: DemoStatus): void {
      if (!demoDraggedTaskId.value) return
      moveDemoTask(demoDraggedTaskId.value, status)
      demoDraggedTaskId.value = null
    }

    function resetDemo(): void {
      demoTasks.value = createDemoTasks()
      demoDraggedTaskId.value = null
      demoFeedback.value = 'La demostración volvió a su estado inicial.'
    }

    function goLogin(): void {
      router.push(isLogged.value ? '/app' : '/login')
    }

    function closeMenu(): void {
      menuOpen.value = false
    }

    function navigateToSection(item: NavItem, index: number, event?: Event): void {
      event?.preventDefault()
      const section = document.getElementById(item.section)
      if (!section) return

      activeNavIndex.value = index
      closeMenu()
      window.history.replaceState(null, '', item.href)
      section.scrollIntoView({
        behavior: motionPreference?.matches ? 'auto' : 'smooth',
        block: 'start'
      })
    }

    function setupRevealObserver(): void {
      if (!pageRef.value) return
      const targets = pageRef.value.querySelectorAll<HTMLElement>('[data-reveal]')
      if (motionPreference?.matches || !('IntersectionObserver' in window)) {
        targets.forEach((target) => target.classList.add('is-visible'))
        return
      }

      pageRef.value.classList.add('is-reveal-ready')
      revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          })
        },
        { threshold: 0.12, rootMargin: '0px 0px -7%' }
      )
      targets.forEach((target) => revealObserver?.observe(target))
    }

    function setupSectionObserver(): void {
      if (!('IntersectionObserver' in window)) return
      sectionObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
          if (!visible?.target.id) return
          const index = navItems.findIndex((item) => item.section === visible.target.id)
          if (index >= 0) activeNavIndex.value = index
        },
        { threshold: [0.08, 0.2, 0.45], rootMargin: '-76px 0px -42% 0px' }
      )
      navItems.forEach((item) => {
        const section = document.getElementById(item.section)
        if (section) sectionObserver?.observe(section)
      })
    }

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeMenu()
    }

    onMounted(() => {
      document.title = 'Despacho Sánchez | Control contable y fiscal'
      motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
      document.addEventListener('keydown', handleKeydown)
      nextTick(() => {
        setupRevealObserver()
        setupSectionObserver()
      })
    })

    onUnmounted(() => {
      revealObserver?.disconnect()
      sectionObserver?.disconnect()
      document.removeEventListener('keydown', handleKeydown)
    })

    return {
      pageRef,
      logoMarkSrc,
      mainImageSrc,
      heroBuildingSrc,
      clipboardComplianceSrc,
      calculatorAssetSrc,
      accountingBriefcaseSrc,
      collageGrowthSrc,
      collageDirectionSrc,
      collageBrandSrc,
      reportGrowthSrc,
      demoLanes,
      demoFeedback,
      menuOpen,
      activeNavIndex,
      accessLabel,
      currentYear,
      navItems,
      outcomes,
      capabilityGroups,
      workflow,
      securityFeatures,
      demoTasksFor,
      advanceDemoTask,
      startDemoDrag,
      dropDemoTask,
      resetDemo,
      navigateToSection,
      goLogin,
      closeMenu
    }
  }
}
