# Descarga de CFDI del SAT

Este documento describe cómo obtiene CFDI el módulo **Fiscal**, qué método de autenticación usa en cada caso, dónde viven las credenciales y qué ocurre desde que el usuario abre el modal hasta que los XML aparecen en el expediente.

## Todo lo que cubre el sistema

La descarga del SAT tiene dos caminos reales, seleccionables desde el mismo modal:

| Método               | Autenticación                                             | Alcance                                   | Interacción necesaria                                                          |
| -------------------- | --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| **e.firma**          | Certificado `.cer`, llave `.key` y contraseña de la llave | Web service oficial de descarga masiva    | Elegir periodo y dirección; el servidor continúa solo                          |
| **RFC + Contraseña** | RFC y Contraseña SAT guardados en el cliente              | Portal de consulta y recuperación de CFDI | Elegir periodo y resolver el CAPTCHA; el servidor consulta, descarga e importa |

No son dos presentaciones del mismo mecanismo. El SAT permite e.firma y Contraseña en su portal web, pero el **web service** de recuperación masiva se habilita con e.firma. DespachoApp respeta esa separación:

- con e.firma crea solicitudes de descarga masiva y las procesa en segundo plano;
- con RFC + Contraseña crea una sesión temporal del portal oficial y mantiene la credencial fuera del navegador.

La carga manual de XML o ZIP sigue disponible en la vista principal de Fiscal. No se duplica dentro del modal de descarga SAT.

## Selector de autenticación

Al abrir **Descarga masiva SAT**, el usuario elige **e.firma** o **RFC + Contraseña**.

El cambio de método también cambia el flujo completo:

- **e.firma** muestra periodo, movimiento, credencial guardada y solicitudes recientes;
- **RFC + Contraseña** verifica los datos fiscales del cliente, permite elegir periodo y movimiento, prepara el CAPTCHA y convierte el panel derecho en seguimiento automático. La sesión interactiva sólo aparece como recuperación si el SAT cambia un paso.

Si se abandona el método RFC + Contraseña o se cierra el modal, la sesión del navegador remoto se destruye. Volver a e.firma no deja cookies del SAT activas.

## Reconsulta de solicitudes anteriores

El panel de seguimiento permite retomar una consulta sin reconstruirla a mano:

- **e.firma:** las solicitudes se conservan en el servidor. **Consultar estado** fuerza una verificación de la petición existente ante el SAT y actualiza código, mensaje, identificador, intentos y fecha. **Volver a solicitar** crea una petición nueva sólo cuando la anterior ya terminó con error, fue cancelada o no encontró datos. Las solicitudes terminadas pueden eliminarse del historial con una confirmación.
- **RFC + Contraseña:** el navegador guarda localmente, por cliente, hasta 12 referencias con sus periodos independientes, movimiento, estado y conteos. **Consultar de nuevo** abre una sesión nueva con esos datos y solicita otro CAPTCHA; **Eliminar** borra únicamente esa referencia local.

El historial local de RFC + Contraseña no contiene la contraseña, cookies, CAPTCHA, archivos ni datos de la e.firma. Puede desaparecer si se limpian los datos locales del navegador. Las sesiones del portal siguen siendo temporales y se destruyen al cerrar el modal o cambiar el método de acceso.

### Cuando una solicitud requiere atención

La etiqueta **Requiere atención** siempre se acompaña con el mejor diagnóstico disponible: mensaje y código del SAT, identificador de solicitud, intentos, fecha de actualización y una recomendación concreta. Si el SAT no proporciona una descripción, la interfaz lo dice expresamente y conserva las opciones de consultar otra vez o repetir la solicitud.

## Flujo automático con e.firma

1. El usuario selecciona el cliente y abre el modal.
2. La primera vez adjunta `.cer`, `.key` y la contraseña de la llave privada.
3. El servidor valida antes de guardar:
   - formato X.509 del certificado;
   - apertura de la llave con la contraseña indicada;
   - correspondencia criptográfica entre certificado y llave;
   - vigencia del certificado;
   - uso como e.firma, no como Certificado de Sello Digital;
   - coincidencia entre el RFC del certificado y el RFC del cliente.
4. La interfaz recibe únicamente metadatos públicos: RFC, serie, vigencia y huella SHA-256 abreviada.
5. El usuario activa emitidas, recibidas o ambas. Las emitidas usan un rango de fechas de hasta 31 días y las recibidas un selector mensual independiente.
6. El servidor firma localmente la autenticación y crea la solicitud en el web service del SAT.
7. Un proceso en segundo plano verifica el estado, descarga los paquetes disponibles y extrae los XML.
8. Cada XML pasa por el importador fiscal: valida RFC relacionado, UUID, estructura, timbre, clasificación y duplicados.
9. El seguimiento muestra documentos nuevos, existentes y rechazados.

