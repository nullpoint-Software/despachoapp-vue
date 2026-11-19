<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { readColorToken, useBackgroundMotion } from './backgroundMotion'

/**
 * Fondo animado: "Dither" de Vue Bits (MIT + Commons Clause), adaptado al rediseño monocromo.
 * Cambios respecto al original:
 * - **Monocromo:** el ruido se cuantiza con la matriz de Bayer 8×8 y se pinta como transparencia en el
 *   color de la tinta (`--textColor`, máx. 30 % en los bloques fuertes), así funciona igual en Light y Dark y nunca tapa texto.
 * - **Costo:** se dibuja a la mitad de la resolución (pixeles de tinta visibles a propósito, ADR-034), con 4 octavas en lugar
 *   de 8 y a ~24 fps (2026-10-13: la quinta octava casi no se veía y costaba un 20 % del sombreador). Se detiene con la preferencia "Pausar fondo animado", con la ventana oculta y
 *   con `prefers-reduced-motion` (queda un cuadro fijo).
 * - **Sin puntero (2026-10-13):** el fondo no recibe eventos (`pointer-events: none`) y ya no escucha `pointermove`;
 *   el ruido que se apartaba alrededor del cursor se retiró porque la interacción con el ratón causaba las caídas de fps.
 * - Sin WebGL no se dibuja nada: el lienzo liso sigue siendo válido.
 * Es el fondo por omisión (`backgroundStyle: 'dither'`); los demás estilos están en `PatternBackground` (ADR-039).
 * `data-motion` publica el estado (`running`, `paused`, `static` o `unavailable`) para las pruebas.
 */
const props = defineProps<{ isPaused: boolean }>()
const root = ref<HTMLElement | null>(null)

// Mitad de la resolución: pixeles de tinta pequeños pero visibles (el usuario los pidió más pequeños, 2026-10-04).
const renderScale = 0.5
const frameIntervalMilliseconds = 42
const maximumOpacity = 0.3

const vertexShader = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`
const fragmentShader = `
precision highp float;
uniform float time;
uniform vec2 resolution;
uniform vec3 inkColor;
uniform float maximumOpacity;

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz; vec4 iy = Pi.yyww; vec4 fx = Pf.xzxz; vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x); vec2 g10 = vec2(gx.y, gy.y); vec2 g01 = vec2(gx.z, gy.z); vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x)); float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z)); float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fadeXy = fade(Pf.xy);
  vec2 nx = mix(vec2(n00, n01), vec2(n10, n11), fadeXy.x);
  return 2.3 * mix(nx.x, nx.y, fadeXy.y);
}
// 4 octavas (el original usa 8): casi la misma textura con mucho menos trabajo por píxel.
float fbm(vec2 p) {
  float value = 0.0; float amplitude = 1.0;
  for (int octave = 0; octave < 4; octave++) { value += amplitude * abs(cnoise(p)); p *= 3.0; amplitude *= 0.3; }
  return value;
}
float pattern(vec2 p) { vec2 shifted = p - time * 0.05; return fbm(p - fbm(p + fbm(shifted))); }
// Matriz de Bayer 8×8 calculada a nivel de bits (equivale a la tabla del original).
float bayer(vec2 cell) {
  float value = 0.0; vec2 coordinate = cell;
  for (int bit = 0; bit < 3; bit++) {
    vec2 bits = mod(coordinate, 2.0);
    // Base 2×2 [[0, 2], [3, 1]] = 2·(x XOR y) + y; el bit menos significativo pesa más al final.
    value = value * 4.0 + 2.0 * abs(bits.x - bits.y) + bits.y;
    coordinate = floor(coordinate / 2.0);
  }
  return value / 64.0;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 centered = uv - 0.5;
  centered.x *= resolution.x / resolution.y;
  float intensity = pattern(centered);
  float threshold = bayer(mod(floor(gl_FragCoord.xy / 2.0), 8.0)) - 0.25;
  // Sin el sesgo de -0.2 del original: con él casi todo quedaba en nivel 0 y el fondo no se veía (2026-10-04).
  float level = floor(clamp(intensity * 0.6 + threshold * 0.5 - 0.05, 0.0, 1.0) * 3.0 + 0.5) / 3.0;
  // Brutalismo (ADR-034): dos tonos de tinta en bloques, el fuerte sólo en el nivel alto, para que el tramado se lea
  // como manchas de tinta y no como un velo uniforme. OGL crea el lienzo sin alfa premultiplicado: el color va tal cual.
  float alpha = level > 0.6 ? maximumOpacity : (level > 0.0 ? maximumOpacity * 0.3 : 0.0);
  gl_FragColor = vec4(inkColor, alpha);
}
`

let renderer: Renderer | null = null
let program: Program | null = null
let mesh: Mesh | null = null

/** Tinta del tema vigente como RGB 0–1 (los tokens son hexadecimales: ver base.css). */
function readInkColor(): [number, number, number] {
  const channels = /^#([0-9a-f]{6})$/i.exec(readColorToken('--textColor', '#0a0a0a'))?.[1] ?? '0a0a0a'
  return [0, 2, 4].map(offset => parseInt(channels.slice(offset, offset + 2), 16) / 255) as [number, number, number]
}
function render(time: number): void {
  if (!renderer || !program || !mesh) return
  program.uniforms.time!.value = time * 0.001
  renderer.render({ scene: mesh })
}
// Pausa, ventana oculta, movimiento reducido y ~24 fps: ciclo compartido con los patrones Canvas 2D (ADR-039).
const { motionState, start, stop, renderStill } = useBackgroundMotion({
  isPaused: () => props.isPaused,
  frameIntervalMilliseconds,
  isAvailable: () => renderer !== null,
  render,
  onAppearanceChange: () => { program!.uniforms.inkColor!.value = readInkColor(); renderStill() }
})
function resize(): void {
  if (!renderer || !program || !root.value) return
  const width = Math.max(1, Math.round(root.value.clientWidth * renderScale)), height = Math.max(1, Math.round(root.value.clientHeight * renderScale))
  renderer.setSize(width, height)
  const canvas = renderer.gl.canvas as HTMLCanvasElement
  canvas.style.width = '100%'; canvas.style.height = '100%'
  program.uniforms.resolution!.value = [width, height]
  renderStill()
}

onMounted(() => {
  if (!root.value) return
  try {
    renderer = new Renderer({ alpha: true, dpr: 1, antialias: false })
    const context = renderer.gl
    context.clearColor(0, 0, 0, 0)
    program = new Program(context, { vertex: vertexShader, fragment: fragmentShader, transparent: true,
      uniforms: { time: { value: 0 }, resolution: { value: [1, 1] }, inkColor: { value: readInkColor() }, maximumOpacity: { value: maximumOpacity } } })
    mesh = new Mesh(context, { geometry: new Triangle(context), program })
    root.value.appendChild(context.canvas as HTMLCanvasElement)
  } catch { renderer = null; program = null; mesh = null }
  window.addEventListener('resize', resize)
  resize()
  start()
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', resize)
  renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext()
  renderer = null; program = null; mesh = null
})
</script>
<template>
  <div
    ref="root"
    class="animated-background"
    data-background="dither"
    aria-hidden="true"
    :data-motion="motionState"
  />
</template>
