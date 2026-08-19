# Sistema visual y de movimiento del inicio

Este documento explica la implementación del nuevo inicio, el fondo animado general y el atajo para quitar resaltado en Notas. Las interacciones toman como referencia patrones visuales conocidos, pero todo el comportamiento fue escrito para esta aplicación con Vue, CSS, Canvas e APIs nativas del navegador. No se agregó React Bits ni otra dependencia de animación.

## 1. Mapa general

La solución está separada en tres capas para que cada parte tenga una responsabilidad clara:

1. **Contenido y estado en Vue**: frases rotativas, módulo seleccionado, navegación activa y datos de cada sección.
2. **Movimiento declarativo en CSS**: transiciones, desplazamiento de tarjetas, pila durante el scroll, indicador de navegación, progreso y cuadrícula global.
3. **Dibujo procedural en Canvas**: caracteres, ruido, scanlines y fallas breves del fondo tipo terminal.

Esta separación evita que una animación controle la estructura de la página. Vue conserva el estado, CSS presenta los cambios y Canvas solo pinta una capa decorativa que no captura clics.

## 2. Atajo para quitar resaltado en Notas

### Comandos

- `Ctrl + U`: aplica el resaltado amarillo o alterna el resaltado actual.
- `Ctrl + Shift + U`: quita explícitamente el resaltado.
- En macOS se admite el equivalente con `Cmd`.

El atajo se procesa en los dos modos de edición:

- **Editor visual**: `handleVisualKeydown` detecta la combinación y llama a `applyVisualMarkdown("removeUnderline")`.
- **Editor Markdown**: `handleEditorKeydown` llama a `applyMarkdown("removeUnderline")`.

En Markdown el resaltado se conserva como `<u>texto</u>`. La apariencia no usa la línea inferior típica de `text-decoration`; el elemento se interpreta como un fragmento resaltado con fondo amarillo. Así se mantiene un formato persistente, compatible con el contenido guardado y disponible para las notas ancladas.

La eliminación funciona de dos formas:

1. Si la selección ya contiene etiquetas `<u>`, se eliminan todas las etiquetas de esa selección.
2. Si el cursor está dentro de un fragmento resaltado, se localizan su apertura y cierre y se reemplaza el bloque completo por su texto interno.

Esto corrige el caso donde solo se encontraba el primer fragmento: la búsqueda parte de la selección o posición actual y no de la primera etiqueta del documento.

Archivos relacionados:

- `src/components/notes/BoardNote/BoardNote.ts`
- `src/components/notes/BoardNote/BoardNote.html`

## 3. Cuadrícula animada global

La cuadrícula administrativa vive en `GridBackground`. Está construida con dos pseudoelementos CSS:

- `::before` genera líneas horizontales, líneas verticales y puntos de intersección mediante varios `linear-gradient` y `radial-gradient`.
- `::after` genera una banda de exploración sutil que cruza la pantalla.

El plano de `::before` es más grande que el viewport. Su animación solo cambia `transform`, por lo que el navegador puede mover la capa en composición sin recalcular el layout en cada cuadro. El ciclo utiliza un recorrido diagonal y regresa de forma continua, con una duración lenta para que el fondo mantenga actividad sin competir con los datos.

La capa tiene `pointer-events: none`, por lo que nunca bloquea menús, formularios o modales. También está marcada con `aria-hidden="true"` porque no comunica información.

Con `prefers-reduced-motion: reduce`, ambas animaciones se detienen y la cuadrícula conserva un estado fijo.

Archivos relacionados:

- `src/components/adminApp/Menus/GridBackground/GridBackground.vue`
- `src/components/adminApp/Menus/GridBackground/GridBackground.html`
- `src/components/adminApp/Menus/GridBackground/GridBackground.ts`
- `src/components/adminApp/Menus/GridBackground/GridBackground.css`

## 4. Faulty Terminal

El fondo del inicio se dibuja en un `canvas` fijo que ocupa toda la página. No es un video ni una textura descargada.

### Generación de la imagen

El algoritmo divide la pantalla en celdas de 28 px, o 24 px en pantallas pequeñas. Para cada celda calcula un valor pseudoaleatorio determinista con una función basada en seno. Ese valor decide:

- si la celda muestra un carácter;
- cuál carácter se elige de `01<>[]{}#/\\+=:_`;
- su opacidad;
- si recibe un pequeño desplazamiento horizontal.

