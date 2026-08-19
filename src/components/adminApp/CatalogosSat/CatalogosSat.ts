import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  loadSatProductCatalog,
  normalizeSatText,
  resetSatProductCatalog,
  type SatSearchRecord,
} from "@/service/adminApp/catalogosSatService";
import { satrs } from "@/service/adminApp/client";
import {
  classifySatProduct,
  generateSatUsageExamples,
  getGeminiNanoAvailability,
  understandSatProduct,
  type GeminiNanoAvailability,
} from "@/service/adminApp/geminiNanoService";

type RecommendationAvailability = "checking" | "unavailable" | "available";

interface SatExamplesResult {
  examples: string[];
  note: string;
}

interface ProductContext {
  summary: string;
  searchTerms: string[];
}

interface SatClassificationResult {
  suggestions: Array<{ code: string; reason: string }>;
  note: string;
  source?: "seed" | "learned" | "local" | "nano";
  status?: "generated" | "confirmed";
}

interface PopularRecommendation {
  query?: string;
  aliases?: string[];
  summary?: string;
  suggestions?: Array<{ code?: string; description?: string; reason?: string }>;
  note?: string;
  status?: "generated" | "confirmed";
  source?: "seed" | "learned";
}

interface PopularCatalogPayload {
  recommendations?: Record<string, PopularRecommendation>;
  codeExamples?: Record<string, unknown>;
}

interface IndexedRecommendation {
  key: string;
  query: string;
  aliases: string[];
  summary: string;
  suggestions: Array<{ code: string; description: string; reason: string }>;
  note: string;
  status: "generated" | "confirmed";
  source: "seed" | "learned";
}

type ClassificationOrigin = "none" | "local" | "server" | "nano";

const suggestions = ref(["software", "café", "papelería", "limpieza", "construcción"]);
const popularCatalogUrl = `${import.meta.env.BASE_URL}data/recomendaciones-sat-populares.json`;
const pageSize = 20;
const examplesCacheKey = "sat-internal-examples-v1";
const examplesCacheLimit = 250;

interface CachedExamplesResult extends SatExamplesResult {
  generatedAt: number;
  description: string;
}

const catalog = ref<SatSearchRecord[]>([]);
const loading = ref(true);
const error = ref("");
const query = ref("");
const searchResults = ref<SatSearchRecord[]>([]);
const selected = ref<SatSearchRecord | null>(null);
const visibleCount = ref(pageSize);
const copiedCode = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const favorites = ref<string[]>(readFavorites());
const recommendationAvailability = ref<RecommendationAvailability>("checking");
const examplesError = ref("");
const generatingExamplesCode = ref("");
const examplesCache = ref<Record<string, CachedExamplesResult>>(readExamplesCache());
const classificationResult = ref<SatClassificationResult | null>(null);
const classificationError = ref("");
const classifyingQuery = ref("");
const classificationPhase = ref<"idle" | "understanding" | "matching" | "saving">("idle");
const nanoAvailability = ref<GeminiNanoAvailability>("checking");
const nanoDownloadProgress = ref(0);
const transferInput = ref<HTMLInputElement | null>(null);
const transferAction = ref<"" | "import" | "export" | "popular">("");
const transferMessage = ref("");
const transferState = ref<"idle" | "success" | "error">("idle");
const manualFormOpen = ref(false);
const manualProductInput = ref<HTMLInputElement | null>(null);
const manualAutoAnalyzing = ref(false);
const lastAnalysisContext = ref<ProductContext | null>(null);
const manualProduct = ref("");
const manualCode = ref("");
const manualCodeSearch = ref("");
const manualAliases = ref("");
const manualExamples = ref("");
const manualReason = ref("");
const manualSaving = ref(false);
const manualMessage = ref("");
const manualState = ref<"idle" | "success" | "error">("idle");
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let storedLookupSequence = 0;
let activeStoredLookup: { query: string; promise: Promise<IndexedRecommendation | null> } | null = null;
let popularCatalogPromise: Promise<PopularCatalogPayload> | null = null;
let examplesGenerationQueue: Promise<void> = Promise.resolve();
const indexedRecommendations = new Map<string, IndexedRecommendation>();
const recommendationByPhrase = new Map<string, string>();
const recommendationKeysByToken = new Map<string, Set<string>>();
const recommendationIndexVersion = ref(0);
const lastClassificationOrigin = ref<ClassificationOrigin>("none");
const checkingStoredRecommendation = ref(false);
const ignoredAssociationWords = new Set([
  "con", "del", "desde", "el", "en", "la", "las", "lo", "los", "para", "por", "que",
  "sin", "una", "uno", "unos", "unas", "y", "servicio", "servicios", "producto", "productos",
  "venta", "ventas", "articulo", "articulos",
]);

