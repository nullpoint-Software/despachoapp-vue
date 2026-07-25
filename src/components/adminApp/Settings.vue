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
          <button type="button" class="profile-password-button" @click="changeOwnPassword">
            <i class="pi pi-lock"></i>
            <span>Cambiar contraseña</span>
          </button>
        </div>
      </section>

      <section class="settings-panel passkey-panel bg-white text-black rounded-2xl shadow p-6
               col-start-1 row-start-3 col-span-2
               lg:col-start-1 lg:row-start-3 lg:col-span-1">
        <div class="passkey-panel__header">
          <div>
            <p>ACCESO SEGURO</p>
            <h2><i class="pi pi-shield mr-2"></i> Passkeys</h2>
          </div>
          <button type="button" class="passkey-add-button" :disabled="passkeyBusy || !passkeySupported"
            @click="addPasskey">
            <i class="pi pi-plus"></i>
            <span>Agregar passkey</span>
          </button>
        </div>
        <p class="passkey-panel__status" :class="{ unavailable: !passkeySupported }">
          {{ passkeyStatusLabel }}
        </p>
        <div class="passkey-list">
          <div v-if="passkeysLoading" class="passkey-empty">Cargando passkeys...</div>
          <div v-else-if="!passkeys.length" class="passkey-empty">Sin passkeys registradas.</div>
          <template v-else>
            <article v-for="passkey in passkeys" :key="passkey.id" class="passkey-row">
              <div>
                <strong>{{ passkey.name }}</strong>
                <span>{{ formatPasskeyDate(passkey.createdAt) }}</span>
              </div>
              <button type="button" aria-label="Eliminar passkey" title="Eliminar passkey"
                :disabled="passkeyBusy" @click="removePasskey(passkey)">
                <i class="pi pi-trash"></i>
              </button>
            </article>
          </template>
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
               col-start-1 row-start-2 col-span-2
               lg:col-start-1 lg:row-start-2 lg:col-span-1">
        <h2 class="text-xl font-semibold mb-4 flex items-center">
          <i class="pi pi-user-plus mr-2"></i> Añadir nuevo usuario
        </h2>

        <div class="create-user-launch">
          <div class="create-user-launch__mark"><i class="pi pi-user-plus" aria-hidden="true"></i></div>
          <div>
            <strong>Alta guiada del equipo</strong>
            <p>Completa identidad, contacto y acceso en tres pasos breves.</p>
          </div>
          <button type="button" class="create-user-button" @click="openCreateUserModal">
            Comenzar registro <i class="pi pi-arrow-right"></i>
          </button>
        </div>

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

    <!-- CREATE USER / STEPPED MODAL -->
    <transition name="fade-scale">
      <div v-if="showCreateUserModal" class="user-wizard-overlay" @click.self="closeCreateUserModal">
        <section class="user-wizard" role="dialog" aria-modal="true" aria-labelledby="user-wizard-title">
          <header>
            <div>
              <p>CUENTA / NUEVO USUARIO</p>
              <h2 id="user-wizard-title">{{ wizardTitles[createUserStep - 1] }}</h2>
            </div>
            <button type="button" aria-label="Cerrar" @click="closeCreateUserModal">×</button>
          </header>

          <nav class="wizard-progress" aria-label="Progreso del registro">
            <button v-for="(title, index) in wizardTitles" :key="title" type="button"
              :class="{ active: createUserStep === index + 1, complete: createUserStep > index + 1 }"
              :disabled="index + 1 > createUserStep" @click="createUserStep = index + 1">
              <b>{{ String(index + 1).padStart(2, '0') }}</b><span>{{ title }}</span>
            </button>
          </nav>

          <div class="wizard-body">
            <div v-if="createUserStep === 1" class="wizard-step identity-step">
              <div class="wizard-avatar">
                <div class="wizard-avatar__header">
                  <span>IMAGEN / 01</span>
                  <small>{{ newUserPreview ? 'VISTA PREVIA LISTA' : 'FOTO OPCIONAL' }}</small>
                </div>
                <div class="wizard-avatar__frame">
                  <img :src="newUserPreview || defaultAvatar" alt="Vista previa del nuevo usuario" />
                  <span class="wizard-avatar__scan" aria-hidden="true"></span>
                  <label for="wizard-user-photo" class="wizard-avatar__camera" aria-label="Seleccionar foto de perfil">
                    <i class="pi pi-camera"></i>
                  </label>
                </div>
                <label for="wizard-user-photo" class="wizard-avatar__upload">
                  <span><b>{{ newUserPreview ? 'Cambiar imagen' : 'Elegir imagen' }}</b><small>JPG o PNG · máximo 5 MB</small></span>
                  <i class="pi pi-arrow-up-right"></i>
                </label>
                <input id="wizard-user-photo" type="file" accept="image/*" hidden @change="onNewFileChange" />
              </div>
              <div class="wizard-fields">
                <label class="wizard-field wizard-field--wide"><span>Nombre completo</span><input v-model.trim="newUser.nombre" type="text" placeholder="Nombre y apellidos" /></label>
                <label class="wizard-field"><span>Teléfono</span><input :value="newUser.telefono" type="tel" inputmode="numeric" placeholder="317 878 1234" maxlength="12" @input="formatNewUserPhone" /><small>10 dígitos, con formato automático.</small></label>
                <label class="wizard-field"><span>Puesto</span><select v-model="newUser.puesto"><option disabled value="">Selecciona un puesto</option><option>Administrador</option><option>Empleado</option></select></label>
                <div class="wizard-field wizard-field--wide">
                  <span>Correo electrónico</span>
                  <div class="email-builder">
                    <input v-model.trim="emailLocalPart" type="text" placeholder="nombre.apellido" aria-label="Usuario del correo" autocomplete="email" @paste="handleEmailPaste" />
                    <b>@</b>
                    <select v-model="emailDomainChoice" aria-label="Dominio del correo">
                      <option v-for="domain in emailDomainOptions" :key="domain" :value="domain">{{ domain }}</option>
                      <option :value="customEmailDomainValue">Otro dominio...</option>
                    </select>
                  </div>
                  <input v-if="emailDomainChoice === customEmailDomainValue" v-model.trim="emailDomain" class="email-custom-domain" type="text" placeholder="dominio.com" aria-label="Dominio personalizado" @paste="handleEmailPaste" />
                  <small>{{ newUser.email || 'Pega un correo completo o escribe un dominio personalizado.' }}</small>
                </div>
              </div>
            </div>

            <div v-else-if="createUserStep === 2" class="wizard-step access-step">
              <div class="access-intro"><i class="pi pi-key"></i><div><strong>Credenciales de acceso</strong><p>Usa una contraseña exclusiva para esta cuenta.</p></div></div>
              <label class="wizard-field"><span>Nombre de usuario</span><input v-model.trim="newUser.username" type="text" autocomplete="off" placeholder="usuario" /></label>
              <label class="wizard-field password-field"><span>Contraseña</span><div><input v-model="newUser.password" :type="showNewPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Mínimo 8 caracteres" /><button type="button" :aria-label="showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="showNewPassword = !showNewPassword"><i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i></button></div></label>
              <div class="password-strength" :data-level="passwordStrength.level"><div><span v-for="index in 4" :key="index" :class="{ filled: index <= passwordStrength.bars }"></span></div><p><b>{{ passwordStrength.label }}</b><small>{{ passwordStrength.hint }}</small></p></div>
              <label class="wizard-field password-field"><span>Confirmar contraseña</span><div><input v-model="newUser.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Repite la contraseña" /><button type="button" :aria-label="showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'" @click="showConfirmPassword = !showConfirmPassword"><i :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"></i></button></div><small :class="{ valid: isPasswordMatch }">{{ newUser.confirmPassword ? (isPasswordMatch ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.') : 'Confirma la contraseña.' }}</small></label>
            </div>

            <div v-else class="wizard-step review-step">
              <div class="review-identity"><img :src="newUserPreview || defaultAvatar" alt="Nuevo usuario" /><div><span>LISTO PARA CREAR</span><h3>{{ newUser.nombre }}</h3><p>{{ newUser.puesto }}</p></div></div>
              <dl><div><dt>Correo</dt><dd>{{ newUser.email }}</dd></div><div><dt>Teléfono</dt><dd>{{ newUser.telefono }}</dd></div><div><dt>Usuario</dt><dd>{{ newUser.username }}</dd></div><div><dt>Seguridad</dt><dd>{{ passwordStrength.label }}</dd></div></dl>
              <p class="review-note"><i class="pi pi-info-circle"></i> La contraseña se enviará cifrada y no aparecerá en esta confirmación.</p>
            </div>
          </div>

          <footer>
            <button v-if="createUserStep > 1" type="button" class="wizard-secondary" @click="createUserStep--"><i class="pi pi-arrow-left"></i> Anterior</button>
            <span v-else></span>
            <button v-if="createUserStep < 3" type="button" class="wizard-primary" :disabled="!canContinueCreateUser" @click="createUserStep++">Continuar <i class="pi pi-arrow-right"></i></button>
            <button v-else type="button" class="wizard-primary" :disabled="!canCreateUser || creatingUser" @click="createUser"><i class="pi pi-user-plus"></i> {{ creatingUser ? 'Creando…' : 'Crear usuario' }}</button>
          </footer>
        </section>
      </div>
    </transition>

    <!-- USER DETAILS MODAL -->
    <transition name="fade-scale">
      <div v-if="modalAbierto" @click.self="modalAbierto = false; isDropdown = false"
        class="modal-overlay fixed user-detail-modal inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm p-4">
        <div
          class="modal-content bg-white/95 text-black rounded-3xl shadow-2xl border border-gray-200 w-full max-w-xl max-h-[92vh] p-8 overflow-y-auto relative">
          <!-- HEADER with delete + close -->
          <header class="settings-detail-header">
            <div>
              <p>CUENTA / EQUIPO</p>
              <h3 class="text-2xl font-bold">Detalles del usuario</h3>
            </div>
            <div class="detail-header-actions">
              <button type="button" class="detail-delete-button"
                @click.stop="confirmDialogVisible = true; userToDelete = usuarioSeleccionado">
                <i class="pi pi-trash"></i><span>Eliminar</span>
              </button>
              <button type="button" class="detail-close-button" aria-label="Cerrar detalles del usuario"
                @click="modalAbierto=false;isDropdown=false">×</button>
            </div>
          </header>
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
            <span class="font-semibold block mb-2">{{ usuarioSeleccionado.activo ? 'Cuenta activa' : 'Cuenta inactiva' }}</span>
            <button @click="usuarioSeleccionado.activo = !usuarioSeleccionado.activo; updateUserStatus(usuarioSeleccionado)"
              :class="usuarioSeleccionado.activo ? 'bg-blue-600' : 'bg-gray-300'"
              class="w-10 h-5 rounded-full relative transition-colors duration-200">
              <span
                class="cursor-pointer block w-5 h-5 bg-white drop-shadow-lg outline-2 outline-white -outline-offset-1 rounded-full transform transition-transform duration-200"
                :class="usuarioSeleccionado.activo ? 'translate-x-5' : 'translate-x-0'">
              </span>
            </button>
          </div>
          <!-- Datos de acceso y contacto -->
          <section class="account-grid" aria-label="Datos de acceso y contacto">
            <div class="account-grid__heading">
              <div><span>FICHA / 02</span><h4>Acceso y contacto</h4></div>
              <small>Información protegida de la cuenta</small>
            </div>
            <article class="account-item account-item--actions">
              <i class="pi pi-id-card"></i>
              <div><small>Nombre completo</small><strong>{{ usuarioSeleccionado.nombre }}</strong></div>
              <button type="button" aria-label="Editar nombre" title="Editar nombre"
                @click="editSelectedUserField('nombre', 'Nombre completo')">
                <i class="pi pi-pencil"></i>
              </button>
            </article>
            <article class="account-item">
              <i class="pi pi-user"></i>
              <div><small>Nombre de usuario</small><strong>{{ usuarioSeleccionado.username }}</strong></div>
              <button type="button" aria-label="Editar usuario" title="Editar usuario"
                @click="editSelectedUserField('username', 'Nombre de usuario')">
                <i class="pi pi-pencil"></i>
              </button>
            </article>
            <article class="account-item">
              <i class="pi pi-envelope"></i>
              <div><small>Correo electrónico</small><strong>{{ usuarioSeleccionado.email || 'Sin registrar' }}</strong></div>
              <button type="button" aria-label="Editar correo" title="Editar correo"
                @click="editSelectedUserField('email', 'Correo electrónico')">
                <i class="pi pi-pencil"></i>
              </button>
            </article>
            <article class="account-item account-item--password">
              <i class="pi pi-key"></i>
              <div><small>Contraseña</small><strong>{{ passwordVisible ? usuarioSeleccionado.password : '••••••••' }}</strong></div>
              <div class="account-actions">
                <button type="button" :disabled="passwordRevealBusy" @click="verPassword" :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Ver contraseña'">
                  <i :class="passwordRevealBusy ? 'pi pi-spin pi-spinner' : (passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye')"></i><span>{{ passwordVisible ? 'Ocultar' : 'Mostrar' }}</span>
                </button>
                <button type="button" @click="changeSelectedUserPassword" aria-label="Cambiar contraseña">
                  <i class="pi pi-lock"></i><span>Cambiar</span>
                </button>
              </div>
              <div v-if="isAdmin" class="password-more-menu" @click.stop>
                <button type="button" class="password-more-trigger" aria-label="Más opciones de contraseña"
                  @click="passwordResetMenuOpen = !passwordResetMenuOpen">
                  <i class="pi pi-ellipsis-v"></i>
                </button>
                <div v-if="passwordResetMenuOpen" class="password-more-dropdown">
                  <button type="button" :disabled="passwordResetBusy" @click="generatePasswordResetLink">
                    <i class="pi pi-link"></i><span>{{ passwordResetBusy ? 'Generando…' : 'Generar enlace' }}</span>
                  </button>
                  <button type="button" :disabled="passwordResetBusy || !usuarioSeleccionado?.email" @click="sendPasswordResetEmail">
                    <i class="pi pi-envelope"></i><span>{{ passwordResetBusy ? 'Enviando…' : 'Enviar correo' }}</span>
                  </button>
                </div>
              </div>
            </article>
            <article class="account-item">
              <i class="pi pi-phone"></i>
              <div><small>Teléfono</small><strong>{{ formatPhoneValue(usuarioSeleccionado.telefono) || 'Sin registrar' }}</strong></div>
              <button type="button" aria-label="Editar teléfono" title="Editar teléfono"
                @click="editSelectedUserField('telefono', 'Teléfono')">
                <i class="pi pi-pencil"></i>
              </button>
            </article>
          </section>
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
import { as, pks, us } from '@/service/adminApp/client'
import { ref, computed, onMounted, watch } from 'vue'
import defaultAvatar from '@/assets/img/user.jpg'
import imageCompression from "browser-image-compression"; 
import { useAppToast } from '@/composables/useAppToast';
import { useAppDialog } from '@/composables/useAppDialog';
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
const passwordRevealBusy = ref(false)
const passwordResetMenuOpen = ref(false)
const passwordResetBusy = ref(false)
const generatedResetLink = ref("")

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

