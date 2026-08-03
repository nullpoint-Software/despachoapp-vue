import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import mainImageSrc from "@/assets/img/logsymbolwhite.png";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiOrb from "./AsciiOrb/AsciiOrb.vue";

gsap.registerPlugin(ScrollTrigger);

type Feature = {
  number: string;
  title: string;
  summary: string;
  details: string[];
  icon: string;
  size?: "wide" | "tall";
};

export default {
  components: { AsciiOrb },
  setup() {
    const router = useRouter();
    const menuOpen = ref(false);
    const isLogged = computed(() => Boolean(localStorage.getItem("token")));
    const currentYear = new Date().getFullYear();
    const pageRef = ref<HTMLElement | null>(null);
    const accessLabel = computed(() => isLogged.value ? "Ir a la aplicación" : "Iniciar sesión");
    let motionMedia: ReturnType<typeof gsap.matchMedia> | undefined;

    const features: Feature[] = [
      { number: "01", title: "Resumen operativo", summary: "Ingresos, clientes activos, tareas pendientes y actividad fiscal en una sola portada.", details: ["Indicadores diarios, mensuales y anuales", "Trabajo pendiente por responsable", "Accesos directos a cada área"], icon: "pi pi-chart-bar", size: "wide" },
      { number: "02", title: "Tareas y seguimiento", summary: "Un tablero Kanban para repartir trabajo, revisar avances y mantener responsables visibles.", details: ["Estados y prioridades", "Asignación a usuarios", "Detalle, fechas y reportes"], icon: "pi pi-th-large", size: "tall" },
      { number: "03", title: "Expedientes de clientes", summary: "Datos fiscales, contacto, documentos y credenciales protegidas dentro del mismo expediente.", details: ["Búsqueda y filtros", "Documentos por cliente", "Revelado seguro de datos sensibles"], icon: "pi pi-id-card" },
      { number: "04", title: "Pagos y cobranza", summary: "Registro por concepto, historial y consultas por periodo para saber qué se cobró y cuándo.", details: ["Conceptos y movimientos", "Filtros por fecha o cliente", "Cortes e historial de pagos"], icon: "pi pi-wallet", size: "wide" },
      { number: "05", title: "Operación fiscal", summary: "Control de facturas, conceptos, impuestos y reportes fiscales sin separar la información del cliente.", details: ["Importación y consulta de CFDI", "Reportes mensuales", "Proveedores y datos para DIOT"], icon: "pi pi-percentage", size: "tall" },
      { number: "06", title: "Catálogos SAT", summary: "Consulta centralizada de claves y referencias del SAT para reducir capturas incorrectas.", details: ["Búsqueda por clave o descripción", "Vigencias visibles", "Selección desde formularios"], icon: "pi pi-search" },
      { number: "07", title: "Cumplimiento", summary: "Seguimiento de opiniones y estado de clientes con una lectura clara de pendientes.", details: ["Resumen por estado", "Filtros por régimen fiscal", "Detalle por contribuyente"], icon: "pi pi-verified" },
      { number: "08", title: "Notas de trabajo", summary: "Notas rápidas, tableros y elementos anclados para conservar contexto mientras trabajas.", details: ["Formato Markdown", "Notas ancladas", "Organización por tableros"], icon: "pi pi-file-edit", size: "wide" },
      { number: "09", title: "Documentos y salidas", summary: "Genera comprobantes, tickets y archivos de trabajo desde los mismos registros.", details: ["Impresión térmica", "Reportes y vistas previas", "Exportaciones a Excel"], icon: "pi pi-print" },
      { number: "10", title: "Acceso y configuración", summary: "La administración mantiene usuarios, permisos y preferencias sin salir de la aplicación.", details: ["Roles y permisos", "Passkeys y recuperación de acceso", "Bitácora, paletas, fuente y escala"], icon: "pi pi-cog", size: "wide" },
    ];

    const workflow = [
      { number: "1", title: "Registra", text: "Crea el expediente del cliente y concentra sus datos fiscales y documentos." },
      { number: "2", title: "Organiza", text: "Asigna tareas, fechas y responsables para que el trabajo tenga seguimiento." },
      { number: "3", title: "Opera", text: "Captura pagos, consulta CFDI, prepara reportes y revisa cumplimiento." },
      { number: "4", title: "Entrega", text: "Imprime comprobantes o exporta la información que necesita el despacho." },
    ];

    function goLogin(): void {
      router.push(isLogged.value ? "/app/inicio" : "/login");
    }

    function closeMenu(): void {
      menuOpen.value = false;
    }

    onMounted(() => {
      document.title = "Despacho Sánchez | Control contable y fiscal";
      if (!pageRef.value) return;

      motionMedia = gsap.matchMedia();
      motionMedia.add(
        {
          allowMotion: "(prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (!context.conditions?.allowMotion) return;

          const heroTimeline = gsap.timeline({ defaults: { duration: 0.75, ease: "power3.out" } });
          heroTimeline
            .from(".home-header", { autoAlpha: 0, y: -24 })
            .from(".home-eyebrow", { autoAlpha: 0, y: 18 }, "<0.18")
            .from(".hero-line", { autoAlpha: 0, yPercent: 110, stagger: 0.11 }, "<0.08")
            .from(".home-lead", { autoAlpha: 0, y: 24 }, "-=0.4")
            .from(".home-hero__actions > *", { autoAlpha: 0, y: 18, stagger: 0.08 }, "-=0.45")
            .from(".home-hero__visual", { autoAlpha: 0, scale: 0.94, rotationY: -7, transformOrigin: "50% 50%" }, "-=0.8");

          gsap.fromTo(
            ".home-progress",
            { scaleX: 0 },
            { scaleX: 1, ease: "none", scrollTrigger: { trigger: pageRef.value, start: "top top", end: "bottom bottom", scrub: 0.25 } },
          );

          gsap.from(".home-intro h2, .home-intro div > p", {
            autoAlpha: 0,
            y: 46,
            stagger: 0.12,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: ".home-intro", start: "top 76%", once: true },
          });

          gsap.set(".home-feature", { autoAlpha: 0, y: 42 });
          ScrollTrigger.batch(".home-feature", {
            start: "top 84%",
            once: true,
            interval: 0.08,
            batchMax: 3,
            onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.09, ease: "power3.out", overwrite: true }),
          });

          gsap.from(".home-workflow li", {
            autoAlpha: 0,
            x: -36,
            stagger: 0.1,
            duration: 0.72,
            ease: "power3.out",
            scrollTrigger: { trigger: ".home-workflow ol", start: "top 78%", once: true },
          });

          gsap.from(".home-security__visual", {
            autoAlpha: 0,
            xPercent: -8,
            rotation: -2,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: ".home-security", start: "top 72%", once: true },
          });
          gsap.from(".home-security__copy > *", {
            autoAlpha: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ".home-security__copy", start: "top 76%", once: true },
          });
          gsap.from(".home-cta > *", {
            autoAlpha: 0,
            scale: 0.94,
            stagger: 0.1,
            duration: 0.72,
            ease: "back.out(1.35)",
            scrollTrigger: { trigger: ".home-cta", start: "top 76%", once: true },
          });
        },
        pageRef.value,
      );

      requestAnimationFrame(() => ScrollTrigger.refresh());
    });

    onUnmounted(() => motionMedia?.revert());

    return { pageRef, mainImageSrc, menuOpen, isLogged, accessLabel, currentYear, features, workflow, goLogin, closeMenu };
  },
};
