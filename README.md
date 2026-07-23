# DespachoApp

Aplicación web para la operación de un despacho contable. Reúne administración de clientes, tareas, pagos, cortes de caja, notas internas, auditoría de cambios y cálculo fiscal a partir de CFDI XML.

El sistema se divide en dos repositorios:

- `despachoapp-vue`: interfaz web desarrollada con Vue 3, TypeScript y Vite.
- `despachoapp-server`: API desarrollada con Node.js, Express y MySQL.

## Funciones principales

- Panel de ingresos, costos y tareas pendientes.
- Tablero Kanban para asignar y dar seguimiento a tareas.
- Expedientes de clientes con RFC, datos de contacto, FIEL y CIECF.
- Registro de pagos mensuales y pagos por concepto.
- Cortes de caja, exportación a Excel e impresión de comprobantes.
- Importación y clasificación de CFDI 4.0 desde archivos XML.
- Separación de facturas emitidas/ingresos y recibidas/egresos.
- Reportes fiscales mensuales, anuales y DIOT.
- Archivo TXT de carga masiva para DIOT.
- Consulta individual y masiva de opiniones de cumplimiento públicas del SAT.
- Clasificación de opiniones, descarga del PDF y archivo automático en el expediente del cliente.
- Notas internas organizadas en carpetas.
- Bitácora de operaciones con opción de revertir cambios compatibles.
- Administración de usuarios, perfiles y permisos.
- Diseño adaptable para escritorio y dispositivos móviles.

## Actualización de cumplimiento y diseño (22 de julio de 2026)

- Se agregó la vista **Opiniones de cumplimiento** con consulta pública individual y masiva por RFC.
- El resultado distingue opinión positiva, con pendientes, suspensión de actividades, inscrito sin obligaciones, no inscrito, cancelado, no localizado, no pública y error de consulta.
- Cuando el SAT entrega un PDF, el servidor lo descarga, cifra y guarda automáticamente en los documentos del cliente junto con sus metadatos.
- La vista muestra fecha de consulta, fecha de emisión, vigencia disponible, régimen fiscal y acciones pendientes detectadas.
- Se incorporó una guía paso a paso para autorizar ante el SAT la publicación de una opinión positiva.
- Los filtros por resultado y régimen fiscal usan botones de opción dentro de un modal, con acciones para aplicar, cancelar y restablecer.
- Los clientes ahora incluyen régimen fiscal para separar RESICO, RIF, actividad empresarial, personas morales y los demás regímenes del catálogo.
- Las tablas de Clientes y Pagos conservan desplazamiento horizontal estable en pantallas pequeñas y ocultan el paginador cuando no es necesario.
- Los reportes guardados se exportan a Excel con encabezados y totales limitados a las columnas con datos.
- La fila de totales del PDF fiscal usa fondo gris y mantiene importes y etiquetas alineados.
- El patrón visual del fondo ahora se mantiene visible en Inicio, Tareas, Clientes, Pagos, Fiscal, Cumplimiento y Ajustes, sin afectar el contraste de tablas y formularios.

## Requisitos

- Windows 10/11, Linux o macOS.
- Node.js 20 o 22.
- npm 10 o una versión compatible con Node.js.
- MySQL 8 o una versión reciente de MariaDB incluida con XAMPP.
- XAMPP, Docker Compose u otra instalación de MySQL.
- Git, si los repositorios se obtendrán desde GitHub.
- Un navegador moderno: Chrome, Edge o Firefox.

Para impresión térmica directa se necesita además el complemento local `Plugin_Impresora_termica.exe`, disponible desde los diálogos de impresión de la aplicación.

## Estructura esperada

Los repositorios pueden estar en cualquier ubicación, pero resulta práctico mantenerlos como carpetas hermanas:

```text
Proyectos/
├── despachoapp-vue/
├── despachoapp-server/
└── despachoapp-docker-compose/
    └── mysql-init/
        └── 01-init.sql
```

## Instalación rápida con XAMPP

### 1. Preparar la base de datos

