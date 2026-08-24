# Sistema visual y de movimiento del inicio

Este documento explica la implementación actual del inicio, el fondo animado general y el resaltado del editor de Notas. Las referencias de React Bits se usaron para entender el comportamiento visual, no como componentes instalados. La app conserva su identidad oscura, técnica y esmeralda, y no añade ninguna dependencia nueva.

## 1. Dirección de diseño

El inicio es una evolución del lenguaje que ya existe en la aplicación:

- fondos verde carbón y superficies oscuras;
- un solo acento esmeralda;
- bordes rectos, tipografía contundente y datos en monoespaciada;
- movimiento orgánico solo donde comunica estado o recorrido;
- contraste alto para que la textura nunca compita con el contenido.

El hero y su balanza 3D se conservaron. Los cambios se concentran en el ambiente CRT, la navegación, la cinta de funciones, el mazo automático, el mapa completo de capacidades y el flujo apilado. Las proporciones se ajustan al contenido: los bloques narrativos son más compactos y la altura adicional se reserva para información que realmente explica el producto.

La implementación se divide en cuatro responsabilidades:

1. **Vue** guarda índices, contenido, temporizadores y ciclo de vida.
2. **CSS** define materialidad, perspectiva, responsive y estados de movimiento reducido.
3. **Canvas 2D** dibuja la terminal procedural que responde al puntero.
4. **GSAP ScrollTrigger** relaciona la compresión de las tarjetas del flujo con la entrada de la siguiente tarjeta.

No existe un listener continuo de scroll. El navegador resuelve sticky e intersecciones, mientras ScrollTrigger calcula el progreso de los tramos que realmente necesitan scrub.

## 2. Atajo para quitar resaltado en Notas

### Comandos

- `Ctrl + U`: aplica o alterna el resaltado amarillo.
- `Ctrl + Shift + U`: quita explícitamente el resaltado.
- En macOS se admite el equivalente con `Cmd`.

El editor visual procesa la combinación en `handleVisualKeydown` y el editor Markdown en `handleEditorKeydown`. En ambos casos la operación termina en una acción de formato común.

El contenido sigue guardándose como `<u>texto</u>`, pero CSS no muestra una línea inferior. La etiqueta representa un resaltado amarillo persistente, tanto en el documento completo como en las notas ancladas.

Al quitar el formato se contemplan dos casos:

1. Si la selección contiene una o varias etiquetas `<u>`, se eliminan todas dentro de esa selección.
2. Si el cursor está dentro de un resaltado, se localiza la pareja de apertura y cierre alrededor de esa posición y se conserva únicamente el texto.

Esto evita que la acción modifique siempre el primer resaltado del documento.

Archivos principales:

- `src/components/notes/BoardNote/BoardNote.ts`
- `src/components/notes/BoardNote/BoardNote.html`

## 3. Cuadrícula animada global

La cuadrícula del área administrativa vive en `GridBackground` y se genera con pseudoelementos CSS.

- `::before` combina líneas horizontales, verticales y puntos de intersección.
- `::after` crea una banda de exploración tenue.

La capa de cuadrícula es mayor que el viewport y se desplaza con `transform`. Al no modificar posición, ancho o alto, el navegador puede componer la animación sin recalcular el layout en cada cuadro.

La cuadrícula tiene `pointer-events: none` y `aria-hidden="true"`. Nunca bloquea formularios, menús o modales. Con `prefers-reduced-motion: reduce` conserva una imagen fija.

## 4. Faulty Terminal reactivo y acabado CRT

El fondo del inicio es un `canvas` fijo. No es video, imagen descargada ni componente de terceros.

### 4.1 Campo procedural

La pantalla se divide en celdas de 15 px en escritorio y 12 px en móvil. Cada celda evalúa cuatro ondas:

- una onda horizontal;
- una vertical;
- una diagonal;
- una radial alrededor de la zona central.

Las ondas se combinan con un hash determinista. El valor resultante decide si una celda se dibuja y con qué intensidad. Cada celda activa es una tesela cuadrada sólida con una luz superior muy tenue. No contiene trazos verticales, segmentos de letras ni combinaciones que puedan leerse como caracteres. La separación regular permite reconocer los cuadrados incluso cuando el campo se deforma alrededor del puntero.

### 4.2 Reacción al puntero

