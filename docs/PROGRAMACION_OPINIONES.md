# Programación de Opiniones de cumplimiento

## Qué resuelve

El módulo de Opiniones puede consultar automáticamente a los clientes en una hora recurrente o iniciar una consulta manual inmediata para un régimen fiscal concreto. Ambos caminos usan la misma rutina de consulta, persistencia de resultados y reintentos, por lo que una ejecución manual no crea un flujo alterno ni altera la programación guardada.

## Hora y zona horaria

La hora seleccionada se interpreta siempre en `America/Mexico_City`, es decir, hora del centro de México. El servidor calcula y devuelve `nextRunAt` como fecha ISO; la interfaz la convierte a la hora local visible y muestra también la zona que realmente usa el programador.

El modal presenta tres referencias distintas:

- **Próxima ejecución:** fecha calculada por el servidor a partir de frecuencia, día y hora.
- **Última ejecución:** momento en que comenzó el último proceso, manual o programado.
- **Estado:** resultado final, cantidad procesada y reintentos pendientes.

Así se puede comprobar la agenda sin deducirla únicamente a partir de un campo `07:00`.

## Precisión y recuperación al reiniciar

Mientras el servidor está activo, `node-cron` dispara el proceso en el minuto configurado y usa explícitamente la zona horaria del centro de México. La tarea tiene protección contra solapamientos: si una consulta sigue ejecutándose, no inicia otra sobre los mismos recursos.

Había un borde importante al arrancar el servidor. El programador se registra unos segundos después de iniciar la aplicación; si el servidor arrancaba, por ejemplo, a las `07:00:05`, el disparo de las `07:00` ya había pasado y la siguiente oportunidad podía ser hasta el día siguiente. Ahora, al iniciar, se revisa el último minuto programado:

1. Se calcula la ocurrencia programada más reciente.
2. Si ocurrió hace menos de 15 minutos, se compara con `lastRunAt`.
3. Si no existe una ejecución posterior a esa ocurrencia, el servidor la recupera una sola vez.
4. Si ya se ejecutó, no se duplica.

La ventana es deliberadamente corta: corrige reinicios o despliegues alrededor de la hora prevista sin lanzar inesperadamente una consulta que llevaba días atrasada.

## Ejecutar ahora por régimen

La sección **Ejecución inmediata** funciona aunque la programación automática esté pausada. El usuario puede elegir:

- **Todos:** incluye a todos los clientes con RFC consultable.
- **Un régimen específico:** filtra a los clientes cuyo `regimen_fiscal` coincide con el código elegido, por ejemplo `626` para RESICO.

Al pulsar **Ejecutar ahora**:

1. El frontend envía `POST /cumplimiento/schedule/run` con `regimes: []` para todos o con un único código.
2. El servidor normaliza el código contra la lista de regímenes admitidos.
3. Se evita comenzar si otra consulta está activa; en ese caso responde `409` con un mensaje legible.
4. Se consultan los clientes con una concurrencia limitada para no saturar al SAT.
5. Los fallos recuperables se agregan a la cola de reintentos de 5, 15, 30 y 60 minutos.
6. Se actualizan el estado, las métricas y la última ejecución.
7. La interfaz vuelve a cargar las Opiniones y muestra el resultado en el mismo modal.

La ejecución inmediata no cambia `enabled`, `frequency`, `runTime`, `dayOfWeek` ni los regímenes de la agenda guardada.

## Estados y concurrencia

Los estados persistidos son:

- `never`: todavía no existe una ejecución.
- `running`: la consulta está en curso.
- `success`: todos los clientes seleccionados respondieron.
- `partial`: algunos respondieron y otros quedaron en reintento.
- `error`: no hubo respuestas correctas o ocurrió un error general.

Existe una exclusión mutua en memoria para impedir dos lotes simultáneos. Además, la tarea cron usa `noOverlap`, de modo que una consulta lenta no se duplica al llegar otra marca de tiempo.

## Contrato de API

### `GET /cumplimiento/schedule`

Además de la configuración devuelve:

- `nextRunAt`: próxima ejecución en ISO o `null` si está pausada.
- `serverNow`: reloj del servidor en ISO, útil para diagnóstico.
- `running`: indica si existe una consulta activa.
- `lastRunAt`, `lastStatus`, `lastMessage` y métricas del último lote.

### `PUT /cumplimiento/schedule`

Guarda la agenda normalizada y reconstruye la tarea cron.

### `POST /cumplimiento/schedule/run`

Entrada:

```json
{
  "regimes": ["626"]
}
```

Una lista vacía significa todos los regímenes. La respuesta contiene `result` con las métricas de la ejecución y `config` con el estado actualizado.

## Verificación automatizada

Las pruebas del servidor cubren:

- normalización de frecuencia, hora, día y regímenes;
- expresión cron resultante;
- cálculo de `07:00` en hora del centro de México;
- salto de viernes a lunes para una agenda de días hábiles;
- cálculo de la ocurrencia anterior usado en la recuperación de un arranque tardío;
- pausas progresivas de la cola de reintentos.

## Organización del modal

El centro de consultas divide las operaciones en dos pestañas para evitar confundir una agenda con una ejecución:

- **Programación automática:** controla si existirán futuras consultas, su frecuencia, hora y regímenes.
- **Ejecutar ahora:** realiza una sola consulta con el régimen elegido y no modifica la agenda.

El estado de la última consulta se muestra por separado. `FINALIZADA` significa que el proceso anterior terminó; no implica que la automatización esté activa. Si la automatización está desactivada, la interfaz muestra **Sin próxima ejecución** y explica el motivo, pero no describe la consulta terminada como “pausada”.

La pestaña activa también decide las acciones del pie: **Guardar programación** sólo aparece en la configuración automática; la consulta inmediata conserva su botón dentro del contexto donde se elige el régimen.
