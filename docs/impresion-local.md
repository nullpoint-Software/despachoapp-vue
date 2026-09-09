# Agnes Printer Plugin 1.2.2 en DespachoApp

El código de Agnes está en el proyecto independiente
`../AgnesPrinterPlugin` dentro de la carpeta Proyectos. Su README, SDK JavaScript,
ejemplo web y contrato HTTP describen cómo conectarlo a otras aplicaciones.

DespachoApp mantiene su integración de impresión y el paquete descargable
`public/printing/AgnesPrinterPlugin-1.2.2.zip`. No conserva una segunda copia del
código nativo. `local-printer/build.ps1` compila el proyecto hermano y copia ese
ZIP; admite `-AgnesProject <ruta>` para otras ubicaciones.

## Uso

En Agnes > Preferencias del equipo, agregar el origen mostrado por Configuración
a la lista de apps autorizadas. Copiar su clave una vez en ese navegador y guardar
la impresora compartida. Las otras apps se agregan con el campo de dirección y el botón Agregar de la lista; no hay que
reemplazar la dirección de DespachoApp para usarlas.

Las cuentas de la aplicación comparten impresora y papel. La vinculación persiste
entre reinicios. La versión 1.2.2 importa los datos históricos y guarda la nueva
configuración en `%LOCALAPPDATA%\AgnesPrinterPlugin\connection.json`.

Inicio automático sigue siendo opcional, con pregunta una vez y control desde el
menú. Para actualizar la copia de inicio: cerrar la anterior, abrir el EXE nuevo,
desactivar y volver a activar Iniciar con Windows. No se actualiza por internet.

El agente es para Windows y requiere el controlador de la impresora. Autoriza
solo apps confiables: comparten clave y configuración. El navegador puede pedir
permiso local; si hay CSP debe permitirse `http://127.0.0.1:18457` en connect-src.

## Validación

- `powershell -File local-printer/test.ps1`: pruebas nativas del proyecto hermano.
- En el proyecto Agnes: `npm test` para el SDK; `npm run demo` para el ejemplo.
- En DespachoApp: `node --test tests/localTicketPrinter.test.cjs tests/printerSettings.test.cjs`.
- `npm run build` genera el frontend con el ZIP actual.

Las rutas antiguas se mantienen compatibles. Las nuevas integraciones pueden
usar `/v1/info`, `/v1/printers`, `/v1/preferences` y `/v1/print`. La confirmación de
envío corresponde a la cola de Windows; la salida física depende del controlador.

## Detección y descarga

Configuración y los tres tipos de ticket comprueban /v1/info al abrirse. Si no
se puede conectar, muestran Descargar Agnes Printer Plugin 1.2.2 y Volver a detectar.
El ZIP se sirve desde public/printing de DespachoApp. Un error de red puede indicar
agente cerrado, origen sin autorizar o permiso local pendiente; no demuestra que
el programa esté desinstalado. La descarga se inicia al pulsar el enlace.