1. Abre el panel de XAMPP.
2. Inicia el servicio **MySQL**.
3. Abre `http://localhost/phpmyadmin`.
4. Entra a la pestaña **Importar**.
5. Selecciona `despachoapp-docker-compose/mysql-init/01-init.sql`.
6. Ejecuta la importación.

El archivo crea la base `kanbanpagos`, sus tablas, relaciones, vistas y usuarios iniciales.

También puede importarse desde una terminal que tenga disponible el cliente de MySQL:

```bash
mysql -u root -p < ../despachoapp-docker-compose/mysql-init/01-init.sql
```

Si el usuario `root` de XAMPP no tiene contraseña, presiona Enter cuando MySQL la solicite.

### 2. Configurar el servidor

En `despachoapp-server`, crea o actualiza el archivo `.env`:

```dotenv
VITE_API_SQL_IP=127.0.0.1
VITE_SQL_PORT=3306
VITE_SQL_USER=root
VITE_SQL_PASS=
VITE_SQL_DB=kanbanpagos
JWT_SECRET=cambia-esta-clave-por-una-larga-y-aleatoria
DATA_ENCRYPTION_KEY=pega-aqui-una-clave-base64-de-32-bytes
PORT=5000
```

Opcionalmente se puede definir otra carpeta para los CFDI:

```dotenv
CFDI_XML_DIR=C:/ruta/privada/cfdi
CLIENT_DOCUMENT_DIR=C:/ruta/privada/documentos-clientes
```

Genera `DATA_ENCRYPTION_KEY` desde el servidor con:

```bash
npm run security:generate-key
```

Copia el resultado al `.env` antes de ejecutar migraciones. Esta clave cifra XML, documentos y credenciales FIEL/CIECF con AES-256-GCM. No la publiques ni la guardes en Git. Sin la misma clave no es posible recuperar los archivos o secretos cifrados, por lo que debe conservarse en un gestor de secretos y en el respaldo seguro del despliegue.

Aunque algunas variables de base de datos comienzan con `VITE_`, pertenecen al servidor y no deben colocarse en el `.env` público del frontend. El archivo `.env` del servidor está excluido de Git.

Instala las dependencias:

```bash
cd ../despachoapp-server
npm install
```

### 3. Ejecutar las migraciones

Las migraciones no se ejecutan al iniciar el servidor. Deben aplicarse manualmente después de importar la base inicial y cada vez que se agreguen migraciones nuevas:

```bash
npm run db:migrate
```

Este comando:

- crea o actualiza las tablas del módulo fiscal;
- agrega proveedores, relaciones, complementos y reportes;
- prepara el almacenamiento de rutas XML;
- cifra las credenciales FIEL y CIECF existentes;
- retira esas credenciales de los eventos de auditoría antiguos;
- mueve a archivos cifrados del servidor cualquier XML antiguo guardado dentro de la base de datos;
- crea el catálogo de documentos PDF cifrados por cliente.

No inicies el módulo Fiscal contra una base nueva sin ejecutar antes este comando.

### 4. Cargar datos de ejemplo (opcional)

En el entorno de desarrollo puede cargarse información para probar clientes, tareas, pagos, notas, facturas, impuestos, reportes y DIOT:

```bash
npm run db:seed:example
```

El comando utiliza `despachoapp-server/scripts/seed-example.sql`. Este archivo es deliberadamente local y está incluido en `.gitignore`, por lo que no se publica en GitHub ni estará presente automáticamente en un clon nuevo.

El sembrador es idempotente para sus registros identificados como `DEMO`: puede ejecutarse nuevamente sin duplicarlos. Debe usarse únicamente en desarrollo o en una base preparada para pruebas.

### 5. Iniciar el servidor

```bash
cd ../despachoapp-server
npm start
```

La API quedará disponible de forma predeterminada en:

```text
http://localhost:5000
```

El inicio normal del servidor no modifica el esquema de la base de datos.

### 6. Configurar el frontend

En `despachoapp-vue`, crea un archivo `.env` con la dirección de la API:

