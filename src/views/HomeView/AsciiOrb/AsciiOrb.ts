import { onBeforeUnmount, onMounted, ref } from "vue";

type TorusPoint = { x: number; y: number; z: number; nx: number; ny: number; nz: number };
type ProjectedPoint = { x: number; y: number; z: number; light: number };

const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const points: TorusPoint[] = [];
const glyphs = " .,:;+*#%@";

let frameId = 0;
let lastFrame = 0;
let running = true;
let visible = true;
let reducedMotion = false;
let rotationX = -0.08;
let rotationY = -0.18;
let targetX = rotationX;
let targetY = rotationY;
let resizeObserver: ResizeObserver | undefined;
let intersectionObserver: IntersectionObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function addPoint(x: number, y: number, z: number, nx = 0, ny = 0, nz = 1): void {
  points.push({ x, y, z, nx, ny, nz });
}

function addSegment(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  spacing = 0.075,
  thickness = 0.08,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.max(2, Math.ceil(distance / spacing));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    for (const layer of [-1, 0, 1]) {
      addPoint(
        from.x + (to.x - from.x) * progress,
        from.y + (to.y - from.y) * progress,
        from.z + (to.z - from.z) * progress + layer * thickness,
        0,
        -0.25,
        layer === 0 ? 1 : layer,
      );
    }
  }
}

function addEllipse(cx: number, cy: number, rx: number, ry: number, z = 0): void {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.075) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const depth of [-0.11, 0, 0.11]) {
      addPoint(cx + rx * cos, cy + ry * sin, z + depth, cos, sin, depth === 0 ? 1 : depth);
    }
  }
}

function addPan(cx: number, rimY: number): void {
  addEllipse(cx, rimY, 0.82, 0.14);
  for (let slice = -3; slice <= 3; slice += 1) {
    const z = slice * 0.07;
    const width = Math.sqrt(Math.max(0.3, 1 - (z / 0.34) ** 2));
    for (let step = 0; step <= 40; step += 1) {
      const u = step / 20 - 1;
      addPoint(cx + u * 0.78 * width, rimY + 0.68 * (1 - u * u), z, u, -0.75, z * 2.2);
    }
  }
}

function buildJusticeScale(): void {
  addEllipse(0, 2.13, 1.14, 0.18);
  addEllipse(0, 1.96, 0.82, 0.12);
  addSegment({ x: -1.08, y: 2.13, z: 0 }, { x: -0.78, y: 1.96, z: 0 });
  addSegment({ x: 1.08, y: 2.13, z: 0 }, { x: 0.78, y: 1.96, z: 0 });
  addSegment({ x: 0, y: 1.98, z: 0 }, { x: 0, y: -1.18, z: 0 }, 0.06, 0.12);
  addEllipse(0, 1.82, 0.27, 0.1);

  addSegment({ x: -0.34, y: -0.92, z: 0 }, { x: 0, y: -1.37, z: 0 });
  addSegment({ x: 0, y: -1.37, z: 0 }, { x: 0.34, y: -0.92, z: 0 });
  addSegment({ x: -0.34, y: -0.92, z: 0 }, { x: 0.34, y: -0.92, z: 0 });
  addEllipse(0, -1.53, 0.18, 0.18);
  addSegment({ x: -2.35, y: -0.88, z: 0 }, { x: 2.35, y: -0.88, z: 0 }, 0.055, 0.13);
  addEllipse(-2.35, -0.88, 0.13, 0.13);
  addEllipse(2.35, -0.88, 0.13, 0.13);

  addSegment({ x: -2.2, y: -0.82, z: 0 }, { x: -2.62, y: 0.22, z: 0 }, 0.065, 0.035);
  addSegment({ x: -1.25, y: -0.88, z: 0 }, { x: -1.02, y: 0.22, z: 0 }, 0.065, 0.035);
  addSegment({ x: 1.25, y: -0.88, z: 0 }, { x: 1.02, y: 0.22, z: 0 }, 0.065, 0.035);
  addSegment({ x: 2.2, y: -0.82, z: 0 }, { x: 2.62, y: 0.22, z: 0 }, 0.065, 0.035);
  addPan(-1.82, 0.22);
  addPan(1.82, 0.22);
}

