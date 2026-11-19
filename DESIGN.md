---
name: Fiscenix
description: Escritorio del despacho contable, brutalista con un acento de tinta de sello.
colors:
  sello-blue: "#1F3BD6"
  sello-blue-dark-mode: "#8FA3FF"
  ink: "#0B0B0B"
  paper: "#FFFFFF"
  desk-gray: "#EDEDEA"
  paper-tint: "#F4F4F1"
  hairline: "#C9C9C4"
  muted-ink: "#4D4D4D"
  night-desk: "#0B0B0B"
  night-paper: "#161616"
  night-ink: "#F2F2EF"
  success-ink: "#14532D"
  warning-ink: "#713F12"
  error-ink: "#991B1B"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 800
    lineHeight: 1.3
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Mono Variable, ui-monospace, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.sello-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 14px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.sello-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
  status-stamp:
    backgroundColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "1px 6px"
---

# Design System: Fiscenix

## Overview

**North star: la oficina de papel del despacho, hecha pantalla.** Expedientes en papel blanco, tinta negra, casillas marcadas con trazo grueso y sellos de recibido en tinta azul. Es brutalista, pero de oficina: serio, legible y sin adornos. Se rechaza el panel SaaS suave de tarjetas redondeadas, grises y sombras difusas.

Es un producto de trabajo (Operate): la persona encuentra todo donde lo espera. El mundo sólo aporta cuatro cosas:
- **Tipografía:** Geist en peso fuerte y Geist Mono para los datos.
- **Paleta:** papel, tinta y un acento.
- **Densidad.**
- **Firma:** estados como sellos.

Light y Dark comparten la misma lógica; en Dark el papel es negro y la tinta clara.

## Colors

- **Color principal (ADR-039, adenda 2026-10-13):** cualquier color RGB elegido en Configuración (LOCAL). No es un tema: lo que se pinta se deriva para Light y para Dark moviendo sólo la luminosidad (OKLCH) hasta ≥ 4.5:1 contra mesa, papel y sutil; el texto del botón es blanco o tinta, el que más contraste dé.
- **Azul tinta de sello** (`sello-blue`, `#1F3BD6`; en Dark `#8FA3FF` con texto negro): el acento por omisión. Sólo marca la acción principal, la opción de menú activa, la pestaña elegida, el foco, la selección de texto y la rama activa del índice de notas.
- **Logo de Fiscenix:** bloque `#1F3BD6` con la F calada y wordmark en tinta; en Dark, bloque `#8FA3FF` y letras `#F2F2EF`. Guía completa en `design/fiscenix-logo/README.md`. En la app sólo aparece donde se ve la marca de la app (instalación y pie del acceso, `ApplicationLogo`), nunca en lugar del logo del despacho.
- **Neutros:**
  - **Tinta** (`#0B0B0B`) para texto, marcos y sombras duras.
  - **Papel** (`#FFFFFF`) para tarjetas, campos y modales.
  - **Mesa** (`#EDEDEA`) como lienzo de fondo.
  - **Hilo** (`#C9C9C4`) para separadores dentro de un marco.
- **Estados:** conservan su color (verde, ámbar, rojo) en texto y borde, sobre papel, con contraste AA en ambos temas.

## Typography

- **Una sola familia:** Geist, empaquetada; nunca fuentes descargadas.
  - Títulos de página: 40 px, peso 800, tracking −0.035em.
  - Títulos de sección y de modal: peso 800.
  - Texto: 14 px a 1.45; texto secundario de 13 px y ayudas de 12 px.
- **Rótulos de dato:** Geist Mono 11 px, peso 700, mayúsculas con 0.06em. Se usan en encabezados de tabla, rótulos de cifras, pasos del modal, revisiones y sellos. Nunca van encima de un título.
- **Cifras, folios, RFC e importes:** Geist Mono con `tabular-nums`.

## Layout

- **Marco:** barra superior en papel con línea de tinta de 2 px (el membrete; sigue el tema: clara en Light, oscura en Dark), menú lateral con borde de 2 px (el índice) y contenido sobre la mesa.
- **Densidad:** controles de 40 px, unidad de 8 px y relleno de tarjeta de 20 px.
- **Pestañas:** carril con marco de 2 px y un bloque azul que se desliza a la opción activa.
- **Capturas:** toda alta va en el modal de captura, por pasos, con "Revisar" al final.
- **Adaptación:** por debajo de 760 px el menú pasa a barra horizontal y los modales a pantalla completa.