```dotenv
VITE_API_SERVER_IP=http://localhost:5000
```

Instala las dependencias e inicia Vite:

```bash
cd ../despachoapp-vue
npm install
npm run dev
```

Vite mostrará la dirección local, normalmente:

```text
http://localhost:5173
```

### 7. Primer acceso

La base inicial incluye una cuenta administrativa de desarrollo:

```text
Usuario: admin
Contraseña: admin
```

Después del primer acceso, cambia la contraseña y revisa los permisos. No utilices estas credenciales en producción.

## Comandos disponibles

### Frontend

Ejecutar el entorno de desarrollo:

```bash
npm run dev
```

Comprobar TypeScript y generar la versión de producción:

```bash
npm run build
```

Previsualizar localmente el resultado de `dist`:

```bash
npm run preview
```

### Servidor

Iniciar la API:

```bash
npm start
```

Aplicar migraciones manuales:

```bash
npm run db:migrate
```

Cargar datos locales de ejemplo:

```bash
npm run db:seed:example
```

Ejecutar las pruebas unitarias del lector CFDI:

```bash
npm test
```

Ejecutar la prueba integral del módulo fiscal:

```bash
npm run test:fiscal:e2e
```

La prueba integral utiliza la base configurada en `.env`; no debe ejecutarse contra producción.

## Actualización de seguridad de dependencias

El 19 de julio de 2026 se actualizaron las dependencias afectadas por las alertas de GitHub y `npm audit`:

| Dependencia | Versión instalada anterior | Versión nueva | Motivo |
| --- | ---: | ---: | --- |
| `axios` | `1.12.2` | `1.18.1` | Corrige alertas de SSRF, contaminación de prototipos, filtración de credenciales, inyección de encabezados y denegación de servicio. |
| `dompurify` | `3.3.0` | `3.4.12` | Corrige evasiones del sanitizado que podían permitir XSS y contaminación de la configuración. |
| `express` | `4.21.2` | `4.22.2` | Mantiene compatibilidad con Express 4 y actualiza `body-parser`, `qs` y `path-to-regexp` para corregir riesgos de DoS y ReDoS. |
| `jspdf` | `3.0.3` | `4.2.1` | Corrige lectura de archivos, traversal, inyección de objetos o JavaScript en PDF y denegaciones de servicio. El código usa ahora la importación nombrada requerida por la versión 4. |
| `jspdf-autotable` | `5.0.2` | `5.0.8` | Asegura compatibilidad declarada con `jsPDF 4` y conserva la generación de tablas fiscales. |
| `vite` | `6.4.1` | `6.4.3` | Corrige lectura arbitraria, traversal y exposición de hashes NTLM desde el servidor de desarrollo. |
| `xlsx` / SheetJS CE | `0.18.5` | `0.20.3` | Corrige contaminación de prototipos y ReDoS. Como npm no publica la versión corregida, se instala el paquete oficial desde `cdn.sheetjs.com`. |

También se ejecutó `npm audit fix` para actualizar dependencias transitivas como Rollup, Babel, Lodash, Minimatch, Picomatch, PostCSS, AJV y `serialize-javascript`. Después de la actualización, `npm audit` reportó **0 vulnerabilidades**.

Para reproducir exactamente estas versiones debe conservarse y utilizarse `package-lock.json`:

```bash
npm ci
npm audit
```

## Guía de ventanas

### Sitio público

#### Inicio público (`/`)

Presenta el producto y permite llegar al acceso o a la información institucional. No requiere sesión.

#### Acerca de (`/aboutus` y `/about`)

Muestra información general del despacho y del sistema.

#### Iniciar sesión (`/login`)

Autentica por nombre de usuario o correo electrónico. Al ingresar correctamente guarda el token y los datos básicos de la sesión en el navegador. El token tiene una vigencia de 30 días.

### Aplicación interna

#### Inicio (`/app`)

Es el resumen operativo del despacho.