La ventana puede cerrarse después de enviar la solicitud. El servidor conserva el trabajo y continúa consultando al SAT.

### Por qué se corrigió el error HTTP 500

El esquema actual del SAT separa las operaciones:

- `SolicitaDescargaEmitidos` para comprobantes emitidos;
- `SolicitaDescargaRecibidos` para comprobantes recibidos.

La integración usa `@nodecfdi/sat-ws-descarga-masiva` para construir los mensajes de la versión 1.5, aplicar la firma XML y respetar el orden de WS-Security. Ya no depende de una plantilla SOAP artesanal con la operación genérica `SolicitaDescarga`.

Un HTTP 500 todavía puede indicar indisponibilidad temporal del SAT. Los fallos 408, 429 y 5xx se tratan como transitorios dentro del procesamiento en segundo plano; un error local de certificado se informa antes de intentar la conexión.

## Flujo con RFC + Contraseña

### De dónde salen los datos

El frontend no pide RFC ni Contraseña.

El servidor consulta el cliente seleccionado:

- `clientes.rfc` aporta el RFC;
- `clientes.ciecf` aporta la Contraseña SAT cifrada.

El endpoint de disponibilidad sólo responde si ambos datos están configurados y devuelve el RFC y nombre del cliente. Nunca devuelve `ciecf`, la Contraseña descifrada, su longitud ni una representación parcial.

Si falta alguno, el modal indica que debe completarse en los datos fiscales del cliente. No crea una segunda copia de la credencial.

### Inicio de sesión y automatización

1. El usuario elige **RFC + Contraseña**.
2. El servidor verifica la credencial del cliente y crea un contexto aislado de Chromium.
3. Ese navegador sólo permite solicitudes a `sat.gob.mx` y sus subdominios.
4. El portal redirige al formulario oficial de autenticación.
5. El servidor captura únicamente la imagen del CAPTCHA y la presenta en el modal.
6. El usuario escribe el CAPTCHA.
7. En ese momento el servidor descifra `ciecf` en memoria, completa RFC, Contraseña y CAPTCHA, y envía el formulario al SAT mediante HTTPS.
8. Si el acceso es válido, el servidor consulta primero las facturas emitidas por el rango seleccionado y después las recibidas por el mes seleccionado.
9. En emitidas activa la búsqueda por fecha; en recibidas configura los selectores de año y mes. Después ejecuta `Buscar CFDI` y activa la descarga disponible.
10. El panel derecho separa **Proceso actual** de **Consultas anteriores** para que el historial no cubra el progreso ni los archivos.

Si el SAT cambia una etiqueta o control, la automatización conserva la sesión autenticada y habilita **Recuperación manual**. Sólo en ese caso se presenta la captura interactiva para resolver el paso inesperado.

La Contraseña debe enviarse al SAT porque es el factor de autenticación elegido. La garantía del sistema es más precisa: **no se envía al frontend, no se registra en logs, no se entrega a terceros y sólo se transmite al dominio oficial del SAT durante el inicio de sesión**.

### Descarga e importación

Cuando una acción dentro del portal produce una descarga:

1. Playwright recibe el archivo dentro del contexto temporal.
2. Se limita a 100 MB.
3. Se reconoce por extensión o contenido como XML o ZIP.
4. Un ZIP se expande en memoria y sólo conserva entradas XML.
5. Se aplican los mismos límites y validaciones del importador manual.
6. Los CFDI válidos se guardan en el expediente del cliente; los UUID existentes se cuentan como duplicados.
7. El modal informa nuevos, existentes y rechazados y la vista Fiscal se actualiza.

Descargas que no sean XML o ZIP se ignoran; por ejemplo, una representación PDF no se incorpora como CFDI.

## Arquitectura de la sesión del portal

```text
Modal Fiscal
  │  clientId + periodo + movimiento + CAPTCHA
  ▼
API autenticada
  │  consulta RFC/ciecf cifrada
  ▼
Contexto Chromium temporal ─── HTTPS ─── Portal oficial del SAT
  │
  ├─ CAPTCHA → modal
  ├─ consulta y descarga automáticas → progreso
  ├─ captura interactiva → sólo recuperación manual
  └─ XML/ZIP descargado → validación CFDI → expediente fiscal
```

