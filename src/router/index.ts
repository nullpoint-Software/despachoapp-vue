import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView/LoginView.vue"),
    },
    {
      path: "/aboutus",
      name: "aboutus",
      component: () => import("@/views/AboutUsView/AboutUsView.vue"),
    },
    {
      path: "/about",
      name: "about",
      component: () => import("@/views/AboutView/AboutView.vue"),
    },
    {
      path: "/app",
      name: "app",
      component: () => import("@/layouts/admin/AdminLayout/AdminLayout.vue"),
      children: [
        {
          path: "",
          component: () => import("@/components/adminApp/Inicio/Inicio.vue")
        },
        {
          path: "inicio",
          redirect: "/app"
        },
        {
          path: "tareas",
          component: () => import("@/components/adminApp/Tareas/Tareas.vue")
        },
        {
          path: "clientes",
          component: () => import("@/components/adminApp/Clientes/Clientes.vue")
        },
        {
          path: "fiscal",
          component: () => import("@/components/adminApp/Fiscal/Fiscal.vue")
        },
        {
          path: "cumplimiento",
          component: () => import("@/components/adminApp/OpinionesCumplimiento/OpinionesCumplimiento.vue")
        },
        {
          path: "catalogos-sat",
          name: "catalogos-sat",
          component: () => import("@/components/adminApp/CatalogosSat/CatalogosSat.vue")
        },
        {
          path: "settings",
          component: () => import("@/components/adminApp/Settings/Settings.vue")
        },
        {
          path: "pagos",
          component: () => import("@/components/adminApp/Pagos/Pagos.vue"),
          children: [
            { path: "", redirect: "/app/pagos/concepto" },
            { path: "historial", redirect: "/app/pagos/concepto" },
            {
              path: "concepto",
              name: "pagos-concepto",
              component: () => import("@/components/adminApp/Tables/PagoConcepto/PagoConcepto.vue")
            },
          ],
        },
      ],
    },
  ],
});

export default router;