- Compara ingresos y costos mediante gráficas.
- Permite cambiar el periodo entre día, mes, año y comparativo de años.
- Ofrece zoom y desplazamiento en las gráficas.
- Muestra una vista compacta de las tareas pendientes del usuario.
- Los datos más recientes aparecen primero y el resto se incorpora progresivamente para evitar bloquear la interfaz.

#### Tareas (`/app/tareas`)

Tablero Kanban para administrar el trabajo del equipo.

- Organiza las tareas en `Disponible`, `Pendiente`, `En Progreso` y `Terminado`.
- Permite crear, editar, asignar y mover tareas entre estados.
- Incluye búsqueda, paginación y vista de tareas propias.
- El selector de fecha y hora se abre en un modal para no deformar el tablero.
- Puede generar un reporte PDF de tareas tomando una fecha de corte.

Una tarea disponible todavía no tiene responsable. Al asignarla o comenzar su atención pasa a los estados de trabajo correspondientes.

#### Clientes (`/app/clientes`)

Administra los expedientes de los clientes del despacho.

- Alta, consulta, edición y eliminación de clientes.
- Búsqueda por los campos visibles y navegación por páginas.
- Registro de nombre, RFC, régimen fiscal, correo, teléfono, contraseña FIEL y contraseña CIECF.
- Las columnas sensibles permanecen ocultas por defecto y se revelan o copian mediante la interacción de la tabla.
- Expediente de PDF para INE, opinión fiscal, e.firma, constancia de situación fiscal y otros documentos.
- Carga por arrastre, descarga y eliminación de documentos con validación de tipo y límite de 15 MB.
- Los PDF y las credenciales se cifran en el servidor; MySQL conserva sólo metadatos y rutas de archivo.
- Los CFDI importados en Fiscal quedan asociados al `id_cliente` de este expediente.

La eliminación de un cliente puede afectar relaciones con pagos, tareas o CFDI. Debe confirmarse que el expediente ya no sea necesario antes de borrarlo.

#### Pagos (`/app/pagos`)

Concentra cobros, gastos, honorarios y cierres de caja. Al entrar a `/app/pagos` se abre directamente la vista de pagos por concepto.

**Por concepto** (`/app/pagos/concepto`)

- Registra cliente, asunto, usuario que atendió, importe cobrado, importe pagado y fecha.
- Permite crear, editar, eliminar e imprimir un comprobante.
- Exporta los registros a Excel.
- Los campos numéricos usan controles propios de incremento y decremento.

Desde el encabezado de Pagos también se puede:

- crear un nuevo pago;
- abrir el corte de caja;
- elegir un intervalo de fechas;
- previsualizar o imprimir el ticket del corte.

La impresión directa requiere que el complemento de impresora térmica esté instalado y ejecutándose. Si no está disponible, el mismo diálogo permite descargarlo.

#### Fiscal (`/app/fiscal`)

Calcula y organiza impuestos a partir de CFDI XML asociados a un cliente.

**Flujo recomendado**

1. Busca y selecciona un cliente escribiendo su nombre o RFC.
2. Elige emitidas/ingresos o recibidas/egresos.
3. Selecciona ejercicio y mes.
4. Arrastra los XML al área de importación o haz clic sobre ella para buscarlos.
5. Revisa la lista de archivos y confirma la importación.
6. Verifica la clasificación, selecciona los CFDI y guarda el reporte.

**Documentos compatibles**

- Facturas de ingreso.
- Facturas de egreso y notas de crédito.
- Recibos de nómina.
- Complementos de pago.
- Traslados.
- CFDI cancelados o sustituidos.
- Relaciones entre comprobantes.

El sistema valida que el archivo sea un CFDI timbrado y evita duplicados mediante el UUID.

**Información mostrada**