El puntero guarda una posición objetivo y una posición interpolada. En cada cuadro la posición visible avanza aproximadamente un 9.5 por ciento hacia el objetivo, evitando saltos.

Dentro de un radio adaptable se calculan:

- una fuerza cuadrática basada en la distancia;
- un desplazamiento radial;
- una torsión sinusoidal perpendicular al radio;
- una reducción del umbral de dibujo.

El resultado es una zona más viva que deforma las formaciones y sigue al mouse. El canvas sigue usando `pointer-events: none`, por lo que observar la reacción nunca impide pulsar botones o manipular la balanza.

### 4.3 Capa CRT

El acabado de televisor antiguo se construye con varias capas:

- scanlines de un píxel cada cuatro píxeles;
- una banda luminosa que recorre verticalmente la pantalla;
- glitches horizontales breves;
- viñeta elíptica oscura en los bordes;
- curvatura visual mediante un contenedor ligeramente ampliado y redondeado;
- reflejo de vidrio muy tenue;
- sombras internas profundas.

La terminal mantiene el mismo verde de la aplicación. No se introducen canales rojos o azules que romperían la paleta.

### 4.4 Rendimiento

- El dibujo se limita a 24 FPS. Es suficiente para una textura ambiental reactiva.
- El `devicePixelRatio` se limita a 1.35.
- `ResizeObserver` redimensiona el canvas solo cuando cambia su caja.
- `requestAnimationFrame` se cancela al desmontar.
- Los listeners del puntero y de preferencias se eliminan en `onUnmounted`.
- Con movimiento reducido se dibuja un cuadro estático y solo se actualiza si cambia la posición necesaria para la composición accesible.

## 5. Hero y Rotating Text

La composición principal conserva el texto, los botones y la balanza ASCII 3D. La primera línea permanece fija y la segunda rota entre cuatro mensajes:

- Una vista.
- Todo conectado.
- Bajo control.
- Sin duplicados.

Vue incrementa `rotatingIndex` cada 2800 ms. `Transition` intercambia las frases con opacidad, desplazamiento vertical y una rotación leve en profundidad. La franja esmeralda siempre usa texto verde carbón para conservar contraste.

Los temporizadores se detienen cuando la pestaña está oculta y se reanudan al volver. También se desactivan con movimiento reducido.

### Modelo 3D ASCII

La balanza se conserva como el visual del hero. El componente proyecta puntos tridimensionales que forman eje, brazos, platos y base. La iluminación cambia la densidad de los caracteres ASCII y el puntero modifica los objetivos de rotación. Un `IntersectionObserver` evita dibujar cuando el modelo queda fuera del viewport.

## 6. Cinta curva con todas las funciones

El antiguo renglón recto se sustituyó por una cinta SVG ondulada.

Un solo `path` describe una curva suave que atraviesa el viewport. Ese mismo camino tiene dos usos:

1. Un `use` lo pinta con un trazo esmeralda grueso y forma la cinta.
2. Un `textPath` coloca el texto exactamente sobre su eje.

La cadena contiene las once funciones del sistema y se repite para que el recorrido sea continuo:

1. Resumen operativo
2. Tareas y seguimiento
3. Expedientes de clientes
4. Pagos y cobranza
5. Operación fiscal
6. Catálogos SAT
7. Cumplimiento
8. Notas de trabajo
9. Documentos y salidas
10. Acceso y configuración
11. Copias de seguridad

Una animación SVG nativa modifica `startOffset` durante 32 segundos. La curva no es decorativa sin contenido: comunica que todos los módulos pertenecen a un mismo flujo. Cuando se solicita movimiento reducido, Vue pausa las animaciones del SVG.

## 7. Gooey Nav líquido

La navegación conserva el comportamiento Gooey, pero ahora vive dentro de un marco técnico que comparte el lenguaje de la aplicación: bordes rectos, superficie verde oscura, línea superior de estado, sombra desplazada en verde y controles con la misma escala que los modales y barras internas.

La marca ocupa su propia celda y el acceso se trata como una acción del sistema. Los cuatro destinos permanecen en una sola fila en escritorio, con un número de referencia que mejora el barrido visual sin cambiar la etiqueta accesible. Los enlaces siguen siendo anclas HTML reales, se pueden enfocar con teclado y conservan sus destinos.

### 7.1 Selección del destino

