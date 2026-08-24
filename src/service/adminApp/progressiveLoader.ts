export interface PageRequest {
  limit: number
  offset: number
}

interface ProgressiveOptions<T> {
  fetchPage: (page: PageRequest) => Promise<T[]>
  onUpdate: (items: T[], complete: boolean) => void
  onBackgroundError?: (error: unknown) => void
  pageSize?: number
}

const waitForIdle = () =>
  new Promise<void>((resolve) => {
    const scheduler = globalThis as typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    }

    if (typeof scheduler.requestIdleCallback === 'function') {
      scheduler.requestIdleCallback(() => resolve(), { timeout: 350 })
    } else {
      globalThis.setTimeout(resolve, 80)
    }
  })

export async function loadProgressively<T>({
  fetchPage,
  onUpdate,
  onBackgroundError,
  pageSize = 40
}: ProgressiveOptions<T>) {
  let offset = 0
  let batch = await fetchPage({ limit: pageSize, offset })
  let items = [...batch]
  onUpdate(items, batch.length < pageSize)

  if (batch.length < pageSize) return

  void (async () => {
    try {
      while (batch.length === pageSize) {
        await waitForIdle()
        offset += pageSize
        batch = await fetchPage({ limit: pageSize, offset })
        if (batch.length) items = [...items, ...batch]
        onUpdate(items, batch.length < pageSize)
      }
    } catch (error) {
      onBackgroundError?.(error)
    }
  })()
}
