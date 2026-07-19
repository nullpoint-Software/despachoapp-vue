<template>
  <main class="settings-view w-full bg-transparent p-4 lg:p-6 mt-20">
    <header class="settings-hero">
      <div>
        <p>CUENTA / SISTEMA</p>
        <h1>Configuración</h1>
        <span>Perfil, acceso y permisos del equipo.</span>
      </div>
      <div class="settings-hero-actions">
        <small>Compilación<br /><strong>{{ buildTime ?? "desarrollo" }}</strong></small>
        <section class="text-size-control" aria-labelledby="text-size-title">
          <span id="text-size-title">Tamaño de texto</span>
          <div role="group" aria-label="Seleccionar tamaño de texto">
            <button
              v-for="option in fontSizeOptions"
              :key="option.id"
              type="button"
              :class="{ active: selectedFontSize === option.id }"
              :aria-pressed="selectedFontSize === option.id"
              :title="`Texto ${option.name.toLowerCase()}`"
              @click="applyFontSize(option.id)"
            >
              <b :class="`text-sample--${option.id}`">{{ option.sample }}</b>
              <small>{{ option.name }}</small>
            </button>
          </div>
        </section>
        <section class="palette-control" aria-label="Paleta visual">
          <span>Paleta visual</span>
          <PaletteSelector />
        </section>
      </div>
    </header>
    <!-- Bento Grid Container -->
    <div class="settings-grid grid grid-cols-3 lg:grid-cols-2 grid-rows-3 lg:grid-rows-3 gap-2 m-4 h-full" :class="{ 'settings-grid--profile': !isAdmin }">

      <!-- 0: PERFIL -->
      <section class="settings-panel profile-panel bg-white text-black rounded-2xl shadow p-6 flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6
               col-start-1 row-start-1 col-span-2
               lg:col-start-1 lg:row-start-1 lg:col-span-1 lg:row-span-1">
        <div class="profile-avatar relative">
          <img :src="profileImage" alt="Foto de perfil" class="w-24 h-24 rounded-full object-cover" />
          <label for="file-input"
            class="absolute bottom-0 right-0 p-2 rounded-full cursor-pointer">
            <i class="pi pi-camera text-xl"></i>
          </label>
          <input id="file-input" type="file" accept="image/*" @change="onFileChange" class="hidden" />
        </div>
        <div class="text-center lg:text-left flex-1">
          <input type="text" v-model="userFullName" @blur="updateName(userFullName)"
            class="w-full text-2xl font-semibold border-b border-gray-300 focus:outline-none focus:border-black" />
          <p class="text-sm text-gray-500 mt-1">Haz clic para editar tu nombre y clic afuera para guardar</p>
          <p class="font-semibold">Tu nombre de usuario es: {{ userName }}</p>
        </div>
      </section>

      <!-- 1: BUSCAR Y SELECCIÓN DE USUARIO -->
      <aside v-if="isAdmin" class="settings-panel users-panel bg-white text-black rounded-2xl shadow p-6 flex flex-col
               col-start-3 row-start-1 row-span-3
               lg:col-start-2 lg:row-start-1 lg:col-span-1 lg:row-span-3">
        <div class="users-heading flex flex-col items-center mb-4">
          <i class="pi pi-users text-3xl"></i>
          <span class="mt-2 text-lg font-semibold">Buscar</span>
        </div>

        <!-- Desktop inline search -->
        <div class="user-search hidden lg:block relative mb-4">
          <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2"></i>
          <input type="text" v-model="searchQuery" placeholder="Escribe nombre..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        <!-- Mobile/tablet: icon opens modal -->
        <div class="mobile-search-trigger lg:hidden flex justify-center mb-4">
          <button @click="showSearchModal = true" class="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <i class="pi pi-search text-xl"></i>
          </button>
        </div>

        <div class="users-list overflow-y-auto">
          <template v-for="user in filteredUsers" :key="user.id_usuario">
            <!-- MOBILE: foto, nombre completo y cargo -->
            <div class="mobile-user-row flex flex-col items-center lg:hidden cursor-pointer mb-4" @click="abrirModal(user)">
              <img :src="user.imagen ? 'data:image/png;base64,' + user.imagen : defaultAvatar"
                class="w-12 h-12 rounded-full object-cover" />
              <p class="text-sm mt-2 font-semibold text-center">{{ user.nombre + (!user.activo ? " (INACTIVO)" : "")}}</p>
              <p class="text-xs text-gray-500">{{ user.puesto }}</p>
            </div>
            <!-- DESKTOP: full card with delete -->
            <div
              class="user-row hidden lg:flex bg-gray-100 p-4 rounded-xl shadow hover:bg-gray-50 transition items-center space-x-4 mb-4">
              <img :src="user.imagen ? 'data:image/png;base64,' + user.imagen : defaultAvatar"
                class="w-10 h-10 rounded-full object-cover" />
              <div class="flex-1 cursor-pointer" @click="abrirModal(user)">
                <p class="font-semibold">{{ user.nombre + " (" + user.username + ")" }}</p>
                <p class="text-sm text-gray-500">{{ user.puesto }}</p>
              </div>
              <span class="font-semibold" v-if="!user.activo">INACTIVO</span>
              <button @click.stop="confirmDialogVisible = true; userToDelete = user"
                class="text-red-500 hover:text-red-700 px-2 cursor-pointer">
                <i class="pi pi-trash text-lg"></i>
              </button>
              <i class="pi pi-chevron-right text-gray-400 cursor-pointer" @click="abrirModal(user)"></i>
            </div>
          </template>
        </div>
      </aside>

      <!-- 2: AÑADIR NUEVO USUARIO -->
      <section v-if="isAdmin" class="settings-panel create-user-panel bg-white text-black rounded-2xl shadow p-6
               col-start-1 row-start-2 col-span-2 row-span-2
               lg:col-start-1 lg:row-start-2 lg:col-span-1 lg:row-span-2">
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <i class="pi pi-user-plus mr-2"></i> Añadir nuevo usuario
        </h2>

        <!-- vista previa imagen -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="new-user-avatar form-control relative">
            <img :src="newUserPreview || defaultAvatar"
              class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 pi pi-user" />
            <label for="new-file"
              class="absolute bottom-0 right-0 p-1 rounded-full cursor-pointer">
              <i class="pi pi-camera text-lg"></i>
            </label>
            <input id="new-file" type="file" accept="image/*" @change="onNewFileChange" class="hidden" />
          </div>
          <span class="text-black font-medium">Vista previa</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <!-- Nombre completo -->
          <div class="form-control relative">
            <i class="pi pi-id-card absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.nombre" placeholder="Nombre completo"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2" />
          </div>
          <!-- Correo -->
          <div class="form-control relative">
            <i class="pi pi-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="email" v-model="newUser.email" placeholder="Correo electrónico" :class="[
              'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
              isEmailValid ? 'border-gray-300' : 'border-red-500'
            ]" />
          </div>
          <!-- Teléfono -->
          <div class="form-control relative">
            <i class="pi pi-phone absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.telefono" placeholder="Teléfono" :class="[
              'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
              isPhoneValid ? 'border-gray-300' : 'border-red-500'
            ]" />
          </div>
          <!-- Puesto -->
          <div class="form-control relative">
            <i class="pi pi-tags absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <select v-model="newUser.puesto"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2">
              <option disabled value="">Seleccionar puesto</option>
              <option>Administrador</option>
              <option>Empleado</option>
            </select>
          </div>
          <!-- Username -->
          <div class="form-control relative">
            <i class="pi pi-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.username" placeholder="Nombre de usuario" autocomplete="new-password"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2" />
          </div>
          <!-- Password -->
          <div class="form-control relative flex items-center">
            <i class="pi pi-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input :type="showNewPassword ? 'text' : 'password'" v-model="newUser.password" placeholder="Contraseña" autocomplete="new-password"
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2" />
            <button @click="showNewPassword = !showNewPassword"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
          <!-- Confirmar Password -->
          <div class="confirm-password-field form-control relative flex items-center">
            <i class="pi pi-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input :type="showConfirmPassword ? 'text' : 'password'" v-model="newUser.confirmPassword"
              placeholder="Confirmar password"
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2" />
            <button @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
        </div>

        <button @click="createUser" :disabled="!canCreateUser"
          type="button"
          class="create-user-button w-full flex items-center justify-center px-5 py-3 bg-black text-white rounded-2xl hover:bg-gray-800 transition disabled:opacity-50">
          <i class="pi pi-plus-circle mr-2"></i> Crear usuario
        </button>
      </section>
    </div>

    <!-- SEARCH MODAL (MOBILE/TABLET) -->
    <transition name="fade-scale">
      <div v-if="showSearchModal" @click.self="showSearchModal = false"
        class="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4">
        <div class="modal-content bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
          <div class="standard-modal-header flex items-center mb-4">
            <button type="button" class="standard-modal-close" aria-label="Cerrar" @click="showSearchModal=false">×</button>
            <i class="pi pi-search text-xl mr-2 text-black"></i>
            <input type="text" v-model="searchQuery" placeholder="Buscar usuario..."
              class="flex-1 py-2 border-b border-gray-300 focus:outline-none text-black" />
          </div>
          <div class="space-y-3 max-h-64 overflow-y-auto">
            <div v-for="user in filteredUsers" :key="user.id_usuario"
              class="flex items-center space-x-3 p-2 rounded hover:bg-gray-100 cursor-pointer"
              @click="openFromSearch(user)">
              <img :src="user.imagen ? 'data:image/png;base64,' + user.imagen : defaultAvatar"
                class="w-8 h-8 rounded-full object-cover" />
              <div>
                <p class="font-semibold text-sm text-black">{{ user.nombre + (!user.activo ? " (INACTIVO)" : "")}} </p>
                <p class="text-xs text-gray-500">{{ user.puesto }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- USER DETAILS MODAL -->
    <transition name="fade-scale">
      <div v-if="modalAbierto" @click.self="modalAbierto = false; isDropdown = false"
        class="modal-overlay fixed user-detail-modal inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4">
        <div
          class="modal-content bg-white/95 text-black rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[92vh] p-8 overflow-y-auto relative">
          <!-- HEADER with delete + close -->
          <div class="settings-detail-header standard-modal-header flex justify-between items-center border-b pb-4 mb-6 space-x-4">
            <button type="button" class="standard-modal-close" aria-label="Cerrar" @click="modalAbierto=false;isDropdown=false">×</button>
            <div class="flex-1">
              <h3 class="text-2xl font-bold">Detalles del usuario</h3>
            </div>
            <button @click.stop="confirmDialogVisible = true; userToDelete = usuarioSeleccionado"
              class="text-red-600 hover:text-red-800 mr-4 cursor-pointer" title="Eliminar usuario">
              <i class="pi pi-trash text-2xl"></i>
            </button>
          </div>
          <!-- USER INFO -->
          <div class="detail-profile flex flex-col items-center mb-2">
            <img :src="usuarioSeleccionado.imagen && usuarioSeleccionado.imagen !== 'null'
              ? 'data:image/png;base64,' + usuarioSeleccionado.imagen
              : defaultAvatar" class="w-28 h-28 rounded-full border-4 border-gray-200 shadow-lg mb-4 object-cover" />
            <div class="detail-profile__identity">
              <small>Usuario seleccionado</small>
              <h4 class="text-xl font-semibold">{{ usuarioSeleccionado.nombre }}</h4>
              <p v-if="!isDropdown" class="text-sm text-gray-500 cursor-pointer" @click="isDropdown = true">
                {{ usuarioSeleccionado.puesto }}
                <i class="pi pi-chevron-down ml-1 translate-y-0.75 transform text-gray-500 pointer-events-none"></i>
              </p>

              <!-- Dropdown cuando isDropdown es true -->
              <div v-else class="relative">
                <select v-model="selectedLevel" @blur="isDropdown = false" @change="updateLevel(selectedLevel)"
                  class="w-full p-2 border text-sm border-gray-300 rounded bg-white text-black">
                  <option value="Administrador">Administrador</option>
                  <option value="Empleado">Empleado</option>
                </select>
              </div>
            </div>
          </div>
          <div class="status-control text-center mb-4">
            <span class="font-semibold block mb-2">Activo</span>
            <button @click="usuarioSeleccionado.activo = !usuarioSeleccionado.activo; updateUserStatus(usuarioSeleccionado)"
              :class="usuarioSeleccionado.activo ? 'bg-blue-600' : 'bg-gray-300'"
              class="w-10 h-5 rounded-full relative transition-colors duration-200">
              <span
                class="cursor-pointer block w-5 h-5 bg-white drop-shadow-lg outline-2 outline-white -outline-offset-1 rounded-full transform transition-transform duration-200"
                :class="usuarioSeleccionado.activo ? 'translate-x-5' : 'translate-x-0'">
              </span>
            </button>
          </div>
          <!-- Sección en dos columnas -->
          <div class="account-grid flex flex-wrap justify-center gap-12 mb-6">
            <!-- Columna izquierda -->
            <div class="text-center">
              <p class="font-medium mb-2">Nombre de usuario:</p>
              <span class="text-lg block mb-4">{{ usuarioSeleccionado.username }}</span>

              <p class="font-medium mb-2">Contraseña:</p>
              <div class="flex items-center justify-center">
                <span class="mr-2 text-lg">
                  {{ passwordVisible ? usuarioSeleccionado.password : '••••••••' }}
                </span>
                <button @click="verPassword" class="text-blue-600 hover:underline text-sm focus:outline-none cursor-pointer">
                  Ver
                </button>
              </div>

            </div>


            <!-- Columna derecha -->
            <div class="text-center">
              <p class="font-medium mb-2">Correo electrónico:</p>
              <span class="text-lg block mb-4">{{ usuarioSeleccionado.email }}</span>

              <p class="font-medium mb-2">Teléfono:</p>
              <span class="text-lg">{{ usuarioSeleccionado.telefono }}</span>
            </div>
          </div>
          <!-- PERMISOS in two columns -->
          <p class="permissions-title text-xl font-semibold mb-4"><i class="pi pi-shield mr-2"></i>Permisos para el rol "{{
            usuarioSeleccionado.puesto }}"</p>
          <div class="permissions-grid grid grid-cols-2 gap-6 mb-4">
            <div v-for="(value, key) in permissions[usuarioSeleccionado.puesto]" :key="key"
              class="permission-row flex items-center justify-between">
              <span class="capitalize max-w-42 w-fit text-sm">{{ traducirPermiso(key) }}</span>
              <button @click="togglePermission(usuarioSeleccionado.puesto, key)"
                :class="value ? 'bg-blue-600' : 'bg-gray-300'"
                class="w-10 h-5 rounded-full relative transition-colors translate-x-0">
                <span
                  class="cursor-pointer block w-5 h-5 bg-white drop-shadow-lg outline-2 outline-white -outline-offset-1 rounded-full transform transition-transform duration-200"
                  :class="value ? 'translate-x-5' : 'translate-x-0'"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </main>
  <!-- Confirmación para eliminación -->
  <ConfirmDeleteDialog v-if="confirmDialogVisible" :element="'¿Estás seguro de eliminar este usuario permanentemente? Se eliminaran los datos de este usuario y las tareas que se le hayan asignado seran regresadas a estado Disponible.'" @confirm="confirmDelete(userToDelete)"
    @cancel="cancelDelete" />