const recordByCode = computed(() => new Map(catalog.value.map((record) => [record.i, record])));
const isAdmin = computed(() => localStorage.getItem("level") === "Administrador");
const manualRecord = computed(() => recordByCode.value.get(manualCode.value.trim()) || null);
const manualCodeOptions = computed(() => {
  const normalizedQuery = normalizeSatText(manualCodeSearch.value);
  if (normalizedQuery.length < 2) return [];
  const current = manualRecord.value;
  if (current && manualCodeSearch.value.includes(current.i)) return [current];
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return catalog.value
    .map((record) => ({
      record,
      score: scoreRecord(record, normalizedQuery, tokens),
    }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (first, second) =>
        second.score - first.score || first.record.d.localeCompare(second.record.d, "es"),
    )
    .slice(0, 8)
    .map((entry) => entry.record);
});
const visibleResults = computed(() => searchResults.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleCount.value < searchResults.value.length);
const resultsTitle = computed(() =>
  query.value.trim().length >= 2
    ? 'Resultados para "' + query.value.trim() + '"'
    : "Consulta productos y servicios",
);
const favoriteRecords = computed(() =>
  favorites.value
    .map((code) => recordByCode.value.get(code))
    .filter((record): record is SatSearchRecord => Boolean(record)),
);

const currentExamplesResult = computed(() =>
  selected.value ? examplesCache.value[selected.value.i] || null : null,
);
const isGeneratingExamples = computed(
  () => Boolean(selected.value) && generatingExamplesCode.value === selected.value?.i,
);
const isClassifying = computed(() => Boolean(classifyingQuery.value));
const knownRecommendation = computed(() => {
  recommendationIndexVersion.value;
  return findIndexedRecommendation(query.value);
});
const hasKnownRecommendation = computed(() => Boolean(knownRecommendation.value));
const classificationStatusText = computed(() => {
  if (isClassifying.value) {
    if (classificationPhase.value === "understanding") {
      return "Gemini Nano está identificando “" + classifyingQuery.value + "” en este dispositivo...";
    }
    if (classificationPhase.value === "matching") {
      return "Nano está comparando el producto únicamente con claves oficiales del catálogo SAT...";
    }
    return "Guardando la relación para próximas consultas...";
  }
  if (hasKnownRecommendation.value) {
    return "Esta relación ya existe en la base local. Se reutiliza al instante y Nano queda bloqueado para esta consulta.";
  }
  if (checkingStoredRecommendation.value) {
    return "Revisando el aprendizaje guardado antes de permitir una consulta con Nano...";
  }
  if (classificationResult.value?.source === "seed") {
    return "Esta relación ya forma parte del catálogo inicial compartido.";
  }
  if (classificationResult.value?.status === "confirmed") {
    return "Esta relación ya fue revisada y confirmada anteriormente.";
  }
  if (classificationResult.value) {
    return "Nano encontró una relación y la guardó en el catálogo interno.";
  }
  if (nanoAvailability.value === "checking") {
    return "Comprobando si Gemini Nano está disponible en este navegador...";
  }
  if (nanoAvailability.value === "unavailable") {
    return "Gemini Nano no está disponible aquí. La búsqueda oficial y el alta manual siguen funcionando.";
  }
  if (nanoAvailability.value === "downloadable" || nanoAvailability.value === "downloading") {
    const progress = Math.round(nanoDownloadProgress.value * 100);
    return progress > 0
      ? "Chrome está preparando Gemini Nano: " + progress + "%"
      : "Chrome descargará Gemini Nano al iniciar el análisis.";
  }
  return "Nano identifica el producto, propone claves oficiales y guarda el aprendizaje automáticamente.";
});

const nanoActionLabel = computed(() => {
  if (!isClassifying.value && hasKnownRecommendation.value) return "Relación local disponible";
  if (!isClassifying.value && checkingStoredRecommendation.value) return "Revisando base local...";
  if (isClassifying.value) {
    if (classificationPhase.value === "saving") return "Guardando aprendizaje...";
    return "Analizando con Nano...";
  }
  if (nanoAvailability.value === "downloadable" || nanoAvailability.value === "downloading") {
    return "Activar Nano y analizar";
  }
  return "Analizar con Nano y guardar";
});

const examplesStatusText = computed(() => {
  if (isGeneratingExamples.value) {
    return "Gemini Nano está creando ejemplos concretos para esta clave...";
  }
  if (currentExamplesResult.value) {
    return "Se muestran debajo y se reutilizan en futuras consultas.";
  }
  if (nanoAvailability.value === "unavailable") {
    return "Nano no está disponible en este navegador; puedes agregar ejemplos manualmente.";
  }
  return "Nano puede crear ejemplos concretos y guardarlos con esta clave.";
});

const examplesActionLabel = computed(() => {
  if (isGeneratingExamples.value) return "Creando con Nano...";
  if (currentExamplesResult.value) return "Regenerar ejemplos";
  return "Crear ejemplos con Nano";
});

const manualDialogTitle = computed(() => {
  if (manualAutoAnalyzing.value) {
    if (classificationPhase.value === "matching") return "Comparando claves oficiales";
    if (classificationPhase.value === "saving") return "Guardando la relación";
    return "Identificando el producto";
  }
  if (manualSaving.value) return "Guardando los cambios";
  if (manualState.value === "success") return "Relación guardada";
  if (manualState.value === "error") return "No se completó el análisis";
  return "Lista para analizar";
});

const manualPrimaryActionLabel = computed(() => {
  recommendationIndexVersion.value;
  if (manualAutoAnalyzing.value) return "Revisando relación...";
  if (manualState.value !== "success" && findIndexedRecommendation(manualProduct.value)) {
    return "Usar relación guardada";
  }
  if (manualSaving.value) return "Guardando...";
  if (manualState.value === "success") return "Guardar cambios";
  if (manualState.value === "error") return "Reintentar con Nano";
  return "Analizar y guardar";
});

const categoryUsage = computed(() => {
  if (!selected.value) {
    return { examples: [] as string[], children: [] as SatSearchRecord[], caption: "" };
  }

  const code = selected.value.i;
  const examples = [
    ...(currentExamplesResult.value?.examples || []),
    ...selected.value.s.split(/[,;]/).map((item) => item.trim()),
  ].filter(Boolean);
  const uniqueExamples = Array.from(
    new Map(examples.map((example) => [normalizeSatText(example), example])).values(),
  ).filter((example) => normalizeSatText(example) !== selected.value?.normalizedDescription);

  let prefix = "";
  if (code.endsWith("000000")) prefix = code.slice(0, 2);
  else if (code.endsWith("0000")) prefix = code.slice(0, 4);
  else if (code.endsWith("00")) prefix = code.slice(0, 6);

  const descendants = prefix
    ? catalog.value
        .filter(
          (record) =>
            record.i !== code &&
            record.i.startsWith(prefix) &&
            !record.i.endsWith("00"),
        )
        .sort((a, b) => a.d.localeCompare(b.d, "es"))
    : [];
  const limit = 12;

  return {
    examples: uniqueExamples.slice(0, limit),
    children: descendants.slice(0, limit),
    caption: descendants.length
      ? "MOSTRANDO " + Math.min(limit, descendants.length) + " DE " + descendants.length
      : "",
  };
});

async function loadCatalog(force = false) {
  loading.value = true;
  error.value = "";
  if (force) resetSatProductCatalog();
  try {
    catalog.value = await loadSatProductCatalog();
    if (query.value.trim().length >= 2) searchCatalog();
  } catch (catalogError) {
    error.value =
      catalogError instanceof Error
        ? catalogError.message
        : "Ocurrio un error inesperado.";
  } finally {
    loading.value = false;
  }
}

function canonicalAssociationToken(token: string) {
  if (token.length > 5 && token.endsWith("ces")) return token.slice(0, -3) + "z";
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function associationTokens(value: string) {
  return Array.from(
    new Set(
      normalizeSatText(value)
        .split(" ")
        .filter((token) => token.length >= 3 && !ignoredAssociationWords.has(token))
        .map(canonicalAssociationToken),
    ),
  );
}

function recommendationPriority(recommendation: IndexedRecommendation) {
  return (recommendation.status === "confirmed" ? 4 : 0) +
    (recommendation.source === "learned" ? 2 : 0);
}

function recommendationPhrases(recommendation: IndexedRecommendation) {
  return Array.from(
    new Set(
      [
        recommendation.query,
        ...recommendation.aliases,
        recommendation.summary,
        ...recommendation.suggestions.map((suggestion) => suggestion.description),
      ]
        .map(normalizeSatText)
        .filter((phrase) => phrase.length >= 2),
    ),
  );
}

function indexRecommendation(
  rawKey: string,
  value: PopularRecommendation,
): IndexedRecommendation | null {
  const queryText = String(value.query || rawKey).trim();
  const key = normalizeSatText(queryText);
  if (key.length < 2) return null;
  const suggestions = (value.suggestions || [])
    .map((suggestion) => ({
      code: String(suggestion.code || "").trim(),
      description: String(suggestion.description || "Clave SAT").trim(),
      reason: String(suggestion.reason || "Relación guardada en el catálogo local.").trim(),
    }))
    .filter((suggestion) => /^\d{8}$/.test(suggestion.code));
  if (!suggestions.length) return null;

  const aliases = Array.from(
    new Map(
      [queryText, ...(value.aliases || [])]
        .map((alias) => String(alias || "").trim())
        .filter((alias) => alias.length >= 2)
        .map((alias) => [normalizeSatText(alias), alias]),
    ).values(),
  );
  const incoming: IndexedRecommendation = {
    key,
    query: queryText,
    aliases,
    summary: String(value.summary || queryText).trim(),
    suggestions,
    note: String(value.note || "Relación recuperada del catálogo local.").trim(),
    status: value.status === "confirmed" ? "confirmed" : "generated",
    source: value.source === "learned" ? "learned" : "seed",
  };
  const previous = indexedRecommendations.get(key);
  const selectedRecommendation = previous && recommendationPriority(previous) > recommendationPriority(incoming)
    ? { ...previous, aliases: Array.from(new Set([...previous.aliases, ...incoming.aliases])) }
    : { ...incoming, aliases: Array.from(new Set([...(previous?.aliases || []), ...incoming.aliases])) };
  indexedRecommendations.set(key, selectedRecommendation);

  for (const phrase of recommendationPhrases(selectedRecommendation)) {
    const previousKey = recommendationByPhrase.get(phrase);
    const previousRecommendation = previousKey ? indexedRecommendations.get(previousKey) : null;
    if (!previousRecommendation || recommendationPriority(selectedRecommendation) >= recommendationPriority(previousRecommendation)) {
      recommendationByPhrase.set(phrase, key);
    }
    for (const token of associationTokens(phrase)) {
      const keys = recommendationKeysByToken.get(token) || new Set<string>();
      keys.add(key);
      recommendationKeysByToken.set(token, keys);
    }
  }
  recommendationIndexVersion.value += 1;
  return selectedRecommendation;
}

function indexPopularCatalog(payload: PopularCatalogPayload) {
  for (const [key, recommendation] of Object.entries(payload.recommendations || {})) {
    indexRecommendation(key, recommendation);
  }
  if (query.value.trim().length >= 2 && catalog.value.length) searchCatalog();
}

function findIndexedRecommendation(value: string): IndexedRecommendation | null {
  const normalizedQuery = normalizeSatText(value);
  if (normalizedQuery.length < 2) return null;
  const exactKey = recommendationByPhrase.get(normalizedQuery);
  if (exactKey) return indexedRecommendations.get(exactKey) || null;

  const queryTokens = associationTokens(normalizedQuery);
  if (!queryTokens.length) return null;
  const queryTokenSet = new Set(queryTokens);
  const candidateKeys = new Set<string>();
  for (const token of queryTokens) {
    for (const key of recommendationKeysByToken.get(token) || []) candidateKeys.add(key);
  }

  const ranked = Array.from(candidateKeys)
    .map((key) => {
      const recommendation = indexedRecommendations.get(key);
      if (!recommendation) return null;
      const phrases = recommendationPhrases(recommendation);
      const allTokens = new Set(phrases.flatMap(associationTokens));
      const matchedTokens = queryTokens.filter((token) => allTokens.has(token)).length;
      const containedPhraseSize = phrases.reduce((best, phrase) => {
        const phraseTokens = associationTokens(phrase);
        return phraseTokens.length && phraseTokens.every((token) => queryTokenSet.has(token))
          ? Math.max(best, phraseTokens.length)
          : best;
      }, 0);
      const coverage = matchedTokens / queryTokens.length;
      const accepted = containedPhraseSize > 0 || (matchedTokens >= 2 && coverage >= 0.75);
      if (!accepted) return null;
      return {
        recommendation,
        matchedTokens,
        score: containedPhraseSize * 120 + coverage * 100 + recommendationPriority(recommendation),
      };
    })
    .filter((entry): entry is { recommendation: IndexedRecommendation; matchedTokens: number; score: number } => Boolean(entry))
    .sort((first, second) => second.score - first.score);

  if (!ranked.length) return null;
  if (ranked[0].matchedTokens === 1 && ranked[1] && ranked[0].score === ranked[1].score) return null;
  return ranked[0].recommendation;
}

function requestStoredRecommendation(product: string) {
  const normalizedProduct = normalizeSatText(product);
  if (activeStoredLookup?.query === normalizedProduct) return activeStoredLookup.promise;
  const promise = satrs.find(product)
    .then((stored) => stored
      ? indexRecommendation(stored.key || stored.query, {
          query: stored.query,
          aliases: stored.aliases || [],
          summary: stored.summary,
          suggestions: stored.suggestions,
          note: stored.note,
          status: stored.status,
          source: stored.source,
        })
      : null)
    .finally(() => {
      if (activeStoredLookup?.promise === promise) activeStoredLookup = null;
    });
  activeStoredLookup = { query: normalizedProduct, promise };
  return promise;
}

async function preflightStoredRecommendation(product: string) {
  const lookupSequence = ++storedLookupSequence;
  checkingStoredRecommendation.value = true;
  try {
    const indexed = await requestStoredRecommendation(product);
    if (lookupSequence !== storedLookupSequence || normalizeSatText(query.value) !== normalizeSatText(product)) {
      return indexed;
    }
    if (indexed) applyIndexedRecommendation(product, indexed, "server");
    return indexed;
  } catch {
    return null;
  } finally {
    if (lookupSequence === storedLookupSequence) checkingStoredRecommendation.value = false;
  }
}

function applyIndexedRecommendation(
  product: string,
  recommendation: IndexedRecommendation,
  origin: ClassificationOrigin,
) {
  const validSuggestions = recommendation.suggestions
    .filter((suggestion) => recordByCode.value.has(suggestion.code))
    .map(({ code, reason }) => ({ code, reason }));
  if (!validSuggestions.length) return false;

  classificationResult.value = {
    suggestions: validSuggestions,
    note: recommendation.note,
    source: recommendation.source,
    status: recommendation.status,
  };
  lastClassificationOrigin.value = origin;
  lastAnalysisContext.value = {
    summary: recommendation.summary || product,
    searchTerms: Array.from(new Set([recommendation.query, ...recommendation.aliases])).slice(0, 8),
  };
  const associatedRecords = validSuggestions
    .map((suggestion) => recordByCode.value.get(suggestion.code))
    .filter((record): record is SatSearchRecord => Boolean(record));
  searchResults.value = [
    ...associatedRecords,
    ...searchResults.value.filter((record) => !associatedRecords.some((associated) => associated.i === record.i)),
  ];
  selected.value = associatedRecords[0] || selected.value;
  recommendationAvailability.value = "available";
  return true;
}

function scoreRecord(
  record: SatSearchRecord,
  normalizedQuery: string,
  tokens: string[],
) {
  const codeQuery = normalizedQuery.replace(/\s/g, "");
  if (record.i === codeQuery) return 1000;
  let score =
    record.i.startsWith(codeQuery) && /^\d+$/.test(codeQuery) ? 700 : 0;

  if (record.normalizedDescription === normalizedQuery) score += 600;
  if (record.normalizedDescription.startsWith(normalizedQuery)) score += 420;
  if (record.normalizedSimilar === normalizedQuery) score += 380;

  const searchable =
    record.normalizedDescription + " " + record.normalizedSimilar;
  if (!tokens.every((token) => searchable.includes(token))) {
    return score || -1;
  }

  score += 160;
  const descriptionWords = record.normalizedDescription.split(" ");
  const similarWords = record.normalizedSimilar.split(" ");
  for (const token of tokens) {
    if (descriptionWords.some((word) => word === token)) score += 45;
    else if (record.normalizedDescription.includes(token)) score += 24;
    if (similarWords.some((word) => word === token)) score += 18;
  }
  if (!record.i.endsWith("00")) score += 8;
  return score;
}

function searchCatalog() {
  const product = query.value.trim();
  const normalizedQuery = normalizeSatText(product);
  if (normalizedQuery.length < 2) {
    searchResults.value = [];
    selected.value = null;
    return;
  }

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  searchResults.value = catalog.value
    .map((record) => ({
      record,
      score: scoreRecord(record, normalizedQuery, tokens),
    }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.record.d.localeCompare(b.record.d, "es"),
    )
    .slice(0, 200)
    .map((entry) => entry.record);

  const associated = findIndexedRecommendation(product);
  if (associated) applyIndexedRecommendation(product, associated, "local");
  else selected.value = searchResults.value[0] || null;
  visibleCount.value = pageSize;
}

function directProductContext(product: string): ProductContext | null {
  const normalizedProduct = normalizeSatText(product);
  const ignoredWords = new Set(["con", "del", "las", "los", "para", "por", "una", "uno", "unos", "unas"]);
  const tokens = normalizedProduct
    .split(" ")
    .filter((token) => token.length > 2 && !ignoredWords.has(token));
  const hasDirectMatch = searchResults.value.slice(0, 12).some((record) => {
    const searchable = `${record.normalizedDescription} ${record.normalizedSimilar}`;
    return searchable.includes(normalizedProduct) || (tokens.length > 0 && tokens.every((token) => searchable.includes(token)));
  });
  if (!hasDirectMatch) return null;
  return {
    summary: product,
    searchTerms: Array.from(new Set([product, ...tokens])).slice(0, 5),
  };
}

function recommendationCandidates(
  product: string,
  context: ProductContext,
  includeLiteralResults = false,
) {
  const ignoredWords = new Set(["con", "del", "las", "los", "para", "por", "una", "uno", "unos", "unas"]);
  const semanticPhrases = Array.from(
    new Set(
      [context.summary, ...context.searchTerms]
        .map(normalizeSatText)
        .filter((term) => term.length > 1),
    ),
  );
  const semanticTokens = Array.from(
    new Set(
      semanticPhrases
        .flatMap((phrase) => phrase.split(" "))
        .filter((token) => token.length > 3 && !ignoredWords.has(token) && !["alimento", "procesado", "consumo", "humano", "producto", "comestible", "marca", "sabor"].includes(token)),
    ),
  );
  const contextText = normalizeSatText(`${product} ${context.summary} ${context.searchTerms.join(" ")}`);
  const snackBrand = /\b(sabritas|doritos|cheetos|tostitos|takis|ruffles|fritos|rancheritos|churrumais)\b/;
  const isSnack = /botana|snack|aperitivo|fritura/.test(contextText) || snackBrand.test(contextText);
  const isHumanFood = isSnack || /consumo humano|alimento procesado|comestible|dulce|bebida/.test(contextText);
  const nonHumanFood = /maquina|equipo|escurridor|exhibidor|almacenador|expendedor|animal|mascota|ave|perro|gato|forraje|semilla|plantula|cultivo/.source;
  const excludedFoodRecord = new RegExp(nonHumanFood);

  const ranked = catalog.value
    .map((record) => {
      const searchable = `${record.normalizedDescription} ${record.normalizedSimilar}`;
      if (isHumanFood && excludedFoodRecord.test(searchable)) {
        return { record, score: -1 };
      }

      let score = 0;
      const descriptionWords = record.normalizedDescription.split(" ");
      for (const phrase of semanticPhrases) {
        if (record.normalizedDescription.includes(phrase)) score += 180;
        if (record.normalizedSimilar.includes(phrase)) score += 140;
      }
      if (isSnack && /botana|snack|aperitivo/.test(searchable)) score += 250;
      if (isSnack && /^botanas?$/.test(record.normalizedDescription.trim())) score += 500;
      for (const token of semanticTokens) {
        const root = token.slice(0, Math.min(6, token.length));
        if (descriptionWords.some((word) => word.startsWith(root))) score += 90;
        else if (record.normalizedDescription.includes(root)) score += 34;
        if (record.normalizedSimilar.includes(root)) score += 20;
      }
      if (!record.i.endsWith("00")) score += 5;
      return { record, score };
    })
    .filter((entry) => entry.score > 50)
    .sort((first, second) => second.score - first.score)
    .map((entry) => entry.record);

  const literalResults = includeLiteralResults ? searchResults.value.slice(0, 2) : [];
  return Array.from(
    new Map(
      [...ranked.slice(0, 6), ...literalResults]
        .map((record) => [record.i, record]),
    ).values(),
  ).slice(0, 8);
}
function trackNanoDownload(progress: number) {
  nanoDownloadProgress.value = Math.max(0, Math.min(1, progress));
  if (progress < 1) nanoAvailability.value = "downloading";
  else nanoAvailability.value = "available";
}

function queueNanoExamples(record: SatSearchRecord) {
  const queued = examplesGenerationQueue.then(() => generateAndStoreNanoExamples(record));
  examplesGenerationQueue = queued.catch(() => undefined);
  return queued;
}

async function generateAndStoreNanoExamples(record: SatSearchRecord) {
  if (examplesCache.value[record.i]) return;
  try {
    const stored = await satrs.getExamples(record.i);
    if (stored) {
      persistExamplesResult(record.i, record.d, stored);
      return;
    }
  } catch {
    // Si aún no existen ejemplos, Nano puede generarlos y volver a intentar el guardado.
  }

  if (generatingExamplesCode.value) return;
  generatingExamplesCode.value = record.i;
  try {
    const generated = await generateSatUsageExamples(
      {
        code: record.i,
        description: record.d,
        similarWords: record.s,
        officialChildren: officialChildrenFor(record),
      },
      trackNanoDownload,
    );
    nanoAvailability.value = "available";
    const saved = await satrs.saveExamples({
      code: record.i,
      description: record.d,
      examples: generated.examples,
      note: generated.note,
    });
    persistExamplesResult(record.i, record.d, saved);
    recommendationAvailability.value = "available";
  } finally {
    generatingExamplesCode.value = "";
  }
}

async function classifyCurrentProduct() {
  const product = query.value.trim();
  if (product.length < 2 || isClassifying.value) return;

  classifyingQuery.value = product;
  lastAnalysisContext.value = null;
  lastClassificationOrigin.value = "none";
  classificationPhase.value = "understanding";
  classificationError.value = "";
  examplesError.value = "";
  classificationResult.value = null;

  try {
    try {
      await getPopularCatalog();
    } catch {
      // El servidor y el catálogo oficial siguen disponibles sin el JSON auxiliar.
    }

    const localRecommendation = findIndexedRecommendation(product);
    if (localRecommendation && applyIndexedRecommendation(product, localRecommendation, "local")) return;

    try {
      const stored = await requestStoredRecommendation(product);
      if (stored && applyIndexedRecommendation(product, stored, "server")) return;
    } catch {
      recommendationAvailability.value = "unavailable";
    }

    const availability = await getGeminiNanoAvailability();
    nanoAvailability.value = availability;
    if (availability === "unavailable") {
      throw new Error(
        "Gemini Nano no está disponible. Usa Chrome de escritorio compatible o crea la relación manualmente.",
      );
    }

    searchCatalog();
    const literalContext = directProductContext(product);
    let context: ProductContext;
    if (literalContext) {
      context = literalContext;
    } else {
      const nanoContext = await understandSatProduct(product, trackNanoDownload);
      nanoAvailability.value = "available";
      context = {
        summary: nanoContext.summary,
        searchTerms: nanoContext.searchTerms.slice(0, 4),
      };
    }
    lastAnalysisContext.value = context;
    classificationPhase.value = "matching";
    const candidates = recommendationCandidates(product, context, true);
    if (!candidates.length) {
      throw new Error("Nano identificó el producto, pero no encontró una clave oficial candidata suficientemente cercana.");
    }
    lastClassificationOrigin.value = "nano";
    const nanoResult = await classifySatProduct(
      {
        product,
        candidates: candidates.map((candidate) => ({
          code: candidate.i,
          description: candidate.d,
          similarWords: candidate.s,
        })),
      },
      trackNanoDownload,
    );
    nanoAvailability.value = "available";
    classificationResult.value = { ...nanoResult, source: "nano" };
    if (!nanoResult.suggestions.length) return;

    classificationPhase.value = "saving";
    const saved = await satrs.saveManual({
      query: product,
      summary: context.summary,
      aliases: context.searchTerms,
      suggestions: nanoResult.suggestions.map((suggestion) => ({
        ...suggestion,
        description: recordByCode.value.get(suggestion.code)?.d || "Clave SAT",
      })),
      note: nanoResult.note,
    });
    const indexed = indexRecommendation(saved.key || product, {
      query: saved.query || product,
      aliases: saved.aliases || context.searchTerms,
      summary: saved.summary || context.summary,
      suggestions: saved.suggestions,
      note: saved.note,
      status: saved.status,
      source: saved.source,
    });
    if (indexed) applyIndexedRecommendation(product, indexed, "nano");

    const primaryRecord = recordByCode.value.get(saved.suggestions[0]?.code || "");
    if (primaryRecord) {
      if (!searchResults.value.some((candidate) => candidate.i === primaryRecord.i)) {
        searchResults.value = [primaryRecord, ...searchResults.value];
      }
      selected.value = primaryRecord;
      void queueNanoExamples(primaryRecord).catch((exampleFailure) => {
        examplesError.value = exampleFailure instanceof Error
          ? "La relación se guardó, pero los ejemplos no: " + exampleFailure.message
          : "La relación se guardó, pero Nano no pudo crear los ejemplos.";
      });
    }
  } catch (classificationFailure) {
    classificationError.value = classificationFailure instanceof Error
      ? classificationFailure.message
      : "Gemini Nano no pudo clasificar este producto.";
  } finally {
    classifyingQuery.value = "";
    classificationPhase.value = "idle";
  }
}
function openRecommendationSuggestion(code: string) {
  const searchedProduct = query.value.trim();
  const record = recordByCode.value.get(code);
  if (!record) return;
  if (!searchResults.value.some((candidate) => candidate.i === code)) {
    searchResults.value = [record, ...searchResults.value];
  }
  selectRecord(record);
  if (searchedProduct) {
    void satrs
      .confirm(searchedProduct, code)
      .then((confirmed) => {
        if (classificationResult.value) classificationResult.value.status = confirmed.status;
      })
      .catch(() => undefined);
  }
}
function runSearchNow() {
  if (searchTimer) clearTimeout(searchTimer);
  searchCatalog();
}

function clearSearch() {
  query.value = "";
  searchResults.value = [];
  selected.value = null;
  searchInput.value?.focus();
}

function useSuggestion(value: string) {
  query.value = value;
  nextTick(runSearchNow);
}

function selectRecord(record: SatSearchRecord) {
  selected.value = record;
  if (window.matchMedia("(max-width: 960px)").matches) {
    nextTick(() =>
      document
        .querySelector(".detail-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
}

function openFavorite(record: SatSearchRecord) {
  query.value = record.i;
  searchCatalog();
  selected.value = record;
  nextTick(() =>
    document
      .querySelector(".search-console")
      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
  );
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = code;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copiedCode.value = ""), 1800);
  } catch {
    copiedCode.value = "";
  }
}

function readExamplesCache(): Record<string, CachedExamplesResult> {
  try {
    const parsed = JSON.parse(localStorage.getItem(examplesCacheKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistExamplesResult(code: string, description: string, result: SatExamplesResult) {
  const nextCache = {
    ...examplesCache.value,
    [code]: { ...result, description, generatedAt: Date.now() },
  };
  const recentEntries = Object.entries(nextCache)
    .sort(([, first], [, second]) => second.generatedAt - first.generatedAt)
    .slice(0, examplesCacheLimit);
  examplesCache.value = Object.fromEntries(recentEntries);
  localStorage.setItem(examplesCacheKey, JSON.stringify(examplesCache.value));
}

async function checkInternalRecommendations() {
  recommendationAvailability.value = "available";
}

async function checkNanoSupport() {
  nanoAvailability.value = "checking";
  nanoAvailability.value = await getGeminiNanoAvailability();
}

async function loadStoredExamples(record: SatSearchRecord | null) {
  if (!record) return;
  try {
    const result = await satrs.getExamples(record.i);
    if (result) {
      persistExamplesResult(record.i, record.d, {
        examples: result.examples,
        note: result.note,
      });
    }
    recommendationAvailability.value = "available";
  } catch {
    recommendationAvailability.value = "unavailable";
  }
}

function officialChildrenFor(record: SatSearchRecord) {
  if (!record.i.endsWith("00")) return [];
  let prefix = "";
  if (record.i.endsWith("000000")) prefix = record.i.slice(0, 2);
  else if (record.i.endsWith("0000")) prefix = record.i.slice(0, 4);
  else prefix = record.i.slice(0, 6);

  return catalog.value
    .filter(
      (candidate) =>
        candidate.i !== record.i &&
        candidate.i.startsWith(prefix) &&
        !candidate.i.endsWith("00"),
    )
    .slice(0, 24)
    .map((candidate) => ({ code: candidate.i, description: candidate.d }));
}

async function generateInternalExamples() {
  const record = selected.value;
  if (!record || generatingExamplesCode.value) return;
  examplesError.value = "";
  try {
    const availability = await getGeminiNanoAvailability();
    nanoAvailability.value = availability;
    if (availability === "unavailable") {
      throw new Error("Gemini Nano no está disponible en este navegador.");
    }
    await queueNanoExamples(record);
  } catch (generationError) {
    examplesError.value = generationError instanceof Error
      ? generationError.message
      : "Nano no pudo generar los ejemplos.";
  }
}
function manualCodeLabel(record: SatSearchRecord) {
  return `${record.i} · ${record.d}`;
}

function syncManualCodeFromSearch() {
  const typedValue = manualCodeSearch.value.trim();
  const typedCode = typedValue.match(/^\d{8}/)?.[0] || "";
  const exactRecord = recordByCode.value.get(typedCode);
  if (exactRecord) {
    manualCode.value = exactRecord.i;
    return;
  }
  if (manualRecord.value && typedValue === manualCodeLabel(manualRecord.value)) return;
  manualCode.value = "";
}

function chooseManualCode(record: SatSearchRecord) {
  manualCode.value = record.i;
  manualCodeSearch.value = manualCodeLabel(record);
}

function openManualForm(record: SatSearchRecord | null = selected.value) {
  manualFormOpen.value = true;
  const currentQuery = query.value.trim();
  manualProduct.value = /^\d{8}$/.test(currentQuery) ? "" : currentQuery;
  manualCode.value = record?.i || "";
  manualCodeSearch.value = record ? manualCodeLabel(record) : "";
  manualAliases.value = "";
  manualExamples.value = "";
  manualReason.value = "";
  manualMessage.value = "";
  manualState.value = "idle";
  document.body.classList.add("modal-open");
  nextTick(() => {
    if (manualProduct.value.length >= 2) void autoCompleteAndSaveManualProduct();
    else manualProductInput.value?.focus();
  });
}

function useSelectedForManual(record: SatSearchRecord) {
  openManualForm(record);
}

function closeManualForm() {
  if (manualAutoAnalyzing.value || manualSaving.value) return;
  manualFormOpen.value = false;
  manualMessage.value = "";
  manualState.value = "idle";
  document.body.classList.remove("modal-open");
}

function markManualProductChanged() {
  if (manualState.value !== "success") return;
  manualState.value = "idle";
  manualMessage.value = "El producto cambió. Ejecuta Nano para crear una nueva relación.";
  manualCode.value = "";
  manualCodeSearch.value = "";
  manualAliases.value = "";
  manualExamples.value = "";
  manualReason.value = "";
}

async function autoCompleteAndSaveManualProduct() {
  const product = manualProduct.value.trim();
  if (product.length < 2 || manualAutoAnalyzing.value || manualSaving.value) return;
  if (loading.value) {
    manualMessage.value = "Espera a que termine de cargar el catálogo SAT.";
    manualState.value = "error";
    return;
  }

  manualAutoAnalyzing.value = true;
  manualState.value = "idle";
  manualMessage.value = findIndexedRecommendation(product)
    ? "La relación ya existe; se reutilizará sin ejecutar Nano."
    : "Revisando primero el aprendizaje local antes de activar Nano.";
  classificationError.value = "";
  try {
    query.value = product;
    await nextTick();
    runSearchNow();
    await classifyCurrentProduct();
    if (classificationError.value) throw new Error(classificationError.value);

    const suggestion = classificationResult.value?.suggestions[0];
    const record = suggestion ? recordByCode.value.get(suggestion.code) : null;
    if (!suggestion || !record) {
      throw new Error("Nano no encontró una coincidencia suficientemente segura para guardarla.");
    }

    manualCode.value = record.i;
    manualCodeSearch.value = manualCodeLabel(record);
    manualReason.value = suggestion.reason;
    const contextTerms = lastAnalysisContext.value?.searchTerms || [];
    const catalogTerms = record.s.split(/[,;]/).map((term) => term.trim()).filter(Boolean);
    manualAliases.value = splitManualList([...contextTerms, ...catalogTerms.slice(0, 4)].join(", "), 10)
      .filter((term) => normalizeSatText(term) !== normalizeSatText(product))
      .join(", ");

    const confirmed = await satrs.confirm(product, record.i);
    if (classificationResult.value) classificationResult.value.status = confirmed.status;
    selected.value = record;
    const cachedExamples = examplesCache.value[record.i];
    if (cachedExamples) manualExamples.value = cachedExamples.examples.join("\n");

    const reusedExistingRelation = lastClassificationOrigin.value === "local" || lastClassificationOrigin.value === "server";
    manualState.value = "success";
    manualMessage.value = reusedExistingRelation
      ? "Relación existente " + record.i + " reutilizada y confirmada sin ejecutar Nano."
      : cachedExamples
        ? "Relación " + record.i + " y " + cachedExamples.examples.length + " ejemplos guardados automáticamente."
        : "Relación " + record.i + " guardada. Nano está agregando los ejemplos en segundo plano.";
    if (!cachedExamples && !reusedExistingRelation) {
      void queueNanoExamples(record).catch((generationError) => {
        if (!manualFormOpen.value || manualCode.value !== record.i) return;
        manualMessage.value = generationError instanceof Error
          ? "La relación quedó guardada; los ejemplos no: " + generationError.message
          : "La relación quedó guardada, pero los ejemplos no pudieron generarse.";
      });
    }
  } catch (analysisError) {
    manualMessage.value = analysisError instanceof Error
      ? analysisError.message
      : "Nano no pudo completar la relación.";
    manualState.value = "error";
  } finally {
    manualAutoAnalyzing.value = false;
  }
}

function splitManualList(value: string, limit: number) {
  return Array.from(
    new Map(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .map((item) => [normalizeSatText(item), item]),
    ).values(),
  ).slice(0, limit);
}

async function saveManualProduct() {
  const product = manualProduct.value.trim();
  const code = manualCode.value.trim();
  const record = recordByCode.value.get(code);
  manualMessage.value = "";
  manualState.value = "idle";
  if (product.length < 2) {
    manualMessage.value = "Escribe el nombre del producto o servicio.";
    manualState.value = "error";
    return;
  }
  if (!record) {
    manualMessage.value = "La clave debe existir en el catálogo SAT cargado.";
    manualState.value = "error";
    return;
  }

  manualSaving.value = true;
  try {
    const aliases = splitManualList(manualAliases.value, 24);
    const examples = splitManualList(manualExamples.value, 16);
    const reason = manualReason.value.trim() || "Asignación manual a " + record.d + ".";
    const saved = await satrs.saveManual({
      query: product,
      summary: product,
      aliases,
      suggestions: [{ code, description: record.d, reason }],
      note: "Recomendación agregada manualmente; confirma que describa la operación real.",
    });
    const confirmed = await satrs.confirm(product, code);
    if (examples.length) {
      const storedExamples = await satrs.saveExamples({
        code,
        description: record.d,
        examples,
        note: "Ejemplos agregados manualmente al catálogo interno.",
      });
      persistExamplesResult(code, record.d, storedExamples);
    }
    const indexed = indexRecommendation(saved.key || product, {
      query: saved.query || product,
      aliases: saved.aliases || aliases,
      summary: saved.summary || product,
      suggestions: confirmed.suggestions,
      note: saved.note,
      status: confirmed.status,
      source: saved.source,
    });
    if (indexed) applyIndexedRecommendation(product, indexed, "server");
    if (!searchResults.value.some((candidate) => candidate.i === code)) {
      searchResults.value = [record, ...searchResults.value];
    }
    selected.value = record;
    query.value = product;
    manualCodeSearch.value = manualCodeLabel(record);
    manualMessage.value = "El producto quedó relacionado con la clave " + code + ".";
    manualState.value = "success";
  } catch {
    manualMessage.value = "No se pudo guardar el producto manualmente.";
    manualState.value = "error";
  } finally {
    manualSaving.value = false;
  }
}

async function getPopularCatalog(): Promise<PopularCatalogPayload> {
  if (!popularCatalogPromise) {
    popularCatalogPromise = fetch(popularCatalogUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar la base de consultas populares.");
        return response.json() as Promise<PopularCatalogPayload>;
      })
      .then((payload) => {
        indexPopularCatalog(payload);
        return payload;
      })
      .catch((error) => {
        popularCatalogPromise = null;
        throw error;
      });
  }
  return popularCatalogPromise;
}

async function loadPopularSuggestions() {
  try {
    const payload = await getPopularCatalog();
    const queries = Object.values(payload.recommendations || {})
      .map((recommendation) => recommendation.query?.trim() || "")
      .filter(Boolean)
      .slice(0, 7);
    if (queries.length) suggestions.value = queries;
    if (query.value.trim().length >= 2 && catalog.value.length) searchCatalog();
  } catch {
    // La búsqueda oficial sigue funcionando aunque la base auxiliar no esté disponible.
  }
}

async function importPopularCatalog() {
  if (transferAction.value) return;
  transferAction.value = "popular";
  transferMessage.value = "";
  transferState.value = "idle";
  try {
    const payload = await getPopularCatalog();
    const result = await satrs.importRecommendations(payload);
    transferMessage.value =
      "Base lista: " + result.importedRecommendations + " consultas y " +
      result.importedCodeExamples + " grupos de ejemplos.";
    transferState.value = "success";
  } catch (popularError) {
    transferMessage.value =
      popularError instanceof Error ? popularError.message : "No se pudo cargar la base popular.";
    transferState.value = "error";
  } finally {
    transferAction.value = "";
  }
}

function openImportPicker() {
  transferMessage.value = "";
  transferState.value = "idle";
  transferInput.value?.click();
}

async function exportRecommendationJson() {
  if (transferAction.value) return;
  transferAction.value = "export";
  transferMessage.value = "";
  transferState.value = "idle";
  try {
    const blob = await satrs.exportRecommendations();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "despachoapp-recomendaciones-sat-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    transferMessage.value = "Catálogo exportado correctamente.";
    transferState.value = "success";
  } catch {
    transferMessage.value = "No se pudo exportar el catálogo interno.";
    transferState.value = "error";
  } finally {
    transferAction.value = "";
  }
}

async function importRecommendationJson(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || transferAction.value) return;
  transferAction.value = "import";
  transferMessage.value = "";
  transferState.value = "idle";
  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("El archivo supera el límite de 5 MB.");
    }
    const payload = JSON.parse(await file.text()) as {
      recommendations?: Record<string, { suggestions?: Array<{ code?: string }> }>;
      codeExamples?: Record<string, unknown>;
    };
    const importedCodes = Array.from(
      new Set([
        ...Object.values(payload.recommendations || {}).flatMap((recommendation) =>
          (recommendation.suggestions || []).map((suggestion) => String(suggestion.code || "")),
        ),
        ...Object.keys(payload.codeExamples || {}),
      ]),
    ).filter(Boolean);
    const invalidCodes = importedCodes.filter((code) => !recordByCode.value.has(code));
    if (invalidCodes.length) {
      throw new Error(
        "El JSON contiene claves que no existen en el catálogo SAT: " +
          invalidCodes.slice(0, 5).join(", "),
      );
    }
    const result = await satrs.importRecommendations(payload);
    classificationResult.value = null;
    examplesCache.value = {};
    localStorage.removeItem(examplesCacheKey);
    await loadStoredExamples(selected.value);
    transferMessage.value =
      "Importadas " + result.importedRecommendations + " recomendaciones y " + result.importedCodeExamples + " grupos de ejemplos.";
    transferState.value = "success";
  } catch (importError) {
    transferMessage.value =
      importError instanceof SyntaxError
        ? "El archivo seleccionado no contiene JSON válido."
        : importError instanceof Error
          ? importError.message
          : "No se pudo importar el catálogo interno.";
    transferState.value = "error";
  } finally {
    transferAction.value = "";
    input.value = "";
  }
}

function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem("sat-product-favorites") || "[]");
  } catch {
    return [];
  }
}