const passkeys = ref([]);
const passkeysLoading = ref(false);
const passkeyBusy = ref(false);
const passkeySupported = ref(false);
const platformPasskeyAvailable = ref(false);
const passkeyStatusLabel = computed(() => {
  if (!passkeySupported.value) return "Este navegador no tiene passkeys disponibles.";
  if (!platformPasskeyAvailable.value) return "Passkeys disponibles con autenticadores externos.";
  return "Listo para usar huella, rostro o Windows Hello.";
});

async function loadPasskeys() {
  passkeysLoading.value = true;
  try {
    passkeys.value = await pks.getPasskeys();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Sin passkeys', detail: error?.response?.data?.error || 'No se pudieron cargar tus passkeys.', life: 3500 });
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
    message: 'Ponle un nombre reconocible a este dispositivo.',
    inputLabel: 'Nombre',
    inputType: 'text',
    placeholder: 'Laptop principal',
    confirmLabel: 'Crear passkey',
  });
  if (name === null) return;
  passkeyBusy.value = true;
  try {
    await pks.register(name || undefined);
    await loadPasskeys();
    toast.add({ severity: 'success', summary: 'Passkey lista', detail: 'Ya puedes verificar datos protegidos con este dispositivo.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No registrada', detail: error?.response?.data?.error || 'No fue posible registrar la passkey.', life: 4000 });
  } finally {
    passkeyBusy.value = false;
  }
}