- Las facturas emitidas y recibidas aparecen en pestañas independientes.
- El sistema determina el sentido del CFDI comparando el RFC emisor y receptor con el RFC del cliente seleccionado.
- Estatus y tipo de comprobante.
- Nombre y RFC de la contraparte.
- Forma de pago: efectivo, cheque, tarjeta, transferencia u otra clave SAT.
- Importe abonado y saldo pendiente.
- Subtotales gravados al 16% y al 8%.
- IVA al 16% y al 8%.
- Bases exentas y a tasa 0%.
- Retenciones, incluido IEPS.
- Fecha de emisión y UUID.
- Productos, servicios, cantidades, unidades e impuestos desglosados.

Cada fila permite previsualizar una representación PDF, consultar el desglose, descargar el XML o eliminarlo.

La tabla muestra el subtotal acumulado de los CFDI seleccionados. El botón **Limpiar filtros** restablece la búsqueda, el periodo y la selección para comenzar una consulta nueva.

**Validación de selección**

- Un CFDI mensual sólo puede incluirse en el mes y año en que fue emitido.
- Un reporte anual sólo acepta CFDI del ejercicio correspondiente.
- Las emitidas sólo pueden utilizarse en el apartado de ingresos y las recibidas en el apartado de egresos.
- La importación rechaza archivos cuyo RFC emisor o receptor no corresponda al cliente y a la pestaña elegida.
- No son seleccionables las compras de gasolina pagadas en efectivo.
- No son seleccionables los comprobantes mayores a $2,000 pagados en efectivo.
- No son seleccionables los CFDI de nómina ni los comprobantes con método de pago por definir.

Los CFDI no seleccionables y los ya utilizados tienen estados visuales distintos. Cuando un comprobante ya pertenece a un reporte, la tabla indica el nombre del reporte en el que se usó.

**Proveedores y DIOT**

En las facturas recibidas, haz clic en el nombre del proveedor para configurar:

- tipo de tercero;
- tipo de operación;
- región fronteriza;
- importación de bienes o servicios;
- tratamiento de acreditamiento;
- proporción acreditable;
- identificador fiscal y país para proveedores extranjeros;
- efecto fiscal del comprobante.

La configuración se guarda por RFC y cliente, por lo que se reutiliza en las demás facturas del mismo proveedor.

**Reportes**

- Los reportes mensuales se organizan de enero a diciembre.
- Cada reporte mensual reúne ingresos emitidos y egresos recibidos en un solo PDF; cuando el contenido cabe, ambas tablas comparten página.
- Al guardar un reporte mensual de facturas recibidas se crea automáticamente su DIOT con exactamente los mismos CFDI.
- Los reportes anuales agrupan la selección del ejercicio.
- La selección queda almacenada para volver a generar el mismo corte.
- El nombre sugerido del reporte se completa automáticamente a partir del cliente, periodo y tipo de corte.
- El PDF se genera en orientación horizontal con nombre del cliente, logotipo y número de página.
- Los reportes fiscales pueden descargarse como Excel con formato en encabezados y totales.
- La DIOT puede descargarse como TXT de carga masiva para el SAT.
- Los reportes guardados se consultan desde un drawer organizado por ejercicio y mes.

Antes de presentar una DIOT, valida la configuración de proveedores y contrasta el resultado con las reglas vigentes del SAT. La aplicación ayuda a organizar la información, pero no sustituye la revisión profesional.

**Almacenamiento de XML**

Los XML no se guardan completos dentro de MySQL. Se almacenan en el servidor con una estructura similar a:

```text
despachoapp-server/storage/cfdi/clientes/{cliente}/{año}/{mes}/{uuid}.xml.enc
```

La tabla `cfdi_facturas` conserva únicamente `xml_path`. El contenido usa AES-256-GCM y se descifra en memoria sólo durante una descarga autorizada. La carpeta está excluida de Git y debe incluirse en la estrategia de respaldos.

**Almacenamiento de documentos de clientes**

Los PDF se guardan cifrados bajo `storage/client-documents` o en la ruta configurada con `CLIENT_DOCUMENT_DIR`. La tabla `cliente_documentos` registra el cliente, tipo documental, nombre original, tamaño, huella SHA-256, usuario y ruta. No almacena el PDF dentro de MySQL.

#### Opiniones de cumplimiento (`/app/cumplimiento`)

