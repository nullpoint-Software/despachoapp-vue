import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import Inicio from '@/components/adminApp/Inicio.vue'
import MainView from '@/views/adminApp/MainView.vue'
import Tareas from '@/components/adminApp/Tareas.vue'
import Clientes from '@/components/adminApp/Clientes.vue'
import Pagos from '@/components/adminApp/Pagos.vue'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/app',
      name: 'app',
      component: MainView,
      children: [
        { path: '', component: Inicio },
        { path: 'inicio', redirect: '/app' },
        { path: 'tareas', component: Tareas},
        { path: 'clientes', component: Clientes},
        { path: 'pagos', component: Pagos}
      ]
    },


  ],
})

export default router
