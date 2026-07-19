<template>
  <main ref="pageRef" class="records-view">
    <header class="records-hero">
      <div>
        <p>ADMINISTRACIÓN / 02</p>
        <h1>Pagos</h1>
        <span>Historial, conceptos y cierres de caja.</span>
      </div>
      <div class="records-actions">
        <AppButton
          label="Corte de caja"
          icon="pi pi-calculator"
          outlined
          @click="cashCutVisible = true"
        /><AppButton
          label="Nuevo pago"
          icon="pi pi-plus"
          class="p-button-primary"
          @click="newPayment"
        />
      </div>
    </header>
    <nav class="records-tabs" aria-label="Secciones de pagos">
      <router-link to="/app/pagos/historial" active-class="is-active"
        >01 / Historial</router-link
      ><router-link to="/app/pagos/concepto" active-class="is-active"
        >02 / Conceptos</router-link
      >
    </nav>
    <section class="records-content"><router-view /></section>
    <CashCutModal v-if="cashCutVisible" @close="cashCutVisible = false" />
  </main>
</template>
<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import CashCutModal from "./CashCutModal.vue";
import { usePaymentActions } from "@/composables/usePaymentActions";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
const router = useRouter();
const pageRef = ref<HTMLElement | null>(null);
const cashCutVisible = ref(false);
const { requestNewPayment } = usePaymentActions();
useBrutalMotion(pageRef, [
  ".records-hero",
  ".records-tabs",
  ".records-content",
]);
async function newPayment() {
  await router.push("/app/pagos/concepto");
  await nextTick();
  requestNewPayment();
}
</script>
<style scoped>
.records-view {
  min-height: 100%;
  padding: clamp(1rem, 2.5vw, 2rem);
  background: var(--br-bg);
  color: var(--br-text);
}
.records-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--br-line);
  border-bottom: 1px solid var(--br-line);
}
.records-hero p {
  margin: 0 0 0.5rem;
  color: var(--br-accent);
  font:
    800 0.75rem "Courier New",
    monospace;
  letter-spacing: 0.12em;
}
.records-hero h1 {
  margin: 0;
  font:
    900 clamp(3.2rem, 9vw, 7rem)/0.75 Arial,
    sans-serif;
  letter-spacing: -0.075em;
  text-transform: uppercase;
}
.records-hero span {
  display: block;
  margin-top: 1rem;
  color: var(--br-muted);
  font:
    700 0.9rem "Courier New",
    monospace;
}
.records-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.records-tabs {
  display: flex;
  border-bottom: 1px solid var(--br-line);
}
.records-tabs a {
  padding: 1rem 1.25rem;
  border-right: 1px solid var(--br-line);
  color: var(--br-muted);
  font:
    800 0.8rem "Courier New",
    monospace;
  text-decoration: none;
  text-transform: uppercase;
}
.records-tabs a.is-active {
  background: var(--br-control);
  color: #141413;
}
.records-content {
  min-height: 24rem;
  padding-top: 1rem;
}
@media (max-width: 720px) {
  .records-hero {
    align-items: stretch;
    flex-direction: column;
  }
  .records-actions {
    justify-content: stretch;
  }
  .records-actions :deep(button) {
    flex: 1;
  }
  .records-tabs a {
    flex: 1;
    text-align: center;
    padding: 0.9rem 0.5rem;
  }
}
</style>