Características de aislamiento:

- una sesión pertenece al usuario autenticado que la creó;
- otro usuario no puede consultar, controlar ni cerrar ese identificador;
- máximo configurable de sesiones simultáneas; por defecto, cuatro;
- vencimiento por 15 minutos de inactividad;
- cookies sólo en memoria;
- cierre explícito al cerrar el modal o cambiar a e.firma;
- limpieza periódica de sesiones vencidas;
- navegación, scripts y peticiones de datos restringidos a dominios del SAT; sólo se permiten estilos, fuentes, imágenes y medios HTTPS externos necesarios para que el portal conserve su formato;
- CAPTCHA resuelto por una persona; no se intenta eludirlo.

## Cifrado y almacenamiento

### e.firma

La migración `014_client_efirma.sql` crea una fila por cliente en `cliente_efirma`. Certificado, llave y contraseña se almacenan con AES-256-GCM, IV aleatorio y etiqueta de autenticación.

La llave privada y su contraseña se descifran sólo para firmar localmente. El certificado `.cer` es público y forma parte de la autenticación WS-Security que recibe el SAT.

### Contraseña SAT del cliente

`clientes.ciecf` utiliza el mismo almacenamiento cifrado de secretos. Los registros antiguos en texto se migran con `sensitiveDataMigration`; `decryptText` también conserva compatibilidad durante la transición.

La clave maestra proviene exclusivamente de `DATA_ENCRYPTION_KEY` y debe contener 32 bytes en Base64 o 64 caracteres hexadecimales. No se guarda en MySQL, frontend ni Git.

### Respaldo y rotación

Un respaldo recuperable necesita:

- base de datos;
- almacenamiento de documentos/XML;
- copia protegida de la misma `DATA_ENCRYPTION_KEY`.

Para rotar la clave:

1. Genera y verifica un respaldo completo.
2. Conserva la clave anterior en `OLD_DATA_ENCRYPTION_KEY`.
3. Coloca la nueva clave en `DATA_ENCRYPTION_KEY`.
4. Ejecuta `npm run security:rotate-client-secrets`.
5. Verifica que el script recifre y valide los secretos dentro de su transacción.
6. Retira `OLD_DATA_ENCRYPTION_KEY` cuando termine la rotación.

No cambies la clave sin rotación: los secretos existentes quedarían ilegibles.

## Límites del importador

Tanto las cargas desde la vista principal como las descargas capturadas en la sesión SAT respetan:

- 100 MB por XML o ZIP recibido;
- hasta 5,000 XML por carga expandida;
- 10 MB por XML;
- 250 MB totales sin comprimir;
- rechazo de XML cuyo RFC emisor o receptor no corresponda al cliente;
- detección global de UUID duplicados.

Las rutas internas de un ZIP no se escriben directamente en disco. Se procesan en memoria para evitar recorridos fuera del almacenamiento fiscal.

## API

Todas las rutas requieren el mismo token que protege el módulo Fiscal.

### e.firma y web service

| Método   | Ruta                                   | Función                                               |
| -------- | -------------------------------------- | ----------------------------------------------------- |
| `GET`    | `/fiscal/sat-credentials?clientId=...` | Estado y metadatos públicos de e.firma                |
| `POST`   | `/fiscal/sat-credentials`              | Valida y guarda/reemplaza `.cer`, `.key` y contraseña |
| `DELETE` | `/fiscal/sat-credentials/:clientId`    | Elimina la credencial persistente                     |
| `POST`   | `/fiscal/sat-downloads`                | Crea solicitudes masivas con la e.firma guardada      |
| `GET`    | `/fiscal/sat-downloads?clientId=...`   | Lista el avance de las solicitudes                    |
| `POST`   | `/fiscal/sat-downloads/:id/refresh`    | Vuelve a verificar una petición existente ante el SAT |
| `DELETE` | `/fiscal/sat-downloads/:id/history`    | Elimina una solicitud terminada del historial         |
| `DELETE` | `/fiscal/sat-downloads/:id`            | Cancela una solicitud activa                          |

### RFC + Contraseña y portal

