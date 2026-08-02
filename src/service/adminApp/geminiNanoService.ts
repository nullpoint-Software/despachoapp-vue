export type GeminiNanoAvailability =
  | "checking"
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface GeminiNanoResult {
  examples: string[];
  note: string;
}

interface LanguageModelPromptOptions {
  responseConstraint: Record<string, unknown>;
  omitResponseConstraintInput?: boolean;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(
    input: string,
    options: LanguageModelPromptOptions,
  ): Promise<string>;
  destroy(): void;
}

interface LanguageModelApi {
  availability(options: Record<string, unknown>): Promise<GeminiNanoAvailability>;
  create(options: Record<string, unknown>): Promise<LanguageModelSession>;
}

const sessionCapabilities = {
  expectedInputs: [{ type: "text", languages: ["es"] }],
  expectedOutputs: [{ type: "text", languages: ["es"] }],
};

const responseSchema = {
  type: "object",
  properties: {
    examples: {
      type: "array",
      items: { type: "string", minLength: 2, maxLength: 90 },
      minItems: 4,
      maxItems: 12,
    },
    note: { type: "string", minLength: 2, maxLength: 220 },
  },
  required: ["examples", "note"],
  additionalProperties: false,
};

const getLanguageModel = (): LanguageModelApi | null => {
  const scope = globalThis as typeof globalThis & {
    LanguageModel?: LanguageModelApi;
  };
  return scope.LanguageModel || null;
};

const promptWithTimeout = async (
  session: LanguageModelSession,
  input: string,
  options: Omit<LanguageModelPromptOptions, "signal">,
  timeoutMs = 15000,
) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await session.prompt(input, { ...options, signal: controller.signal });
  } catch (promptError) {
    if (controller.signal.aborted) {
      throw new Error("Gemini Nano tardó demasiado. Intenta nuevamente o escribe una descripción más específica.");
    }
    throw promptError;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const getGeminiNanoAvailability =
  async (): Promise<GeminiNanoAvailability> => {
    const languageModel = getLanguageModel();
    if (!languageModel) return "unavailable";

    try {
      return await languageModel.availability(sessionCapabilities);
    } catch {
      return "unavailable";
    }
  };

export const generateSatUsageExamples = async (
  input: {
    code: string;
    description: string;
    similarWords: string;
    officialChildren: Array<{ code: string; description: string }>;
  },
  onDownloadProgress?: (progress: number) => void,
): Promise<GeminiNanoResult> => {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    throw new Error(
      "Gemini Nano no está disponible en este navegador. Usa una versión compatible de Chrome de escritorio.",
    );
  }

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: "system",
        content:
          "Eres un asistente mexicano de clasificación de productos y servicios para CFDI. Genera ejemplos cotidianos, concretos y breves que puedan corresponder a la descripción oficial proporcionada. No cambies la clave, no inventes reglas fiscales y no afirmes que el resultado sustituye una revisión profesional. Si la categoría es amplia, cubre tipos distintos. Si es específica, genera presentaciones o variantes comerciales realistas del mismo artículo.",
      },
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener("downloadprogress", (event) => {
        const progressEvent = event as Event & { loaded?: number };
        onDownloadProgress?.(
          Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))),
        );
      });
    },
  });

  const childrenContext = input.officialChildren.length
    ? input.officialChildren
        .map((child) => child.code + ": " + child.description)
        .join("\n")
    : "No hay subclaves oficiales proporcionadas.";

  const prompt = [
    "Clave SAT seleccionada: " + input.code,
    "Descripción oficial: " + input.description,
    "Palabras similares del catálogo: " +
      (input.similarWords || "No publicadas"),
    "Subclaves oficiales relacionadas:",
    childrenContext,
    "",
    "Devuelve entre 6 y 12 ejemplos en español de México de productos o servicios concretos que una persona reconocería dentro de esta descripción.",
    "No incluyas claves distintas dentro del texto de los ejemplos.",
    "Evita repetir la descripción literal y evita ejemplos que pertenezcan claramente a otra categoría.",
    "La nota debe recordar en una sola frase que los ejemplos son orientativos y que debe elegirse la clave más específica disponible.",
  ].join("\n");

  try {
    const rawResult = await promptWithTimeout(session, prompt, {
      responseConstraint: responseSchema,
      omitResponseConstraintInput: true,
    });
    const parsed = JSON.parse(rawResult) as Partial<GeminiNanoResult>;
    const examples = Array.from(
      new Map(
        (Array.isArray(parsed.examples) ? parsed.examples : [])
          .map((example) => String(example).trim())
          .filter((example) => example.length >= 2 && example.length <= 90)
          .map((example) => [example.toLocaleLowerCase("es-MX"), example]),
      ).values(),
    ).slice(0, 12);

    if (examples.length < 4) {
      throw new Error("Gemini Nano no devolvió suficientes ejemplos útiles.");
    }

    return {
      examples,
      note:
        typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim()
          : "Ejemplos orientativos; utiliza la clave más específica que describa tu operación.",
    };
  } finally {
    session.destroy();
  }
};

