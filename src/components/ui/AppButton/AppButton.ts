interface AppButtonProps {
  label?: string
  icon?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  outlined?: boolean
}

defineOptions({ inheritAttrs: false })
withDefaults(defineProps<AppButtonProps>(), { type: 'button', disabled: false, outlined: false })