async function removePasskey(passkey) {
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
    toast.add({ severity: 'error', summary: 'No eliminada', detail: error?.response?.data?.error || 'No fue posible eliminar la passkey.', life: 3500 });
  } finally {
    passkeyBusy.value = false;
  }
}

function formatPasskeyDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

onMounted(setupPasskeys);

// USUARIOS
const usuarios = ref(await us.getUsuarios())
const currentUserId = String(localStorage.getItem("userid") || "")

const searchQuery = ref('')
const filteredUsers = computed(() =>
  usuarios.value.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

// -------------- CONTRASEÑA MAESTRA --------------
// -------------- FIN CONTRASEÑA MAESTRA --------------

function abrirModal(u) {
  usuarioSeleccionado.value = u
  passwordVisible.value = false
  passwordRevealBusy.value = false
  generatedResetLink.value = ""
  passwordResetMenuOpen.value = false
  modalAbierto.value = true
  selectedLevel.value = u.puesto;
}
function openFromSearch(u) {
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
    toast.add({ severity: 'error', summary: 'Verificación rechazada', detail: error?.response?.data?.error || 'No fue posible verificar tu identidad.', life: 4000 })
  } finally {
    passwordRevealBusy.value = false
  }
}

function isSelectedUserSelf() {
  return String(usuarioSeleccionado.value?.id_usuario || '') === currentUserId;
}

