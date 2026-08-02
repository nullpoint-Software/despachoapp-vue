import { as, pks, us } from '@/service/adminApp/client'
import { ref, computed, onMounted, watch } from 'vue'
import { USER_AVATAR_PLACEHOLDER as defaultAvatar } from '@/constants/brandAssets'
import imageCompression from "browser-image-compression";
import { useAppToast } from '@/composables/useAppToast';
import { useAppDialog } from '@/composables/useAppDialog';
import { getPermissions, hasPermission, updatePermissions, updateUserPermissions } from '@/service/adminApp/permissionsService';
import router from '@/router';

interface SettingsUser {
  id_usuario: string | number;
  nombre: string;
  username: string;
  email: string;
  puesto: string;
  imagen?: string;
  activo?: boolean;
  password?: string;
  [key: string]: unknown;
}

interface PasskeyRecord {
  id: number;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiErrorShape {
  response?: { data?: { error?: string } };
}

interface PermissionMatrix {
  [role: string]: Record<string, boolean>;
}

interface NewUserForm {
  nombre: string;
  email: string;
  telefono: string;
  username: string;
  puesto: string;
  imagen: string;
  password: string;
  confirmPassword?: string;
}

interface EmailParts { local: string; domain: string }

const apiErrorMessage = (error: unknown): string | undefined =>
  (error as ApiErrorShape).response?.data?.error;
// SEARCH MODAL STATE
const showSearchModal = ref(false)
const showAppearanceModal = ref(false);

// USER DETAILS MODAL
const modalAbierto = ref(false)
const buildTime = ref<string>("");
const usuarioSeleccionado = ref<SettingsUser | null>(null)
const passwordVisible = ref(false)
const passwordRevealBusy = ref(false)
const passwordResetMenuOpen = ref(false)
const passwordResetBusy = ref(false)
const generatedResetLink = ref("")

const confirmDialogVisible = ref(false);
const userToDelete = ref<SettingsUser | null>(null);
const isDropdown = ref(false);
const selectedLevel = ref<string>("");
async function confirmDelete(u: SettingsUser): Promise<void> {
  await deleteUser(u)
  confirmDialogVisible.value = false;
  userToDelete.value = null;
}
async function cancelDelete() {
  confirmDialogVisible.value = false;
  userToDelete.value = null;
}
const toast = useAppToast();
const { prompt: promptDialog, confirm: confirmDialog } = useAppDialog();
// PERFIL
const userInfo = await as.getUserInfo();
const isAdmin = userInfo && userInfo.level === 'Administrador';

const userFullName = ref(localStorage.getItem("fullname"))
const userName = ref(localStorage.getItem("username"));
const storedPhoto = localStorage.getItem("userphoto");
const profileImage = ref(
  storedPhoto && storedPhoto !== "data:image/png;base64,null"
    ? storedPhoto
    : defaultAvatar
);
onMounted(async () => {
    const showToast = await localStorage.getItem("showToast");
    const res = await fetch('/build-time.txt')
    buildTime.value = await res.text()
    if (showToast === "nameSuccess") {
      toast.add({
        severity: "success",
        summary: "Agregado",
        detail: "Nombre actualizado correctamente",
        life: 3000,
      });
      localStorage.removeItem("showToast"); // clear flag
    }
  });

const passkeys = ref<PasskeyRecord[]>([]);
const passkeysLoading = ref(false);
const passkeyBusy = ref(false);
const passkeySupported = ref(false);
const platformPasskeyAvailable = ref(false);
const passkeyStatusLabel = computed(() => {
  if (!passkeySupported.value) return "Este navegador no tiene passkeys disponibles.";
  if (!platformPasskeyAvailable.value) return "Listo para usar NordPass, una llave de seguridad u otro gestor compatible.";
  return "Puedes guardarla en NordPass o usar huella, rostro y Windows Hello.";
});

async function loadPasskeys() {
  passkeysLoading.value = true;
  try {
    passkeys.value = await pks.getPasskeys();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Sin passkeys', detail: apiErrorMessage(error) || 'No se pudieron cargar tus passkeys.', life: 3500 });
  } finally {
    passkeysLoading.value = false;
  }
}

async function setupPasskeys() {
  passkeySupported.value = pks.supportsPasskeys();
  if (passkeySupported.value) {
    platformPasskeyAvailable.value = await pks.platformAuthenticatorAvailable().catch(() => false);
  }
  await loadPasskeys();
}

async function addPasskey() {
  if (!passkeySupported.value || passkeyBusy.value) return;
  const name = await promptDialog({
    title: 'Agregar passkey',
    message: 'Ponle un nombre reconocible a NordPass, este dispositivo o tu llave de seguridad.',
    inputLabel: 'Nombre',
    inputType: 'text',
    placeholder: 'NordPass personal',
    confirmLabel: 'Crear passkey',
  });
  if (name === null) return;
  passkeyBusy.value = true;
  try {
    await pks.register(name || undefined);
    await loadPasskeys();
    toast.add({ severity: 'success', summary: 'Passkey lista', detail: 'Ya puedes verificar datos protegidos con NordPass o el autenticador elegido.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No registrada', detail: apiErrorMessage(error) || 'No fue posible registrar la passkey.', life: 4000 });
  } finally {
    passkeyBusy.value = false;
  }
}

async function removePasskey(passkey: PasskeyRecord): Promise<void> {
  if (passkeyBusy.value) return;
  const confirmed = await confirmDialog({
    title: 'Eliminar passkey',
    message: `Eliminar "${passkey.name}" de tu cuenta.`,
    tone: 'danger',
    confirmLabel: 'Eliminar',
    cancelLabel: 'Cancelar',
  });
  if (!confirmed) return;
  passkeyBusy.value = true;
  try {
    await pks.delete(passkey.id);
    await loadPasskeys();
    toast.add({ severity: 'success', summary: 'Passkey eliminada', detail: 'El acceso se actualizó correctamente.', life: 2500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No eliminada', detail: apiErrorMessage(error) || 'No fue posible eliminar la passkey.', life: 3500 });
  } finally {
    passkeyBusy.value = false;
  }
}

function formatPasskeyDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

onMounted(setupPasskeys);

// USUARIOS
const usuarios = ref<SettingsUser[]>(await us.getUsuarios())
const currentUserId = String(localStorage.getItem("userid") || "")

const searchQuery = ref('')
const filteredUsers = computed(() =>
  usuarios.value.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

// -------------- CONTRASEÑA MAESTRA --------------
// -------------- FIN CONTRASEÑA MAESTRA --------------

function abrirModal(u: SettingsUser): void {
  usuarioSeleccionado.value = u
  passwordVisible.value = false
  passwordRevealBusy.value = false
  generatedResetLink.value = ""
  passwordResetMenuOpen.value = false
  modalAbierto.value = true
  selectedLevel.value = u.puesto;
}
function openFromSearch(u: SettingsUser): void {
  abrirModal(u)
  showSearchModal.value = false
}
async function verPassword() {
  if (passwordRevealBusy.value || !usuarioSeleccionado.value) return;
  if (passwordVisible.value) {
    passwordVisible.value = false;
    delete usuarioSeleccionado.value.password;
    return;
  }
  const entrada = await promptDialog({
    title: 'Ver contraseña de usuario',
    message: 'Confirma tu contraseña de acceso para consultar este dato protegido.',
    inputLabel: 'Tu contraseña',
    inputType: 'password',
    placeholder: 'Escribe tu contraseña',
    confirmLabel: 'Verificar y mostrar',
  })
  if (!entrada) return
  passwordRevealBusy.value = true
  try {
    const userbd = await us.getUsuarioPS(usuarioSeleccionado.value.id_usuario, entrada)
    usuarioSeleccionado.value.password = userbd.password
    passwordVisible.value = true
    window.setTimeout(() => {
      passwordVisible.value = false
      if (usuarioSeleccionado.value) delete usuarioSeleccionado.value.password
    }, 20000)
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Verificación rechazada', detail: apiErrorMessage(error) || 'No fue posible verificar tu identidad.', life: 4000 })
  } finally {
    passwordRevealBusy.value = false
  }
}

function isSelectedUserSelf() {
  return String(usuarioSeleccionado.value?.id_usuario || '') === currentUserId;
}

function syncSelectedUserPatch(patch: Partial<SettingsUser>): void {
  if (!usuarioSeleccionado.value) return;
  const selectedUser = { ...usuarioSeleccionado.value, ...patch };
  usuarioSeleccionado.value = selectedUser;
  const index = usuarios.value.findIndex((user) => user.id_usuario === selectedUser.id_usuario);
  if (index !== -1) usuarios.value[index] = { ...usuarios.value[index], ...patch };
  if (isSelectedUserSelf()) {
    if (patch.nombre !== undefined) {
      userFullName.value = patch.nombre;
      localStorage.setItem("fullname", patch.nombre);
    }
    if (patch.username !== undefined) {
      userName.value = patch.username;
      localStorage.setItem("username", patch.username);
    }
    if (patch.puesto !== undefined) localStorage.setItem("level", patch.puesto);
    if (patch.imagen !== undefined) localStorage.setItem("userphoto", "data:image/png;base64," + patch.imagen);
  }
}

async function editSelectedUserField(field: keyof SettingsUser, label: string): Promise<void> {
  if (!usuarioSeleccionado.value) return;
  const currentValue = usuarioSeleccionado.value[field] || "";
  const value = await promptDialog({
    title: `Editar ${label.toLowerCase()}`,
    message: `Actualiza ${label.toLowerCase()} para esta cuenta.`,
    inputLabel: label,
    inputType: field === 'email' ? 'email' : 'text',
    initialValue: String(currentValue || ''),
    placeholder: field === 'email' ? 'nombre@gmail.com' : String(currentValue || label),
    confirmLabel: 'Guardar',
  });
  if (value === null) return;
  try {
    await us.editUsuario(usuarioSeleccionado.value.id_usuario, { [field]: value });
    syncSelectedUserPatch({ [field]: value });
    toast.add({ severity: 'success', summary: 'Usuario actualizado', detail: `${label} guardado correctamente.`, life: 2500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No guardado', detail: apiErrorMessage(error) || 'No se pudo actualizar el usuario.', life: 3500 });
  }
}

async function changeSelectedUserPassword() {
  if (!usuarioSeleccionado.value) return;
  let currentPassword;
  if (isSelectedUserSelf()) {
    currentPassword = await promptDialog({
      title: 'Confirmar identidad',
      message: 'Escribe tu contraseña actual antes de cambiarla.',
      inputLabel: 'Contraseña actual',
      inputType: 'password',
      placeholder: 'Contraseña actual',
      confirmLabel: 'Continuar',
    });
    if (!currentPassword) return;
  }
  const password = await promptDialog({
    title: 'Cambiar contraseña',
    message: 'La nueva contraseña se guardará cifrada.',
    inputLabel: 'Nueva contraseña',
    inputType: 'password',
    placeholder: 'Mínimo 8 caracteres',
    confirmLabel: 'Continuar',
  });
  if (!password) return;
  const confirmPassword = await promptDialog({
    title: 'Confirmar contraseña',
    message: 'Repite la nueva contraseña.',
    inputLabel: 'Confirmación',
    inputType: 'password',
    placeholder: 'Repite la contraseña',
    confirmLabel: 'Guardar',
  });
  if (confirmPassword === null) return;
  if (password !== confirmPassword) {
    toast.add({ severity: 'warn', summary: 'No coincide', detail: 'Las contraseñas no coinciden.', life: 3000 });
    return;
  }
  try {
    await us.editUsuario(usuarioSeleccionado.value.id_usuario, { password, currentPassword });
    passwordVisible.value = false;
    delete usuarioSeleccionado.value.password;
    toast.add({ severity: 'success', summary: 'Contraseña actualizada', detail: 'La contraseña se guardó correctamente.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No guardada', detail: apiErrorMessage(error) || 'No se pudo cambiar la contraseña.', life: 3500 });
  }
}

async function changeOwnPassword() {
  const currentPassword = await promptDialog({
    title: 'Confirmar contraseña actual',
    message: 'Escribe tu contraseña actual antes de cambiarla.',
    inputLabel: 'Contraseña actual',
    inputType: 'password',
    placeholder: 'Contraseña actual',
    confirmLabel: 'Continuar',
  });
  if (!currentPassword) return;
  const password = await promptDialog({
    title: 'Cambiar contraseña',
    message: 'La nueva contraseña se guardará cifrada.',
    inputLabel: 'Nueva contraseña',
    inputType: 'password',
    placeholder: 'Mínimo 8 caracteres',
    confirmLabel: 'Continuar',
  });
  if (!password) return;
  const confirmPassword = await promptDialog({
    title: 'Confirmar contraseña',
    message: 'Repite la nueva contraseña.',
    inputLabel: 'Confirmación',
    inputType: 'password',
    placeholder: 'Repite la contraseña',
    confirmLabel: 'Guardar',
  });
  if (confirmPassword === null) return;
  if (password !== confirmPassword) {
    toast.add({ severity: 'warn', summary: 'No coincide', detail: 'Las contraseñas no coinciden.', life: 3000 });
    return;
  }
  try {
    await us.editUsuario(currentUserId, { password, currentPassword });
    toast.add({ severity: 'success', summary: 'Contraseña actualizada', detail: 'Tu contraseña se guardó correctamente.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No guardada', detail: apiErrorMessage(error) || 'No se pudo cambiar tu contraseña.', life: 3500 });
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function generatePasswordResetLink() {
  if (!usuarioSeleccionado.value || passwordResetBusy.value) return;
  passwordResetBusy.value = true;
  try {
    const result = await us.createPasswordReset(usuarioSeleccionado.value.id_usuario, false);
    generatedResetLink.value = result.resetUrl || "";
    if (generatedResetLink.value) await copyText(generatedResetLink.value);
    toast.add({
      severity: "success",
      summary: "Enlace generado",
      detail: generatedResetLink.value ? "El enlace se copió al portapapeles." : "Enlace creado correctamente.",
      life: 3500,
    });
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "No generado",
      detail: apiErrorMessage(error) || "No fue posible generar el enlace.",
      life: 4000,
    });
  } finally {
    passwordResetBusy.value = false;
    passwordResetMenuOpen.value = false;
  }
}

async function sendPasswordResetEmail() {
  if (!usuarioSeleccionado.value || passwordResetBusy.value) return;
  passwordResetBusy.value = true;
  try {
    await us.createPasswordReset(usuarioSeleccionado.value.id_usuario, true);
    toast.add({
      severity: "success",
      summary: "Correo enviado",
      detail: `Enlace enviado a ${usuarioSeleccionado.value.email}.`,
      life: 3500,
    });
    generatedResetLink.value = "";
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "No enviado",
      detail: apiErrorMessage(error) || "No fue posible enviar el correo.",
      life: 4000,
    });
  } finally {
    passwordResetBusy.value = false;
    passwordResetMenuOpen.value = false;
  }
}

// DELETE USER
async function deleteUser(u: SettingsUser): Promise<void> {
  try {
    usuarios.value = usuarios.value.filter(x => x.id_usuario !== u.id_usuario)
    if (u.id_usuario == localStorage.getItem("userid")) { //si se intenta eliminar a uno mismo xd
      await us.deleteUsuario(String(u.id_usuario))
      localStorage.clear()
      router.push("/")
    } else {
      await us.deleteUsuario(String(u.id_usuario))
      window.location.reload();
    }

  } catch (error) {
    toast.add({ severity: "error", summary: "Error", detail: apiErrorMessage(error) || "No se pudo eliminar el usuario.", life: 3500 });
  }

}

async function updateName(u: string): Promise<void> {
  try {
    await localStorage.setItem("fullname", u);
    await us.editUsuario(localStorage.getItem("userid"), { nombre: u })
    localStorage.setItem("showToast", "nameSuccess");
    window.location.reload()

  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
  }

}

async function updateUserStatus(u: SettingsUser): Promise<void>{
  try {
    await us.editUsuario(u.id_usuario,{activo: u.activo})
  } catch (error) {
    toast.add({ severity: "error", summary: "Error", detail: apiErrorMessage(error) || "No se pudo actualizar el estado.", life: 3000 });
  }
}

async function updateImage(u: string): Promise<void> {
  try {
    await localStorage.setItem("userphoto", "data:image/png;base64," + u)
    await us.editUsuario(localStorage.getItem("userid"), { imagen: u })
    toast.add({
      severity: "success",
      summary: "Agregado",
      detail: "Imagen de perfil actualizada correctamente",
      life: 3000,
    });
    window.location.reload()
  } catch (_error) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
  }
}

// PERMISOS JSON
const permissions = ref<PermissionMatrix>(await getPermissions());
async function togglePermission(role: string, key: string): Promise<void> {
  permissions.value[role][key] = !permissions.value[role][key]
  await updatePermissions(permissions.value)
}
function traducirPermiso(k: string): string {
  const map = {
    canMoveAllCards: 'Puede mover todas las tareas',
    canMoveOwnCard: 'Puede mover sus tareas',
    canMoveAvailableCard: 'Puede mover tareas disponibles',
    canAddCard: 'Puede crear tareas',
    canEditCard: 'Puede editar tarea',
    canDeleteCard: 'Puede eliminar tarea',

    canAddCliente: 'Puede agregar cliente',
    canEditCliente: 'Puede editar cliente',
    canDeleteCliente: 'Puede eliminar cliente',

    canAddPagoConcepto: 'Puede agregar pago por concepto',
    canEditPagoConcepto: 'Puede editar pago por concepto',
    canDeletePagoConcepto: 'Puede eliminar pago por concepto',

    canAddPagoMensual: 'Puede agregar pago mensual',
    canEditPagoMensual: 'Puede editar pago mensual',
    canDeletePagoMensual: 'Puede eliminar pago mensual',
  };

  return map[k as keyof typeof map] || k;
}


// CREAR USUARIO
const newUser = ref<NewUserForm>({
  nombre: '',
  email: '',
  telefono: '',
  username: '',
  puesto: '',
  imagen: '',
  password: '',
  confirmPassword: ''
})
const newUserPreview = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const showCreateUserModal = ref(false)
const createUserStep = ref(1)
const creatingUser = ref(false)
const emailLocalPart = ref('')
const emailDomain = ref('gmail.com')
const customEmailDomainValue = '__custom__'
const emailDomainChoice = ref('gmail.com')
const emailDomainOptions = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
  'dreamsoft-dev.com',
]
const wizardTitles = ['Identidad y contacto', 'Acceso', 'Confirmación']

const resetNewUser = () => {
  Object.assign(newUser.value, {
    nombre: '',
    email: '',
    telefono: '',
    username: '',
    puesto: '',
    imagen: '',
    password: '',
    confirmPassword: ''
  })
  emailLocalPart.value = ''
  emailDomain.value = 'gmail.com'
  emailDomainChoice.value = 'gmail.com'
  newUserPreview.value = ''
  showNewPassword.value = false
  showConfirmPassword.value = false
  createUserStep.value = 1
}

function openCreateUserModal() {
  resetNewUser()
  showCreateUserModal.value = true
}

function closeCreateUserModal() {
  if (creatingUser.value) return
  showCreateUserModal.value = false
  resetNewUser()
}

function formatPhoneValue(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 10)
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ')
}

function formatNewUserPhone(event: Event): void {
  newUser.value.telefono = formatPhoneValue((event.target as HTMLInputElement).value)
}

function parseEmailParts(value = ''): EmailParts | null {
  const match = String(value)
    .trim()
    .match(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/i)
  if (!match) return null
  return {
    local: match[1].replace(/\s+/g, ''),
    domain: match[2].replace(/^@+/, '').toLowerCase(),
  }
}

function applyEmailParts(value = ''): boolean {
  const parsed = parseEmailParts(value)
  if (!parsed) return false
  emailLocalPart.value = parsed.local
  emailDomain.value = parsed.domain
  emailDomainChoice.value = emailDomainOptions.includes(parsed.domain) ? parsed.domain : customEmailDomainValue
  newUser.value.email = `${parsed.local}@${parsed.domain}`
  return true
}

function handleEmailPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text') || ''
  if (applyEmailParts(text)) event.preventDefault()
}

