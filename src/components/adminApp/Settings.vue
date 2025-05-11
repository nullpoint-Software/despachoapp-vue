<template>
  <div class="w-full bg-transparent p-4 lg:p-6 lg:ml-20 mt-20">
    <!-- Bento Grid Container -->
    <div class="grid grid-cols-3 lg:grid-cols-2 grid-rows-3 lg:grid-rows-3 gap-2 m-4 h-full">

      <!-- 0: PERFIL -->
      <div class="bg-white text-black rounded-2xl shadow p-6 flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6
               col-start-1 row-start-1 col-span-2
               lg:col-start-1 lg:row-start-1 lg:col-span-1 lg:row-span-1">
        <div class="relative">
          <img :src="profileImage" alt="Foto de perfil" class="w-24 h-24 rounded-full object-cover" />
          <label for="file-input"
            class="absolute bottom-0 right-0 bg-gray-100 p-2 rounded-full hover:bg-gray-200 cursor-pointer">
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
      </div>

      <!-- 1: BUSCAR Y SELECCIÓN DE USUARIO -->
      <div v-if="isAdmin" class="bg-white text-black rounded-2xl shadow p-6 flex flex-col
               col-start-3 row-start-1 row-span-3
               lg:col-start-2 lg:row-start-1 lg:col-span-1 lg:row-span-3">
        <div class="flex flex-col items-center mb-4">
          <i class="pi pi-users text-3xl"></i>
          <span class="mt-2 text-lg font-semibold">Buscar</span>
        </div>

        <!-- Desktop inline search -->
        <div class="hidden lg:block relative mb-4">
          <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2"></i>
          <input type="text" v-model="searchQuery" placeholder="Escribe nombre..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        <!-- Mobile/tablet: icon opens modal -->
        <div class="lg:hidden flex justify-center mb-4">
          <button @click="showSearchModal = true" class="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
            <i class="pi pi-search text-xl"></i>
          </button>
        </div>

        <div class="overflow-y-auto">
          <template v-for="user in filteredUsers" :key="user.id_usuario">
            <!-- MOBILE: foto, nombre completo y cargo -->
            <div class="flex flex-col items-center lg:hidden cursor-pointer mb-4" @click="abrirModal(user)">
              <img :src="user.imagen ? 'data:image/png;base64,' + user.imagen : defaultAvatar"
                class="w-12 h-12 rounded-full object-cover" />
              <p class="text-sm mt-2 font-semibold text-center">{{ user.nombre + (!user.activo ? " (INACTIVO)" : "")}}</p>
              <p class="text-xs text-gray-500">{{ user.puesto }}</p>
            </div>
            <!-- DESKTOP: full card with delete -->
            <div
              class="hidden lg:flex bg-gray-100 p-4 rounded-xl shadow hover:bg-gray-50 transition items-center space-x-4 mb-4">
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
      </div>

      <!-- 2: AÑADIR NUEVO USUARIO -->
      <div v-if="isAdmin" class="bg-white text-black rounded-2xl shadow p-6
               col-start-1 row-start-2 col-span-2 row-span-2
               lg:col-start-1 lg:row-start-2 lg:col-span-1 lg:row-span-2">
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <i class="pi pi-user-plus mr-2"></i> Añadir nuevo usuario
        </h2>

        <!-- vista previa imagen -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="relative">
            <img :src="newUserPreview || defaultAvatar"
              class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 pi pi-user" />
            <label for="new-file"
              class="absolute bottom-0 right-0 bg-gray-100 p-1 rounded-full hover:bg-gray-200 cursor-pointer">
              <i class="pi pi-camera text-lg"></i>
            </label>
            <input id="new-file" type="file" accept="image/*" @change="onNewFileChange" class="hidden" />
          </div>
          <span class="text-black font-medium">Vista previa</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <!-- Nombre completo -->
          <div class="relative">
            <i class="pi pi-id-card absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.nombre" placeholder="Nombre completo"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2" />
          </div>
          <!-- Correo -->
          <div class="relative">
            <i class="pi pi-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="email" v-model="newUser.email" placeholder="Correo electrónico" :class="[
              'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
              isEmailValid ? 'border-gray-300' : 'border-red-500'
            ]" />
          </div>
          <!-- Teléfono -->
          <div class="relative">
            <i class="pi pi-phone absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.telefono" placeholder="Teléfono" :class="[
              'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
              isPhoneValid ? 'border-gray-300' : 'border-red-500'
            ]" />
          </div>
          <!-- Puesto -->
          <div class="relative">
            <i class="pi pi-tags absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <select v-model="newUser.puesto"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2">
              <option disabled value="">Seleccionar puesto</option>
              <option>Administrador</option>
              <option>Empleado</option>
            </select>
          </div>
          <!-- Username -->
          <div class="relative">
            <i class="pi pi-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input type="text" v-model="newUser.username" placeholder="Nombre de usuario" autocomplete="new-password"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2" />
          </div>
          <!-- Password -->
          <div class="relative flex items-center">
            <i class="pi pi-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input :type="showNewPassword ? 'text' : 'password'" v-model="newUser.password" placeholder="Contraseña" autocomplete="new-password"
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2" />
            <button @click="showNewPassword = !showNewPassword"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
          <!-- Confirmar Password -->
          <div class="relative flex items-center">
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
          class="w-full flex items-center justify-center px-5 py-3 bg-black text-white rounded-2xl hover:bg-gray-800 transition disabled:opacity-50">
          <i class="pi pi-plus-circle mr-2"></i> Crear usuario
        </button>
      </div>
      <p class="font-thin text-gray-400">Compilacion: {{ buildTime ?? "test" }}</p>
    </div>

    <!-- SEARCH MODAL (MOBILE/TABLET) -->
    <transition name="fade-scale">
      <div v-if="showSearchModal" @click.self="showSearchModal = false"
        class="fixed inset-0 z-40 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4">
        <div class="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
          <div class="flex items-center mb-4">
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
        class="fixed user-detail-modal inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4">
        <div
          class="bg-white/95 text-black rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[92vh] p-8 overflow-y-auto  relative">
          <!-- HEADER with delete + close -->
          <div class="flex justify-between items-center border-b pb-4 mb-6 space-x-4">
            <div class="flex-1">
              <h3 class="text-2xl font-bold">Detalles del usuario</h3>
            </div>
            <button @click.stop="confirmDialogVisible = true; userToDelete = usuarioSeleccionado"
              class="text-red-600 hover:text-red-800 mr-4 cursor-pointer" title="Eliminar usuario">
              <i class="pi pi-trash text-2xl"></i>
            </button>
          </div>
          <!-- USER INFO -->
          <div class="flex flex-col items-center mb-2">
            <img :src="usuarioSeleccionado.imagen && usuarioSeleccionado.imagen !== 'null'
              ? 'data:image/png;base64,' + usuarioSeleccionado.imagen
              : defaultAvatar" class="w-28 h-28 rounded-full border-4 border-gray-200 shadow-lg mb-4 object-cover" />
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
          <div class="text-center mb-4">
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
          <div class="flex flex-wrap justify-center gap-12 mb-6">
            <!-- Columna izquierda -->
            <div class="text-center">
              <p class="font-medium mb-2">Nombre de usuario:</p>
              <span class="text-lg block mb-4">{{ usuarioSeleccionado.username }}</span>

              <p class="font-medium mb-2">Password:</p>
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
          <p class="text-xl font-semibold mb-4"><i class="pi pi-shield mr-2"></i>Permisos para el rol "{{
            usuarioSeleccionado.puesto }}"</p>
          <div class="grid grid-cols-2 gap-6 mb-4">
            <div v-for="(value, key) in permissions[usuarioSeleccionado.puesto]" :key="key"
              class="flex items-center justify-between">
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
    <Toast />
  </div>
  <!-- Confirmación para eliminación -->
  <ConfirmDeleteDialog v-if="confirmDialogVisible" :element="'¿Estás seguro de eliminar este usuario permanentemente? Se eliminaran los datos de este usuario y las tareas que se le hayan asignado seran regresadas a estado Disponible.'" @confirm="confirmDelete(userToDelete)"
    @cancel="cancelDelete" />
