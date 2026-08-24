export type GeminiNanoAvailability =
  'checking' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

export interface GeminiNanoResult {
  examples: string[]
  note: string
}

interface LanguageModelPromptOptions {
  responseConstraint: Record<string, unknown>
  omitResponseConstraintInput?: boolean
  signal?: AbortSignal
}

interface LanguageModelSession {
  prompt(input: string, options: LanguageModelPromptOptions): Promise<string>
  destroy(): void
}

interface LanguageModelApi {
  availability(options: Record<string, unknown>): Promise<GeminiNanoAvailability>
  create(options: Record<string, unknown>): Promise<LanguageModelSession>
}

const sessionCapabilities = {
  expectedInputs: [{ type: 'text', languages: ['es'] }],
  expectedOutputs: [{ type: 'text', languages: ['es'] }]
}

const responseSchema = {
  type: 'object',
  properties: {
    examples: {
      type: 'array',
      items: { type: 'string', minLength: 2, maxLength: 90 },
      minItems: 4,
      maxItems: 6
    }
  },
  required: ['examples'],
  additionalProperties: false
}

const getLanguageModel = (): LanguageModelApi | null => {
  const scope = globalThis as typeof globalThis & {
    LanguageModel?: LanguageModelApi
  }
  return scope.LanguageModel || null
}

const promptWithTimeout = async (
  session: LanguageModelSession,
  input: string,
  options: Omit<LanguageModelPromptOptions, 'signal'>,
  timeoutMs = 15000
) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await session.prompt(input, { ...options, signal: controller.signal })
  } catch (promptError) {
    if (controller.signal.aborted) {
      throw new Error(
        'Gemini Nano tardó demasiado. Intenta nuevamente o escribe una descripción más específica.'
      )
    }
    throw promptError
  } finally {
    window.clearTimeout(timeout)
  }
}

export const getGeminiNanoAvailability = async (): Promise<GeminiNanoAvailability> => {
  const languageModel = getLanguageModel()
  if (!languageModel) return 'unavailable'

  try {
    return await languageModel.availability(sessionCapabilities)
  } catch {
    return 'unavailable'
  }
}

export const generateSatUsageExamples = async (
  input: {
    code: string
    description: string
    similarWords: string
    officialChildren: Array<{ code: string; description: string }>
  },
  onDownloadProgress?: (progress: number) => void
): Promise<GeminiNanoResult> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    throw new Error(
      'Gemini Nano no está disponible en este navegador. Usa una versión compatible de Chrome de escritorio.'
    )
  }

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: 'system',
        content:
          'Genera ejemplos mexicanos breves que pertenezcan directamente a la clave SAT indicada. No inventes claves ni reglas fiscales.'
      }
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progressEvent = event as Event & { loaded?: number }
        onDownloadProgress?.(Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))))
      })
    }
  })

  const childrenContext = input.officialChildren.length
    ? input.officialChildren
        .slice(0, 8)
        .map((child) => child.code + ': ' + child.description.slice(0, 70))
        .join('\n')
    : 'No hay subclaves oficiales proporcionadas.'

  const prompt = [
    'Clave SAT seleccionada: ' + input.code,
    'Descripción oficial: ' + input.description,
    'Palabras similares del catálogo: ' + (input.similarWords || 'No publicadas'),
    'Subclaves oficiales relacionadas:',
    childrenContext,
    '',
    'Devuelve exactamente 4 ejemplos concretos y distintos en español de México.',
    'No escribas claves ni artículos de otra categoría.'
  ].join('\n')

  try {
    const rawResult = await promptWithTimeout(session, prompt, {
      responseConstraint: responseSchema,
      omitResponseConstraintInput: true
    })
    const parsed = JSON.parse(rawResult) as Partial<GeminiNanoResult>
    const examples = Array.from(
      new Map(
        (Array.isArray(parsed.examples) ? parsed.examples : [])
          .map((example) => String(example).trim())
          .filter((example) => example.length >= 2 && example.length <= 90)
          .map((example) => [example.toLocaleLowerCase('es-MX'), example])
      ).values()
    ).slice(0, 12)

    if (examples.length < 4) {
      throw new Error('Gemini Nano no devolvió suficientes ejemplos útiles.')
    }

    return {
      examples,
      note:
        typeof parsed.note === 'string' && parsed.note.trim()
          ? parsed.note.trim()
          : 'Ejemplos orientativos; utiliza la clave más específica que describa tu operación.'
    }
  } finally {
    session.destroy()
  }
}

export interface GeminiNanoProductContext {
  summary: string
  searchTerms: string[]
}

