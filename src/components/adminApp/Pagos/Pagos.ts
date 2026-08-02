import { nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import { usePaymentActions } from "@/composables/usePaymentActions";
import { useBrutalMotion } from "@/composables/useBrutalMotion";
const router = useRouter();
const pageRef = ref<HTMLElement | null>(null);
const cashCutVisible = ref(false);
const { requestNewPayment } = usePaymentActions();
useBrutalMotion(pageRef, [
  ".records-hero",
  ".records-content",
]);
async function newPayment() {
  await router.push("/app/pagos/concepto");
  await nextTick();
  requestNewPayment();
}