buildJusticeScale();
function rotate(point: TorusPoint, angleX: number, angleY: number): ProjectedPoint {
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const y1 = point.y * cosX - point.z * sinX;
  const z1 = point.y * sinX + point.z * cosX;
  const x2 = point.x * cosY + z1 * sinY;
  const z2 = -point.x * sinY + z1 * cosY;
  const ny1 = point.ny * cosX - point.nz * sinX;
  const nz1 = point.ny * sinX + point.nz * cosX;
  const nx2 = point.nx * cosY + nz1 * sinY;
  const nz2 = -point.nx * sinY + nz1 * cosY;
  const light = Math.max(0, nx2 * -0.25 + ny1 * -0.5 + nz2 * -0.82);
  return { x: x2, y: y1, z: z2, light };
}

function resize(): void {
  const canvas = canvasRef.value;
  const root = rootRef.value;
  if (!canvas || !root) return;
  const rect = root.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  draw(performance.now());
}

function draw(time: number): void {
  const canvas = canvasRef.value;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  if (!reducedMotion) {
    const idle = time * 0.00028;
    rotationX += (targetX + Math.sin(idle * 0.7) * 0.08 - rotationX) * 0.035;
    rotationY += (targetY + Math.sin(idle * 2.4) * 0.18 - rotationY) * 0.025;
  }

  const projected = points.map((point) => rotate(point, rotationX, rotationY)).sort((a, b) => a.z - b.z);
  const scale = Math.min(width / 6.8, height / 5.8);
  const focal = 5.2;
  const fontSize = Math.max(8, Math.min(14, width / 52));
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;

  for (const point of projected) {
    const depth = focal / (focal + point.z);
    const x = width / 2 + point.x * scale * depth;
    const y = height / 2 + point.y * scale * depth;
    const brightness = Math.min(1, point.light * 0.78 + (point.z + 2.3) / 12);
    const glyph = glyphs[Math.min(glyphs.length - 1, Math.floor(brightness * glyphs.length))];
    context.globalAlpha = 0.28 + brightness * 0.72;
    context.fillStyle = brightness > 0.58 ? "#b8f5d8" : "#69b892";
    context.fillText(glyph, x, y);
  }
  context.globalAlpha = 1;
}

function animate(time: number): void {
  if (!running) return;
  if (visible && !document.hidden && !reducedMotion && time - lastFrame > 32) {
    draw(time);
    lastFrame = time;
  }
  frameId = requestAnimationFrame(animate);
}

function handlePointer(event: PointerEvent): void {
  if (reducedMotion || !rootRef.value) return;
  const rect = rootRef.value.getBoundingClientRect();
  targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.95;
  targetX = -0.08 + ((event.clientY - rect.top) / rect.height - 0.5) * 0.55;
}

function handleMotionPreference(event: MediaQueryListEvent | MediaQueryList): void {
  reducedMotion = event.matches;
  if (reducedMotion) {
    rotationX = -0.08;
    rotationY = -0.18;
    draw(performance.now());
  }
}

onMounted(() => {
  const root = rootRef.value;
  if (!root) return;
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  handleMotionPreference(motionQuery);
  motionQuery.addEventListener("change", handleMotionPreference);
  root.addEventListener("pointermove", handlePointer, { passive: true });
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "120px" });
  intersectionObserver.observe(root);
  resize();
  frameId = requestAnimationFrame(animate);
});

onBeforeUnmount(() => {
  running = false;
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  motionQuery?.removeEventListener("change", handleMotionPreference);
  rootRef.value?.removeEventListener("pointermove", handlePointer);
});