function syncSelectedUserPatch(patch) {
  if (!usuarioSeleccionado.value) return;
  usuarioSeleccionado.value = { ...usuarioSeleccionado.value, ...patch };
  const index = usuarios.value.findIndex((user) => user.id_usuario === usuarioSeleccionado.value.id_usuario);
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

async function editSelectedUserField(field, label) {
  if (!usuarioSeleccionado.value) return;
  const currentValue = usuarioSeleccionado.value[field] || "";
  const value = await promptDialog({
    title: `Editar ${label.toLowerCase()}`,
    message: `Actualiza ${label.toLowerCase()} para esta cuenta.`,
    inputLabel: label,
    inputType: 'text',
    placeholder: String(currentValue || label),
    confirmLabel: 'Guardar',
  });
  if (value === null) return;
  try {
    await us.editUsuario(usuarioSeleccionado.value.id_usuario, { [field]: value });
    syncSelectedUserPatch({ [field]: value });
    toast.add({ severity: 'success', summary: 'Usuario actualizado', detail: `${label} guardado correctamente.`, life: 2500 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No guardado', detail: error?.response?.data?.error || 'No se pudo actualizar el usuario.', life: 3500 });
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
    toast.add({ severity: 'error', summary: 'No guardada', detail: error?.response?.data?.error || 'No se pudo cambiar la contraseña.', life: 3500 });
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
    toast.add({ severity: 'error', summary: 'No guardada', detail: error?.response?.data?.error || 'No se pudo cambiar tu contraseña.', life: 3500 });
  }
}

async function copyText(value) {
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
      detail: error?.response?.data?.error || "No fue posible generar el enlace.",
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
      detail: error?.response?.data?.error || "No fue posible enviar el correo.",
      life: 4000,
    });
  } finally {
    passwordResetBusy.value = false;
    passwordResetMenuOpen.value = false;
  }
}

// DELETE USER
async function deleteUser(u) {
  try {
    usuarios.value = usuarios.value.filter(x => x.id_usuario !== u.id_usuario)
    if (u.id_usuario == localStorage.getItem("userid")) { //si se intenta eliminar a uno mismo xd
      await us.deleteUsuario(u.id_usuario)
      localStorage.clear()
      router.push("/")
    } else {
      await us.deleteUsuario(u.id_usuario)
      window.location.reload();
    }

  } catch (error) {
    toast.add({ severity: "error", summary: "Error", detail: error?.response?.data?.error || "No se pudo eliminar el usuario.", life: 3500 });
  }

}

