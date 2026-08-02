import { nextTick, ref, watch, defineProps, defineEmits } from "vue";
import { regimenesFiscales } from "@/constants/regimenesFiscales";

const props = defineProps({
  customer: {
    type: Object,
    default: () => ({ id_cliente: "", nombre: "", rfc: "", regimen_fiscal: "", fiel: "", ciecf: "", telefono: "", email: "" }),
  },
});
const emit = defineEmits(["close", "save"]);
const steps = [{ id: 1, label: "Identidad" }, { id: 2, label: "Contacto" }, { id: 3, label: "Acceso SAT" }];
const currentStep = ref(1);
const customer = ref({ ...props.customer });
const emptyErrors = () => ({ nombre: "", rfc: "", regimen_fiscal: "", fiel: "", ciecf: "", telefono: "", email: "" });
const errors = ref(emptyErrors());

watch(() => props.customer, (newVal) => {
  customer.value = { ...newVal };
  errors.value = emptyErrors();
  currentStep.value = 1;
});

const focusFirstInvalid = () => nextTick(() => (document.querySelector('.modal-content [aria-invalid="true"]') as HTMLElement | null)?.focus());

const validateStep = (step: number) => {
  let valid = true;
  if (step === 1) {
    errors.value.nombre = customer.value.nombre?.trim() ? "" : "El nombre es obligatorio.";
    const rfc = String(customer.value.rfc || "").trim().toUpperCase();
    errors.value.rfc = !rfc ? "El RFC es obligatorio." : (/^[A-Z0-9&Ñ]{12,13}$/.test(rfc) ? "" : "El RFC debe tener 12 o 13 caracteres válidos.");
    errors.value.regimen_fiscal = customer.value.regimen_fiscal ? "" : "Selecciona el régimen fiscal.";
    valid = !errors.value.nombre && !errors.value.rfc && !errors.value.regimen_fiscal;
  }
  if (step === 2) {
    const telefonoPattern = /^[0-9\s\-\(\)]+$/;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    errors.value.telefono = customer.value.telefono?.trim() && telefonoPattern.test(customer.value.telefono) ? "" : "Escribe un teléfono válido.";
    errors.value.email = customer.value.email?.trim() && emailPattern.test(customer.value.email) ? "" : "Escribe un correo electrónico válido.";
    valid = !errors.value.telefono && !errors.value.email;
  }
  if (step === 3) {
    errors.value.fiel = !customer.value.id_cliente && !customer.value.fiel?.trim() ? "La contraseña FIEL es obligatoria." : "";
    errors.value.ciecf = !customer.value.id_cliente && !customer.value.ciecf?.trim() ? "La contraseña CIECF es obligatoria." : "";
    valid = !errors.value.fiel && !errors.value.ciecf;
  }
  if (!valid) focusFirstInvalid();
  return valid;
};

const normalizeRfcInput = () => { customer.value.rfc = String(customer.value.rfc || "").trim().toUpperCase().slice(0, 13); };
const close = () => emit("close");
const nextStep = () => { normalizeRfcInput(); if (validateStep(currentStep.value)) currentStep.value += 1; };
const previousStep = () => { currentStep.value = Math.max(1, currentStep.value - 1); };
const goToStep = (step: number) => {
  if (step < currentStep.value) currentStep.value = step;
  else if (step === currentStep.value + 1) nextStep();
};
const save = () => {
  normalizeRfcInput();
  if (!validateStep(3)) return;
  const firstInvalidStep = [1, 2].find((step) => !validateStep(step));
  if (firstInvalidStep) { currentStep.value = firstInvalidStep; focusFirstInvalid(); return; }
  emit("save", { ...customer.value });
};