watch([emailLocalPart, emailDomain], ([localPart, domain]) => {
  const pastedEmail = parseEmailParts(localPart) || parseEmailParts(domain)
  if (pastedEmail) {
    if (pastedEmail.local !== localPart) emailLocalPart.value = pastedEmail.local
    if (pastedEmail.domain !== domain) emailDomain.value = pastedEmail.domain
    const matchingChoice = emailDomainOptions.includes(pastedEmail.domain) ? pastedEmail.domain : customEmailDomainValue
    if (emailDomainChoice.value !== matchingChoice) emailDomainChoice.value = matchingChoice
    newUser.value.email = `${pastedEmail.local}@${pastedEmail.domain}`
    return
  }

  const cleanLocal = String(localPart || '').replace(/\s|@/g, '')
  const cleanDomain = String(domain || '').replace(/^@+|\s/g, '').toLowerCase() || 'gmail.com'
  if (cleanLocal !== localPart) emailLocalPart.value = cleanLocal
  if (cleanDomain !== domain) emailDomain.value = cleanDomain
  const matchingChoice = emailDomainOptions.includes(cleanDomain) ? cleanDomain : customEmailDomainValue
  if (emailDomainChoice.value !== matchingChoice) emailDomainChoice.value = matchingChoice
  newUser.value.email = cleanLocal ? `${cleanLocal}@${cleanDomain}` : ''
})

