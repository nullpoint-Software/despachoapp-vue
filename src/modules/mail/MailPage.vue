<script setup lang="ts">
import { ref } from 'vue'
import HelpTip from '../../shared/components/HelpTip.vue'
import MailComposer from './MailComposer.vue'

/**
 * Sección Correo (2026-10-18, pedido del usuario: "un apartado propio para emails más genéricos, sin envío de nada"):
 * un correo libre a cualquier dirección, sin documento ni adjuntos, con la cuenta vinculada en este equipo. Es el mismo
 * redactor en modo genérico (`clientId` NULL); el Host exige `mail.send` y lo audita sin cliente. Al enviar, el redactor
 * se vuelve a montar vacío (`composerKey`).
 */
const composerKey = ref(0)
</script>

<template>
  <section data-testid="mail-page">
    <div class="section-heading page-heading">
      <div>
        <div class="help-title-row">
          <h1>Correo</h1>
          <HelpTip
            title="Correo libre"
            text="Escribe a cualquier dirección con tu cuenta vinculada en este equipo, sin documento ni adjuntos. Para enviar documentos de un cliente usa la acción Correo en Clientes, Documentos o Fiscal. Cada envío queda registrado en el Host."
          />
        </div>
        <p class="lede">
          Un correo a cualquier dirección, con tu firma y sin adjuntos.
        </p>
      </div>
    </div>
    <div class="surface-panel mail-page-panel">
      <MailComposer
        :key="composerKey"
        :request="{ clientId: null, clientName: '' }"
        @close="composerKey++"
      />
    </div>
  </section>
</template>

<style scoped>
.mail-page-panel { padding: 20px; }
</style>