Consulta el resultado público de la opinión de cumplimiento de los clientes registrados.

- Permite actualizar un cliente o ejecutar una consulta masiva en lotes para todos los expedientes.
- Utiliza únicamente el RFC en la consulta pública; no envía la CIECF ni la e.firma.
- Distingue resultados positivos, negativos, situaciones especiales, opiniones privadas y errores de consulta.
- Reconoce expresamente los estados **Suspensión de actividades** e **Inscrito sin obligaciones**, sin clasificarlos como opinión positiva.
- Muestra las omisiones o situaciones que el cliente debe revisar cuando el SAT proporciona ese detalle.
- Descarga el PDF disponible, lo guarda cifrado en los documentos del cliente y muestra si el archivo quedó archivado.
- Presenta la fecha de consulta, fecha de emisión, vigencia informada y régimen fiscal del cliente.
- Agrupa los resultados por régimen fiscal y permite filtrar por resultado o régimen desde un modal.
- Incluye instrucciones para autorizar que una opinión positiva sea pública ante el SAT.

La disponibilidad, contenido y vigencia dependen de la respuesta pública del SAT. Una consulta sin detalle no debe interpretarse automáticamente como positiva.

#### Notas

Se abre desde el botón de notas de la barra superior o desde el menú móvil.

- Crea y edita notas con contenido Markdown.
- Organiza documentos en carpetas y subcarpetas.
- Busca por título, contenido o ruta.
- Permite fijar, archivar, restaurar y eliminar notas.
- Las notas fijadas pueden mostrarse en la ventana flotante.
- La tecla `/`, cuando el cursor no está en un campo de texto, abre o cierra la ventana de notas fijadas.

El contenido de las notas se guarda mediante la API. La estructura personalizada de carpetas se conserva en `localStorage`; por ello puede variar entre navegadores o equipos.

#### Registro de cambios

Disponible en la barra superior para usuarios autorizados.

- Lista altas, modificaciones y eliminaciones registradas por la aplicación.
- Filtra por identificador y tipo de operación.
- Permite expandir cada entrada para comparar los valores anteriores y nuevos.
- Algunas operaciones ofrecen la acción **Deshacer**.

Antes de revertir un movimiento, revisa si existen cambios posteriores relacionados. La reversión modifica datos reales.

#### Configuración y usuarios (`/app/settings`)

Disponible principalmente para administradores.

- Consulta y busca usuarios.
- Crea empleados o administradores.
- Edita nombre, correo, teléfono, imagen, puesto y nombre de usuario.
- Activa o desactiva cuentas.
- Cambia contraseñas.
- Elimina usuarios cuando sus relaciones lo permiten.
- Ajusta permisos globales y por perfil.
- Permite cambiar la paleta visual, incluida la variante **OLED absoluto**.
- Permite elegir un tamaño de texto pequeño, normal o grande.
- Conserva la paleta y el tamaño de texto en el dispositivo para aplicarlos desde el inicio de la siguiente sesión.

Las preferencias visuales se administran únicamente desde Configuración para mantener limpia la barra superior.

## Carga progresiva y rendimiento

Las tablas principales solicitan primero una página pequeña con los registros recientes. Cuando hay más información, las siguientes páginas se cargan en segundo plano y se incorporan sin bloquear la vista.

Los endpoints aceptan parámetros de paginación como `limit` y `offset`. Para mantener un buen rendimiento:

- no elimines los índices de las tablas;
- evita solicitar límites excesivos desde clientes externos;
- archiva respaldos antiguos fuera de las carpetas servidas por la aplicación;
- conserva los XML en disco y no vuelvas a almacenarlos como texto en MySQL.

## Producción

### Frontend

Configura `VITE_API_SERVER_IP` con la URL pública y genera la aplicación:

```bash
npm run build
```

El resultado queda en `despachoapp-vue/dist`. El proceso genera un `.htaccess` con redirección a `index.html`, necesario para que las rutas de Vue funcionen al recargar bajo Apache.