- `activeNavIndex` representa la sección dominante en el viewport.
- `navHoverIndex` representa el enlace apuntado o enfocado.
- `navIndicatorIndex` usa temporalmente el hover y vuelve al estado de lectura al salir.

`navigateToSection` activa el destino inmediatamente, actualiza el hash sin recargar la página y calcula la posición final usando la altura real del encabezado. Durante el desplazamiento suave, el índice queda bloqueado para impedir que una sección intermedia tome el control del indicador. El bloqueo termina con el evento scrollend únicamente cuando el destino ya está alineado bajo el navbar. Para Contacto se comprueba el final real del documento. Un respaldo de 1400 ms cubre navegadores que no emitan scrollend.

Después del desplazamiento, un `IntersectionObserver` vuelve a resolver la sección dominante mediante una línea de activación situada debajo del navbar. Cuando se alcanza el final del documento, Contacto se selecciona explícitamente aunque su encabezado no pueda subir hasta la parte superior del viewport. El índice se envía a CSS mediante `--nav-index` y el indicador se desplaza solo con `transform`.

### 7.2 Fusión líquida

El indicador contiene una masa principal y cuatro gotas. Un filtro SVG combina:

- `feGaussianBlur` para suavizar los contornos;
- `feColorMatrix` para endurecer el canal alfa y unir las áreas cercanas;
- `feComposite` para recuperar el detalle del origen.

Al apuntar o enfocar, las gotas se separan con distintas escalas y velocidades. Mientras permanecen cerca, el filtro las fusiona con la masa principal y el botón parece llenarse de líquido. Al cambiar de enlace, toda la superficie se desplaza con una curva de desaceleración larga.

### 7.3 Marco de aplicación y adaptación móvil

La barra completa mide menos de 80 px en escritorio. Marca, navegación y acceso quedan alineados sobre una misma retícula, mientras el efecto líquido se limita al selector activo. Esto conserva la expresividad sin convertir todo el encabezado en una forma blanda que desentonaría con la interfaz.

En móvil se oculta la fila de destinos y aparece un control cuadrado con borde verde. El menú desplegado reutiliza el mismo fondo, borde, tipografía monoespaciada y sombra desplazada. El botón conserva el atributo aria-expanded, la lista no genera desbordamiento horizontal y los cinco destinos mantienen una altura táctil mínima de 48 px.

### 7.4 Estados y seguridad de interacción

El encabezado se reafirma al final de la cascada como `position: sticky` y `z-index: 40`. Esto evita que reglas compartidas con el contenido principal lo conviertan accidentalmente en un bloque estático.

La capa Gooey utiliza `pointer-events: none`, por lo que nunca puede interceptar el clic de un enlace aunque visualmente lo cubra. Cada destino mantiene una superficie táctil completa, texto en una sola línea y un estado `aria-current="location"`. El hover puede mover temporalmente el líquido, pero al salir siempre vuelve a la sección realmente activa.

En el menú móvil cada fila conserva número, nombre y dirección. Al elegir un destino, el menú se cierra, `aria-expanded` vuelve a `false` y el indicador de escritorio se sincroniza con el mismo estado compartido. La acción de acceso usa una retícula independiente de dos columnas para mantener su etiqueta en una sola línea.

## 8. Card Swap automático con perspectiva

La sección de funciones ya no contiene tabs, botones anterior y siguiente, lista lateral ni navegación manual. Es un mazo automático.

### 8.1 Estado y ciclo

`activeFeatureIndex` señala la función frontal. Cada 3900 ms avanza una posición y vuelve al inicio después de la función 11.

`featureDeck` calcula tres tarjetas:

- `active`: función actual;
- `middle`: función siguiente;
- `back`: función posterior.

Cuando cambia el índice, Vue conserva las tarjetas que siguen en el mazo, cambia sus clases de posición y deja que `TransitionGroup` agregue o retire solo la carta necesaria.

### 8.2 Perspectiva

El escenario usa `perspective: 1700px`. Cada posición combina `translate3d`, `scale`, `rotateY` y `rotateZ`:

- la tarjeta frontal queda más cerca del observador y ligeramente inclinada;
- la intermedia se desplaza arriba y a la derecha;
- la posterior se aleja, pierde intensidad y anticipa el siguiente cambio;
- la tarjeta saliente baja hacia la izquierda y rota en el eje Y;
- la entrante aparece desde el fondo derecho.

Solo se animan `transform`, `opacity` y `filter`. No se recalculan anchos o posiciones durante el cambio.