watch(emailDomainChoice, (choice) => {
  if (!choice || choice === customEmailDomainValue || choice === emailDomain.value) return
  emailDomain.value = choice
})

async function compressToBase64(file: File): Promise<string> {
  const options = {
    maxWidthOrHeight: 200,
    useWebWorker: true,
  };

  const compressedFile = await imageCompression(file, options);
  const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
  return base64.split(",")[1]; // Return base64 only
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: `La imagen no debe superar los ${maxSizeMB} MB.`, life: 3500 });
      input.value = "";
      return;
    }

    profileImage.value = URL.createObjectURL(f);
    const base64Only = await compressToBase64(f);
    await updateImage(base64Only);
  }
}

async function onNewFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: `La imagen no debe superar los ${maxSizeMB} MB.`, life: 3500 });
      input.value = "";
      return;
    }

    const fullDataUrl = await imageCompression.getDataUrlFromFile(f);
    newUserPreview.value = fullDataUrl;

    const base64Only = await compressToBase64(f);
    newUser.value.imagen = base64Only;
  }
}


const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.value.email))
const isPhoneValid = computed(() => newUser.value.telefono.replace(/\D/g, '').length === 10)
const isPasswordMatch = computed(
  () =>
    newUser.value.password && newUser.value.password === newUser.value.confirmPassword
)
const passwordStrength = computed(() => {
  const password = newUser.value.password
  if (!password) return { bars: 0, level: 'empty', label: 'Sin evaluar', hint: 'Usa 8 caracteres o más.' }

  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 12 && score < 4) score++
  const bars = Math.min(score, 4)
  const levels = [
    { level: 'weak', label: 'Muy débil', hint: 'Añade longitud, mayúsculas y números.' },
    { level: 'weak', label: 'Débil', hint: 'Combina mayúsculas, números y símbolos.' },
    { level: 'medium', label: 'Aceptable', hint: 'Un símbolo la hará más segura.' },
    { level: 'good', label: 'Buena', hint: 'Cumple el nivel recomendado.' },
    { level: 'strong', label: 'Fuerte', hint: 'Buena combinación y longitud.' },
  ]
  return { bars, ...levels[bars] }
})
const canCreateUser = computed(
  () =>
    newUser.value.nombre &&
    isEmailValid.value &&
    isPhoneValid.value &&
    newUser.value.puesto &&
    newUser.value.username &&
    isPasswordMatch.value &&
    passwordStrength.value.bars >= 3
)
const canContinueCreateUser = computed(() => {
  if (createUserStep.value === 1) {
    return Boolean(newUser.value.nombre && isEmailValid.value && isPhoneValid.value && newUser.value.puesto)
  }
  if (createUserStep.value === 2) {
    return Boolean(newUser.value.username && isPasswordMatch.value && passwordStrength.value.bars >= 3)
  }
  return canCreateUser.value
})

