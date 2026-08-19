import { onMounted, onUnmounted, ref } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const glyphs = "01<>[]{}#/\\+=:_";
const frameInterval = 1000 / 18;
let context: CanvasRenderingContext2D | null = null;
let resizeObserver: ResizeObserver | null = null;
let motionPreference: MediaQueryList | null = null;
let animationFrame = 0;
let lastFrame = 0;
let logicalWidth = 0;
let logicalHeight = 0;

function noise(x: number, y: number, frame: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + frame * 0.417) * 43758.5453;
  return value - Math.floor(value);
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  logicalWidth = Math.max(1, Math.round(bounds.width));
  logicalHeight = Math.max(1, Math.round(bounds.height));
  canvas.width = Math.round(logicalWidth * ratio);
  canvas.height = Math.round(logicalHeight * ratio);
  context = canvas.getContext("2d", { alpha: true });
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawFrame(performance.now(), true);
}

function drawFrame(time: number, still = false): void {
  if (!context || !logicalWidth || !logicalHeight) return;
  const frame = still ? 3 : Math.floor(time / 180);
  const cell = logicalWidth < 720 ? 24 : 28;
  const columns = Math.ceil(logicalWidth / cell);
  const rows = Math.ceil(logicalHeight / cell);

  context.clearRect(0, 0, logicalWidth, logicalHeight);
  context.font = `700 ${Math.max(9, cell * 0.38)}px "Courier New", monospace`;
  context.textBaseline = "middle";

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = noise(column, row, frame);
      if (seed < 0.82) continue;
      const glyphIndex = Math.floor(noise(row, column, frame + 17) * glyphs.length);
      const pulse = noise(column + frame, row, 11);
      const alpha = 0.08 + pulse * 0.2;
      context.fillStyle = `rgba(120, 213, 170, ${alpha})`;
      const jitter = seed > 0.97 && !still ? (pulse - 0.5) * 10 : 0;
      context.fillText(glyphs[glyphIndex] || "0", column * cell + jitter, row * cell + cell * 0.5);
    }
  }

  context.fillStyle = "rgba(120, 213, 170, 0.025)";
  for (let y = 0; y < logicalHeight; y += 5) context.fillRect(0, y, logicalWidth, 1);

  if (!still) {
    const bandSeed = noise(frame, 4, 9);
    const bandY = Math.floor(bandSeed * logicalHeight);
    const bandHeight = 1 + Math.floor(noise(frame, 8, 2) * 3);
    context.fillStyle = "rgba(120, 213, 170, 0.16)";
    context.fillRect(0, bandY, logicalWidth, bandHeight);
    context.fillStyle = "rgba(238, 246, 242, 0.055)";
    context.fillRect(noise(frame, 3, 5) * logicalWidth * 0.65, bandY - 4, logicalWidth * 0.28, 1);
  }
}

function animate(time: number): void {
  if (time - lastFrame >= frameInterval) {
    lastFrame = time;
    drawFrame(time);
  }
  animationFrame = requestAnimationFrame(animate);
}

function syncMotionPreference(): void {
  cancelAnimationFrame(animationFrame);
  if (motionPreference?.matches) {
    drawFrame(0, true);
    return;
  }
  animationFrame = requestAnimationFrame(animate);
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  motionPreference.addEventListener("change", syncMotionPreference);
  resizeCanvas();
  syncMotionPreference();
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  motionPreference?.removeEventListener("change", syncMotionPreference);
});

defineExpose({ canvasRef });
