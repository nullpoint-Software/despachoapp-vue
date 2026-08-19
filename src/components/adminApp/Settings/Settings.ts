import { as, bs, pks, us } from '@/service/adminApp/client'
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { USER_AVATAR_PLACEHOLDER as defaultAvatar } from '@/constants/brandAssets'
import imageCompression from "browser-image-compression";
import { useAppToast } from '@/composables/useAppToast';
import { useAppDialog } from '@/composables/useAppDialog';
import {
  getUserPermissionProfile,
  resetUserPermissionOverrides,
  updateUserPermissionOverrides,
  type PermissionProfile,
} from '@/service/adminApp/permissionsService';
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

type UserDetailTab = 'account' | 'permissions';
type PermissionSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PermissionMeta {
  label: string;
  description: string;
  group: 'Tareas' | 'Clientes' | 'Cobranza' | 'Otros';
  icon: string;
  sensitive?: boolean;
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
interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}
interface BackupConfig {
  backupDir: string;
  storageRoot: string;
  cron: string;
  timezone: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string;
  dayOfWeek: number;
  dayOfMonth: number;
  retentionDays: number;
  retentionMaxFiles: number;
  schedulerEnabled: boolean;
  creating: boolean;
  importing: boolean;
}

const apiErrorMessage = (error: unknown): string | undefined =>
  (error as ApiErrorShape).response?.data?.error;
const showAppearanceModal = ref(false);
const showBackupManager = ref(false);
const backupLoading = ref(false);
const backupBusy = ref(false);
const backupError = ref("");
const backups = ref<BackupFile[]>([]);
const backupConfig = ref<BackupConfig | null>(null);
const backupImportInput = ref<HTMLInputElement | null>(null);
const backupScheduleOpen = ref(false);
const backupScheduleForm = ref({
  schedulerEnabled: true,
  frequency: 'daily' as BackupConfig['frequency'],
  time: '02:00',
  dayOfWeek: 1,
  dayOfMonth: 1,
  timezone: 'America/Mexico_City',
  cron: '0 2 * * *',
});

const backupWeekdays = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const backupMonthDays = Array.from({ length: 28 }, (_, index) => index + 1);
const backupFrequencyLabels: Record<BackupConfig['frequency'], string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  custom: 'Cron',
};

// USER DETAILS MODAL
const modalAbierto = ref(false)
const userDetailTab = ref<UserDetailTab>('account')
const permissionTutorialOpen = ref(false)
const selectedUserPhotoBusy = ref(false)
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

const settingsTutorialOpen = ref(false)
const settingsTutorialSteps = computed(() => [
  {
    target: '.settings-hero',
    eyebrow: 'Ajustes / inicio',
    title: 'Tu centro de control',
    body: 'Desde aquí administras tu cuenta, el acceso seguro, la apariencia y, si eres administrador, al equipo completo.',
  },
  {
    target: '.settings-context-bar',
    eyebrow: 'Ajustes / accesos',
    title: 'Ve directo a cada área',
    body: 'Estos accesos resumen el estado de tu cuenta y te llevan al bloque que quieres configurar.',
  },
  {
    target: '.profile-panel',
    eyebrow: 'Ajustes / perfil',
    title: 'Mantén tu identidad actualizada',
    body: 'Cambia tu foto, edita tu nombre o actualiza tu contraseña de acceso.',
  },
  {
    target: '.passkey-panel',
    eyebrow: 'Ajustes / seguridad',
    title: 'Accede sin depender de contraseñas',
    body: 'Registra una passkey con huella, rostro, Windows Hello, un gestor compatible o una llave física.',
  },
  ...(isAdmin ? [
    {
      target: '.users-panel',
      eyebrow: 'Ajustes / equipo',
      title: 'Consulta y administra usuarios',
      body: 'Busca a una persona para editar sus datos, activar su cuenta o revisar los permisos de su rol.',
    },
    {
      target: '.create-user-panel',
      eyebrow: 'Ajustes / altas',
      title: 'Agrega integrantes con una guía',
      body: 'El registro separa identidad, credenciales y confirmación para reducir errores al crear una cuenta.',
    },
  ] : []),
])