async function updateName(u) {
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

async function updateUserStatus(u){
  try {
    await us.editUsuario(u.id_usuario,{activo: u.activo})
  } catch (error) {
    toast.add({ severity: "error", summary: "Error", detail: error?.response?.data?.error || "No se pudo actualizar el estado.", life: 3000 });
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

function formatNewUserPhone(event) {
  newUser.value.telefono = formatPhoneValue(event.target.value)
}

function parseEmailParts(value = '') {
  const match = String(value)
    .trim()
    .match(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/i)
  if (!match) return null
  return {
    local: match[1].replace(/\s+/g, ''),
    domain: match[2].replace(/^@+/, '').toLowerCase(),
  }
}

function applyEmailParts(value = '') {
  const parsed = parseEmailParts(value)
  if (!parsed) return false
  emailLocalPart.value = parsed.local
  emailDomain.value = parsed.domain
  emailDomainChoice.value = emailDomainOptions.includes(parsed.domain) ? parsed.domain : customEmailDomainValue
  newUser.value.email = `${parsed.local}@${parsed.domain}`
  return true
}

function handleEmailPaste(event) {
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
      toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: `La imagen no debe superar los ${maxSizeMB} MB.`, life: 3500 });
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
      toast.add({ severity: 'warn', summary: 'Imagen demasiado grande', detail: `La imagen no debe superar los ${maxSizeMB} MB.`, life: 3500 });
      e.target.value = "";
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

const updateLevel = async (level) => {
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
      detail: error?.response?.data?.error || 'Revisa los datos e inténtalo de nuevo.',
      life: 4000,
    })
  } finally {
    creatingUser.value = false
  }
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
  background: transparent;
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
  grid-template-rows: auto auto auto !important;
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
.profile-password-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.8rem;
  margin-top: 1rem;
  border: 1px solid var(--br-accent);
  border-radius: 0;
  background: transparent;
  color: var(--br-accent);
  padding: 0.65rem 0.9rem;
  font: 800 0.72rem "Courier New", monospace;
  text-transform: uppercase;
  cursor: pointer;
}
.profile-password-button:hover {
  background: var(--br-accent);
  color: var(--br-accent-text);
}
.create-user-panel {
  grid-column: 1 !important;
  grid-row: 2 !important;
  padding: 1.35rem !important;
}
.passkey-panel {
  grid-column: 1 !important;
  grid-row: 3 !important;
  display: flex;
  min-height: 13rem;
  flex-direction: column;
  gap: 1rem;
  padding: 1.35rem !important;
}
.passkey-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.passkey-panel__header p {
  margin: 0 0 0.35rem;
  color: var(--br-accent);
  font: 800 0.68rem "Courier New", monospace;
  letter-spacing: 0.1em;
}
.passkey-panel__header h2 {
  margin: 0;
  color: var(--br-text);
  font: 900 clamp(1.35rem, 3vw, 2rem)/1 Arial, sans-serif;
  letter-spacing: -0.035em;
  text-transform: uppercase;
}
.passkey-panel__header h2 i {
  color: var(--br-accent);
}
.passkey-add-button {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid var(--br-accent);
  border-radius: 0;
  background: var(--br-accent);
  color: var(--br-accent-text);
  padding: 0 0.85rem;
  font: 800 0.72rem "Courier New", monospace;
  text-transform: uppercase;
}
.passkey-add-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.passkey-panel__status {
  margin: 0;
  border-top: 1px solid var(--br-line);
  border-bottom: 1px solid var(--br-line);
  padding: 0.75rem 0;
  color: var(--br-muted);
  font: 800 0.72rem/1.35 "Courier New", monospace;
  text-transform: uppercase;
}
.passkey-panel__status.unavailable {
  color: #ef4d3d;
}
.passkey-list {
  display: grid;
  gap: 0.65rem;
}
.passkey-empty,
.passkey-row {
  border: 1px solid var(--br-line);
  background: var(--br-panel-2);
  padding: 0.75rem;
}
.passkey-empty {
  color: var(--br-muted);
  font: 800 0.72rem "Courier New", monospace;
  text-transform: uppercase;
}
.passkey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.passkey-row strong {
  display: block;
  color: var(--br-text);
  font: 900 0.95rem/1.2 Arial, sans-serif;
}
.passkey-row span {
  display: block;
  margin-top: 0.25rem;
  color: var(--br-muted);
  font: 800 0.68rem "Courier New", monospace;
  text-transform: uppercase;
}
.passkey-row button {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  background: transparent;
  color: #ef4d3d;
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

.create-user-launch {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 1.25rem;
  min-height: 9rem;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
  padding: 1.25rem;
}
.create-user-launch__mark {
  display: grid;
  width: 4.5rem;
  height: 4.5rem;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  background: var(--br-control);
  color: var(--br-accent);
  font-size: 1.6rem;
}
.create-user-launch strong {
  display: block;
  color: var(--br-control-text);
  font: 900 1.05rem Arial, sans-serif;
}
.create-user-launch p {
  max-width: 36rem;
  margin: 0.35rem 0 0;
  color: var(--br-control-muted);
  font: 700 0.72rem/1.45 "Courier New", monospace;
}
.create-user-launch .create-user-button {
  width: auto !important;
  min-height: 3rem;
  padding: 0.75rem 1rem !important;
}

.user-wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: color-mix(in srgb, var(--br-bg) 82%, transparent);
  backdrop-filter: blur(8px);
}
.user-wizard {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  width: min(62rem, calc(100vw - 2rem));
  max-height: min(47rem, calc(100vh - 2rem));
  overflow: hidden;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel);
  color: var(--br-text);
  box-shadow: 10px 10px 0 var(--br-accent);
}
.user-wizard > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  min-height: 6.5rem;
  border-bottom: 1px solid var(--br-line-strong);
  padding: 1.35rem 1.5rem;
}
.user-wizard > header p {
  margin: 0 0 0.4rem;
  color: var(--br-accent);
  font: 800 0.64rem "Courier New", monospace;
  letter-spacing: 0.1em;
}
.user-wizard > header h2 {
  margin: 0;
  color: var(--br-text);
  font: 900 clamp(1.75rem, 3.3vw, 2.75rem)/0.95 Arial, sans-serif;
  letter-spacing: -0.045em;
}
.user-wizard > header button {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  background: var(--br-accent);
  color: var(--br-accent-ink, #101010);
  font: 700 1.7rem/1 Arial, sans-serif;
  cursor: pointer;
}
.wizard-progress {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--br-line-strong);
}
.wizard-progress button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.65rem;
  min-height: 4rem;
  border: 0;
  border-right: 1px solid var(--br-line);
  background: var(--br-panel-2);
  color: var(--br-muted);
  padding: 0.8rem 1rem;
  text-align: left;
}
.wizard-progress button:last-child { border-right: 0; }
.wizard-progress button.active {
  background: var(--br-control);
  color: var(--br-control-text);
  box-shadow: inset 0 -4px 0 var(--br-accent);
}
.wizard-progress button.complete { color: var(--br-accent); cursor: pointer; }
.wizard-progress b {
  font: 900 1.1rem Arial, sans-serif;
}
.wizard-progress span {
  font: 800 0.64rem/1.2 "Courier New", monospace;
  text-transform: uppercase;
}
.wizard-body {
  min-height: 0;
  overflow-y: auto;
  padding: clamp(1.25rem, 3vw, 2rem);
}
.wizard-step { min-height: 18rem; }
.identity-step {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: clamp(1.25rem, 3vw, 2.5rem);
}
.wizard-avatar {
  align-self: start;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
  padding: 0.7rem;
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--br-accent) 72%, transparent);
}
.wizard-avatar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 2rem;
  color: var(--br-text);
  font: 800 0.56rem "Courier New", monospace;
  letter-spacing: 0.07em;
}
.wizard-avatar__header small {
  color: var(--br-accent);
  font: inherit;
  letter-spacing: 0;
}
.wizard-avatar__frame {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--br-line-strong);
  background:
    linear-gradient(var(--br-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--br-line) 1px, transparent 1px),
    var(--br-control);
  background-size: 1.5rem 1.5rem;
}
.wizard-avatar__frame::before,
.wizard-avatar__frame::after {
  position: absolute;
  z-index: 2;
  width: 1.35rem;
  height: 1.35rem;
  border-color: var(--br-accent);
  content: "";
  pointer-events: none;
}
.wizard-avatar__frame::before {
  top: 0.5rem;
  left: 0.5rem;
  border-top: 2px solid var(--br-accent);
  border-left: 2px solid var(--br-accent);
}
.wizard-avatar__frame::after {
  right: 0.5rem;
  bottom: 0.5rem;
  border-right: 2px solid var(--br-accent);
  border-bottom: 2px solid var(--br-accent);
}
.wizard-avatar__frame img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  transition: transform 220ms ease, filter 220ms ease;
}
.wizard-avatar:hover .wizard-avatar__frame img {
  transform: scale(1.025);
  filter: contrast(1.04);
}
.wizard-avatar__scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 5px, color-mix(in srgb, var(--br-bg) 8%, transparent) 5px 6px);
  pointer-events: none;
}
.wizard-avatar .wizard-avatar__camera {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  display: grid;
  width: 3rem;
  min-height: 3rem;
  margin: 0;
  place-items: center;
  border: 1px solid var(--br-accent-ink, #101010);
  background: var(--br-accent);
  color: var(--br-accent-ink, #101010);
  font-size: 1rem;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease;
}
.wizard-avatar .wizard-avatar__camera:hover {
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 var(--br-accent-ink, #101010);
}
.wizard-avatar .wizard-avatar__upload {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 3.7rem;
  margin-top: 0.65rem;
  border: 1px solid var(--br-line-strong);
  background: transparent;
  color: var(--br-text);
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease;
}
.wizard-avatar .wizard-avatar__upload:hover {
  border-color: var(--br-accent);
  background: color-mix(in srgb, var(--br-accent) 10%, transparent);
}
.wizard-avatar__upload > span {
  display: grid;
  gap: 0.18rem;
  text-align: left;
}
.wizard-avatar__upload b {
  font: 900 0.7rem Arial, sans-serif;
}
.wizard-avatar__upload small {
  color: var(--br-muted);
  font: 700 0.55rem "Courier New", monospace;
}
.wizard-avatar__upload > i { color: var(--br-accent); }
.wizard-avatar > p {
  display: flex;
  gap: 0.4rem;
  margin: 0.65rem 0 0;
  color: var(--br-muted);
  font: 700 0.55rem/1.35 "Courier New", monospace;
}
.wizard-avatar > p i { color: var(--br-accent); }
.wizard-avatar label:focus-visible {
  outline: 2px solid var(--br-accent);
  outline-offset: 2px;
}
.wizard-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 1rem;
}
.wizard-field {
  display: grid;
  align-content: start;
  gap: 0.4rem;
  min-width: 0;
}
.wizard-field--wide { grid-column: 1 / -1; }
.wizard-field > span,
.wizard-field > label {
  color: var(--br-muted);
  font: 800 0.64rem "Courier New", monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.wizard-field input,
.wizard-field select,
.email-builder {
  width: 100%;
  min-height: 3.4rem;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  outline: 0;
  background: var(--br-control);
  color: var(--br-control-text);
  font: 700 0.95rem "Courier New", monospace;
}
.wizard-field input,
.wizard-field select { padding: 0.85rem 1rem; }
.wizard-field input:focus,
.wizard-field select:focus,
.email-builder:focus-within { box-shadow: inset 0 -3px 0 var(--br-accent); }
.wizard-field small {
  min-height: 1em;
  color: var(--br-muted);
  font: 700 0.62rem/1.3 "Courier New", monospace;
}
.wizard-field small.valid { color: var(--br-success, #3bd68a); }
.email-builder {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(9rem, 0.8fr);
  align-items: center;
  overflow: hidden;
}
.email-builder input,
.email-builder select {
  width: 100%;
  min-height: 3.3rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  box-shadow: none !important;
}
.email-builder select {
  padding: 0 1.9rem 0 0.65rem;
  cursor: pointer;
}
.email-custom-domain {
  margin-top: 0.45rem;
}
.email-builder b { color: var(--br-accent); font: 900 1.15rem Arial, sans-serif; }
.access-step {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
  max-width: 48rem;
  margin: 0 auto;
}
.access-intro {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-left: 4px solid var(--br-accent);
  background: var(--br-panel-2);
  padding: 1rem;
}
.access-intro > i { color: var(--br-accent); font-size: 1.4rem; }
.access-intro strong { color: var(--br-text); font: 900 1rem Arial, sans-serif; }
.access-intro p { margin: 0.2rem 0 0; color: var(--br-muted); font: 700 0.68rem "Courier New", monospace; }
.password-field > div { position: relative; }
.password-field input { padding-right: 3.25rem; }
.password-field button {
  position: absolute;
  top: 1px;
  right: 1px;
  display: grid;
  width: 3.15rem;
  height: calc(100% - 2px);
  place-items: center;
  border: 0;
  border-left: 1px solid var(--br-line);
  background: var(--br-panel-2);
  color: var(--br-accent);
  cursor: pointer;
}
.password-strength {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(12rem, 1fr);
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--br-line);
  padding: 0.85rem 1rem;
}
.password-strength > div { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
.password-strength > div span { height: 0.45rem; background: var(--br-line); }
.password-strength[data-level="weak"] .filled { background: var(--br-danger-line, #e85b4a); }
.password-strength[data-level="medium"] .filled { background: #e8a83d; }
.password-strength[data-level="good"] .filled,
.password-strength[data-level="strong"] .filled { background: var(--br-success, #3bd68a); }
.password-strength p { display: flex; justify-content: space-between; gap: 1rem; margin: 0; }
.password-strength b { color: var(--br-text); font: 900 0.76rem Arial, sans-serif; }
.password-strength small { color: var(--br-muted); font: 700 0.62rem "Courier New", monospace; text-align: right; }
.review-step { max-width: 48rem; margin: 0 auto; }
.review-identity {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem;
  border-bottom: 1px solid var(--br-line-strong);
  padding-bottom: 1.25rem;
}
.review-identity img { width: 6rem; height: 6rem; border: 1px solid var(--br-line-strong); object-fit: cover; }
.review-identity span { color: var(--br-accent); font: 800 0.62rem "Courier New", monospace; letter-spacing: 0.08em; }
.review-identity h3 { margin: 0.25rem 0; color: var(--br-text); font: 900 1.6rem Arial, sans-serif; }
.review-identity p { margin: 0; color: var(--br-muted); font: 700 0.72rem "Courier New", monospace; }
.review-step dl { display: grid; grid-template-columns: 1fr 1fr; margin: 1rem 0; border: 1px solid var(--br-line); }
.review-step dl div { min-width: 0; padding: 0.9rem 1rem; border-right: 1px solid var(--br-line); border-bottom: 1px solid var(--br-line); }
.review-step dt { color: var(--br-muted); font: 800 0.6rem "Courier New", monospace; text-transform: uppercase; }
.review-step dd { margin: 0.25rem 0 0; overflow-wrap: anywhere; color: var(--br-text); font: 800 0.78rem "Courier New", monospace; }
.review-note { display: flex; gap: 0.6rem; margin: 0; color: var(--br-muted); font: 700 0.66rem/1.4 "Courier New", monospace; }
.review-note i { color: var(--br-accent); }
.user-wizard > footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid var(--br-line-strong);
  padding: 1rem 1.5rem;
}
.wizard-primary,
.wizard-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-width: 10rem;
  min-height: 3rem;
  border: 1px solid var(--br-line-strong);
  border-radius: 0;
  padding: 0.7rem 1rem;
  font: 800 0.68rem "Courier New", monospace;
  text-transform: uppercase;
  cursor: pointer;
}
.wizard-primary { background: var(--br-accent); color: var(--br-accent-ink, #101010); }
.wizard-secondary { background: transparent; color: var(--br-text); }
.wizard-primary:disabled { opacity: 0.38; cursor: not-allowed; }

.settings-detail-header > .flex-1 p {
  margin: 0 0 0.35rem;
  color: var(--br-accent);
  font: 800 0.62rem "Courier New", monospace;
  letter-spacing: 0.08em;
}
.settings-detail-header h3 {
  margin: 0;
  color: var(--br-text) !important;
  font: 900 clamp(1.7rem, 3vw, 2.45rem)/1 Arial, sans-serif !important;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}
.user-detail-modal .modal-content {
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr);
  grid-template-rows: auto auto auto auto;
  width: min(64rem, calc(100vw - 2rem)) !important;
  max-width: 64rem !important;
  max-height: min(48rem, calc(100vh - 2rem)) !important;
  overflow: auto;
  border-radius: 0 !important;
  background: var(--br-panel) !important;
  box-shadow: 10px 10px 0 var(--br-accent) !important;
}
.user-detail-modal .settings-detail-header {
  position: relative;
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 7rem;
  border-bottom: 1px solid var(--br-line-strong);
  padding: 1.25rem 1.4rem 1.25rem 1.6rem;
}
.settings-detail-header > div:first-child { min-width: 0; }
.settings-detail-header > div:first-child p {
  margin: 0 0 0.35rem;
  color: var(--br-accent);
  font: 800 0.62rem "Courier New", monospace;
  letter-spacing: 0.08em;
}
.detail-header-actions {
  display: flex;
  align-items: stretch;
  gap: 0.55rem;
  flex: 0 0 auto;
}
.detail-header-actions button {
  min-height: 3rem;
  border-radius: 0;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, color 180ms ease;
}
.detail-header-actions button:hover { transform: translateY(-2px); }
.detail-header-actions button:active { transform: translateY(0); }
.detail-header-actions button:focus-visible { outline: 2px solid var(--br-accent); outline-offset: 2px; }
.detail-delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border: 1px solid var(--br-danger-line, #e06a5c);
  background: transparent;
  color: var(--br-danger-line, #e06a5c);
  padding: 0.65rem 0.85rem;
  font: 800 0.65rem "Courier New", monospace;
  text-transform: uppercase;
}
.detail-delete-button:hover {
  background: color-mix(in srgb, var(--br-danger-line, #e06a5c) 14%, transparent);
}
.detail-close-button {
  display: grid;
  width: 3rem;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel-2);
  color: var(--br-text);
  font: 700 1.45rem/1 Arial, sans-serif;
}
.detail-close-button:hover {
  border-color: var(--br-accent);
  background: var(--br-accent);
  color: var(--br-accent-ink, #101010);
}
.user-detail-modal .detail-profile {
  grid-column: 1;
  grid-row: 2;
  grid-template-columns: 1fr !important;
  align-content: start;
  min-width: 0;
  border-right: 1px solid var(--br-line);
  background: var(--br-panel-2);
  text-align: center;
}
.user-detail-modal .detail-profile > img { width: 8rem !important; height: 8rem !important; margin-inline: auto !important; border-radius: 0 !important; }
.user-detail-modal .detail-profile__identity { text-align: center; }
.user-detail-modal .detail-profile p { justify-content: center; }
.user-detail-modal .status-control { grid-column: 1; grid-row: 3; border-right: 1px solid var(--br-line); background: var(--br-panel-2); }
.user-detail-modal .account-grid {
  grid-column: 2;
  grid-row: 2 / span 2;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 0.75rem !important;
  border-bottom: 1px solid var(--br-line);
  background:
    linear-gradient(var(--br-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--br-line) 1px, transparent 1px),
    var(--br-panel);
  background-size: 2rem 2rem;
  padding: 1.2rem !important;
}
.account-grid > .account-grid__heading {
  grid-column: 1 / -1;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  border: 0 !important;
  border-bottom: 1px solid var(--br-line-strong) !important;
  padding: 0 0 0.85rem !important;
  text-align: left !important;
}
.account-grid__heading span {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--br-accent) !important;
  font: 800 0.58rem "Courier New", monospace !important;
  letter-spacing: 0.08em;
}
.account-grid__heading h4 {
  margin: 0;
  color: var(--br-text);
  font: 900 1.15rem Arial, sans-serif;
}
.account-grid__heading > small {
  max-width: 13rem;
  color: var(--br-muted);
  font: 700 0.58rem/1.3 "Courier New", monospace;
  text-align: right;
}
.account-item {
  position: relative;
  display: grid;
  grid-template-columns: 2.55rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  min-height: 6.25rem;
  border: 1px solid var(--br-line-strong);
  background: color-mix(in srgb, var(--br-panel-2) 94%, transparent);
  padding: 0.85rem;
  overflow: hidden;
}
.account-item::after {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1.25rem;
  height: 0.2rem;
  background: var(--br-accent);
  content: "";
}
.account-item > i {
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel);
  color: var(--br-accent);
  font-size: 1rem;
}
.account-item > div { min-width: 0; }
.account-item small {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--br-muted);
  font: 800 0.58rem "Courier New", monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.account-item strong {
  display: block;
  overflow: hidden;
  color: var(--br-text);
  font: 800 0.9rem Arial, sans-serif;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  grid-column: 1 / -1;
  width: 100%;
  padding-top: 0.7rem;
}
.account-item > button,
.account-item--password button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.65rem;
  min-width: 0;
  width: 100%;
  border: 1px solid var(--br-accent);
  background: transparent;
  color: var(--br-accent) !important;
  padding: 0.5rem 0.7rem;
  font: 800 0.64rem "Courier New", monospace;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease;
  text-align: center;
  white-space: nowrap;
}
.account-item--password button:hover {
  background: var(--br-accent);
  color: var(--br-accent-ink, #101010) !important;
}
.account-item--password button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.account-item--password {
  overflow: visible;
  z-index: 4;
}
.password-more-menu {
  position: absolute;
  right: 0.55rem;
  top: 0.55rem;
  z-index: 8;
}
.password-more-trigger {
  display: grid !important;
  width: 2.35rem !important;
  min-height: 2.35rem !important;
  place-items: center !important;
  border: 1px solid var(--br-line-strong) !important;
  background: var(--br-panel) !important;
  color: var(--br-text) !important;
  padding: 0 !important;
}
.password-more-trigger:hover {
  border-color: var(--br-accent) !important;
  background: var(--br-accent) !important;
  color: var(--br-accent-text) !important;
}
.password-more-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 0.35rem);
  display: grid;
  width: min(15rem, calc(100vw - 2rem));
  border: 1px solid var(--br-line-strong);
  background: var(--br-panel);
  box-shadow: 6px 6px 0 var(--br-accent);
}
.password-more-dropdown button {
  justify-content: flex-start !important;
  width: 100% !important;
  min-height: 2.8rem !important;
  border: 0 !important;
  border-bottom: 1px solid var(--br-line) !important;
  color: var(--br-text) !important;
  padding: 0.7rem 0.85rem !important;
  text-align: left !important;
}
.password-more-dropdown button:last-child {
  border-bottom: 0 !important;
}
.password-more-dropdown button:hover:not(:disabled) {
  background: var(--br-accent) !important;
  color: var(--br-accent-text) !important;
}
.account-item > button span,
.account-item--password button span { color: inherit !important; font-size: inherit !important; }
.user-detail-modal .permissions-title { grid-column: 1 / -1; grid-row: 4; }
.user-detail-modal .permissions-grid { grid-column: 1 / -1; grid-row: 5; }
.account-grid button { display: inline-flex; align-items: center; gap: 0.4rem; }
.create-user-launch strong,
.detail-profile h4,
.status-control > span,
.account-grid span,
.permissions-title,
.permission-row > span {
  color: var(--br-text) !important;
}
.create-user-launch p,
.detail-profile__identity > small,
.detail-profile p,
.account-grid p {
  color: var(--br-muted) !important;
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
  .passkey-panel,
  .users-panel {
    grid-column: 1 !important;
  }
  .profile-panel { grid-row: 1 !important; }
  .create-user-panel { grid-row: 2 !important; }
  .passkey-panel { grid-row: 3 !important; }
  .users-panel {
    grid-row: 4 !important;
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
  .account-actions { grid-template-columns: 1fr; }
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

@media (max-width: 760px) {
  .create-user-launch {
    grid-template-columns: 3.5rem minmax(0, 1fr);
  }
  .create-user-launch__mark { width: 3.5rem; height: 3.5rem; }
  .create-user-launch .create-user-button { grid-column: 1 / -1; width: 100% !important; }
  .user-wizard { width: calc(100vw - 1rem); max-height: calc(100vh - 1rem); box-shadow: 5px 5px 0 var(--br-accent); }
  .user-wizard > header { min-height: 5.5rem; padding: 1rem; }
  .wizard-progress button { display: flex; justify-content: center; min-height: 3.4rem; padding: 0.6rem; }
  .wizard-progress button span { display: none; }
  .wizard-body { padding: 1rem; }
  .identity-step,
  .access-step { grid-template-columns: 1fr; }
  .wizard-avatar { display: grid; grid-template-columns: 6.25rem minmax(0, 1fr); align-items: stretch; gap: 0.65rem; }
  .wizard-avatar__header,
  .wizard-avatar > p { grid-column: 1 / -1; }
  .wizard-avatar__frame { grid-column: 1; }
  .wizard-avatar__frame img { width: 100%; }
  .wizard-avatar .wizard-avatar__camera { width: 2.35rem; min-height: 2.35rem; right: 0.35rem; bottom: 0.35rem; }
  .wizard-avatar .wizard-avatar__upload { grid-column: 2; min-height: 100%; margin-top: 0; }
  .wizard-fields { grid-template-columns: 1fr; }
  .wizard-field--wide,
  .access-intro,
  .password-strength { grid-column: 1; }
  .password-strength { grid-template-columns: 1fr; }
  .password-strength p { flex-direction: column; gap: 0.25rem; }
  .password-strength small { text-align: left; }
  .email-builder { grid-template-columns: minmax(0, 1fr) auto minmax(7.5rem, 0.8fr); }
  .review-step dl { grid-template-columns: 1fr; }
  .review-step dl div { border-right: 0; }
  .user-wizard > footer { padding: 0.75rem 1rem; }
  .wizard-primary,
  .wizard-secondary { min-width: 0; }
  .user-detail-modal { align-items: stretch !important; justify-content: stretch !important; padding: 0 !important; }
  .user-detail-modal .modal-content { display: block; width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; overflow-y: auto !important; border: 0 !important; box-shadow: none !important; }
  .user-detail-modal .settings-detail-header { min-height: 6rem; gap: 0.75rem; padding: 1rem; }
  .settings-detail-header h3 { font-size: clamp(1.35rem, 7vw, 1.9rem) !important; }
  .detail-delete-button span { display: none; }
  .detail-delete-button { width: 3rem; padding-inline: 0; }
  .account-grid__heading > small { display: none; }
  .user-detail-modal .detail-profile { border-right: 0; }
  .user-detail-modal .status-control { border-right: 0; }
}
</style>