Después dibuja scanlines de un píxel cada cinco píxeles y una banda horizontal ocasional. El resultado se parece a una terminal inestable, pero mantiene una densidad baja para conservar la lectura del contenido.

### Rendimiento

- La animación usa `requestAnimationFrame`, pero limita el dibujo a 18 cuadros por segundo. Una textura ambiental no necesita actualizarse a 60 FPS.
- El `devicePixelRatio` se limita a 1.5. Esto evita que pantallas de alta densidad multipliquen innecesariamente la cantidad de píxeles del canvas.
- `ResizeObserver` recalcula la superficie solo cuando cambia su tamaño.
- Al desmontar el componente se cancelan el frame, el observador y el listener de preferencias.
- Con movimiento reducido se dibuja un solo cuadro estático.

El canvas es decorativo, tiene `pointer-events: none` y queda detrás del contenido. Un degradado de máscara reduce la intensidad cerca de los bordes y evita una textura uniforme.

Archivos relacionados:

- `src/views/HomeView/FaultyTerminal/FaultyTerminal.vue`
- `src/views/HomeView/FaultyTerminal/FaultyTerminal.html`
- `src/views/HomeView/FaultyTerminal/FaultyTerminal.ts`
- `src/views/HomeView/FaultyTerminal/FaultyTerminal.css`

## 5. Scroll Reveal

Las secciones que deben aparecer al entrar al viewport usan el atributo `data-reveal`.

Al montar la vista, `setupRevealObserver` crea un solo `IntersectionObserver`. Cuando un elemento supera el 18 por ciento de intersección, recibe la clase `is-visible` y deja de observarse. El movimiento ocurre una sola vez, por lo que volver hacia arriba no hace que el contenido parpadee o desaparezca.

CSS controla el estado inicial y final:

- inicio: menor opacidad y desplazamiento vertical moderado;
- visible: opacidad completa y posición original;
- movimiento reducido: contenido visible inmediatamente y sin transición.

No existe un listener continuo de `scroll`. El navegador calcula las intersecciones de forma optimizada.

## 6. Rotating Text

El título principal conserva una primera línea estable, `Todo el despacho.`, y rota la segunda línea entre cuatro mensajes.

Vue guarda el índice activo en `rotatingIndex`. Un intervalo lo incrementa cada 2800 ms y el componente `Transition`, en modo `out-in`, reemplaza una frase por la siguiente. CSS define la entrada y salida con opacidad, desplazamiento y una ligera compresión.

La rotación se detiene por completo si la persona solicita movimiento reducido. El listener a `matchMedia` también reacciona si la preferencia cambia mientras la página está abierta.

## 7. Navegación Gooey

La navegación conserva enlaces HTML reales para que los anclajes, teclado y comportamiento del navegador sigan funcionando.

El efecto utiliza tres piezas:

1. `activeNavIndex` representa la sección visible.
2. `navHoverIndex` representa temporalmente el enlace apuntado o enfocado.
3. `navIndicatorIndex` elige el hover cuando existe y vuelve a la sección activa al salir.

La posición se envía a CSS mediante `--nav-index`. El indicador es una superficie redondeada con dos pequeñas masas que cambian de posición y escala, creando la sensación elástica. No se utiliza un filtro SVG pesado ni una biblioteca.

Otro `IntersectionObserver` vigila Funciones, Cómo funciona, Seguridad y Contacto. Cuando una sección domina la zona central del viewport, su enlace queda activo. En móvil la navegación cambia a un menú directo y legible, sin intentar comprimir todos los enlaces.

## 8. Card Swap para funciones

Las once funciones originales siguen disponibles. La experiencia ahora separa la selección y la lectura:

- a la izquierda hay un índice compacto de módulos;
- a la derecha hay una baraja de tres tarjetas visibles;
- la tarjeta activa contiene el detalle completo;
- las dos siguientes crean profundidad y anticipan el movimiento.

`featureDeck` es un valor calculado. Toma el módulo activo, el siguiente y el posterior, y asigna las posiciones `active`, `middle` y `back`. Cuando cambia el índice, `TransitionGroup` anima la diferencia y CSS transforma cada posición.

Los botones anterior y siguiente recorren la lista en ciclo. También se admiten flechas izquierda y derecha. El contador usa `aria-live="polite"`, la lista se expone como `tablist` y cada selector como `tab`.

