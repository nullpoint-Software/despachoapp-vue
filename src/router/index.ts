import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
    },
    {
      path: "/aboutus",
      name: "aboutus",
      component: () => import("@/views/AboutUsView.vue"),
    },
    {
      path: "/about",
      name: "about",
      component: () => import("@/views/AboutView.vue"),
    },
    {
      path: "/app",
      name: "app",
      component: () => import("@/views/adminApp/MainView.vue"),
      children: [
        { 
          path: "", 
          component: () => import("@/components/adminApp/Inicio.vue") 
        },
        { 
          path: "inicio", 
          redirect: "/app"
        },
        { 
          path: "tareas", 
          component: () => import("@/components/adminApp/Tareas.vue") 
        },
        { 
          path: "clientes", 
          component: () => import("@/components/adminApp/Clientes.vue") 
        },
        { 
          path: "settings", 
          component: () => import("@/components/adminApp/Settings.vue") 
        },
        {
          path: "pagos",
          component: () => import("@/components/adminApp/Pagos.vue"),
          children: [
            { path: "", redirect: "/app/pagos/historial" },
            { 
              path: "historial", 
              name: "pagos-historial", 
              component: () => import("@/components/adminApp/PagosHistorial.vue") 
            },
            { 
              path: "concepto", 
              name: "pagos-concepto", 
              component: () => import("@/components/adminApp/PagoConcepto.vue") 
            },
            { 
              path: "mensual", 
              name: "pagos-mensual", 
              component: () => import("@/components/adminApp/PagoMensual.vue") 
            },
          ],
        },
      ],
    },
  ],
});

export default router;