### 8.3 Contenido y accesibilidad

La carta activa contiene cuatro niveles de lectura: título, qué hace, cómo lo hace y en qué ayuda. Debajo aparecen cuatro capacidades concretas. La jerarquía permite entender el valor de la función sin depender de una frase promocional corta.

El contenedor del mazo conserva `aria-live="polite"` y las cartas de fondo usan `aria-hidden`. El indicador lateral es estable, por lo que nunca puede mostrar un título distinto mientras `TransitionGroup` termina una salida visual.

El ciclo se pausa si la pestaña queda oculta. Con movimiento reducido se mantiene una función estática para evitar movimiento automático.

### 8.4 Mapa permanente de las once funciones

La animación no es la única forma de descubrir el alcance del programa. Debajo del mazo se renderizan las once funciones completas en cuatro grupos:

- Trabajo diario: resumen operativo, tareas y notas.
- Clientes y cobranza: expedientes, pagos y documentos.
- Fiscal y cumplimiento: operación fiscal, catálogos SAT y cumplimiento.
- Control y continuidad: acceso, configuración y copias de seguridad.

El mapa ya no repite los tres niveles explicativos de la carta automática. Una cifra principal muestra las 11 funciones y el encabezado las presenta como cuatro frentes de una misma operación. Cada frente indica su cantidad de funciones y cada fila conserva número, icono, nombre y beneficio operativo.

La información permanece visible sin clics, pestañas, acordeones ni espera. El mazo explica cada función con profundidad; el mapa permite comprobar el alcance completo y localizar rápidamente dónde participa cada herramienta.

### 8.5 Densidad y proporciones

La introducción usa tres resultados compactos separados por líneas, no tarjetas altas. El Card Swap redujo su escenario de 43 a 38 rem y ahora aprovecha ese espacio con contenido real. El mapa usa una retícula asimétrica de siete y cinco columnas para evitar una fila genérica de tarjetas iguales. Sus filas limitan el beneficio a dos líneas visuales y eliminan la repetición de los bloques Cómo y Beneficio, reduciendo altura sin ocultar ninguna función.

El Scroll Stack conserva el apilado, pero sus superficies bajaron a una altura base cercana a 23 rem. El cierre comercial también reduce su escala tipográfica y añade una explicación concreta. Así cada componente ocupa el espacio que necesita su mensaje, sin superficies grandes sostenidas por una sola frase.

## 9. Scroll Stack acumulativo y reversible

El flujo contiene Registra, Organiza, Opera, Entrega y Respalda. Las cinco tarjetas son hijas directas de un mismo contenedor.

### 9.1 Apilado físico

Cada tarjeta usa `position: sticky` con un `top` progresivo:

- 88 px
- 100 px
- 112 px
- 124 px
- 136 px

También aumenta el `z-index`. Cuando la siguiente tarjeta alcanza su límite, queda encima y permite ver el borde de las anteriores. No es una lista con entradas consecutivas: todas permanecen físicamente acumuladas dentro del mismo contenedor.

El contenedor raíz usa `overflow-x: clip`. `hidden` crearía un ancestro de scroll y rompería el sticky respecto al viewport.

### 9.2 Compresión ligada al scroll

Para cada tarjeta, excepto la última, GSAP crea un tween sobre su superficie interna. El trigger es la tarjeta siguiente:

- inicio cuando la siguiente entra por la parte inferior;
- final cuando alcanza su posición sticky;
- `scrub: true` relaciona directamente el progreso con el desplazamiento;
- la superficie anterior reduce escala, sube unos píxeles, inclina `rotationX` y baja a 62 por ciento de opacidad.

Se fija el contenedor exterior y se anima únicamente la superficie interna. Así no se modifica el elemento que resuelve sticky.

Al subir, ScrollTrigger recorre el tween hacia atrás. La tarjeta recupera escala 1, desplazamiento 0 y opacidad 1. No hacen falta eventos `onEnterBack` ni cálculos manuales de `scrollY`.

### 9.3 Ciclo de vida

Las animaciones se crean después de montar el DOM dentro de `gsap.context`, limitado a `.home-scroll-stack`. `context.revert()` elimina tweens y ScrollTriggers al desmontar o cambiar la preferencia de movimiento.

En movimiento reducido no se crea el contexto GSAP, se desactiva sticky y las tarjetas aparecen como bloques normales.

