import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const frameInterval = 1000 / 24
let context: CanvasRenderingContext2D | null = null
let resizeObserver: ResizeObserver | null = null
let motionPreference: MediaQueryList | null = null
let animationFrame = 0
let lastFrame = 0
let logicalWidth = 0
let logicalHeight = 0
let hasPointer = false
const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }

function hash(x: number, y: number, frame: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + frame * 17.13) * 43758.5453123
  return value - Math.floor(value)
}

function terminalField(x: number, y: number, time: number): number {
  const a = Math.sin(x * 0.013 + time * 0.00048)
  const b = Math.sin(y * 0.019 - time * 0.00039)
  const c = Math.sin((x + y) * 0.009 + time * 0.00027)
  const d = Math.sin(
    Math.hypot(x - logicalWidth * 0.52, y - logicalHeight * 0.44) * 0.021 - time * 0.00058
  )
  return (a + b + c + d) * 0.25
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const bounds = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 1.35)
  logicalWidth = Math.max(1, Math.round(bounds.width))
  logicalHeight = Math.max(1, Math.round(bounds.height))
  canvas.width = Math.round(logicalWidth * ratio)
  canvas.height = Math.round(logicalHeight * ratio)
  context = canvas.getContext('2d', { alpha: true })
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  if (!hasPointer) {
    pointer.x = logicalWidth * 0.68
    pointer.y = logicalHeight * 0.36
    pointer.targetX = pointer.x
    pointer.targetY = pointer.y
  }
  drawFrame(performance.now(), true)
}

function drawSquare(x: number, y: number, cell: number, alpha: number, variation: number): void {
  if (!context) return
  const inset = Math.max(1.15, cell * 0.1)
  const size = Math.max(3, cell - inset * 2)
  const tileAlpha = alpha * (0.84 + variation * 0.16)

  context.fillStyle = 'rgba(120, 213, 170, ' + tileAlpha + ')'
  context.fillRect(x + inset, y + inset, size, size)

  context.fillStyle = 'rgba(218, 255, 235, ' + tileAlpha * 0.16 + ')'
  context.fillRect(x + inset, y + inset, size, Math.max(0.75, cell * 0.055))
}

function drawFrame(time: number, still = false): void {
  if (!context || !logicalWidth || !logicalHeight) return
  pointer.x += (pointer.targetX - pointer.x) * (still ? 1 : 0.095)
  pointer.y += (pointer.targetY - pointer.y) * (still ? 1 : 0.095)

  const frame = still ? 7 : Math.floor(time / 92)
  const cell = logicalWidth < 720 ? 12 : 15
  const columns = Math.ceil(logicalWidth / cell) + 1
  const rows = Math.ceil(logicalHeight / cell) + 1
  const radius = Math.min(390, Math.max(190, logicalWidth * 0.23))

  context.clearRect(0, 0, logicalWidth, logicalHeight)
  context.fillStyle = 'rgba(3, 11, 8, 0.34)'
  context.fillRect(0, 0, logicalWidth, logicalHeight)

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centerX = column * cell + cell * 0.5
      const centerY = row * cell + cell * 0.5
      const dx = centerX - pointer.x
      const dy = centerY - pointer.y
      const distance = Math.hypot(dx, dy) || 1
      const influence = hasPointer ? Math.max(0, 1 - distance / radius) : 0
      const easedInfluence = influence * influence
      const swirl = Math.sin(time * 0.0018 + distance * 0.025) * easedInfluence
      const warpedX = centerX + (dx / distance) * easedInfluence * 54 - (dy / distance) * swirl * 24
      const warpedY = centerY + (dy / distance) * easedInfluence * 38 + (dx / distance) * swirl * 24
      const random = hash(column, row, frame)
      const field = terminalField(warpedX, warpedY, time) + (random - 0.5) * 0.76
      const threshold = 0.06 - easedInfluence * 0.34
      if (field < threshold) continue

      const strength = Math.min(1, (field - threshold) * 1.55 + easedInfluence * 0.76)
      const alpha = 0.09 + strength * 0.35
      const jitter =
        !still && random > 0.965 ? (hash(row, column, frame + 9) - 0.5) * cell * 1.7 : 0
      const variation = hash(row + 7, column + 13, frame)
      drawSquare(column * cell + jitter, row * cell, cell, alpha, variation)
    }
  }

  if (hasPointer) {
    const halo = context.createRadialGradient(
      pointer.x,
      pointer.y,
      0,
      pointer.x,
      pointer.y,
      radius * 0.62
    )
    halo.addColorStop(0, 'rgba(180, 244, 210, 0.12)')
    halo.addColorStop(0.35, 'rgba(120, 213, 170, 0.055)')
    halo.addColorStop(1, 'rgba(120, 213, 170, 0)')
    context.fillStyle = halo
    context.fillRect(pointer.x - radius, pointer.y - radius, radius * 2, radius * 2)
  }

  context.fillStyle = 'rgba(192, 242, 216, 0.028)'
  for (let y = 0; y < logicalHeight; y += 4) context.fillRect(0, y, logicalWidth, 1)

  if (!still) {
    const bandY = ((time * 0.072) % (logicalHeight + 180)) - 90
    const band = context.createLinearGradient(0, bandY - 34, 0, bandY + 34)
    band.addColorStop(0, 'rgba(120, 213, 170, 0)')
    band.addColorStop(0.5, 'rgba(120, 213, 170, 0.065)')
    band.addColorStop(1, 'rgba(120, 213, 170, 0)')
    context.fillStyle = band
    context.fillRect(0, bandY - 34, logicalWidth, 68)

    if (hash(frame, 4, 12) > 0.94) {
      const glitchY = hash(frame, 7, 3) * logicalHeight
      const glitchX = hash(frame, 2, 18) * logicalWidth * 0.42
      context.fillStyle = 'rgba(202, 250, 224, 0.13)'
      context.fillRect(
        glitchX,
        glitchY,
        logicalWidth * (0.18 + hash(frame, 9, 6) * 0.34),
        1 + hash(frame, 1, 2) * 3
      )
    }
  }
}

function animate(time: number): void {
  if (time - lastFrame >= frameInterval) {
    lastFrame = time
    drawFrame(time)
  }
  animationFrame = requestAnimationFrame(animate)
}

function syncMotionPreference(): void {
  cancelAnimationFrame(animationFrame)
  if (motionPreference?.matches) {
    drawFrame(0, true)
    return
  }
  animationFrame = requestAnimationFrame(animate)
}

function handlePointerMove(event: PointerEvent): void {
  hasPointer = true
  pointer.targetX = event.clientX
  pointer.targetY = event.clientY
  if (motionPreference?.matches) drawFrame(0, true)
}

function handlePointerLeave(): void {
  hasPointer = false
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)
  motionPreference.addEventListener('change', syncMotionPreference)
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', handlePointerLeave)
  resizeCanvas()
  syncMotionPreference()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  motionPreference?.removeEventListener('change', syncMotionPreference)
  window.removeEventListener('pointermove', handlePointerMove)
  document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
})

defineExpose({ canvasRef })