export const understandSatProduct = async (
  product: string,
  onDownloadProgress?: (progress: number) => void
): Promise<GeminiNanoProductContext> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    throw new Error('Gemini Nano no está disponible para identificar el producto.')
  }

  const contextSchema = {
    type: 'object',
    properties: {
      summary: { type: 'string', minLength: 4, maxLength: 80 },
      searchTerms: {
        type: 'array',
        items: { type: 'string', minLength: 2, maxLength: 45 },
        minItems: 2,
        maxItems: 4
      }
    },
    required: ['summary', 'searchTerms'],
    additionalProperties: false
  }

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: 'system',
        content:
          'Identifica el producto completo, incluso si usa marca o modelo. Devuelve su categoría genérica y términos breves para buscarla en un catálogo. No propongas claves SAT.'
      }
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progressEvent = event as Event & { loaded?: number }
        onDownloadProgress?.(Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))))
      })
    }
  })

  try {
    const rawResult = await promptWithTimeout(
      session,
      [
        `Producto o servicio: ${product}`,
        'Indica qué es y su categoría comercial.',
        'Usa sustantivos o frases breves en español para searchTerms.'
      ].join('\n'),
      { responseConstraint: contextSchema, omitResponseConstraintInput: true }
    )
    const parsed = JSON.parse(rawResult) as Partial<GeminiNanoProductContext>
    const searchTerms = Array.from(
      new Set(
        (Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [])
          .map((term) => String(term).trim())
          .filter((term) => term.length >= 2 && term.length <= 45)
      )
    ).slice(0, 4)
    if (searchTerms.length < 2) {
      throw new Error('Gemini Nano no pudo identificar suficientes características del producto.')
    }
    return {
      summary: String(parsed.summary || product)
        .trim()
        .slice(0, 80),
      searchTerms
    }
  } finally {
    session.destroy()
  }
}

export interface GeminiNanoClassificationSuggestion {
  code: string
  reason: string
}

export interface GeminiNanoClassificationResult {
  suggestions: GeminiNanoClassificationSuggestion[]
  note: string
}

export const classifySatProduct = async (
  input: {
    product: string
    candidates: Array<{ code: string; description: string; similarWords: string }>
  },
  onDownloadProgress?: (progress: number) => void
): Promise<GeminiNanoClassificationResult> => {
  const languageModel = getLanguageModel()
  if (!languageModel) {
    throw new Error(
      'Gemini Nano no está disponible en este navegador. Usa una versión compatible de Chrome de escritorio.'
    )
  }
  if (!input.candidates.length) {
    throw new Error(
      'No encontramos candidatos oficiales suficientes para consultar con Gemini Nano.'
    )
  }

  const allowedCodes = new Set(input.candidates.map((candidate) => candidate.code))
  const classificationSchema = {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        minItems: 0,
        maxItems: 2,
        items: {
          type: 'object',
          properties: {
            code: { type: 'string', enum: [...allowedCodes] },
            reason: { type: 'string', minLength: 4, maxLength: 72 },
            confidence: { type: 'string', enum: ['high', 'low'] }
          },
          required: ['code', 'reason', 'confidence'],
          additionalProperties: false
        }
      },
      note: { type: 'string', minLength: 2, maxLength: 90 }
    },
    required: ['suggestions', 'note'],
    additionalProperties: false
  }

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: 'system',
        content:
          'Elige solo claves SAT candidatas que describan directamente el producto completo. Devuelve cero resultados antes que una coincidencia dudosa. No inventes claves.'
      }
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progressEvent = event as Event & { loaded?: number }
        onDownloadProgress?.(Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))))
      })
    }
  })

  const candidateText = input.candidates
    .map(
      (candidate) =>
        `${candidate.code}: ${candidate.description.slice(0, 72)}${
          candidate.similarWords ? ` | ${candidate.similarWords.slice(0, 42)}` : ''
        }`
    )
    .join('\n')

  try {
    const rawResult = await promptWithTimeout(
      session,
      [
        `Producto o servicio escrito por el usuario: ${input.product}`,
        'Claves oficiales candidatas:',
        candidateText,
        '',
        'Devuelve máximo 2 coincidencias directas; confidence=high solo si son seguras.',
        'Ignora accesorios, componentes y palabras parecidas no solicitadas.',
        'Razón de máximo 8 palabras. Si dudas, suggestions debe quedar vacío.'
      ].join('\n'),
      {
        responseConstraint: classificationSchema,
        omitResponseConstraintInput: true
      }
    )
    const parsed = JSON.parse(rawResult) as Partial<{
      suggestions: Array<
        GeminiNanoClassificationSuggestion & {
          confidence: 'high' | 'low'
        }
      >
      note: string
    }>
    const rejectedReason =
      /no coincide|no corresponde|no es espec[ií]fic|podr[ií]a referirse|solo comparte|relaci[oó]n indirecta|otra categor[ií]a|dudoso/i
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((suggestion) =>
            Boolean(
              suggestion &&
              allowedCodes.has(String(suggestion.code)) &&
              suggestion.confidence === 'high' &&
              String(suggestion.reason || '').trim() &&
              !rejectedReason.test(String(suggestion.reason))
            )
          )
          .map((suggestion) => ({
            code: String(suggestion.code),
            reason: String(suggestion.reason).trim().slice(0, 96)
          }))
          .slice(0, 2)
      : []

    return {
      suggestions,
      note: suggestions.length
        ? typeof parsed.note === 'string' && parsed.note.trim()
          ? parsed.note.trim()
          : 'Sugerencias orientativas; confirma la clave más específica antes de emitir el CFDI.'
        : 'No encontré una coincidencia directa suficientemente segura. Agrega el tipo, uso o presentación del producto.'
    }
  } finally {
    session.destroy()
  }
}
