import { defineComponent } from 'vue'
import { useAdminLayout } from '.././composables/useAdminLayout'
export default defineComponent({
  name: 'AdminLayout',
  setup() {
    return useAdminLayout()
  }
})