| Método   | Ruta                                            | Función                                                                              |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET`    | `/fiscal/sat-password-credentials?clientId=...` | Indica si el cliente tiene RFC y Contraseña configurados                             |
| `POST`   | `/fiscal/sat-portal/sessions`                   | Crea el navegador temporal con cliente, periodo y movimiento                         |
| `GET`    | `/fiscal/sat-portal/sessions/:sessionId`        | Devuelve fase, CAPTCHA, progreso, descargas y recuperación disponible                |
| `POST`   | `/fiscal/sat-portal/sessions/:sessionId/login`  | Envía el CAPTCHA; el servidor agrega la credencial y comienza la consulta automática |
| `POST`   | `/fiscal/sat-portal/sessions/:sessionId/manual` | Habilita la captura interactiva cuando falló la automatización                       |
| `POST`   | `/fiscal/sat-portal/sessions/:sessionId/input`  | Reproduce interacción permitida únicamente durante la recuperación manual            |
| `POST`   | `/fiscal/sat-portal/sessions/:sessionId/reload` | Destruye el contexto fallido y abre uno nuevo                                        |
| `DELETE` | `/fiscal/sat-portal/sessions/:sessionId`        | Destruye navegador, cookies y memoria de la sesión                                   |

### Importación general

| Método | Ruta             | Función                                              |
| ------ | ---------------- | ---------------------------------------------------- |
| `POST` | `/fiscal/import` | Importa XML o ZIP desde la vista principal de Fiscal |

## Puesta en marcha

Desde `despachoapp-server`:

```bash
npm install
npm run security:generate-key
npm run db:migrate
npm test
npm start
```

El flujo RFC + Contraseña requiere Chrome, Chromium o Edge en el servidor. La detección usa ubicaciones habituales; en contenedores o instalaciones personalizadas configura `CHROMIUM_PATH`.

En producción:

- sirve la API detrás de HTTPS;
- protege `DATA_ENCRYPTION_KEY` con el gestor de secretos de la infraestructura;
- restringe Fiscal a personal autorizado;
- dimensiona `SAT_BROWSER_MAX_SESSIONS` según memoria disponible;
- evita registrar cuerpos de las rutas de login.

## Diagnóstico

### “Falta la Contraseña SAT”

El cliente no tiene RFC o `ciecf`. Completa ambos en sus datos fiscales y vuelve a abrir el modal. La Contraseña no se captura en el modal porque el expediente es la única fuente de verdad.

### El CAPTCHA cambia después de enviar

El SAT rechazó el texto o la credencial. Usa la imagen nueva. Si vuelve a fallar, valida la Contraseña guardada en el cliente.

### “Chromium no está instalado”

Instala Chrome/Chromium/Edge en el servidor o configura `CHROMIUM_PATH`. Este requisito sólo afecta al método RFC + Contraseña; el web service con e.firma no abre navegador.

### La recuperación manual no responde al teclado

La captura sólo se habilita después de pulsar **Abrir recuperación manual**. Haz clic primero sobre el campo visible; el modal enfoca un capturador invisible y reenvía texto y teclas permitidas a la coordenada seleccionada.

## Reglas de reportes y complementos

Las reglas de selección excepcional, el resaltado amarillo de tasa 0%, exentos y devoluciones, y la relación entre complementos de pago y sus facturas se documentan en [Flujo SAT y reglas CFDI](./FLUJO_SAT_Y_REGLAS_CFDI.md).

### Una descarga no se importó

Comprueba el estado bajo la captura del portal. Sólo XML y ZIP se importan como CFDI. Un PDF se ignora; un XML ajeno al RFC del cliente se rechaza.

### “La e.firma no está vigente”

Revisa la fecha de expiración y usa **Reemplazar** con los archivos renovados.

### “El certificado no corresponde al RFC”

El RFC del `.cer` no coincide con el cliente. Corrige el expediente o selecciona la e.firma del contribuyente correcto.

### El SAT responde HTTP 500

La solicitud usa las operaciones vigentes. Reintenta para descartar indisponibilidad temporal y revisa el mensaje específico. En RFC + Contraseña la interfaz conserva también el código interno y la etapa exacta donde se detuvo la automatización, en lugar de mostrar el aviso genérico “El SAT cambió un paso”. Confirma además que los archivos sean e.firma y no CSD. Si el web service permanece indisponible, selecciona RFC + Contraseña y entra al portal.

## Referencias oficiales

- Consulta y recuperación de comprobantes: <https://wwwmat.sat.gob.mx/consultas/42968/consulta-y-recuperacion-de-comprobantes-%28nuevo%29>
- Formulario oficial de acceso por Contraseña: <https://cfdiau.sat.gob.mx/nidp/app/login?id=SATUPCFDiCon&option=credential>
- URLs productivas del servicio de descarga masiva: <https://wwwmat.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461174995058&ssbinary=true>
- Documentación de solicitud de descarga: <https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175195160&ssbinary=true>