function toggleFavorite(code: string) {
  favorites.value = isFavorite(code)
    ? favorites.value.filter((item) => item !== code)
    : [code, ...favorites.value].slice(0, 12);
  localStorage.setItem(
    "sat-product-favorites",
    JSON.stringify(favorites.value),
  );
}

function isFavorite(code: string) {
  return favorites.value.includes(code);
}

function clearFavorites() {
  favorites.value = [];
  localStorage.removeItem("sat-product-favorites");
}

function shorten(value: string, max: number) {
  return value.length > max ? value.slice(0, max).trim() + "..." : value;
}

function formatCode(code: string) {
  return code;
}

function levelLabel(code: string) {
  if (code.endsWith("000000")) return "Segmento";
  if (code.endsWith("0000")) return "Familia";
  if (code.endsWith("00")) return "Clase";
  return "Clave específica";
}


watch(query, () => {
  classificationResult.value = null;
  classificationError.value = "";
  storedLookupSequence += 1;
  checkingStoredRecommendation.value = false;
  if (searchTimer) clearTimeout(searchTimer);
  const product = query.value.trim();
  if (product.length < 2) {
    searchCatalog();
    return;
  }
  const local = findIndexedRecommendation(product);
  checkingStoredRecommendation.value = !local;
  searchTimer = setTimeout(() => {
    searchCatalog();
    if (!findIndexedRecommendation(product)) void preflightStoredRecommendation(product);
    else checkingStoredRecommendation.value = false;
  }, 220);
});

watch(selected, () => {
  examplesError.value = "";
  void loadStoredExamples(selected.value);
});

watch(
  () => (manualRecord.value ? examplesCache.value[manualRecord.value.i] || null : null),
  (result) => {
    if (!manualFormOpen.value || !result) return;
    manualExamples.value = result.examples.join("\n");
    if (manualState.value === "success" && manualRecord.value) {
      manualMessage.value =
        "Relación " + manualRecord.value.i + " y " + result.examples.length +
        " ejemplos guardados automáticamente.";
    }
  },
);

onMounted(() => {
  loadCatalog();
  checkInternalRecommendations();
  void checkNanoSupport();
  void loadPopularSuggestions();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (copyTimer) clearTimeout(copyTimer);
  document.body.classList.remove("modal-open");
});
