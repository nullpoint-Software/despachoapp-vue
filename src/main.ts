import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initializePalette } from './composables/useColorPalette'


const app = createApp(App)
initializePalette()
const pinia = createPinia();

app.use(pinia)
app.use(router)
app.mount('#app')
app.directive('tooltip', {
  mounted(element, binding) { element.setAttribute('title', String(binding.value ?? '')); },
  updated(element, binding) { element.setAttribute('title', String(binding.value ?? '')); },
});
