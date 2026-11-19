import { motionDirective } from './shared/motion/motionDirective'
import { slidingTabsDirective } from './shared/motion/slidingTabsDirective'
import { createApp } from 'vue'
import App from './App.vue'
// Geist (OFL-1.1) empaquetada con la aplicación: nunca se descarga en tiempo de ejecución.
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './shared/styles/base.css'
createApp(App).directive('motion', motionDirective).directive('sliding-tabs', slidingTabsDirective).mount('#app')