</template>

<script setup>
import { as, ps, us } from '@/service/adminApp/client'
import { ref, computed, onMounted } from 'vue'
import defaultAvatar from '@/assets/img/user.jpg'
import imageCompression from "browser-image-compression"; 
import { useAppToast } from '@/composables/useAppToast';
import ConfirmDeleteDialog from '@/components/adminApp/Dialogs/ConfirmDeleteDialog.vue';
import PaletteSelector from '@/components/ui/PaletteSelector.vue';
import { useFontSize } from '@/composables/useFontSize';
import { getPermissions, hasPermission, updatePermissions, updateUserPermissions } from '@/service/adminApp/permissionsService';
import router from '@/router';
// SEARCH MODAL STATE
const showSearchModal = ref(false)
const { fontSizeOptions, selectedFontSize, applyFontSize } = useFontSize();

// USER DETAILS MODAL
const modalAbierto = ref(false)
const buildTime = ref();
const usuarioSeleccionado = ref()
const passwordVisible = ref(false)

const confirmDialogVisible = ref(false);
const userToDelete = ref();
const isDropdown = ref(false);
const selectedLevel = ref();
async function confirmDelete(u) {
  await deleteUser(u)
  confirmDialogVisible.value = false;
  userToDelete.value = null;
}
async function cancelDelete() {
  confirmDialogVisible.value = false;
  userToDelete.value = null;
}
const toast = useAppToast();
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

