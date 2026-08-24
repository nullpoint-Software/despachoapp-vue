import { readonly, ref } from 'vue'

const newPaymentRequest = ref(0)

export function usePaymentActions() {
  return {
    newPaymentRequest: readonly(newPaymentRequest),
    requestNewPayment: () => {
      newPaymentRequest.value += 1
    }
  }
}
