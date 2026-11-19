<script setup lang="ts">
import { ref } from 'vue'
import FormModal from '../../shared/components/FormModal.vue'
import MailComposer from './MailComposer.vue'
import { closeMailComposer, mailComposerRequest } from './mailComposerState'

/** Un solo redactor de correo para toda la app ([[MAIL]]); lo abren Clientes, el expediente y Fiscal con `openMailComposer`. */
const isBusy = ref(false)
</script>

<template>
  <FormModal
    :is-open="Boolean(mailComposerRequest)"
    title="Enviar correo"
    :description="mailComposerRequest?.clientName"
    :is-busy="isBusy"
    test-id="mail-composer-modal"
    @close="closeMailComposer"
  >
    <MailComposer
      v-if="mailComposerRequest"
      :key="mailComposerRequest.clientId + (mailComposerRequest.attachments ?? []).map(item => item.label).join()"
      :request="mailComposerRequest"
      @close="closeMailComposer"
      @busy="isBusy = $event"
    />
  </FormModal>
</template>