## 10. Circular Gallery de acceso y trazabilidad

La sección que antes mostraba cuatro renglones estáticos ahora usa una galería cilíndrica con seis controles reales del sistema:

- acceso protegido;
- passkeys;
- permisos por usuario;
- bitácora de actividad;
- información sensible;
- interfaz adaptable.

La galería no sustituye el contenido por una animación decorativa. Cada ficha explica el mecanismo y la banda inferior mantiene visible el resultado operativo de la función activa.

### 10.1 Geometría del cilindro

El paso angular se calcula como `360 / securityFeatures.length`. Con seis fichas, cada una ocupa 60 grados. La posición de cada tarjeta se resuelve con:

1. `rotateY(var(--gallery-angle))` para colocarla alrededor del eje;
2. `translateZ(var(--gallery-radius))` para separarla del centro;
3. una rotación inversa en el track para llevar la ficha seleccionada al frente.

El contenedor utiliza `perspective: 1180px` y conserva `transform-style: preserve-3d`. Las caras posteriores se ocultan con `backface-visibility`, mientras las tarjetas laterales pierden saturación y luminosidad. La ficha activa recupera contraste y borde esmeralda.

En escritorio el radio llega aproximadamente a 21 rem. En móvil baja a 12.5 rem y la tarjeta frontal usa 15 rem de ancho. Las fichas laterales quedan parcialmente visibles, comunicando la continuidad circular sin generar scroll horizontal.

### 10.2 Rotación, arrastre y ajuste

`securityRotation` guarda el ángulo confirmado. El temporizador avanza 60 grados cada 4200 ms. Durante el arrastre, el movimiento no actualiza estado reactivo en cada píxel: se escribe temporalmente la propiedad CSS `--gallery-rotation` sobre el track. Al soltar, el ángulo se redondea al múltiplo de 60 más cercano y Vue actualiza la ficha activa.

La rotación automática se detiene cuando ocurre cualquiera de estas condiciones:

- la pestaña queda oculta;
- el sistema solicita movimiento reducido;
- el puntero permanece sobre la galería;
- el foco del teclado está dentro de sus controles;
- el usuario está arrastrando;
- se activa el botón de pausa.

El botón de pausa permite una decisión permanente del usuario. La pausa temporal por puntero o foco se revierte al salir de la galería.

### 10.3 Teclado y lectores de pantalla

La zona circular tiene `tabindex="0"`, acepta flecha izquierda y derecha, y se identifica como una galería circular. Los botones anterior, pausa y siguiente son controles nativos con etiquetas accesibles.

Las seis fichas permanecen en el DOM para conservar la geometría, pero solo la frontal queda expuesta al árbol accesible. Las otras cinco usan `aria-hidden="true"`. El resultado operativo se renderiza fuera de la ficha para evitar recortes y conservar una tarjeta compacta.

Con `prefers-reduced-motion: reduce` no se inicia el temporizador y todas las transiciones se vuelven instantáneas. Las flechas siguen funcionando, por lo que reducir movimiento no elimina contenido ni control.

## 11. Scroll Reveal y progreso de lectura

Los bloques con `data-reveal` usan un único `IntersectionObserver`. Al superar 18 por ciento de intersección reciben `is-visible` y dejan de observarse. La animación ocurre una vez y evita parpadeos al regresar.

La línea superior de progreso utiliza CSS Scroll Timeline cuando el navegador la soporta. No existe un cálculo JavaScript de progreso.

## 12. Accesibilidad, contraste y fallbacks

- Se conserva el enlace para saltar al contenido.
- Botones y enlaces son elementos nativos.
- El menú móvil comunica `aria-expanded` y `aria-controls`.
- Canvas, filtros y capas decorativas no capturan el puntero.
- Los iconos decorativos usan `aria-hidden`.
- El texto esmeralda oscuro sobre el acento claro mantiene contraste alto.
- El texto principal usa blanco suave y los secundarios un verde grisáceo legible.
- Todos los movimientos automáticos responden a `prefers-reduced-motion`.
- Los temporizadores se detienen con `document.hidden`.
- La galería pausa autoplay con puntero, foco, arrastre, movimiento reducido o control manual.
- La galería acepta arrastre, flechas del teclado y botones nativos.
- No se reemplaza el cursor del sistema, por lo que el puntero permanece visible.
- El layout móvil no produce desbordamiento horizontal.

