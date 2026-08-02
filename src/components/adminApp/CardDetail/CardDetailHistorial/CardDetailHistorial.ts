import { ref, watch, defineProps, defineEmits, onMounted } from "vue";
const props = defineProps({
  registro: {
    type: Object,
    default: () => ({
      id: "",
      cliente: "",
      atendio: "",
      fecha: "",
      cantidad: "",
      tipo: "",
    }),
  },
  usuario: {
    type: Object,
    default: () => ({
      id: "",
      nombre: "",
      foto: "",
    }),
  },
});
const emit = defineEmits(["close", "save"]);

const registro = ref({ ...props.registro });
const errors = ref({
  cliente: "",
  atendio: "",
  fecha: "",
  cantidad: "",
  tipo: "",
});

// Calendar usa un ref Date
const fechaSeleccionada = ref<Date | null>(null);

// Al montar, si no hay fecha, la ponemos hoy
onMounted(() => {
  if (!registro.value.fecha) {
    const hoy = new Date();
    registro.value.fecha = formatoFecha(hoy);
  }
  if (!registro.value.atendio.trim() && props.usuario.nombre) {
    registro.value.atendio = props.usuario.nombre;
  }
  fechaSeleccionada.value = aDate(registro.value.fecha);
});

watch(() => props.registro, (newVal) => {
  registro.value = { ...newVal };
  errors.value = {
    cliente: "",
    atendio: "",
    fecha: "",
    cantidad: "",
    tipo: "",
  };
  fechaSeleccionada.value = aDate(newVal.fecha);
});

/* Funciones de fecha */
function formatoFecha(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}
function aDate(cadena: string): Date | null {
  if (!cadena) return null;
  const [dia, mes, anio] = cadena.split("/");
  if (!dia || !mes || !anio) return null;
  return new Date(Number(anio), Number(mes) - 1, Number(dia));
}

/* VALIDACIÓN */
const validate = () => {
  let valid = true;
  errors.value = {
    cliente: "",
    atendio: "",
    fecha: "",
    cantidad: "",
    tipo: "",
  };
  if (!registro.value.cliente.trim()) {
    errors.value.cliente = "El cliente es obligatorio.";
    valid = false;
  }
  if (!registro.value.atendio.trim()) {
    errors.value.atendio = "El campo 'quien atendio' es obligatorio.";
    valid = false;
  }
  if (!registro.value.fecha.trim()) {
    errors.value.fecha = "La fecha es obligatoria.";
    valid = false;
  }
  if (!registro.value.cantidad) {
    errors.value.cantidad = "La cantidad es obligatoria.";
    valid = false;
  }
  if (!registro.value.tipo.trim()) {
    errors.value.tipo = "El tipo es obligatorio.";
    valid = false;
  }
  return valid;
};

const close = () => {
  emit("close");
};

const addDollarPrefix = (value: string): string => {
  if (!value) return value;
  if (typeof value === "string" && !value.startsWith('$')) {
    return '$' + value;
  }
  return value;
};

const save = () => {
  if (fechaSeleccionada.value) {
    registro.value.fecha = formatoFecha(fechaSeleccionada.value);
  }
  if (validate()) {
    registro.value.cantidad = addDollarPrefix(registro.value.cantidad);
    emit("save", { ...registro.value });
  }
};
