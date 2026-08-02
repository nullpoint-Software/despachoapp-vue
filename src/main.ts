import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App/App.vue'
import router from './router'
import { initializePalette } from './composables/useColorPalette'
import { initializeFontSize } from './composables/useFontSize'
import { initializeFontFamily } from './composables/useFontFamily'
import { tooltipDirective } from './directives/tooltip'
import { imageFallbackDirective } from './directives/imageFallback'
import { registerGlobalComponents } from './plugins/globalComponents'


const app = createApp(App)
initializePalette()
initializeFontSize()
initializeFontFamily()
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.directive('tooltip', tooltipDirective)
app.directive('image-fallback', imageFallbackDirective)
registerGlobalComponents(app)
app.mount('#app')
