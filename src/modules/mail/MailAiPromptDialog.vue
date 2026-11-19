<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy } from '@lucide/vue'
import FormModal from '../../shared/components/FormModal.vue'
import ActionButton from '../../shared/components/ActionButton.vue'
import { useOfficeBranding } from '../branding/officeBrandingState'
import { buildMailAiPrompt, type MailAiPurpose } from './buildMailAiPrompt'

/**
 * «Prompt para IA» de la vista HTML (2026-10-18). Sin conexiones: la persona describe lo que quiere, Fiscenix arma el
 * prompt (`buildMailAiPrompt`) con las reglas del HTML de correo y los marcadores, y lo copia. La IA que elija la
 * persona le preguntará los datos que falten; su HTML se pega en el código, donde se sanea.
 * Copiar usa la copia nativa del texto seleccionado (`execCommand`): la ventana no concede el permiso de portapapeles.
 */
const props = defineProps<{ isOpen: boolean; purpose: MailAiPurpose }>()
const emit = defineEmits<{ close: [] }>()
const { branding } = useOfficeBranding()
const request = ref(''), feedback = ref('')
const promptField = ref<HTMLTextAreaElement | null>(null)
const prompt = computed(() => buildMailAiPrompt({ purpose: props.purpose, request: request.value, officeName: branding.value.officeName }))

function copyPrompt(): void {
  const field = promptField.value
  if (!field) return
  field.focus(); field.select()
  let isCopied = false
  try { isCopied = document.execCommand('copy') } catch { isCopied = false }
  feedback.value = isCopied ? 'Prompt copiado. Pégalo en la IA que uses, contesta sus preguntas y pega el HTML que te dé en el código.' : 'El texto quedó seleccionado: cópialo con Ctrl+C.'
}
</script>

<template>
  <FormModal
    :is-open="isOpen"
    title="Prompt para IA"
    :description="purpose === 'signature' ? 'Para diseñar la firma con la IA que prefieras.' : 'Para diseñar el cuerpo del correo con la IA que prefieras.'"
    test-id="mail-ai-prompt-modal"
    @close="emit('close')"
  >
    <form
      class="mail-ai-prompt"
      @submit.prevent="copyPrompt"
    >
      <div class="field">
        <label for="mail-ai-request">¿Qué quieres?</label>
        <textarea
          id="mail-ai-request"
          v-model="request"
          rows="3"
          placeholder="Por ejemplo: firma con mi nombre, puesto, teléfono y los colores azul y negro del despacho"
        />
      </div>
      <div class="field">
        <label for="mail-ai-prompt-text">Prompt</label>
        <textarea
          id="mail-ai-prompt-text"
          ref="promptField"
          :value="prompt"
          rows="12"
          readonly
          spellcheck="false"
        />
        <p class="field-help">
          Fiscenix no se conecta a ninguna IA. La IA te preguntará correos, teléfonos y otros datos antes de escribir el HTML.
        </p>
      </div>
      <p
        v-if="feedback"
        class="field-help"
        role="status"
      >
        {{ feedback }}
      </p>
      <div class="actions form-footer">
        <ActionButton
          type="submit"
          variant="primary"
        >
          <Copy
            :size="16"
            aria-hidden="true"
          /> Copiar prompt
        </ActionButton>
        <ActionButton @click="emit('close')">
          Cerrar
        </ActionButton>
      </div>
    </form>
  </FormModal>
</template>

<style scoped>
.mail-ai-prompt { display: grid; gap: var(--spaceMedium); }
#mail-ai-prompt-text { font-family: var(--monoFontFamily); font-size: 12px; line-height: 1.5; }
</style>