Publica el contenido de `dist` en el servidor web. No publiques el código fuente ni el `.env` del servidor Node.

### Servidor

1. Configura un usuario MySQL exclusivo con los permisos mínimos necesarios.
2. Define un `JWT_SECRET` largo y aleatorio.
3. Genera `DATA_ENCRYPTION_KEY`, guárdala fuera del repositorio y verifica que el proceso Node pueda leerla.
4. Ejecuta `npm run db:migrate` durante el despliegue, antes de reiniciar la API. Haz un respaldo previo porque esta migración cifra los XML y secretos existentes.
5. Ejecuta Node mediante un administrador de procesos como PM2 o como servicio del sistema.
6. Coloca la API detrás de HTTPS y de un proxy inverso.
7. Restringe CORS al dominio real de la aplicación.
8. Protege las carpetas `archivos`, `storage/cfdi` y `storage/client-documents` contra acceso web directo.

## Respaldos

Un respaldo completo necesita estos elementos:

- exportación SQL de `kanbanpagos`;
- carpeta `despachoapp-server/storage/cfdi`;
- carpeta `despachoapp-server/storage/client-documents`;
- carpeta `despachoapp-server/archivos`, si se utilizan adjuntos;
- archivos de permisos dentro de `despachoapp-server/data`;
- variables de entorno almacenadas de forma segura.
- la misma `DATA_ENCRYPTION_KEY` en un respaldo separado y protegido.

Respaldar solamente MySQL no recuperará los XML, porque la base contiene sólo sus rutas.

## Solución de problemas

### El frontend indica que no puede conectarse

- Confirma que `npm start` esté ejecutándose en `despachoapp-server`.
- Abre `http://localhost:5000` para comprobar que el puerto responde.
- Revisa `VITE_API_SERVER_IP` y reinicia Vite después de cambiar `.env`.
- Verifica que un firewall no esté bloqueando los puertos 5000 o 5173.

### El servidor no conecta con MySQL

- Confirma que MySQL esté iniciado en XAMPP.
- Revisa host, puerto, usuario, contraseña y base en el `.env` del servidor.
- En XAMPP el puerto suele ser `3306`, pero puede cambiar si existe otra instalación de MySQL.
- Comprueba que la base `kanbanpagos` exista.

### Fiscal muestra errores de tablas o columnas

Ejecuta manualmente:

```bash
cd ../despachoapp-server
npm run db:migrate
```

Después reinicia el servidor. Las migraciones nunca se ejecutan automáticamente con `npm start`.

### No se puede descargar un XML

- Revisa que `xml_path` tenga valor para la factura.
- Confirma que el archivo exista dentro de `storage/cfdi` o en `CFDI_XML_DIR`.
- Restaura tanto la base de datos como la carpeta de XML desde el mismo respaldo.

### El sembrador no se encuentra

`scripts/seed-example.sql` está ignorado por Git. Debe existir localmente en `despachoapp-server` antes de ejecutar `npm run db:seed:example`.

### `npm` no funciona o busca una ruta inexistente

Reinstala Node.js y npm, abre una terminal nueva y comprueba:

```bash
node --version
npm --version
```

Luego elimina únicamente `node_modules` del proyecto afectado y ejecuta nuevamente `npm install`. No borres la base de datos ni las carpetas de XML durante este proceso.

## Seguridad

- Cambia las credenciales iniciales inmediatamente.
- Nunca subas `.env`, respaldos, XML, FIEL, CIECF ni archivos de clientes a Git.
- Usa HTTPS en producción.
- Limita el acceso a Configuración, Registro de cambios y Fiscal mediante permisos.
- Realiza respaldos cifrados y prueba periódicamente su restauración.
- Revisa las dependencias con `npm audit` antes de cada despliegue.
- Los datos fiscales y las contraseñas de clientes son información sensible; aplica controles de acceso y las políticas legales correspondientes.

## Licencia

El servidor declara licencia ISC. Revisa las condiciones internas del proyecto antes de redistribuir la aplicación o sus datos.