// USUARIOS
const usuarios = ref(await us.getUsuarios())
console.log(usuarios);

const searchQuery = ref('')
const filteredUsers = computed(() =>
  usuarios.value.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

// -------------- CONTRASEÑA MAESTRA --------------
const MASTER_PASSWORD = 'Hanekawa'
// -------------- FIN CONTRASEÑA MAESTRA --------------

function abrirModal(u) {
  usuarioSeleccionado.value = u
  passwordVisible.value = false
  modalAbierto.value = true
  selectedLevel.value = u.puesto;
}
function openFromSearch(u) {
  abrirModal(u)
  showSearchModal.value = false
}
async function verPassword() {
  const entrada = prompt('Por seguridad, ingresa tu contraseña:')
  const userVerify = await as.loginUser({ username: localStorage.getItem("username"), password: entrada }); //check si contrasena es correcta
  const userInfo = await as.getUserInfo() //actualiza la informacion del usuario para actualizar localstorage
  if (entrada && userVerify) {
    if (userInfo && localStorage.getItem('level') == "Administrador") { //si token es valido userinfo es true
      const userbd = await us.getUsuarioPS(usuarioSeleccionado.value.id_usuario)
      usuarioSeleccionado.value.password = userbd.password
      passwordVisible.value = true
    } else {
      alert('No tienes permiso para hacer esto!')
    }

  } else {
    alert('Contraseña incorrecta')
  }
}

// DELETE USER
async function deleteUser(u) {
  try {
    usuarios.value = usuarios.value.filter(x => x.id_usuario !== u.id_usuario)
    if (u.id_usuario == localStorage.getItem("userid")) { //si se intenta eliminar a uno mismo xd
      console.log("deleting user: ", u);

      await us.deleteUsuario(u.id_usuario)
      localStorage.clear()
      router.push("/")
    } else {
      await us.deleteUsuario(u.id_usuario)
      window.location.reload();
    }

  } catch (error) {
    console.log(error);

  }

}

async function updateName(u) {
  try {
    console.log("new name: ", u);
    await localStorage.setItem("fullname", u);
    await us.editUsuario(localStorage.getItem("userid"), { nombre: u })
    localStorage.setItem("showToast", "nameSuccess");
    window.location.reload()
    
  } catch (error) {
    console.error(error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
  }

}

async function updateUserStatus(u){
  try {
    await us.editUsuario(u.id_usuario,{activo: u.activo})
  } catch (error) {
    console.error(error);
  }
}

async function updateImage(u) {
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
  } catch (error) {
    console.error(error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
  }
}

// PERMISOS JSON
const permissions = ref(await getPermissions());
async function togglePermission(role, key) {
  permissions.value[role][key] = !permissions.value[role][key]
  await updatePermissions(permissions.value)
}
function traducirPermiso(k) {
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

  return map[k] || k;
}


// CREAR USUARIO
const newUser = ref({
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

async function compressToBase64(file) {
  const options = {
    maxWidthOrHeight: 200,
    useWebWorker: true,
  };

  const compressedFile = await imageCompression(file, options);
  const base64 = await imageCompression.getDataUrlFromFile(compressedFile);
  return base64.split(",")[1]; // Return base64 only
}

async function onFileChange(e) {
  const f = e.target.files[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      alert(`La imagen no debe superar los ${maxSizeMB}MB.`);
      e.target.value = "";
      return;
    }

    profileImage.value = URL.createObjectURL(f);
    const base64Only = await compressToBase64(f);
    await updateImage(base64Only);
  }
}

async function onNewFileChange(e) {
  const f = e.target.files[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      alert(`La imagen no debe superar los ${maxSizeMB}MB.`);
      e.target.value = "";
      return;
    }

    const fullDataUrl = await imageCompression.getDataUrlFromFile(f);
    newUserPreview.value = fullDataUrl;

    const base64Only = await compressToBase64(f);
    newUser.value.imagen = base64Only;
  }
}


const isEmailValid = computed(() => /\S+@\S+\.\S+/.test(newUser.value.email))
const isPhoneValid = computed(() => /^\d{7,}$/.test(newUser.value.telefono))
const isPasswordMatch = computed(
  () =>
    newUser.value.password && newUser.value.password === newUser.value.confirmPassword
)
const canCreateUser = computed(
  () =>
    newUser.value.nombre &&
    isEmailValid.value &&
    isPhoneValid.value &&
    newUser.value.puesto &&
    newUser.value.username &&
    isPasswordMatch.value
)

const updateLevel = async (level) => {
  // Tu lógica para actualizar el nivel
  console.log("Nivel seleccionado:", level);
  const initialLevel = await usuarioSeleccionado.value.puesto;
  try {
    await us.editUsuario(usuarioSeleccionado.value.id_usuario, { puesto: level })
    usuarioSeleccionado.value.puesto = await level;
    isDropdown.value =  false;
    if (usuarioSeleccionado.value.id_usuario == localStorage.getItem("userid")) {
      await localStorage.setItem("level", level)
    }
    window.location.reload();
  } catch (error) {
    modalAbierto.value = false;
    usuarioSeleccionado.value.puesto = initialLevel;
    isDropdown.value = false;
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "No se pudo realizar la operacion",
      life: 3000,
    });
    console.error(error);

  }

  // Aquí puedes hacer la lógica para actualizar el valor de 'puesto' en el backend o estado
};