La baraja no duplica el contenido de negocio. Todo sale del arreglo `features`, por lo que agregar o modificar un módulo requiere cambiar los datos, no la estructura visual.

## 9. Scroll Stack para el flujo

La sección Cómo funciona contiene cinco tarjetas: Registra, Organiza, Opera, Entrega y Respalda.

Cada tarjeta usa `position: sticky` y recibe un valor de `top` ligeramente distinto. Mientras se avanza, la siguiente tarjeta alcanza su límite y se coloca sobre la anterior. `z-index` sigue el orden del proceso, por lo que la pila siempre expresa avance.

Cuando el navegador soporta CSS Scroll-driven Animations, `animation-timeline: view()` añade un ajuste sutil de escala y opacidad ligado a la entrada de cada tarjeta. Si no existe soporte, la mecánica sticky sigue funcionando; el efecto principal no depende de la API nueva.

En pantallas pequeñas se simplifican columnas y tamaños. Con movimiento reducido se conserva la pila funcional, pero se eliminan las interpolaciones.

## 10. Componentes adicionales

### Mapa de contexto conectado

El hero incorpora un núcleo central y nodos para Clientes, Tareas, Fiscal, Cobros y Documentos. Los círculos y líneas se generan con CSS. Su objetivo no es decorar sin significado, sino mostrar que los módulos comparten información.

### Progreso de lectura

Una línea superior usa CSS Scroll Timeline cuando está disponible. Su escala horizontal representa el avance de la página. En navegadores sin soporte simplemente permanece oculta, sin ejecutar JavaScript de seguimiento.

### Marquee operativo

El renglón continuo enumera las áreas conectadas. Es una capa secundaria de ritmo visual y se detiene en preferencias de movimiento reducido.

## 11. Accesibilidad y fallbacks

- Se mantiene un enlace `Saltar al contenido principal`.
- Los controles son botones o enlaces nativos, no `div` con clic.
- Los iconos decorativos usan `aria-hidden`.
- Canvas, cuadrícula y capas de movimiento no capturan el puntero.
- Card Swap expone selección y contador a tecnologías de asistencia.
- El menú móvil comunica `aria-expanded` y su relación con `aria-controls`.
- Todos los sistemas de movimiento responden a `prefers-reduced-motion`.
- IntersectionObserver y CSS Scroll Timeline tienen estados alternativos sin animación.

## 12. Cómo ajustar el sistema

Los controles principales están concentrados para evitar valores repartidos por toda la aplicación:

- **Velocidad del título**: valor `2800` en `syncRotation`.
- **Cuadros del terminal**: `frameInterval = 1000 / 18`.
- **Densidad del terminal**: umbral `seed < 0.82` y tamaño `cell`.
- **Color del terminal**: valores `rgba(120, 213, 170, ...)`.
- **Tamaño de cuadrícula**: `--grid-size` en `GridBackground.css`.
- **Velocidad de cuadrícula**: duración de `grid-drift`.
- **Revelado**: `threshold` y `rootMargin` del observer.
- **Velocidad de Card Swap**: transición de las tarjetas en `HomeView.css`.
- **Separación de Scroll Stack**: fórmula de `top` en la plantilla del flujo.

## 13. Archivos principales

- `src/views/HomeView/HomeView.ts`: estado, datos, timers y observers.
- `src/views/HomeView/HomeView.html`: estructura semántica e interacciones.
- `src/views/HomeView/HomeView.css`: dirección visual, transiciones y responsive.
- `src/views/HomeView/FaultyTerminal/`: fondo procedural del inicio.
- `src/components/adminApp/Menus/GridBackground/`: cuadrícula animada del área administrativa.
- `src/components/notes/BoardNote/`: resaltado y atajos del editor.

## 14. Dependencias

La implementación no agrega paquetes. Utiliza:

- Vue para estado, ciclo de vida y transiciones;
- CSS para composición, sticky, keyframes y media queries;
- Canvas 2D para la textura procedural;
- `IntersectionObserver`, `ResizeObserver`, `matchMedia` y `requestAnimationFrame` como APIs del navegador.

La página de inicio dejó de depender de GSAP. El paquete puede seguir presente porque otras áreas del proyecto todavía lo utilizan, pero esta vista no lo carga para sus efectos.
