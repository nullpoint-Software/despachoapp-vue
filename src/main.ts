import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import App from './App.vue'
import router from './router'
import Tooltip from 'primevue/tooltip';
import ToastService from 'primevue/toastservice';


const app = createApp(App)
const pinia = createPinia();

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
// oxlint-disable-next-line no-constant-binary-expression
            darkModeSelector: false || 'none',
        }
    }
});
app.use(ToastService); // Registra el ToastService globalmente
app.mount('#app')
app.directive('tooltip', Tooltip);