export interface GeminiNanoProductContext {
  summary: string;
  searchTerms: string[];
}

export const understandSatProduct = async (
  product: string,
  onDownloadProgress?: (progress: number) => void,
): Promise<GeminiNanoProductContext> => {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    throw new Error("Gemini Nano no está disponible para identificar el producto.");
  }

  const contextSchema = {
    type: "object",
    properties: {
      summary: { type: "string", minLength: 4, maxLength: 80 },
      searchTerms: {
        type: "array",
        items: { type: "string", minLength: 2, maxLength: 45 },
        minItems: 3,
        maxItems: 5,
      },
    },
    required: ["summary", "searchTerms"],
    additionalProperties: false,
  };

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: "system",
        content:
          "Identifica productos y servicios antes de clasificarlos fiscalmente. Reconoce marcas, modelos y nombres comerciales por su uso real. Devuelve una descripción genérica precisa y términos que aparecerían en un catálogo de productos. Prioriza la categoría comercial del artículo completo, no su forma, ingrediente ni el significado literal de una palabra aislada. Por ejemplo, Doritos 3D es una botana de maíz y Nintendo Switch es una consola de videojuegos. No propongas claves SAT todavía.",
      },
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener("downloadprogress", (event) => {
        const progressEvent = event as Event & { loaded?: number };
        onDownloadProgress?.(Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))));
      });
    },
  });

  try {
    const rawResult = await promptWithTimeout(
      session,
      [
        `Producto o servicio: ${product}`,
        "Primero identifica qué es, para qué sirve y su categoría comercial genérica.",
        "Si contiene una marca o modelo conocido, interpreta el producto completo y no cada palabra por separado.",
        "Los términos de búsqueda deben ser sustantivos o frases breves en español útiles para encontrarlo en un catálogo oficial.",
      ].join("\n"),
      { responseConstraint: contextSchema, omitResponseConstraintInput: true },
    );
    const parsed = JSON.parse(rawResult) as Partial<GeminiNanoProductContext>;
    const searchTerms = Array.from(
      new Set(
        (Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [])
          .map((term) => String(term).trim())
          .filter((term) => term.length >= 2 && term.length <= 45),
      ),
    ).slice(0, 5);
    if (searchTerms.length < 2) {
      throw new Error("Gemini Nano no pudo identificar suficientes características del producto.");
    }
    return {
      summary: String(parsed.summary || product).trim().slice(0, 80),
      searchTerms,
    };
  } finally {
    session.destroy();
  }
};

export interface GeminiNanoClassificationSuggestion {
  code: string;
  reason: string;
}

export interface GeminiNanoClassificationResult {
  suggestions: GeminiNanoClassificationSuggestion[];
  note: string;
}

