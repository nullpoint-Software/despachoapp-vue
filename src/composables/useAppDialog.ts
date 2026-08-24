import { readonly, ref } from 'vue'

export type AppDialogTone = 'info' | 'danger' | 'success'
export type AppDialogMode = 'alert' | 'confirm' | 'prompt'

export interface AppDialogOptions {
  title: string
  message: string
  tone?: AppDialogTone
  confirmLabel?: string
  cancelLabel?: string
  inputLabel?: string
  inputType?: 'text' | 'password' | 'email'
  initialValue?: string
  placeholder?: string
}

type DialogState = AppDialogOptions & { mode: AppDialogMode }
type PendingDialog = { state: DialogState; resolve: (value: boolean | string | null) => void }
const current = ref<DialogState | null>(null)
const queue: PendingDialog[] = []
let activeResolve: PendingDialog['resolve'] | null = null

function showNext() {
  if (current.value || !queue.length) return
  const next = queue.shift()!
  current.value = next.state
  activeResolve = next.resolve
}
function request(mode: AppDialogMode, options: AppDialogOptions) {
  return new Promise<boolean | string | null>((resolve) => {
    queue.push({ state: { mode, ...options }, resolve })
    showNext()
  })
}
function settle(value: boolean | string | null) {
  const resolve = activeResolve
  current.value = null
  activeResolve = null
  resolve?.(value)
  window.setTimeout(showNext, 0)
}

export function useAppDialog() {
  return {
    dialog: readonly(current),
    alert: (options: AppDialogOptions) => request('alert', options) as Promise<boolean>,
    confirm: (options: AppDialogOptions) => request('confirm', options) as Promise<boolean>,
    prompt: (options: AppDialogOptions) => request('prompt', options) as Promise<string | null>,
    settle
  }
}
