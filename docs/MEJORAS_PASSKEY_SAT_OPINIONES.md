# Passkeys múltiples, descarga SAT y Opiniones

Fecha: 23 de agosto de 2026

## Alcance

Esta entrega corrige el alta de una segunda passkey y reorganiza dos superficies fiscales: el modal de descarga masiva de CFDI y el panorama de Opiniones de cumplimiento.

## Passkeys múltiples

### Problema

Después de registrar una passkey, el navegador intentaba volver a utilizar el mismo autenticador. WebAuthn rechaza ese intento porque la credencial ya está vinculada a la cuenta, aunque el usuario quisiera agregar un teléfono, una llave de seguridad u otro dispositivo.

### Comportamiento nuevo

- La primera passkey conserva el flujo normal del navegador.
- Si ya existe al menos una, el siguiente registro prioriza otro teléfono o llave mediante `hybrid` y `security-key`, pero mantiene disponible `client-device` para registrar el dispositivo actual cuando sea distinto.
- La nueva passkey se agrega a la cuenta; no reemplaza las anteriores.
- La interfaz muestra cuántas passkeys están registradas.
- Los errores `InvalidStateError` y `NotAllowedError` ahora explican si se eligió un autenticador repetido, se canceló el diálogo o el dispositivo no respondió.
- Se dejó de forzar `residentKey: required`; el cliente respeta la selección enviada por el servidor y admite más llaves compatibles.

La base de datos ya admite varias filas por usuario. La unicidad permanece en `credential_id`, que es el comportamiento correcto: un usuario puede tener varias credenciales distintas, pero la misma credencial no puede duplicarse.

## Modal de descarga masiva SAT

### Nueva jerarquía

El modal se organiza como un proceso de tres pasos:

1. Acceso: e.firma o RFC + Contraseña SAT.
2. Consulta: periodo o mes y tipo de movimiento.
3. Resultado: solicitud, automatización e importación.

El expediente activo aparece separado del título, el selector de autenticación funciona como barra de comando y el seguimiento conserva su panel propio. En escritorio, formulario y seguimiento aprovechan la altura del modal sin desplazar toda la ventana; en pantallas pequeñas vuelven a un flujo vertical.

### Facturas recibidas por mes

El portal del SAT no consulta las recibidas mediante un rango. Cuando se selecciona `Sólo recibidas`:

- la interfaz muestra un selector de mes;
- el valor interno se normaliza al primer y último día de ese mes para mantener el contrato existente con el servidor;
- el texto de alcance indica explícitamente el mes que se consultará.

Cuando se solicitan emitidas y recibidas, la interfaz aclara que las emitidas usan el rango y las recibidas usan el mes correspondiente a la fecha inicial.

El componente `DateTimePicker` incorpora el modo reutilizable `monthOnly`. En este modo oculta los días, presenta mes y año y emite el primer día del mes seleccionado.

## Opiniones de cumplimiento

### Panorama positivo

La antigua fila de seis cifras con el mismo peso visual se sustituyó por una composición asimétrica:

- el número de opiniones positivas es el resultado principal;
- se calcula la cobertura favorable sobre los clientes que ya tienen una consulta registrada;
- una barra muestra la proporción positiva;
- clientes totales, situaciones que requieren atención, opiniones no públicas, pendientes de consulta y PDF archivados quedan como métricas secundarias.

El cálculo utilizado es:

```text
clientes revisados = clientes totales - clientes sin consultar
cobertura favorable = opiniones positivas / clientes revisados × 100
```

Cuando todavía no hay clientes revisados, la cobertura se muestra como 0 % y se evita una división inválida.

### Lectura de registros

- Las filas positivas tienen una guía verde discreta.
- La fila seleccionada usa una superficie favorable sin perder contraste.
- El detalle positivo se presenta como evidencia del SAT, con marca visual, estado y explicación breve.
- El recorrido de ayuda apunta ahora al nuevo panorama principal.

## Validación

- `npm run type-check`: correcto.
- `npm run build-only`: correcto.
- `git diff --check`: correcto.
- La compilación de Vite procesó los componentes, plantillas y hojas de estilo nuevas.

La revisión visual automatizada no pudo abrir el navegador local por una restricción del sandbox de Codex. La aplicación sí compiló en producción; queda recomendada una comprobación manual rápida en la sesión autenticada para evaluar datos reales y el diálogo nativo de WebAuthn.
