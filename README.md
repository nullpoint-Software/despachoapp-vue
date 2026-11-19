# Fiscenix Web

Demo de [Fiscenix](docs/superpowers/specs/2026-11-18-fiscenix-web-design.md) para el portafolio. Corre **íntegramente en el navegador**: no hay servidor, base de datos ni peticiones externas. Los datos viven en memoria y se borran al recargar la página; el SAT y el correo están simulados.

Estado de la entrega 0 (base): sesión, perfiles demo, Inicio y Configuración (preferencias locales). Ningún perfil tiene acceso a módulos todavía y la entrada "Catálogos SAT" está oculta hasta su entrega.

## Perfiles demo

Contraseña de todos: `demo1234`.

| Usuario | Persona | Rol |
| --- | --- | --- |
| `admin.demo` | Ana Torres | Administrador |
| `contador.demo` | Luis Méndez | Contador |
| `auxiliar.demo` | Carla Ruiz | Auxiliar |

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo
npm run check      # typecheck, lint, pruebas unitarias y build
npm run test:e2e   # Playwright contra el build servido con vite preview
```

## Despliegue

Importar el repositorio en Vercel. `vercel.json` ya configura el build (`npm run build`, salida `dist`), el fallback SPA y las cabeceras de seguridad.

## Origen

`src/` y `shared/` se copiaron de ContaApp2 (Fiscenix escritorio), rama `legacy-migration`, commit `c0c00bf`. La API simulada está en [docs/modules/DEMO-API.md](docs/modules/DEMO-API.md).