export const classifySatProduct = async (
  input: {
    product: string;
    candidates: Array<{ code: string; description: string; similarWords: string }>;
  },
  onDownloadProgress?: (progress: number) => void,
): Promise<GeminiNanoClassificationResult> => {
  const languageModel = getLanguageModel();
  if (!languageModel) {
    throw new Error(
      "Gemini Nano no está disponible en este navegador. Usa una versión compatible de Chrome de escritorio.",
    );
  }
  if (!input.candidates.length) {
    throw new Error("No encontramos candidatos oficiales suficientes para consultar con Gemini Nano.");
  }

  const allowedCodes = new Set(input.candidates.map((candidate) => candidate.code));
  const classificationSchema = {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: 0,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            code: { type: "string", enum: [...allowedCodes] },
            reason: { type: "string", minLength: 4, maxLength: 96 },
          },
            directMatch: { type: "boolean" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          required: ["code", "reason", "directMatch", "confidence"],
          additionalProperties: false,
        },
      },
      note: { type: "string", minLength: 2, maxLength: 140 },
    },
    required: ["suggestions", "note"],
    additionalProperties: false,
  };

  const session = await languageModel.create({
    ...sessionCapabilities,
    initialPrompts: [
      {
        role: "system",
        content:
          "Eres un clasificador estricto de productos y servicios para CFDI. Elige únicamente claves candidatas que describan directamente el producto real. Rechaza coincidencias basadas solo en una palabra compartida, un adjetivo, una marca o una interpretación indirecta. No incluyas una clave si tu propia explicación dice que no coincide, que no es específica o que solo podría relacionarse. Es preferible devolver cero resultados que uno incorrecto. No inventes claves ni reglas fiscales.",
      },
    ],
    monitor(monitor: EventTarget) {
      monitor.addEventListener("downloadprogress", (event) => {
        const progressEvent = event as Event & { loaded?: number };
        onDownloadProgress?.(
          Math.max(0, Math.min(1, Number(progressEvent.loaded || 0))),
        );
      });
    },
  });

  const candidateText = input.candidates
    .map(
      (candidate) =>
        `${candidate.code}: ${candidate.description.slice(0, 100)}${
          candidate.similarWords ? ` | También: ${candidate.similarWords.slice(0, 80)}` : ""
        }`,
    )
    .join("\n");

  try {
    const rawResult = await promptWithTimeout(
      session,
      [
        `Producto o servicio escrito por el usuario: ${input.product}`,
        "Claves oficiales candidatas:",
        candidateText,
        "",
        "Devuelve como máximo tres coincidencias directas. No necesitas completar ninguna cuota.",
        "Marca directMatch como true solamente si la clave describe realmente el producto, y confidence como high solo con evidencia clara.",
        "Omite accesorios, componentes, homónimos y coincidencias por adjetivos salvo que el usuario los haya solicitado.",
        "Explica cada coincidencia en una frase directa de máximo 12 palabras. Si ninguna es segura, devuelve suggestions vacío.",
      ].join("\n"),
      {
        responseConstraint: classificationSchema,
        omitResponseConstraintInput: true,
      },
    );
    const parsed = JSON.parse(rawResult) as Partial<{
      suggestions: Array<GeminiNanoClassificationSuggestion & {
        directMatch: boolean;
        confidence: "high" | "medium" | "low";
      }>;
      note: string;
    }>;
    const rejectedReason = /no coincide|no corresponde|no es espec[ií]fic|podr[ií]a referirse|solo comparte|relaci[oó]n indirecta|otra categor[ií]a|dudoso/i;
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((suggestion) =>
            Boolean(
              suggestion &&
                allowedCodes.has(String(suggestion.code)) &&
                suggestion.directMatch === true &&
                suggestion.confidence === "high" &&
                String(suggestion.reason || "").trim() &&
                !rejectedReason.test(String(suggestion.reason)),
            ),
          )
          .map((suggestion) => ({
            code: String(suggestion.code),
            reason: String(suggestion.reason).trim().slice(0, 96),
          }))
          .slice(0, 3)
      : [];

    return {
      suggestions,
      note: suggestions.length
        ? typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim()
          : "Sugerencias orientativas; confirma la clave más específica antes de emitir el CFDI."
        : "No encontré una coincidencia directa suficientemente segura. Agrega el tipo, uso o presentación del producto.",
    };
  } finally {
    session.destroy();
  }
};
