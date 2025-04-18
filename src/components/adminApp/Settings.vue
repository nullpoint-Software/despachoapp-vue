<template>
  <div class="w-full h-full bg-transparent p-4 lg:p-6">
    <!-- Bento Grid Container -->
    <div class="grid grid-cols-3 lg:grid-cols-2 grid-rows-3 lg:grid-rows-3 gap-2 m-4 h-full">

      <!-- 0: PERFIL -->
      <div
        class="bg-white text-black rounded-2xl shadow p-6 flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6
               col-start-1 row-start-1 col-span-2
               lg:col-start-1 lg:row-start-1 lg:col-span-1 lg:row-span-1"
      >
        <div class="relative">
          <img :src="profileImage" alt="Foto de perfil" class="w-24 h-24 rounded-full object-cover" />
          <label for="file-input" class="absolute bottom-0 right-0 bg-gray-100 p-2 rounded-full hover:bg-gray-200 cursor-pointer">
            <i class="pi pi-camera text-xl"></i>
          </label>
          <input id="file-input" type="file" accept="image/*" @change="onFileChange" class="hidden" />
        </div>
        <div class="text-center lg:text-left flex-1">
          <input
            type="text"
            v-model="userName"
            class="w-full text-2xl font-semibold border-b border-gray-300 focus:outline-none focus:border-black"
          />
          <p class="text-sm text-gray-500 mt-1">Haz clic para editar tu nombre</p>
        </div>
      </div>

      <!-- 1: BUSCAR Y SELECCIÓN DE USUARIO -->
      <div
        class="bg-white text-black rounded-2xl shadow p-6 flex flex-col
               col-start-3 row-start-1 row-span-3
               lg:col-start-2 lg:row-start-1 lg:col-span-1 lg:row-span-3"
      >
        <div class="flex flex-col items-center mb-4">
          <i class="pi pi-users text-3xl"></i>
          <span class="mt-2 text-lg font-semibold">Buscar</span>
        </div>

        <!-- Desktop inline search -->
        <div class="hidden lg:block relative mb-4">
          <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2"></i>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Escribe nombre..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
          />
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
            <div
              class="flex flex-col items-center lg:hidden cursor-pointer mb-4"
              @click="abrirModal(user)"
            >
              <img :src="user.imagen" class="w-12 h-12 rounded-full object-cover" />
              <p class="text-sm mt-2 font-semibold">{{ user.nombre }}</p>
              <p class="text-xs text-gray-500">{{ user.puesto }}</p>
            </div>
            <!-- DESKTOP: full card with delete -->
            <div
              class="hidden lg:flex bg-gray-100 p-4 rounded-xl shadow hover:bg-gray-50 transition items-center space-x-4 mb-4"
            >
              <img :src="user.imagen" class="w-10 h-10 rounded-full object-cover" />
              <div class="flex-1 cursor-pointer" @click="abrirModal(user)">
                <p class="font-semibold">{{ user.nombre }}</p>
                <p class="text-sm text-gray-500">{{ user.puesto }}</p>
              </div>
              <button @click.stop="deleteUser(user)" class="text-red-500 hover:text-red-700 px-2">
                <i class="pi pi-trash text-lg"></i>
              </button>
              <i class="pi pi-chevron-right text-gray-400 cursor-pointer" @click="abrirModal(user)"></i>
            </div>
          </template>
        </div>
      </div>

      <!-- 2: AÑADIR NUEVO USUARIO -->
      <div
        class="bg-white text-black rounded-2xl shadow p-6
               col-start-1 row-start-2 col-span-2 row-span-2
               lg:col-start-1 lg:row-start-2 lg:col-span-1 lg:row-span-2"
      >
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <i class="pi pi-user-plus mr-2"></i> Añadir nuevo usuario
        </h2>

        <!-- vista previa imagen -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="relative">
            <img
              :src="newUserPreview || defaultAvatar"
              class="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
            <label for="new-file" class="absolute bottom-0 right-0 bg-gray-100 p-1 rounded-full hover:bg-gray-200 cursor-pointer">
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
            <input
              type="text"
              v-model="newUser.nombre"
              placeholder="Nombre completo"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
            />
          </div>
          <!-- Correo -->
          <div class="relative">
            <i class="pi pi-envelope absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input
              type="email"
              v-model="newUser.email"
              placeholder="Correo electrónico"
              :class="[
                'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
                isEmailValid ? 'border-gray-300' : 'border-red-500'
              ]"
            />
          </div>
          <!-- Teléfono -->
          <div class="relative">
            <i class="pi pi-phone absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input
              type="text"
              v-model="newUser.telefono"
              placeholder="Teléfono"
              :class="[
                'w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2',
                isPhoneValid ? 'border-gray-300' : 'border-red-500'
              ]"
            />
          </div>
          <!-- Puesto -->
          <div class="relative">
            <i class="pi pi-tags absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <select
              v-model="newUser.puesto"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
            >
              <option disabled value="">Seleccionar puesto</option>
              <option>Administrador</option>
              <option>Empleado</option>
            </select>
          </div>
          <!-- Username -->
          <div class="relative">
            <i class="pi pi-user absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input
              type="text"
              v-model="newUser.username"
              placeholder="Username"
              class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
            />
          </div>
          <!-- Password -->
          <div class="relative flex items-center">
            <i class="pi pi-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input
              :type="showNewPassword ? 'text' : 'password'"
              v-model="newUser.password"
              placeholder="Password"
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2"
            />
            <button @click="showNewPassword = !showNewPassword" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
          <!-- Confirmar Password -->
          <div class="relative flex items-center">
            <i class="pi pi-key absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"></i>
            <input
              :type="showConfirmPassword ? 'text' : 'password'"
              v-model="newUser.confirmPassword"
              placeholder="Confirmar password"
              class="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2"
            />
            <button @click="showConfirmPassword = !showConfirmPassword" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
          </div>
        </div>

        <button
          @click="createUser"
          :disabled="!canCreateUser"
          class="w-full flex items-center justify-center px-5 py-3 bg-black text-white rounded-2xl hover:bg-gray-800 transition disabled:opacity-50"
        >
          <i class="pi pi-plus-circle mr-2"></i> Crear usuario
        </button>
      </div>
    </div>

    <!-- SEARCH MODAL (MOBILE/TABLET) -->
    <transition name="fade-scale">
      <div
        v-if="showSearchModal"
        @click.self="showSearchModal = false"
        class="fixed inset-0 z-40 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4"
      >
        <div class="bg-white rounded-xl shadow-lg w-full max-w-sm p-4">
          <div class="flex items-center mb-4">
            <i class="pi pi-search text-xl mr-2 text-black"></i>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Buscar usuario..."
              class="flex-1 py-2 border-b border-gray-300 focus:outline-none text-black"
            />
          </div>
          <div class="space-y-3 max-h-64 overflow-y-auto">
            <div
              v-for="user in filteredUsers"
              :key="user.id_usuario"
              class="flex items-center space-x-3 p-2 rounded hover:bg-gray-100 cursor-pointer"
              @click="openFromSearch(user)"
            >
              <img :src="user.imagen" class="w-8 h-8 rounded-full object-cover" />
              <div>
                <p class="font-semibold text-sm text-black">{{ user.nombre }}</p>
                <p class="text-xs text-gray-500">{{ user.puesto }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- USER DETAILS MODAL -->
    <transition name="fade-scale">
      <div
        v-if="modalAbierto"
        @click.self="modalAbierto = false"
        class="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4"
      >
        <div
          class="bg-white/95 text-black rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl p-8 overflow-auto relative"
        >
          <!-- HEADER with delete + close -->
          <div class="flex justify-between items-center border-b pb-4 mb-6 space-x-4">
            <div class="flex-1">
              <h3 class="text-2xl font-bold">Detalles del usuario</h3>
            </div>
            <button
              @click="deleteUser(usuarioSeleccionado); modalAbierto=false"
              class="text-red-600 hover:text-red-800 mr-4"
              title="Eliminar usuario"
            >
              <i class="pi pi-trash text-2xl"></i>
            </button>
          </div>
          <!-- USER INFO -->
          <div class="flex flex-col items-center mb-6">
            <img
              :src="usuarioSeleccionado.imagen"
              class="w-28 h-28 rounded-full border-4 border-gray-200 shadow-lg mb-4 object-cover"
            />
            <h4 class="text-xl font-semibold">{{ usuarioSeleccionado.nombre }}</h4>
            <p class="text-sm text-gray-500">{{ usuarioSeleccionado.puesto }}</p>
          </div>
          <!-- PASSWORD -->
          <div class="mb-6 w-full text-center">
            <p class="font-medium mb-2">Password:</p>
            <div class="flex items-center justify-center">
              <span class="mr-2 text-lg">{{ passwordVisible ? usuarioSeleccionado.password : '••••••••' }}</span>
              <button
                @click="verPassword"
                class="text-blue-600 hover:underline text-sm focus:outline-none"
              >
                Ver
              </button>
            </div>
          </div>
          <!-- PERMISOS in two columns -->
          <p class="text-xl font-semibold mb-4"><i class="pi pi-shield mr-2"></i>Permisos</p>
          <div class="grid grid-cols-2 gap-6 mb-4">
            <div
              v-for="(value, key) in permissions[usuarioSeleccionado.puesto]"
              :key="key"
              class="flex items-center justify-between"
            >
              <span class="capitalize text-sm">{{ traducirPermiso(key) }}</span>
              <button
                @click="togglePermission(usuarioSeleccionado.puesto, key)"
                :class="value ? 'bg-blue-600' : 'bg-gray-300'"
                class="w-10 h-5 rounded-full relative transition-colors"
              >
                <span
                  class="block w-5 h-5 bg-white rounded-full transform transition-transform duration-200"
                  :class="value ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// PERFIL
const userName = ref('Nombre de Usuario')
const profileImage = ref('https://i.pravatar.cc/120')
function onFileChange(e) {
  const f = e.target.files[0]
  if (f) profileImage.value = URL.createObjectURL(f)
}

// USUARIOS
const usuarios = ref([
  {
    id_usuario: crypto.randomUUID(),
    nombre: 'Juan Pérez',
    email: 'juan@x.com',
    telefono: '5551234',
    imagen: 'https://i.pravatar.cc/150?img=3',
    puesto: 'Administrador',
    fecha_registro: new Date().toISOString(),
    username: 'juanp',
    password: 'SeCrEt123'
  },
  {
    id_usuario: crypto.randomUUID(),
    nombre: 'Ana López',
    email: 'ana@x.com',
    telefono: null,
    imagen: 'https://i.pravatar.cc/150?img=5',
    puesto: 'Empleado',
    fecha_registro: new Date().toISOString(),
    username: 'analo',
    password: 'Pa$$w0rd'
  }
])
const searchQuery = ref('')
const filteredUsers = computed(() =>
  usuarios.value.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

// SEARCH MODAL STATE
const showSearchModal = ref(false)

// USER DETAILS MODAL
const modalAbierto = ref(false)
const usuarioSeleccionado = ref({})
const passwordVisible = ref(false)
// -------------- CONTRASEÑA MAESTRA --------------
const MASTER_PASSWORD = 'Hanekawa'
// -------------- FIN CONTRASEÑA MAESTRA --------------

function abrirModal(u) {
  usuarioSeleccionado.value = u
  passwordVisible.value = false
  modalAbierto.value = true
}
function openFromSearch(u) {
  abrirModal(u)
  showSearchModal.value = false
}
function verPassword() {
  const entrada = prompt('Ingresa la contraseña maestra:')
  if (entrada === MASTER_PASSWORD) {
    passwordVisible.value = true
  } else {
    alert('Contraseña maestra incorrecta')
  }
}

// DELETE USER
function deleteUser(u) {
  usuarios.value = usuarios.value.filter(x => x.id_usuario !== u.id_usuario)
}

// PERMISOS JSON
const permissions = ref({
  Administrador: {
    canMoveAllCards: true,
    canEditCard: true,
    canDeleteCard: true,
    canAddCliente: true,
    canEditCliente: true,
    canDeleteCliente: true
  },
  Empleado: {
    canMoveAllCards: false,
    canMoveOwnCard: false,
    canMoveAvailableCard: true,
    canEditCard: true,
    canDeleteCard: false,
    canAddCliente: true,
    canEditCliente: false,
    canDeleteCliente: false
  }
})
function togglePermission(role, key) {
  permissions.value[role][key] = !permissions.value[role][key]
}
function traducirPermiso(k) {
  const map = {
    canMoveAllCards: 'Puede mover todas las tarjetas',
    canMoveOwnCard: 'Puede mover sus tarjetas',
    canMoveAvailableCard: 'Puede mover tarjetas disponibles',
    canEditCard: 'Puede editar tarjeta',
    canDeleteCard: 'Puede eliminar tarjeta',
    canAddCliente: 'Puede agregar cliente',
    canEditCliente: 'Puede editar cliente',
    canDeleteCliente: 'Puede eliminar cliente'
  }
  return map[k] || k
}

// CREAR USUARIO
const defaultAvatar = 'https://i.pravatar.cc/150?img=12'
const newUser = ref({
  nombre: '',
  email: '',
  telefono: '',
  username: '',
  puesto: '',
  password: '',
  confirmPassword: ''
})
const newUserPreview = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

function onNewFileChange(e) {
  const f = e.target.files[0]
  if (f) {
    const reader = new FileReader()
    reader.onload = () => (newUserPreview.value = reader.result)
    reader.readAsDataURL(f)
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

function createUser() {
  if (!canCreateUser.value) return
  usuarios.value.push({
    ...newUser.value,
    id_usuario: crypto.randomUUID(),
    fecha_registro: new Date().toISOString(),
    imagen: newUserPreview.value || defaultAvatar
  })
  Object.assign(newUser.value, {
    nombre: '',
    email: '',
    telefono: '',
    username: '',
    puesto: '',
    password: '',
    confirmPassword: ''
  })
  newUserPreview.value = ''
}
</script>

<style scoped>
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