const updateLevel = async (level: string): Promise<void> => {
  const selectedUser = usuarioSeleccionado.value;
  if (!selectedUser) return;
  const initialLevel = selectedUser.puesto;
  try {
    await us.editUsuario(selectedUser.id_usuario, { puesto: level })
    selectedUser.puesto = level;
    isDropdown.value =  false;
    if (selectedUser.id_usuario == localStorage.getItem("userid")) {
      await localStorage.setItem("level", level)
    }
    window.location.reload();
  } catch (error) {
    modalAbierto.value = false;
    selectedUser.puesto = initialLevel;
    isDropdown.value = false;
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
  }

};

async function createUser() {
  if (!canCreateUser.value) return
  creatingUser.value = true
  try {
    const userInfo = await as.getUserInfo() //actualiza la informacion del usuario para actualizar localstorage
    if (localStorage.getItem('level') == "Administrador" && userInfo) {
      const payload = { ...newUser.value }
      delete payload.confirmPassword
      const creationResult = await us.addUsuario(payload)
      usuarios.value = await us.getUsuarios()
      toast.add({
        severity: creationResult.emailWarning ? 'warn' : 'success',
        summary: 'Usuario creado',
        detail: creationResult.emailWarning || `${newUser.value.nombre} ya puede acceder a la aplicación. Credenciales enviadas por correo.`,
        life: creationResult.emailWarning ? 6000 : 3500,
      })
      showCreateUserModal.value = false
      resetNewUser()
    } else {
      toast.add({
        severity: "error",
        summary: "Acceso restringido",
        detail: "Solo un administrador puede crear usuarios.",
        life: 3000,
      });
    }

  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'No se creó el usuario',
      detail: apiErrorMessage(error) || 'Revisa los datos e inténtalo de nuevo.',
      life: 4000,
    })
  } finally {
    creatingUser.value = false
  }
}
