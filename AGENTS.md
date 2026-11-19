# AGENTS.md — Reglas de Fiscenix Web

Pointers: diseño visual en `DESIGN.md`; especificación en `docs/superpowers/specs/2026-11-18-fiscenix-web-design.md`; API simulada en `docs/modules/DEMO-API.md`.

## Regla de oro: sólo memoria

La demo no hace peticiones externas ni usa servidor. Todo dato de negocio vive en `DemoStore` (memoria) y se pierde al recargar. Sólo las preferencias del dispositivo usan `localStorage` (clave `fiscenixWeb.localPreferences`). La CSP de `src/index.html` y `vercel.json` lo hacen cumplir.

## Reglas de código (heredadas de ContaApp2)

- Una responsabilidad principal por clase, archivo, servicio, store y componente.
- Identificadores técnicos en inglés, sin abreviaturas, sin `_`; `camelCase`.
- Arrays en plural; booleanos con `is`, `has`, `can` o `should`; funciones con verbo + sustantivo.
- IDs y números expresivos: `clientId`, `totalPaymentAmount`, `timeoutMilliseconds`.
- TypeScript `strict`; sin `any` para evitar diseñar tipos.
- El código nuevo o modificado lleva comentarios que explican flujos, reglas y decisiones; se actualizan con el código.
- La UI sólo habla con `window.contapp: DesktopApi`; no se toca `shared/contracts` ni los módulos Vue más de lo imprescindible.
- Un método del contrato no simulado se rechaza con `rejectInDemo`, nunca se omite.

## Documentación

Todo cambio relevante actualiza `docs/modules/DEMO-API.md` (qué hace, datos, dependencias, archivos, qué cambió y por qué), con diagramas Mermaid cuando cambien componentes o flujos. No documentar obviedades línea por línea.

## Verificación

`npm run check` y `npm run test:e2e` antes de cada commit.