## Elevation & Depth

- **Sombras duras desplazadas en tinta**, sin difuminado:
  - 3 px en botones;
  - 4 px en tarjetas;
  - 8 px en modales y cajones.
- **Al presionar:** un botón se hunde (`translate(3px, 3px)`) y pierde la sombra, como un sello.
- **Fondo de los modales:** tinta plana al 55 %, sin desenfoque.
- **Fondo de la mesa:** por omisión, el tramado Dither en bloques finos de tinta (a la mitad de la resolución), hasta 30 %, nunca encima del contenido.
  - Desde ADR-039 se puede elegir también Cuadrícula de puntos, Cuadros, Ondas, Hilos, Hiperespacio, Retícula ondulada, Listones e Iridiscencia (Canvas 2D, tinta; Iridiscencia usa el color principal) o Ninguno.
- **Banner del acceso:** mosaico SVG de baldosas geométricas en tinta, papel y gris, con una o dos en el color principal (`LoginBanner`). Llena todo el panel derecho con baldosas enteras, sin marco (2026-10-13).
- **Selección rápida:** clientes, regímenes, RFC y usuarios se eligen escribiendo (`SearchSelectField`); las fechas, en el modal de `DateField`.
- **Avisos:** SwipeToast abajo a la derecha, con mecha y descarte al arrastrar.
- **Barra de lista:** `ListToolbar` en una fila (inicio, buscador que llena el espacio, Filtros, acciones); si las acciones bajan, ocupan la fila completa. El buscador es siempre `SearchBox`: lupa en su celda, placeholder y ×.
- **Filtros:** se eligen en un modal "Filtros" con contador; la búsqueda queda a la vista. Los activos se muestran bajo la barra como chips removibles (`FilterChips`: marco de 2 px, sombra dura de 2 px, rótulo mono y ×).
- **Datos con forma:** RFC, teléfono, dinero y correo usan sus campos (`RfcField`, `PhoneField`, `MoneyField`, `EmailField`) con formato al escribir y en Geist Mono.
- **Métricas:** marco de 2 px, etiqueta mono de 11 px en mayúsculas y valor en 800 con cifras tabulares, igual en todas las vistas.

## Shapes

- **Esquinas:** rectas en todo, incluidos controles, tarjetas, modales, pestañas, indicadores de paso y sellos.
- **Marco y separadores:** marco de 2 px en tinta; separadores internos de 1 px en hilo.
- **Excepciones:** sólo los puntos de estado y los tramados del cargador son redondos.

## Components

- **Botón primario:** bloque azul con marco de tinta y sombra de 3 px. **Secundario:** papel con marco de tinta.
- **Botón destructivo:** borde y texto rojos; eliminar siempre es con Hold Button.
- **Campo:** papel con marco de 2 px. El foco es un anillo azul de 3 px; el error, un borde rojo y un mensaje debajo.
- **Sello de estado:** rectángulo con borde de 2 px del color del estado y texto mono en mayúsculas sobre papel. Es la firma visual del sistema.
- **Modal de captura:** `FormModal` con `CaptureSteps`/`FormStepper`.
  - Indicadores cuadrados: el activo en azul, los terminados en tinta.
  - Pie con Atrás y Continuar; el último paso es "Revisar".
- **Índice de notas:** Branched Menu (Vue Bits), con ramas de 2 px en hilo y la rama activa trazada en azul.

## Do's and Don'ts

- **Do:** marca con el azul sólo lo principal y lo seleccionado.
- **Do:** dibuja estados como sellos con texto.
- **Do:** usa mono para datos.
- **Do:** termina toda alta en "Revisar".
- **Don't:** redondear esquinas.
- **Don't:** difuminar sombras o fondos.
- **Don't:** poner etiquetas pequeñas encima de los títulos.
- **Don't:** agregar un segundo acento ni pintar el color elegido sin pasar por la derivación de contraste.
- **Don't:** rotar o inclinar elementos: es serio, no juguetón. Única excepción: las baldosas decorativas del banner del acceso giran en cuartos de vuelta.