const permissionTutorialSteps = [
  {
    target: '.permission-overview',
    eyebrow: 'Permisos / alcance',
    title: 'Configuras una cuenta',
    body: 'El resumen muestra los permisos efectivos de la persona seleccionada y cuántos tienen ajustes propios.',
  },
  {
    target: '.permission-impact-note',
    eyebrow: 'Permisos / impacto',
    title: 'Distingue los ajustes personales',
    body: 'Los cambios sólo afectan a esta cuenta. Puedes reconocer las excepciones y restablecer los permisos del rol cuando sea necesario.',
  },
  {
    target: '.permission-group',
    eyebrow: 'Permisos / categorías',
    title: 'Decide por área de trabajo',
    body: 'Los accesos están agrupados en tareas, clientes y cobranza, con una explicación clara de lo que habilita cada uno.',
  },
  {
    target: '.permission-switch',
    eyebrow: 'Permisos / guardado',
    title: 'Activa sólo lo necesario',
    body: 'Usa el interruptor de cada acceso. El estado de guardado confirma cuándo el cambio ya quedó aplicado.',
  },
]

function startSettingsTutorial(): void {
  settingsTutorialOpen.value = true
}

function scrollToSettings(target: string): void {
  document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

onMounted(() => {
  if (!localStorage.getItem('tourSettingsDone')) settingsTutorialOpen.value = true
})

const userFullName = ref(localStorage.getItem("fullname"))
const userName = ref(localStorage.getItem("username"));
const storedPhoto = localStorage.getItem("userphoto");
const profileNameDraft = ref(userFullName.value || "")
const profileEditingName = ref(false)
const profileUpdateBusy = ref(false)
const profilePhotoBusy = ref(false)
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
  if (!platformPasskeyAvailable.value) return "Listo para usar una llave de seguridad o un gestor compatible.";
  return "Puedes usar huella, rostro, Windows Hello o un gestor compatible.";
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
    message: 'Ponle un nombre reconocible a este dispositivo, gestor o llave de seguridad.',
    inputLabel: 'Nombre',
    inputType: 'text',
    placeholder: 'Dispositivo personal',
    confirmLabel: 'Crear passkey',
  });
  if (name === null) return;
  passkeyBusy.value = true;
  try {
    await pks.register(name || undefined);
    await loadPasskeys();
    toast.add({ severity: 'success', summary: 'Passkey lista', detail: 'Ya puedes verificar datos protegidos con el autenticador elegido.', life: 3000 });
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

function formatBytes(bytes = 0): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatBackupDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function backupScheduleSummary(config: BackupConfig | null): string {
  if (!config?.schedulerEnabled) return 'Desactivada';
  if (config.frequency === 'custom') return config.cron;
  const frequency = backupFrequencyLabels[config.frequency] || 'Diario';
  if (config.frequency === 'weekly') {
    const day = backupWeekdays.find(item => item.value === Number(config.dayOfWeek))?.label || 'Lunes';
    return `${frequency}, ${day} ${config.time}`;
  }
  if (config.frequency === 'monthly') return `${frequency}, día ${config.dayOfMonth} ${config.time}`;
  return `${frequency}, ${config.time}`;
}

async function loadBackups(): Promise<void> {
  backupLoading.value = true;
  backupError.value = "";
  try {
    const overview = await bs.getOverview();
    backups.value = overview.backups;
    backupConfig.value = overview.config;
    syncBackupScheduleForm(overview.config);
  } catch (error) {
    backupError.value = apiErrorMessage(error) || 'No fue posible cargar los respaldos.';
  } finally {
    backupLoading.value = false;
  }
}

function syncBackupScheduleForm(config: BackupConfig): void {
  backupScheduleForm.value = {
    schedulerEnabled: config.schedulerEnabled,
    frequency: config.frequency || 'daily',
    time: config.time || '02:00',
    dayOfWeek: Number(config.dayOfWeek ?? 1),
    dayOfMonth: Number(config.dayOfMonth ?? 1),
    timezone: config.timezone || 'America/Mexico_City',
    cron: config.cron || '0 2 * * *',
  };
}

async function saveBackupSchedule(): Promise<void> {
  backupBusy.value = true;
  try {
    const config = await bs.updateConfig(backupScheduleForm.value);
    backupConfig.value = config;
    syncBackupScheduleForm(config);
    toast.add({ severity: 'success', summary: 'Programación actualizada', detail: 'Los próximos respaldos usarán este horario.', life: 3500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No actualizado', detail: apiErrorMessage(error) || 'No fue posible guardar la programación.', life: 4500 });
  } finally {
    backupBusy.value = false;
  }
}

async function openBackupManager(): Promise<void> {
  showBackupManager.value = true;
  await loadBackups();
}

function closeBackupManager(): void {
  if (backupBusy.value) return;
  showBackupManager.value = false;
}

async function createBackup(): Promise<void> {
  backupBusy.value = true;
  backupError.value = "";
  try {
    const backup = await bs.createBackup('manual-ui');
    backups.value = [backup, ...backups.value.filter(item => item.filename !== backup.filename)];
    toast.add({ severity: 'success', summary: 'Respaldo creado', detail: backup.filename, life: 3500 });
    await loadBackups();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No creado', detail: apiErrorMessage(error) || 'No fue posible crear el respaldo.', life: 4500 });
  } finally {
    backupBusy.value = false;
  }
}

async function downloadBackup(backup: BackupFile): Promise<void> {
  backupBusy.value = true;
  try {
    const blob = await bs.downloadBackup(backup.filename);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backup.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No descargado', detail: apiErrorMessage(error) || 'No fue posible descargar el respaldo.', life: 4000 });
  } finally {
    backupBusy.value = false;
  }
}

async function deleteBackup(backup: BackupFile): Promise<void> {
  const confirmed = window.confirm(`Eliminar el respaldo ${backup.filename}?`);
  if (!confirmed) return;
  backupBusy.value = true;
  try {
    await bs.deleteBackup(backup.filename);
    backups.value = backups.value.filter(item => item.filename !== backup.filename);
    toast.add({ severity: 'success', summary: 'Respaldo eliminado', detail: backup.filename, life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No eliminado', detail: apiErrorMessage(error) || 'No fue posible eliminar el respaldo.', life: 4000 });
  } finally {
    backupBusy.value = false;
  }
}

async function pruneBackups(): Promise<void> {
  backupBusy.value = true;
  try {
    const result = await bs.pruneBackups();
    toast.add({ severity: 'success', summary: 'Limpieza completa', detail: `${result.deleted} respaldos eliminados.`, life: 3000 });
    await loadBackups();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No limpiado', detail: apiErrorMessage(error) || 'No fue posible limpiar respaldos antiguos.', life: 4000 });
  } finally {
    backupBusy.value = false;
  }
}

function chooseBackupImport(): void {
  if (backupBusy.value || backupLoading.value) return;
  backupImportInput.value?.click();
}

async function importBackupFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const confirmed = window.confirm(
    `Importar ${file.name}? Se creará un respaldo de seguridad antes de restaurar, pero la base de datos y archivos actuales serán reemplazados.`
  );
  if (!confirmed) return;

  backupBusy.value = true;
  backupError.value = "";
  try {
    const response = await bs.importBackup(file);
    const safetyName = response?.result?.safetyBackup?.filename;
    toast.add({
      severity: 'success',
      summary: 'Respaldo importado',
      detail: safetyName ? `Respaldo previo: ${safetyName}` : 'Restauración completada.',
      life: 5000,
    });
    await loadBackups();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No importado', detail: apiErrorMessage(error) || 'No fue posible importar el respaldo.', life: 5000 });
  } finally {
    backupBusy.value = false;
  }
}

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
  permissionProfile.value = null
  permissionLoadError.value = ''
  passwordVisible.value = false
  passwordRevealBusy.value = false
  generatedResetLink.value = ""
  passwordResetMenuOpen.value = false
  userDetailTab.value = 'account'
  modalAbierto.value = true
  selectedLevel.value = u.puesto;
  void loadPermissionProfile(u.id_usuario)
}
async function openPermissionTab(): Promise<void> {
  userDetailTab.value = 'permissions'
  if (usuarioSeleccionado.value) await loadPermissionProfile(usuarioSeleccionado.value.id_usuario)
  await nextTick()
  if (!localStorage.getItem('tourSettingsPermissionsDone')) permissionTutorialOpen.value = true
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

async function startProfileNameEdit(): Promise<void> {
  profileNameDraft.value = userFullName.value || ""
  profileEditingName.value = true
  await nextTick()
  document.querySelector<HTMLInputElement>('#profile-full-name')?.focus()
}

function cancelProfileNameEdit(): void {
  profileNameDraft.value = userFullName.value || ""
  profileEditingName.value = false
}

async function saveProfileName(): Promise<void> {
  const name = profileNameDraft.value.trim()
  if (name.length < 2 || profileUpdateBusy.value) {
    if (name.length < 2) {
      toast.add({ severity: 'warn', summary: 'Nombre incompleto', detail: 'Escribe al menos dos caracteres.', life: 3000 })
    }
    return
  }
  profileUpdateBusy.value = true
  try {
    await us.editUsuario(localStorage.getItem("userid"), { nombre: name })
    userFullName.value = name
    localStorage.setItem("fullname", name)
    profileEditingName.value = false
    toast.add({ severity: 'success', summary: 'Nombre actualizado', detail: 'Tu nombre se guardó correctamente.', life: 2800 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Nombre sin cambios', detail: apiErrorMessage(error) || 'No se pudo guardar tu nombre.', life: 3500 })
  } finally {
    profileUpdateBusy.value = false
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
    await us.editUsuario(localStorage.getItem("userid"), { imagen: u })
    const dataUrl = "data:image/png;base64," + u
    profileImage.value = dataUrl
    localStorage.setItem("userphoto", dataUrl)
    toast.add({
      severity: "success",
      summary: "Foto actualizada",
      detail: "La nueva foto ya aparece en tu cuenta.",
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Foto sin cambios",
      detail: apiErrorMessage(error) || "No se pudo actualizar la foto.",
      life: 3000,
    });
  }
}

// PERMISOS JSON
const permissionMetadata: Record<string, PermissionMeta> = {
  canMoveAllCards: {
    label: 'Mover cualquier tarea',
    description: 'Permite cambiar de columna tareas propias, disponibles y asignadas a otras personas.',
    group: 'Tareas',
    icon: 'pi pi-arrows-alt',
  },
  canMoveOwnCard: {
    label: 'Mover tareas propias',
    description: 'Permite avanzar o regresar las tareas que tiene asignadas.',
    group: 'Tareas',
    icon: 'pi pi-arrow-right-arrow-left',
  },
  canMoveAvailableCard: {
    label: 'Tomar tareas disponibles',
    description: 'Permite mover y comenzar tareas que todavía no tienen responsable.',
    group: 'Tareas',
    icon: 'pi pi-inbox',
  },
  canAddCard: {
    label: 'Crear tareas',
    description: 'Permite registrar nuevas tareas para el despacho.',
    group: 'Tareas',
    icon: 'pi pi-plus-circle',
  },
  canEditCard: {
    label: 'Editar tareas',
    description: 'Permite cambiar datos, fechas y responsables de una tarea.',
    group: 'Tareas',
    icon: 'pi pi-pencil',
  },
  canDeleteCard: {
    label: 'Eliminar tareas',
    description: 'Permite borrar tareas y retirarlas del flujo de trabajo.',
    group: 'Tareas',
    icon: 'pi pi-trash',
    sensitive: true,
  },
  canAddCliente: {
    label: 'Agregar clientes',
    description: 'Permite crear expedientes nuevos de clientes.',
    group: 'Clientes',
    icon: 'pi pi-user-plus',
  },
  canEditCliente: {
    label: 'Editar clientes',
    description: 'Permite actualizar datos fiscales, contacto y expediente.',
    group: 'Clientes',
    icon: 'pi pi-user-edit',
  },
  canDeleteCliente: {
    label: 'Eliminar clientes',
    description: 'Permite eliminar un expediente y sus relaciones disponibles.',
    group: 'Clientes',
    icon: 'pi pi-user-minus',
    sensitive: true,
  },
  canAddPagoConcepto: {
    label: 'Registrar pago por concepto',
    description: 'Permite capturar cobros o pagos asociados a un concepto.',
    group: 'Cobranza',
    icon: 'pi pi-receipt',
  },
  canEditPagoConcepto: {
    label: 'Editar pago por concepto',
    description: 'Permite corregir importes y datos de pagos por concepto.',
    group: 'Cobranza',
    icon: 'pi pi-file-edit',
  },
  canDeletePagoConcepto: {
    label: 'Eliminar pago por concepto',
    description: 'Permite borrar registros de pagos por concepto.',
    group: 'Cobranza',
    icon: 'pi pi-trash',
    sensitive: true,
  },
  canAddPagoMensual: {
    label: 'Registrar pago mensual',
    description: 'Permite capturar mensualidades de clientes.',
    group: 'Cobranza',
    icon: 'pi pi-calendar-plus',
  },
  canEditPagoMensual: {
    label: 'Editar pago mensual',
    description: 'Permite corregir importes, periodos y datos de mensualidades.',
    group: 'Cobranza',
    icon: 'pi pi-calendar-clock',
  },
  canDeletePagoMensual: {
    label: 'Eliminar pago mensual',
    description: 'Permite borrar registros de mensualidades.',
    group: 'Cobranza',
    icon: 'pi pi-calendar-times',
    sensitive: true,
  },
}

const permissionGroupDetails: Record<PermissionMeta['group'], { icon: string; description: string }> = {
  Tareas: { icon: 'pi pi-list-check', description: 'Creación, edición y movimiento del trabajo diario.' },
  Clientes: { icon: 'pi pi-address-book', description: 'Altas y cambios dentro de los expedientes.' },
  Cobranza: { icon: 'pi pi-wallet', description: 'Mensualidades y pagos registrados en el sistema.' },
  Otros: { icon: 'pi pi-sliders-h', description: 'Accesos adicionales disponibles para este rol.' },
}

const permissionProfile = ref<PermissionProfile | null>(null)
const permissionLoading = ref(false)
const permissionLoadError = ref('')
let permissionRequestVersion = 0
const permissionSaving = ref(false)
const permissionSaveState = ref<PermissionSaveState>('idle')

const effectivePermissions = computed<Record<string, boolean>>(() => permissionProfile.value?.effective || {})

const permissionSummary = computed(() => {
  const values = Object.values(effectivePermissions.value)
  return {
    enabled: values.filter(Boolean).length,
    total: values.length,
    customized: Object.keys(permissionProfile.value?.overrides || {}).length,
  }
})

const permissionGroups = computed(() => {
  type PermissionItem = PermissionMeta & { key: string; enabled: boolean; customized: boolean }
  const grouped = new Map<PermissionMeta['group'], PermissionItem[]>()
  Object.entries(effectivePermissions.value).forEach(([key, enabled]) => {
    const meta = permissionMetadata[key] || {
      label: key,
      description: 'Acceso adicional disponible para esta cuenta.',
      group: 'Otros' as const,
      icon: 'pi pi-key',
    }
    const entries = grouped.get(meta.group) || []
    entries.push({
      ...meta,
      key,
      enabled,
      customized: Object.prototype.hasOwnProperty.call(permissionProfile.value?.overrides || {}, key),
    })
    grouped.set(meta.group, entries)
  })
  return (['Tareas', 'Clientes', 'Cobranza', 'Otros'] as const)
    .filter((name) => grouped.has(name))
    .map((name) => ({ name, ...permissionGroupDetails[name], items: grouped.get(name) || [] }))
})

const permissionSaveLabel = computed(() => ({
  idle: 'Cambios sólo para esta cuenta',
  saving: 'Guardando cambios…',
  saved: 'Permisos actualizados',
  error: 'No se pudo guardar',
})[permissionSaveState.value])

async function loadPermissionProfile(userId: string | number): Promise<void> {
  if (permissionProfile.value && String(permissionProfile.value.user.id) === String(userId)) return
  const requestVersion = ++permissionRequestVersion
  permissionLoading.value = true
  permissionLoadError.value = ''
  try {
    const profile = await getUserPermissionProfile(userId)
    if (requestVersion === permissionRequestVersion) permissionProfile.value = profile
  } catch (error) {
    if (requestVersion === permissionRequestVersion) {
      permissionLoadError.value = apiErrorMessage(error) || 'No fue posible cargar los permisos.'
    }
  } finally {
    if (requestVersion === permissionRequestVersion) permissionLoading.value = false
  }
}

async function togglePermission(key: string): Promise<void> {
  const profile = permissionProfile.value
  if (!profile || permissionSaving.value) return
  const previousOverrides = { ...profile.overrides }
  const previousEffective = { ...profile.effective }
  const nextEnabled = !profile.effective[key]
  const nextOverrides = { ...profile.overrides }
  if (nextEnabled === profile.template[key]) delete nextOverrides[key]
  else nextOverrides[key] = nextEnabled

  profile.overrides = nextOverrides
  profile.effective = { ...profile.template, ...nextOverrides }
  permissionSaving.value = true
  permissionSaveState.value = 'saving'
  try {
    permissionProfile.value = await updateUserPermissionOverrides(profile.user.id, nextOverrides)
    permissionSaveState.value = 'saved'
    window.setTimeout(() => {
      if (permissionSaveState.value === 'saved') permissionSaveState.value = 'idle'
    }, 2200)
  } catch {
    profile.overrides = previousOverrides
    profile.effective = previousEffective
    permissionSaveState.value = 'error'
    toast.add({
      severity: 'error',
      summary: 'Permisos sin cambios',
      detail: 'No se pudo actualizar esta cuenta. Intenta de nuevo.',
      life: 4000,
    })
  } finally {
    permissionSaving.value = false
  }
}

async function resetPermissionsToRoleDefaults(): Promise<void> {
  const profile = permissionProfile.value
  if (!profile || permissionSaving.value || !Object.keys(profile.overrides).length) return
  permissionSaving.value = true
  permissionSaveState.value = 'saving'
  try {
    permissionProfile.value = await resetUserPermissionOverrides(profile.user.id)
    permissionSaveState.value = 'saved'
    toast.add({
      severity: 'success',
      summary: 'Permisos restablecidos',
      detail: `${profile.user.name} vuelve a usar los permisos de ${profile.user.role}.`,
      life: 3000,
    })
  } catch {
    permissionSaveState.value = 'error'
    toast.add({
      severity: 'error',
      summary: 'Permisos sin cambios',
      detail: 'No se pudieron restablecer los permisos del rol.',
      life: 4000,
    })
  } finally {
    permissionSaving.value = false
  }
}
function traducirPermiso(k: string): string {
  return permissionMetadata[k]?.label || k;
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
    if (!f.type.startsWith('image/')) {
      toast.add({ severity: 'warn', summary: 'Archivo no compatible', detail: 'Selecciona una imagen JPG, PNG o WebP.', life: 3500 })
      input.value = ""
      return
    }
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: `La imagen no debe superar los ${maxSizeMB} MB.`, life: 3500 });
      input.value = "";
      return;
    }

    profilePhotoBusy.value = true
    try {
      const base64Only = await compressToBase64(f);
      await updateImage(base64Only);
    } finally {
      profilePhotoBusy.value = false
      input.value = ""
    }
  }
}

async function onSelectedUserFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !usuarioSeleccionado.value || selectedUserPhotoBusy.value) return
  if (!file.type.startsWith('image/')) {
    toast.add({ severity: 'warn', summary: 'Archivo no compatible', detail: 'Selecciona una imagen JPG, PNG o WebP.', life: 3500 })
    input.value = ""
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: 'La imagen no debe superar los 5 MB.', life: 3500 })
    input.value = ""
    return
  }

  selectedUserPhotoBusy.value = true
  try {
    const base64Only = await compressToBase64(file)
    await us.editUsuario(usuarioSeleccionado.value.id_usuario, { imagen: base64Only })
    syncSelectedUserPatch({ imagen: base64Only })
    if (isSelectedUserSelf()) profileImage.value = `data:image/png;base64,${base64Only}`
    toast.add({ severity: 'success', summary: 'Foto actualizada', detail: `La foto de ${usuarioSeleccionado.value.nombre} se guardó correctamente.`, life: 3000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Foto sin cambios', detail: apiErrorMessage(error) || 'No se pudo actualizar la foto del usuario.', life: 3500 })
  } finally {
    selectedUserPhotoBusy.value = false
    input.value = ""
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
