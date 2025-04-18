import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import LoginView from "@/views/LoginView.vue";
import AboutUsView from "@/views/AboutUsView.vue";
import Inicio from "@/components/adminApp/Inicio.vue";
import MainView from "@/views/adminApp/MainView.vue";
import Tareas from "@/components/adminApp/Tareas.vue";
import Clientes from "@/components/adminApp/Clientes.vue";
import Pagos from "@/components/adminApp/Pagos.vue";
import PagoConcepto from "@/components/adminApp/PagoConcepto.vue";
import PagoMensual from "@/components/adminApp/PagoMensual.vue";
import PagosHistorial from "@/components/adminApp/PagosHistorial.vue";
import Settings from "@/components/adminApp/Settings.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/aboutus",
      name: "aboutus",
      component: AboutUsView,
    },
    {
      path: "/about",
      name: "about",
      // Lazy-loading: Código dividido por ruta
      component: () => import("../views/AboutView.vue"),
    },
    {
      path: "/app",
      name: "app",
      component: MainView,
      children: [
        { path: "", component: Inicio },
        { path: "inicio", redirect: "/app" },
        { path: "tareas", component: Tareas },
        { path: "clientes", component: Clientes },
        { path: "settings", component: Settings },
        {
          path: "pagos",
          component: Pagos,
          children: [
            // Redirección absoluta para que al entrar en /app/pagos redirija a /app/pagos/historial
            { path: "", redirect: "/app/pagos/historial" },
            { path: "historial", name: "pagos-historial", component: PagosHistorial },
            { path: "concepto", name: "pagos-concepto", component: PagoConcepto },
            { path: "mensual", name: "pagos-mensual", component: PagoMensual },
          ],
        },
      ],
    },
  ],
});

export default router;
