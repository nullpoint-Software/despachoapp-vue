import { motionDirective } from './shared/motion/motionDirective'
import { slidingTabsDirective } from './shared/motion/slidingTabsDirective'
import { createApp } from 'vue'
import App from './App.vue'
import { createDemoApi } from './demo/createDemoApi'
import { createDemoStore } from './demo/demoStore'
// Geist (OFL-1.1) empaquetada con la aplicación: nunca se descarga en tiempo de ejecución.
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './shared/styles/base.css'

/** `localStorage` puede lanzar al accederlo (modo privado, datos bloqueados): la demo sigue sin persistir preferencias. */
function readBrowserStorage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

// Un store nuevo en cada carga de página es lo que hace que los datos desaparezcan al recargar.
window.contapp = createDemoApi(createDemoStore(), { storage: readBrowserStorage(), reloadPage: () => window.location.reload() })
createApp(App).directive('motion', motionDirective).directive('sliding-tabs', slidingTabsDirective).mount('#app')