async function createUser() {
  if (!canCreateUser.value) return
  // usuarios.value.push({
  //   ...newUser.value,
  //   id_usuario: crypto.randomUUID(),
  //   fecha_registro: new Date().toISOString(),
  //   imagen: newUser.value.imagen || null
  // })
  console.log("trying to create user: ", newUser.value);
  try {
    const userInfo = await as.getUserInfo() //actualiza la informacion del usuario para actualizar localstorage
    if (localStorage.getItem('level') == "Administrador" && userInfo) {
      await us.addUsuario(newUser.value)
      window.location.reload();
    } else {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "No puedes realizar esta operacion!",
        life: 3000,
      });
    }

  } catch (error) {
    console.error(error);
  }

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
  newUserPreview.value = ''

}
</script>

<style scoped>
::-webkit-scrollbar {
  width: 3px;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(100, 100, 100, 0.5);
  border-radius: 10px;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.settings-view {
  min-height: 100%;
  width: 100%;
  max-width: 100%;
  margin-top: 5rem !important;
  overflow-x: clip;
  padding: clamp(1rem, 2.5vw, 2rem) !important;
  background: var(--br-bg);
  color: var(--br-text);
  box-sizing: border-box;
}
.settings-hero {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  padding: 1.5rem 0 2rem;
  border-top: 2px solid var(--br-line-strong);
  border-bottom: 2px solid var(--br-line-strong);
}
.settings-hero p {
  margin: 0 0 0.5rem;
  color: var(--br-accent);
  font: 800 0.72rem "Courier New", monospace;
  letter-spacing: 0.12em;
}
.settings-hero h1 {
  margin: 0;
  font: 900 clamp(3.25rem, 7vw, 5.75rem)/0.82 Arial, sans-serif;
  letter-spacing: -0.075em;
  text-transform: uppercase;
}
.settings-hero > div:first-child > span {
  display: block;
  margin-top: 1rem;
  color: var(--br-muted);
  font: 700 0.86rem "Courier New", monospace;
}
.settings-hero-actions {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(9rem, 0.7fr) minmax(21rem, 1.8fr) minmax(14rem, 1fr);
  align-items: stretch;
  gap: 0.75rem;
}
.settings-hero-actions > * {
  min-height: 5.5rem;
  box-sizing: border-box;
}
.palette-control :deep(.palette-selector) {
  width: 100%;
}
.palette-control :deep(.palette-selector summary) {
  width: 100%;
  min-height: 2.5rem;
  box-sizing: border-box;
}
.palette-control,
.text-size-control {
  min-width: 0;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
  color: var(--br-text);
  padding: 0.5rem;
}
.palette-control > span,
.text-size-control > span {
  display: block;
  margin: 0 0 0.4rem;
  color: var(--br-muted);
  font: 800 0.62rem "Courier New", monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.text-size-control > div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
}
.text-size-control button {
  display: flex;
  min-width: 0;
  min-height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border: 1px solid var(--br-line);
  background: transparent;
  color: var(--br-text);
  cursor: pointer;
}
.text-size-control button:hover {
  border-color: var(--br-accent);
}
.text-size-control button.active {
  border-color: var(--br-accent);
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.text-size-control button:focus-visible {
  outline: 2px solid var(--br-accent);
  outline-offset: 2px;
}
.text-size-control button b {
  font-family: Arial, sans-serif;
  line-height: 1;
}
.text-size-control button small {
  overflow: hidden;
  font: 700 0.56rem "Courier New", monospace;
  text-overflow: ellipsis;
}
.text-sample--small { font-size: 0.78rem; }
.text-sample--medium { font-size: 1rem; }
.text-sample--large { font-size: 1.22rem; }
.settings-hero-actions > small {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  border: 1px solid var(--br-line-strong);
  padding: 0.65rem 0.8rem;
  color: var(--br-muted);
  font: 700 0.62rem/1.35 "Courier New", monospace;
  text-transform: uppercase;
}
.settings-hero-actions > small strong {
  color: var(--br-text);
  font-variant-numeric: tabular-nums;
}
.settings-grid {
  display: grid !important;
  height: auto !important;
  grid-template-columns: minmax(0, 1.35fr) minmax(22rem, 0.65fr) !important;
  grid-template-rows: auto auto !important;
  gap: 1rem !important;
  margin: 1rem 0 0 !important;
}
.settings-grid--profile {
  grid-template-columns: minmax(0, 1fr) !important;
}
.settings-panel {
  min-width: 0;
  border: 1px solid var(--br-line) !important;
  border-radius: 0 !important;
  background: var(--br-panel) !important;
  color: var(--br-text) !important;
  box-shadow: 8px 8px 0 var(--br-accent) !important;
}
.profile-panel {
  grid-column: 1 !important;
  grid-row: 1 !important;
  align-items: center !important;
  padding: 1.35rem !important;
}
.profile-panel > .relative {
  flex: 0 0 auto;
}
.profile-avatar {
  width: 6rem;
  height: 6rem;
}
.profile-avatar > img {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.profile-avatar label[for="file-input"] {
  right: 0.35rem !important;
  bottom: 0.35rem !important;
}
.new-user-avatar {
  width: 6.5rem;
  height: 6.5rem;
}
.new-user-avatar > img {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.new-user-avatar label[for="new-file"] {
  right: 0.2rem !important;
  bottom: 0.2rem !important;
}
.profile-panel img,
.create-user-panel img,
.users-panel img,
.detail-profile img {
  border: 1px solid var(--br-line-strong) !important;
  border-radius: 0 !important;
  background: var(--br-panel-2);
  box-shadow: none !important;
}
.profile-panel label[for="file-input"],
.create-user-panel label[for="new-file"] {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border: 1px solid var(--br-panel);
  border-radius: 0 !important;
  background: var(--br-accent) !important;
  color: var(--br-accent-text);
  padding: 0 !important;
}
.profile-panel label[for="file-input"] > i,
.create-user-panel label[for="new-file"] > i {
  color: var(--br-accent-text) !important;
}
.profile-panel input {
  min-height: 3.25rem;
  border: 0 !important;
  border-bottom: 1px solid var(--br-line-strong) !important;
  border-radius: 0;
  background: transparent !important;
  color: var(--br-text) !important;
  padding: 0.4rem 0;
  font: 900 clamp(1.5rem, 3vw, 2.25rem)/1 Arial, sans-serif;
}
.profile-panel p {
  color: var(--br-muted) !important;
  font-family: "Courier New", monospace;
}
.profile-panel p:last-child {
  color: var(--br-text) !important;
}
.create-user-panel {
  grid-column: 1 !important;
  grid-row: 2 !important;
  padding: 1.35rem !important;
}
.create-user-panel > h2,
.users-heading span {
  margin: 0 0 1rem !important;
  color: var(--br-text);
  font: 900 clamp(1.35rem, 3vw, 2rem)/1 Arial, sans-serif;
  letter-spacing: -0.035em;
  text-transform: uppercase;
}
.create-user-panel > h2 i,
.users-heading i {
  color: var(--br-accent);
}
.create-user-panel > .flex.items-center {
  border-top: 1px solid var(--br-line);
  border-bottom: 1px solid var(--br-line);
  padding: 0.85rem 0;
}
.create-user-panel > .flex.items-center > span {
  color: var(--br-muted) !important;
  font: 800 0.7rem "Courier New", monospace;
  text-transform: uppercase;
}
.create-user-panel > .grid {
  align-items: stretch;
  gap: 0.75rem !important;
}
.create-user-panel .form-control {
  min-width: 0;
}
.confirm-password-field {
  grid-column: 1 / -1;
}
.form-control > i {
  z-index: 1;
  color: var(--br-accent) !important;
}
.form-control input,
.form-control select {
  width: 100%;
  min-height: 3.2rem;
  border: 1px solid var(--br-line-strong) !important;
  border-radius: 0 !important;
  background: var(--br-control) !important;
  color: var(--br-control-text, #141413) !important;
  font: 700 0.84rem "Courier New", monospace;
}
.form-control button {
  z-index: 2;
  border: 0;
  background: transparent;
  color: var(--br-control-muted, #4e4b45) !important;
  cursor: pointer;
}
.form-control input:focus,
.form-control select:focus,
.user-search input:focus {
  outline: 2px solid var(--br-accent) !important;
  outline-offset: 2px;
  box-shadow: none !important;
}
.create-user-button {
  min-height: 3.25rem;
  border: 1px solid var(--br-accent) !important;
  border-radius: 0 !important;
  background: var(--br-accent) !important;
  color: var(--br-accent-text) !important;
  font: 800 0.78rem "Courier New", monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.create-user-button:hover:not(:disabled) {
  background: var(--br-text) !important;
  color: var(--br-bg) !important;
}
.create-user-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}
.users-panel {
  grid-column: 2 !important;
  grid-row: 1 / span 2 !important;
  min-height: 42rem;
  max-height: calc(100dvh - 8rem);
  padding: 0 !important;
  overflow: hidden;
}
.users-heading {
  align-items: flex-start !important;
  margin: 0 !important;
  padding: 1.25rem;
  border-bottom: 1px solid var(--br-line);
}
.users-heading span {
  margin: 0.5rem 0 0 !important;
}
.user-search {
  display: block !important;
  margin: 0 !important;
  padding: 1rem;
  border-bottom: 1px solid var(--br-line);
}
.user-search > i {
  left: 1.8rem !important;
  color: var(--br-accent);
}
.user-search input {
  min-height: 3rem;
  border: 1px solid var(--br-line-strong) !important;
  border-radius: 0 !important;
  background: var(--br-control) !important;
  color: var(--br-control-text, #141413) !important;
  font: 700 0.82rem "Courier New", monospace;
}
.mobile-search-trigger,
.mobile-user-row {
  display: none !important;
}
.users-list {
  min-height: 0;
  padding: 0.75rem;
}
.user-row {
  display: flex !important;
  min-height: 4.75rem;
  margin: 0 !important;
  border: 1px solid transparent;
  border-bottom-color: var(--br-line);
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--br-text);
  padding: 0.75rem !important;
  box-shadow: none !important;
}
.user-row:hover {
  border-color: var(--br-accent);
  background: var(--br-panel-2) !important;
}
.user-row p {
  margin: 0;
  color: var(--br-text);
}
.user-row p + p {
  margin-top: 0.25rem;
  color: var(--br-muted) !important;
  font: 700 0.68rem "Courier New", monospace;
}
.user-row > span {
  border: 1px solid var(--br-danger-line, #e06a5c);
  color: var(--br-danger-line, #e06a5c);
  padding: 0.25rem;
  font: 800 0.58rem "Courier New", monospace;
}
.user-row > button {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--br-danger-line, #e06a5c);
  background: transparent;
  color: var(--br-danger-line, #e06a5c) !important;
}
.user-row > button:hover {
  background: var(--br-danger, #96382e);
  color: #fff !important;
}
.user-row > .pi-chevron-right {
  color: var(--br-muted) !important;
}
.user-detail-modal .modal-content {
  width: min(54rem, calc(100vw - 2rem)) !important;
  max-width: 54rem !important;
  padding: 0 !important;
}
.settings-detail-header {
  margin: 0 !important;
}
.settings-detail-header > button:not(.standard-modal-close) {
  position: absolute;
  right: 4.5rem;
  top: 1.35rem;
  border: 0;
  background: transparent;
  color: var(--br-danger-line, #e06a5c) !important;
}
.detail-profile {
  display: grid !important;
  grid-template-columns: 6rem minmax(0, 1fr);
  align-items: center !important;
  gap: 1.25rem;
  margin: 0 !important;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--br-line);
}
.detail-profile > img {
  width: 6rem !important;
  height: 6rem !important;
  margin: 0 !important;
}
.detail-profile__identity {
  min-width: 0;
  text-align: left;
}
.detail-profile__identity > small {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--br-control-muted, #4e4b45);
  font: 800 0.62rem "Courier New", monospace;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.detail-profile h4 {
  margin: 0;
  color: var(--br-control-text, #141413);
  font: 900 1.5rem Arial, sans-serif;
}
.detail-profile p {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.35rem 0 0;
  color: var(--br-control-muted, #4e4b45) !important;
  font: 700 0.76rem "Courier New", monospace;
}
.detail-profile select {
  min-width: 12rem;
  margin-top: 0.5rem;
  border: 1px solid var(--br-line-strong) !important;
  border-radius: 0 !important;
  background: var(--br-control) !important;
  color: var(--br-control-text, #141413) !important;
}
.status-control {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  margin: 0 !important;
  padding: 0.85rem 1.5rem;
  border-bottom: 1px solid var(--br-line);
}
.status-control > span {
  margin: 0 !important;
  color: var(--br-control-text, #141413);
  font: 800 0.72rem "Courier New", monospace;
  text-transform: uppercase;
}
.status-control > button,
.permission-row > button {
  position: relative;
  flex: 0 0 auto;
  border: 1px solid var(--br-line-strong);
  border-radius: 0 !important;
  background: var(--br-panel-2) !important;
  cursor: pointer;
}
.status-control > button.bg-blue-600,
.permission-row > button.bg-blue-600 {
  border-color: var(--br-accent);
  background: var(--br-accent) !important;
}
.status-control > button span,
.permission-row > button span {
  border-radius: 0 !important;
  background: var(--br-control-text, #fff) !important;
  outline: 0 !important;
  filter: none !important;
}
.account-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr;
  gap: 0 !important;
  margin: 0 !important;
  border-bottom: 1px solid var(--br-line);
}
.account-grid > div {
  padding: 1.1rem 1.5rem 1.25rem;
  text-align: left !important;
}
.account-grid > div + div {
  border-left: 1px solid var(--br-line);
}
.account-grid p {
  color: var(--br-control-muted, #4e4b45) !important;
  font: 800 0.68rem "Courier New", monospace !important;
  text-transform: uppercase;
}
.account-grid p:not(:first-child) {
  margin-top: 1rem !important;
}
.account-grid .flex {
  justify-content: flex-start !important;
}
.account-grid span {
  overflow-wrap: anywhere;
  color: var(--br-control-text, #141413);
  font-size: 0.95rem !important;
}
.account-grid button {
  border: 0;
  background: transparent;
  color: var(--br-accent) !important;
  font-weight: 800;
  cursor: pointer;
}
.permissions-title {
  margin: 0 !important;
  padding: 1.1rem 1.25rem;
  border-bottom: 1px solid var(--br-line);
  color: var(--br-control-text, #141413);
  font: 900 1.15rem Arial, sans-serif !important;
}
.permissions-grid {
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}
.permission-row {
  min-height: 3.75rem;
  border-right: 1px solid var(--br-line);
  border-bottom: 1px solid var(--br-line);
  padding: 0.75rem 1.25rem;
}
.permission-row > span {
  color: var(--br-control-text, #141413);
  font: 700 0.75rem/1.25 "Courier New", monospace;
}
@media (max-width: 1180px) {
  .settings-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .settings-hero-actions {
    width: 100%;
    grid-template-columns: minmax(8rem, 0.65fr) minmax(19rem, 1.7fr) minmax(13rem, 1fr);
  }
  .settings-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .profile-panel,
  .create-user-panel,
  .users-panel {
    grid-column: 1 !important;
  }
  .profile-panel { grid-row: 1 !important; }
  .create-user-panel { grid-row: 2 !important; }
  .users-panel {
    grid-row: 3 !important;
    max-height: none;
  }
}
@media (max-width: 620px) {
  .settings-view { margin-top: 0 !important; padding: 0.75rem !important; }
  .settings-hero h1 { font-size: clamp(2.7rem, 15vw, 4.2rem); }
  .settings-hero-actions { display: grid; grid-template-columns: 1fr; }
  .text-size-control { min-width: 0; }
  .profile-panel { align-items: flex-start !important; }
  .create-user-panel > .grid,
  .account-grid,
  .permissions-grid { grid-template-columns: 1fr !important; }
  .account-grid > div + div { border-top: 1px solid var(--br-line); border-left: 0; }
  .permission-row { border-right: 0; }
  .detail-profile {
    grid-template-columns: 4.5rem minmax(0, 1fr);
    gap: 0.9rem;
    padding: 1rem;
  }
  .detail-profile > img {
    width: 4.5rem !important;
    height: 4.5rem !important;
  }
  .status-control { padding-inline: 1rem; }
}

@media (min-width: 621px) and (max-width: 900px) {
  .settings-hero-actions {
    grid-template-columns: minmax(8rem, 0.7fr) minmax(18rem, 1.6fr);
  }
  .settings-hero-actions > small {
    grid-column: 1 / -1;
  }
}
</style>
