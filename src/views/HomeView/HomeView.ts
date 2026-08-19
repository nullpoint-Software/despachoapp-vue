import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import FaultyTerminal from "./FaultyTerminal/FaultyTerminal.vue";

type Feature = {
  number: string;
  title: string;
  summary: string;
  details: string[];
  icon: string;
};

type WorkflowStep = {
  title: string;
  text: string;
  result: string;
  icon: string;
};

export default {
  components: { FaultyTerminal },
  setup() {
    const router = useRouter();
    const pageRef = ref<HTMLElement | null>(null);
    const menuOpen = ref(false);
    const rotatingIndex = ref(0);
    const activeFeatureIndex = ref(0);
    const activeNavIndex = ref(0);
    const navHoverIndex = ref<number | null>(null);
    const isLogged = computed(() => Boolean(localStorage.getItem("token")));
    const accessLabel = computed(() => isLogged.value ? "Ir a la aplicación" : "Iniciar sesión");
    const currentYear = new Date().getFullYear();
    let rotationTimer: number | undefined;
    let revealObserver: IntersectionObserver | undefined;
    let sectionObserver: IntersectionObserver | undefined;
    let motionPreference: MediaQueryList | undefined;

    const rotatingPhrases = [
      "Una vista.",
      "Todo conectado.",
      "Bajo control.",
      "Sin duplicados.",
    ];

    const navItems = [
      { label: "Funciones", href: "#funciones", section: "funciones" },
      { label: "Cómo funciona", href: "#flujo", section: "flujo" },
      { label: "Seguridad", href: "#seguridad", section: "seguridad" },
      { label: "Contacto", href: "#contacto", section: "contacto" },
    ];

    const features: Feature[] = [
      { number: "01", title: "Resumen operativo", summary: "Consulta ingresos, clientes activos, tareas pendientes y actividad fiscal para decidir qué atender primero.", details: ["Indicadores por día, mes y año", "Pendientes agrupados por responsable", "Accesos directos a clientes, pagos y tareas", "Lectura de la operación reciente"], icon: "pi pi-chart-bar" },
      { number: "02", title: "Tareas y seguimiento", summary: "Organiza el trabajo del equipo en un tablero Kanban con responsables, fechas, prioridades y avance visible.", details: ["Estados y prioridades configurables", "Asignación a usuarios del despacho", "Fechas límite y seguimiento del avance", "Detalle y reportes por tarea"], icon: "pi pi-th-large" },
      { number: "03", title: "Expedientes de clientes", summary: "Concentra identidad, contacto, situación fiscal, documentos y credenciales protegidas dentro de cada expediente.", details: ["Búsqueda y filtros por cliente", "Documentos vinculados al expediente", "Datos fiscales disponibles al operar", "Revelado seguro de información sensible"], icon: "pi pi-id-card" },
      { number: "04", title: "Pagos y cobranza", summary: "Registra cada cobro por cliente y concepto, consulta periodos y conserva un historial claro de movimientos.", details: ["Conceptos y movimientos de cobro", "Filtros por fecha, cliente o periodo", "Cortes e historial de pagos", "Comprobantes desde el mismo registro"], icon: "pi pi-wallet" },
      { number: "05", title: "Operación fiscal", summary: "Relaciona facturas, conceptos e impuestos con el cliente para preparar consultas y reportes fiscales mensuales.", details: ["Importación y consulta de CFDI", "Conceptos e impuestos desglosados", "Reportes fiscales por periodo", "Proveedores y datos para DIOT"], icon: "pi pi-percentage" },
      { number: "06", title: "Catálogos SAT", summary: "Busca claves, descripciones y vigencias del SAT al capturar información para reducir errores y consultas externas.", details: ["Búsqueda por clave o descripción", "Vigencias disponibles en la consulta", "Selección directa desde formularios", "Referencias fiscales centralizadas"], icon: "pi pi-search" },
      { number: "07", title: "Cumplimiento", summary: "Revisa opiniones de cumplimiento y detecta qué contribuyentes requieren atención con filtros y estados claros.", details: ["Resumen agrupado por estado", "Filtros por régimen fiscal", "Detalle por contribuyente", "Pendientes visibles para seguimiento"], icon: "pi pi-verified" },
      { number: "08", title: "Notas de trabajo", summary: "Conserva acuerdos, recordatorios y contexto operativo en notas organizadas por directorios.", details: ["Edición visual que conserva Markdown", "Fragmentos importantes resaltados", "Notas ancladas sobre cualquier modal", "Contexto disponible durante el trabajo"], icon: "pi pi-file-edit" },
      { number: "09", title: "Documentos y salidas", summary: "Genera comprobantes, tickets, vistas previas y archivos de trabajo utilizando la información ya capturada.", details: ["Impresión térmica de comprobantes", "Reportes con vista previa", "Exportaciones a Excel", "Salidas vinculadas a los registros"], icon: "pi pi-print" },
      { number: "10", title: "Acceso y configuración", summary: "Administra cuentas, permisos y preferencias para adaptar el sistema a cada integrante del despacho.", details: ["Roles y permisos por usuario", "Passkeys y recuperación de acceso", "Bitácora de cambios y actividad", "Paletas, fuente y escala de interfaz"], icon: "pi pi-cog" },
      { number: "11", title: "Copias de seguridad", summary: "Protege la base de datos, los CFDI y los documentos de clientes con respaldos manuales o programados.", details: ["Programación diaria, semanal o mensual", "Descarga e importación de archivos .tar.gz", "Retención por antigüedad y cantidad", "Respaldo preventivo antes de restaurar"], icon: "pi pi-database" },
    ];

    const workflow: WorkflowStep[] = [
      { title: "Registra", text: "Crea el expediente del cliente y concentra identidad, contacto, datos fiscales y documentos.", result: "El expediente se vuelve la fuente común para las siguientes operaciones.", icon: "pi pi-id-card" },
      { title: "Organiza", text: "Asigna tareas, fechas, prioridades y responsables para que cada pendiente tenga seguimiento.", result: "El equipo comparte responsables, fechas y contexto sin duplicar capturas.", icon: "pi pi-sitemap" },
      { title: "Opera", text: "Captura pagos, consulta CFDI, prepara reportes y revisa el cumplimiento de cada cliente.", result: "Cada movimiento permanece relacionado con su cliente y periodo.", icon: "pi pi-cog" },
      { title: "Entrega", text: "Genera comprobantes, imprime tickets o exporta la información que necesita el despacho.", result: "Las salidas reutilizan información validada en lugar de volver a escribirla.", icon: "pi pi-send" },
      { title: "Respalda", text: "Programa copias de la base de datos, CFDI y documentos para conservar una ruta de recuperación.", result: "La operación mantiene una copia verificable antes de una restauración.", icon: "pi pi-database" },
    ];

    const navIndicatorIndex = computed(() => navHoverIndex.value ?? activeNavIndex.value);
    const activeFeature = computed(() => features[activeFeatureIndex.value] || features[0]);
    const featureDeck = computed(() => [
      { feature: features[(activeFeatureIndex.value + 2) % features.length], position: "back" },
      { feature: features[(activeFeatureIndex.value + 1) % features.length], position: "middle" },
      { feature: activeFeature.value, position: "active" },
    ]);

    function goLogin(): void {
      router.push(isLogged.value ? "/app/inicio" : "/login");
    }

    function closeMenu(): void {
      menuOpen.value = false;
    }

    function selectFeature(index: number): void {
      activeFeatureIndex.value = (index + features.length) % features.length;
    }

    function stepFeature(direction: number): void {
      selectFeature(activeFeatureIndex.value + direction);
    }

    function handleFeatureKeys(event: KeyboardEvent): void {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepFeature(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepFeature(-1);
      }
    }

    function syncRotation(): void {
      window.clearInterval(rotationTimer);
      if (motionPreference?.matches) return;
      rotationTimer = window.setInterval(() => {
        rotatingIndex.value = (rotatingIndex.value + 1) % rotatingPhrases.length;
      }, 2800);
    }

    function setupRevealObserver(): void {
      if (!pageRef.value) return;
      const targets = pageRef.value.querySelectorAll<HTMLElement>("[data-reveal]");
      if (motionPreference?.matches || !("IntersectionObserver" in window)) {
        targets.forEach(target => target.classList.add("is-visible"));
        return;
      }
      revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.18, rootMargin: "0px 0px -8%" });
      targets.forEach(target => revealObserver?.observe(target));
    }

    function setupSectionObserver(): void {
      if (!("IntersectionObserver" in window)) return;
      sectionObserver = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = navItems.findIndex(item => item.section === visible.target.id);
        if (index >= 0) activeNavIndex.value = index;
      }, { threshold: [0.12, 0.35, 0.6], rootMargin: "-18% 0px -56%" });
      navItems.forEach(item => {
        const section = document.getElementById(item.section);
        if (section) sectionObserver?.observe(section);
      });
    }

    onMounted(() => {
      document.title = "Despacho Sánchez | Control contable y fiscal";
      motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
      motionPreference.addEventListener("change", syncRotation);
      syncRotation();
      nextTick(() => {
        setupRevealObserver();
        setupSectionObserver();
      });
    });

    onUnmounted(() => {
      window.clearInterval(rotationTimer);
      revealObserver?.disconnect();
      sectionObserver?.disconnect();
      motionPreference?.removeEventListener("change", syncRotation);
    });

    return {
      pageRef,
      mainImageSrc,
      menuOpen,
      accessLabel,
      currentYear,
      rotatingPhrases,
      rotatingIndex,
      navItems,
      navHoverIndex,
      navIndicatorIndex,
      features,
      activeFeatureIndex,
      featureDeck,
      workflow,
      goLogin,
      closeMenu,
      selectFeature,
      stepFeature,
      handleFeatureKeys,
    };
  },
};
