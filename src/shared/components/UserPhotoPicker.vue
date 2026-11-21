<script setup lang="ts">
import { ref } from 'vue'
import { Camera, Trash2 } from '@lucide/vue'
import UserAvatar from './UserAvatar.vue'
import ActionButton from './ActionButton.vue'
import { photoFor, rememberUserPhoto } from '../users/userPhotoStore'
import { maximumPhotoDataUrlLength } from '../../../shared/contracts/userPhotos'
import { useNotifications } from '../notifications/notificationStore'

/**
 * Elegir o quitar la foto de perfil (2026-10-04, como "Elegir imagen" de la ContaApp anterior). La imagen se lee en la
 * vista (el usuario la eligió con el selector de archivos del sistema), se recorta al centro en cuadrado y se reduce a
 * 256×256 JPEG antes de enviarla; el archivo original nunca sale del equipo. Acepta JPG, PNG o WebP de hasta 5 MB.
 * El Host decide si se puede: la propia foto o, con `users.manage`, la de otra persona.
 */
const props = defineProps<{ userId: string; displayName: string }>()
const { notify } = useNotifications()
const input = ref<HTMLInputElement | null>(null)
const isBusy = ref(false), error = ref('')
const maximumFileBytes = 5 * 1024 * 1024, photoPixels = 256

/** Se lee como `data:` (la política de contenido de la vista no permite `blob:`). */
function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unreadable image'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Invalid image'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
/** Recorte cuadrado centrado y reducción a 256×256; baja la calidad si aún excede el límite del contrato. */
function toPhotoDataUrl(image: HTMLImageElement): string {
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  const canvas = document.createElement('canvas'); canvas.width = photoPixels; canvas.height = photoPixels
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, photoPixels, photoPixels)
  for (const quality of [.86, .72, .58]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= maximumPhotoDataUrlLength) return dataUrl
  }
  throw new Error('Image too large')
}
async function choose(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  error.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error.value = 'Elige una imagen JPG, PNG o WebP.'; return }
  if (file.size > maximumFileBytes) { error.value = 'La imagen pesa más de 5 MB.'; return }
  isBusy.value = true
  try {
    const photoDataUrl = toPhotoDataUrl(await readImage(file))
    const result = await window.contapp.manageUserPhotos({ action: 'save', userId: props.userId, photoDataUrl })
    rememberUserPhoto(props.userId, result.photos[0]?.photoDataUrl ?? null)
    notify('Foto actualizada', 'La foto de ' + props.displayName + ' se guardó en el Host.', 'success')
  } catch { error.value = 'No se pudo guardar la foto. Revisa la imagen, tu sesión y tus permisos.' }
  finally { isBusy.value = false }
}
async function remove(): Promise<void> {
  isBusy.value = true; error.value = ''
  try {
    await window.contapp.manageUserPhotos({ action: 'remove', userId: props.userId })
    rememberUserPhoto(props.userId, null)
    notify('Foto quitada', props.displayName + ' vuelve a mostrar sus iniciales.', 'success')
  } catch { error.value = 'No se pudo quitar la foto. Revisa tu sesión y tus permisos.' }
  finally { isBusy.value = false }
}
</script>
<template>
  <div class="photo-picker">
    <UserAvatar
      :user-id="userId"
      :display-name="displayName"
      size="large"
    />
    <div class="photo-picker-actions">
      <input
        ref="input"
        class="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :aria-label="'Elegir foto de ' + displayName"
        @change="choose"
      >
      <ActionButton
        :is-loading="isBusy"
        @click="input?.click()"
      >
        <Camera
          :size="16"
          aria-hidden="true"
        /> {{ photoFor(userId) ? 'Cambiar foto' : 'Elegir foto' }}
      </ActionButton>
      <ActionButton
        v-if="photoFor(userId)"
        :disabled="isBusy"
        :aria-label="'Quitar foto de ' + displayName"
        @click="remove"
      >
        <Trash2
          :size="16"
          aria-hidden="true"
        />
      </ActionButton>
      <p
        class="field-help"
        :class="{ 'tone-error': error }"
      >
        {{ error || 'JPG, PNG o WebP de hasta 5 MB. Se recorta en cuadrado.' }}
      </p>
    </div>
  </div>
</template>
<style scoped>
.photo-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.photo-picker-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.photo-picker-actions .field-help { flex-basis: 100%; margin: 0; }
</style>
