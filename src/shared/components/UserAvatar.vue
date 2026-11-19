<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { photoFor, requestUserPhotos } from '../users/userPhotoStore'

/**
 * Foto de un trabajador (2026-10-04): la foto de perfil del Host o, si no tiene, sus iniciales sobre papel con el marco
 * de 2 px de la app. Cuadrada, como el resto del sistema brutalista. Pide su foto al almacén compartido al montarse.
 * Es decorativa cuando el nombre ya está escrito al lado (`isDecorative`); si no, el nombre es su texto alternativo.
 */
const props = withDefaults(defineProps<{ userId: string; displayName: string; size?: 'small' | 'medium' | 'large'; isDecorative?: boolean }>(), { size: 'medium', isDecorative: false })
watchEffect(() => requestUserPhotos([props.userId]))
const photo = computed(() => photoFor(props.userId) ?? null)
const initials = computed(() => props.displayName.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toLocaleUpperCase('es-MX') || '?')
</script>
<template>
  <span
    class="user-avatar"
    :class="'avatar-' + size"
    :role="isDecorative ? undefined : 'img'"
    :aria-label="isDecorative ? undefined : 'Foto de ' + displayName"
    :aria-hidden="isDecorative || undefined"
    :title="displayName"
  >
    <img
      v-if="photo"
      :src="photo"
      alt=""
    >
    <span v-else>{{ initials }}</span>
  </span>
</template>
<style scoped>
.user-avatar { display: inline-grid; place-items: center; flex: none; overflow: hidden; border: 2px solid var(--borderColor); background: var(--subtleColor); color: var(--textColor); font-family: var(--monoFontFamily); font-weight: 800; line-height: 1; }
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-small { width: 24px; height: 24px; font-size: 10px; }
.avatar-medium { width: 32px; height: 32px; font-size: 12px; }
.avatar-large { width: 72px; height: 72px; font-size: 22px; box-shadow: var(--buttonShadow); }
</style>