</template>

<script setup>
import { as, ps, us } from '@/service/adminApp/client'
import { ref, computed, onMounted } from 'vue'
import defaultAvatar from '@/assets/img/user.jpg'
import { PrimeIcons } from '@primevue/core/api';
import { Toast } from 'primevue';
import { useToast } from 'primevue';
import ConfirmDeleteDialog from './ConfirmDeleteDialog.vue';
import { getPermissions, hasPermission, updatePermissions, updateUserPermissions } from '@/service/adminApp/permissionsService';
import router from '@/router';
// SEARCH MODAL STATE
const showSearchModal = ref(false)

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
const toast = useToast();
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

async function onFileChange(e) {
  const f = e.target.files[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      alert(`La imagen no debe superar los ${maxSizeMB}MB.`);
      e.target.value = ""; // Limpia el input
      return;
    }

    profileImage.value = URL.createObjectURL(f);

    const reader = new FileReader();
    reader.onload = async () => {
      const fullDataUrl = reader.result; // data:image/png;base64,...
      const base64Only = fullDataUrl.split(",")[1];
      await updateImage(base64Only);
    };
    reader.readAsDataURL(f);
  }
}
function onNewFileChange(e) {
  const f = e.target.files[0];
  if (f) {
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (f.size > maxSizeBytes) {
      alert(`La imagen no debe superar los ${maxSizeMB}MB.`);
      e.target.value = ""; // Limpia el input si la imagen es demasiado grande
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fullDataUrl = reader.result; // data:image/png;base64,...
      const base64Only = fullDataUrl.split(",")[1];
      newUserPreview.value = fullDataUrl;
      newUser.value.imagen = base64Only;
      console.log("Base64 only:", base64Only);
    };
    reader.readAsDataURL(f);
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
    isDropdown.value = await false;
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
</style>