## 13. Parámetros de ajuste

Los controles principales se encuentran en pocos puntos:

- Rotación del hero: `2800 ms` en `syncRotation`.
- Card Swap: `3900 ms` en `syncFeatureAutoplay`.
- Circular Gallery: `4200 ms` en `syncSecurityAutoplay` y pasos de 60 grados.
- Sensibilidad de arrastre circular: `0.26` grados por píxel horizontal.
- Cinta curva: `32 s` en el elemento `animate`.
- Terminal: `24 FPS`, celdas de 15 o 12 px y radio máximo de 390 px.
- Suavizado del puntero: factor `0.095`.
- Profundidad del mazo: transforms de `active`, `middle` y `back` en `HomeView.css`.
- Separación de la pila: reglas `nth-child` de 12 px.
- Compresión de la pila: escala base `0.91` y opacidad `0.62` en `setupScrollStack`.
- Scroll Reveal: `threshold: 0.18` y `rootMargin: 0px 0px -8%`.
- Final del scroll del navbar: evento `scrollend` con respaldo de `1400 ms` en `navigateToSection`.
- Línea de activación del navbar: altura del encabezado más 18 por ciento del viewport.

## 14. Validación realizada

La revisión en navegador confirmó:

- canvas de 1529 por 1062 píxeles en un viewport de 1440 por 1000;
- teselas cuadradas visibles sin trazos que parezcan letras o símbolos;
- hero, balanza 3D y controles principales conservados;
- cuatro grupos y once funciones presentes en el mapa permanente;
- Card Swap de 608 px de alto cuyo contenido se adapta a la función activa;
- texto del mapa con contraste entre `#a9bdb4`, `#f2f6f3` y el fondo verde carbón;
- superficie del Scroll Stack de 1338 por 350 px en escritorio;
- viewport móvil de 390 px sin desbordamiento horizontal;
- siete clics consecutivos entre Funciones, Cómo funciona, Seguridad y Contacto con hash, clase activa y aria-current sincronizados;
- navegación con Enter hacia Cómo funciona, Contacto y Funciones conservando foco, hash, clase activa y aria-current;
- encabezado sticky estable a 77 px de alto durante toda la navegación;
- indicador Gooey centrado sobre los cuatro destinos con una desviación máxima menor a 0.06 px;
- cuatro destinos móviles que cierran el menú, restauran aria-expanded a false y mantienen el encabezado en la posición superior;
- tarjeta frontal móvil con perspectiva reducida y sin desbordamiento horizontal;
- seis fichas en la Circular Gallery, una activa y cinco ocultas al árbol accesible;
- avance automático de Acceso protegido a Passkeys;
- arrastre desde Passkeys hasta Permisos por usuario;
- navegación con teclado desde Permisos por usuario hasta Bitácora de actividad;
- galería de 969 por 496 px en escritorio y 381 por 400 px en móvil;
- cero desbordamiento horizontal después de autoplay, arrastre y teclado;
- ausencia de excepciones nuevas de la vista durante la ejecución.

## 15. Archivos principales

- `src/views/HomeView/HomeView.ts`: estado, temporizadores, arrastre, observers y ScrollTrigger.
- `src/views/HomeView/HomeView.html`: estructura semántica, SVG curvo, mazo, pila y galería circular.
- `src/views/HomeView/HomeView.css`: dirección visual, cilindro 3D, perspectiva, goo, CRT complementario y responsive.
- `src/views/HomeView/FaultyTerminal/`: canvas procedural y carcasa CRT.
- `src/views/HomeView/AsciiOrb/`: balanza 3D ASCII conservada.
- `src/components/adminApp/Menus/GridBackground/`: cuadrícula global.
- `src/components/notes/BoardNote/`: resaltado y atajos del editor.

## 16. Dependencias

No se agregó ningún paquete.

- Vue controla estado, ciclo de vida y transiciones.
- Canvas 2D genera el ambiente Faulty Terminal.
- SVG nativo construye la cinta y el filtro gooey.
- IntersectionObserver, ResizeObserver, matchMedia y requestAnimationFrame cubren observación y dibujo.
- GSAP y ScrollTrigger, ya presentes en el proyecto, se usan solamente para la compresión reversible del Scroll Stack.

React Bits no se importa, no se copia como dependencia y no condiciona el mantenimiento de la página.
