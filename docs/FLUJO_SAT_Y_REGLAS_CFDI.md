# Descarga SAT por Contraseña y reglas de inclusión de CFDI

## Propósito

Este documento describe el flujo completo de descarga por RFC + Contraseña SAT, las medidas que evitan exponer credenciales y las reglas visuales y operativas usadas al preparar reportes fiscales.

La intención del diseño es que la persona usuaria sólo intervenga donde el SAT lo exige: el CAPTCHA. Después de validarlo, DespachoApp consulta el periodo, descarga los archivos y los importa al expediente sin mostrar ni obligar a operar el navegador remoto.

## Flujo de usuario

1. Se abre `Fiscal > Descarga masiva SAT` y se selecciona `RFC + Contraseña`.
2. La aplicación toma el RFC y la Contraseña SAT cifrada del expediente del cliente.
3. Se eligen fecha inicial, fecha final y movimiento: emitidas, recibidas o ambas.
4. El servidor crea una sesión aislada de Chromium y abre el acceso oficial del SAT.
5. La aplicación muestra únicamente la imagen del CAPTCHA. No muestra la Contraseña ni la envía al navegador del usuario.
6. La persona captura el CAPTCHA y pulsa `Validar y descargar`.
7. Si el SAT acepta el acceso, el servidor continúa automáticamente:
   - abre la consulta de emitidas o recibidas;
   - selecciona la búsqueda por fecha;
   - llena el periodo;
   - ejecuta `Buscar CFDI`;
   - selecciona y descarga los XML o ZIP disponibles;
   - valida el contenido;
   - importa cada CFDI al expediente fiscal.
8. El modal presenta etapa, avance, número de consultas y descargas procesadas.
9. Al terminar, Fiscal actualiza la tabla sin requerir una carga manual.

## Arquitectura del recorrido

| Etapa         | Frontend                                         | Servidor                                                   | Resultado                                              |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| Configuración | Envía cliente, movimiento y periodo              | Valida RFC, credencial y rango máximo de 31 días           | La consulta queda delimitada antes de abrir el SAT     |
| Autenticación | Presenta el CAPTCHA                              | Completa RFC y Contraseña dentro del navegador aislado     | La credencial no se expone a la interfaz               |
| Consulta      | Muestra progreso                                 | Navega por emitidas y/o recibidas, llena fechas y busca    | No se requiere interacción con el portal               |
| Descarga      | Muestra conteos                                  | Escucha descargas del SAT y acepta XML o ZIP               | Los archivos no pasan por el navegador del usuario     |
| Importación   | Actualiza Fiscal                                 | Expande ZIP, analiza CFDI, detecta duplicados y guarda XML | El expediente queda listo para conciliación y reportes |
| Recuperación  | Ofrece un botón sólo al fallar la automatización | Habilita una captura interactiva de la misma sesión        | Un cambio del SAT no bloquea por completo la operación |

## Seguridad de la sesión

- La Contraseña SAT se conserva cifrada en el expediente y se descifra únicamente al completar el formulario oficial dentro del servidor.
- El frontend nunca recibe la Contraseña descifrada.
- Cookies, sesión autenticada y contexto de navegación viven dentro de una sesión temporal del servidor.
- Cada sesión pertenece al usuario que la creó; otro usuario no puede consultar ni controlar su identificador.
- La sesión vence después de 15 minutos de inactividad y también se destruye cuando se cierra el modal.
- La navegación principal sólo acepta dominios `sat.gob.mx` y sus subdominios.
- Para conservar el formato visual del portal se permiten recursos HTTPS de imagen, fuente, estilo y medios; scripts, XHR y documentos externos continúan bloqueados.
- Sólo se importan descargas reconocidas como XML CFDI o ZIP. Otros formatos se ignoran.
- Cada descarga está limitada a 100 MB antes de procesarse.

## Recuperación manual

El portal del SAT es una aplicación externa y puede cambiar identificadores, botones o pasos sin previo aviso. Por ello la automatización usa selectores redundantes: etiquetas accesibles, texto visible, nombres e identificadores de controles.

Si aun así no encuentra una fecha, enlace de consulta o control de descarga:

1. La sesión cambia a `Requiere atención`.
2. Se conserva la página autenticada; no se obliga a iniciar sesión otra vez.
3. Aparece `Abrir recuperación manual`.
4. Sólo entonces se muestra la captura interactiva del portal.
5. Los XML o ZIP descargados durante esa recuperación siguen entrando por el mismo validador e importador automático.

La recuperación es una salida de compatibilidad, no el flujo principal.

## Reglas de selección para reportes

La selección distingue entre bloqueo real, advertencia y señal informativa.

| Condición del CFDI                                        | Color / tratamiento         | ¿Seleccionable? | Motivo                                                               |
| --------------------------------------------------------- | --------------------------- | --------------- | -------------------------------------------------------------------- |
| Marcado `sin efectos fiscales` (`diot_efecto_fiscal = 0`) | Rojo, casilla deshabilitada | No              | Es el único bloqueo estricto para reportes                           |
| Tasa 0%                                                   | Amarillo                    | Sí              | Debe identificarse y revisarse en el corte                           |
| Operación exenta                                          | Amarillo                    | Sí              | Debe identificarse y revisarse en el corte                           |
| Egreso o devolución, tipo `E`                             | Amarillo                    | Sí              | Representa una disminución o devolución que requiere lectura visible |
| Nómina, tipo `N`                                          | Advertencia amarilla suave  | Sí              | Puede incluirse si existe un caso excepcional justificado            |
| Forma de pago `99`                                        | Advertencia amarilla suave  | Sí              | Se permite incluirla, pero requiere validar el soporte               |
| Efectivo mayor a $2,000                                   | Advertencia amarilla suave  | Sí              | Se permite el caso excepcional, por ejemplo un ingreso alto          |
| Gasolina pagada en efectivo                               | Advertencia amarilla suave  | Sí              | Se permite incluirla con revisión expresa                            |

Las advertencias no eliminan información ni sustituyen el criterio contable; hacen visible la excepción antes de guardar el reporte.

## Complementos de pago

Los CFDI tipo `P` aparecen en una sección independiente llamada `Complementos de pago`.

La relación se obtiene de `cfdi_pagos.uuid_documento` y se cruza con `cfdi_facturas.uuid`. Para cada complemento se muestra:

- cantidad de facturas relacionadas;
- folio, o UUID abreviado si no hay folio;
- importe aplicado a cada factura;
- acceso al detalle de la factura relacionada cuando el XML ya existe en el expediente.

La misma separación se conserva en los reportes:

- el PDF agrega encabezados de sección y muestra las facturas a las que aplica cada complemento;
- el Excel agrega secciones, una columna de revisión y otra de facturas relacionadas;
- los CFDI a 0%, exentos o de devolución también conservan el resaltado amarillo en PDF y Excel.

## Límites del SAT

La consulta por Contraseña usa la vista oficial de consulta y recuperación. DespachoApp limita cada ejecución a 31 días para mantener consultas controlables y compatibles con el formulario.

El SAT informa que la consulta presenta hasta 500 CFDI para descarga visible y aplica límites diarios de recuperación. Si un periodo concentra más documentos, debe dividirse en rangos menores. Referencia: [Consulta y recuperación de comprobantes del SAT](https://wwwmat.sat.gob.mx/consultas/42968/consulta-y-recuperacion-de-comprobantes-%28nuevo%29).

## Verificación técnica

La implementación se verifica con:

- pruebas unitarias de normalización de periodo, movimiento y formato de fecha del portal;
- pruebas de restricción de dominios y tipos de recursos externos;
- pruebas de detección segura de XML y ZIP;
- comprobación de tipos de Vue y TypeScript;
- compilación de producción del frontend;
- validación de sintaxis de los controladores y servicios del servidor;
- ejecución del conjunto completo de pruebas del backend.

## Archivos principales

- Frontend del modal: `src/components/adminApp/SatMassDownload/`
- Contrato HTTP del frontend: `src/service/adminApp/fiscalService.ts`
- Automatización del portal: `despachoapp-server/src/services/satCfdiPortalBrowserService.js`
- Endpoints y credenciales: `despachoapp-server/src/controllers/satMassDownload.controller.js`
- Reglas de selección y relaciones de pago: `despachoapp-server/src/controllers/fiscal.controller.js`
- Vista y exportaciones fiscales: `src/components/adminApp/Fiscal/`
