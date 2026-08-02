import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  loadSatProductCatalog,
  normalizeSatText,
  resetSatProductCatalog,
  type SatSearchRecord,
} from "@/service/adminApp/catalogosSatService";
import {
  generateSatUsageExamples,
  getGeminiNanoAvailability,
  type GeminiNanoAvailability,
  understandSatProduct,
  type GeminiNanoClassificationResult,
  type GeminiNanoProductContext,
  type GeminiNanoResult,
} from "@/service/adminApp/geminiNanoService";


const suggestions = ["software", "café", "papelería", "limpieza", "construcción"];
const pageSize = 20;
const nanoCacheKey = "sat-gemini-nano-examples-v1";
const nanoCacheLimit = 250;
const classificationCacheKey = "sat-gemini-classifications-v3";

interface CachedNanoResult extends GeminiNanoResult {
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
const nanoAvailability = ref<GeminiNanoAvailability>("checking");
const nanoProgress = ref(0);
const nanoError = ref("");
const generatingCode = ref("");
const nanoCache = ref<Record<string, CachedNanoResult>>(readNanoCache());
const nanoClassification = ref<GeminiNanoClassificationResult | null>(null);
const classificationError = ref("");
const classifyingQuery = ref("");
const classificationPhase = ref<"idle" | "understanding" | "matching">("idle");
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const recordByCode = computed(() => new Map(catalog.value.map((record) => [record.i, record])));
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

const currentNanoResult = computed(() =>
  selected.value ? nanoCache.value[selected.value.i] || null : null,
);
const isGeneratingNano = computed(
  () => Boolean(selected.value) && generatingCode.value === selected.value?.i,
);
const isClassifying = computed(() => Boolean(classifyingQuery.value));
const classificationStatusText = computed(() => {
  if (isClassifying.value) {
    if (classificationPhase.value === "understanding") return `Identificando qué es “${classifyingQuery.value}”...`;
    if (classificationPhase.value === "matching") return "Producto identificado. Comparando con las claves oficiales...";
    return nanoAvailability.value === "downloading"
      ? `Descargando el modelo local... ${Math.round(nanoProgress.value * 100)}%`
      : `Buscando las claves más adecuadas para “${classifyingQuery.value}”...`;
  }
  if (nanoClassification.value) return "Solo se muestran coincidencias directas con confianza alta.";
  if (nanoAvailability.value === "checking") return "Comprobando disponibilidad del modelo local...";
  if (nanoAvailability.value === "unavailable") return "Gemini Nano no está disponible en este navegador o dispositivo.";
  if (nanoAvailability.value === "downloadable") return "El modelo se descargará una sola vez antes de analizar el producto.";
  return "Gemini comparará tu producto con claves oficiales del catálogo.";
});
const nanoStatusText = computed(() => {
  if (isGeneratingNano.value) {
    return nanoAvailability.value === "downloading"
      ? `Descargando el modelo local... ${Math.round(nanoProgress.value * 100)}%`
      : "Gemini Nano está preparando ejemplos para esta clave...";
  }
  if (currentNanoResult.value) {
    return "Gemini Nano ya generó ejemplos para esta clave. Puedes regenerarlos cuando lo necesites.";
  }
  if (nanoAvailability.value === "checking") return "Comprobando si Gemini Nano está disponible...";
  if (nanoAvailability.value === "downloadable") return "El modelo se descargará una sola vez para generar ejemplos en este dispositivo.";
  if (nanoAvailability.value === "downloading") return "Descargando Gemini Nano en este dispositivo...";
  if (nanoAvailability.value === "available") return "Listo para generar ejemplos orientativos para cualquier clave del catálogo.";
  return "Gemini Nano no está disponible en este navegador o dispositivo.";
});
const nanoActionLabel = computed(() => {
  if (isGeneratingNano.value) {
    return nanoAvailability.value === "downloading" ? "Descargando..." : "Generando...";
  }
  if (currentNanoResult.value) return "Regenerar ejemplos";
  if (["downloadable", "downloading"].includes(nanoAvailability.value)) {
    return "Descargar modelo y generar";
  }
  if (nanoAvailability.value === "unavailable") return "Gemini Nano no disponible";
  return "Generar ejemplos";
});

const categoryUsage = computed(() => {
  if (!selected.value) {
    return { examples: [] as string[], children: [] as SatSearchRecord[], caption: "" };
  }

  const code = selected.value.i;
  const examples = [
    ...(currentNanoResult.value?.examples || []),
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
  const normalizedQuery = normalizeSatText(query.value);
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

  visibleCount.value = pageSize;
  selected.value = searchResults.value[0] || null;
}

function directProductContext(product: string): GeminiNanoProductContext | null {
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

function readCachedClassification(product: string): GeminiNanoClassificationResult | null {
  try {
    const cache = JSON.parse(localStorage.getItem(classificationCacheKey) || "{}") as Record<
      string,
      { result: GeminiNanoClassificationResult; storedAt: number }
    >;
    const entry = cache[normalizeSatText(product)];
    return entry && Date.now() - entry.storedAt < 7 * 24 * 60 * 60 * 1000
      ? entry.result
      : null;
  } catch {
    return null;
  }
}

function persistClassification(product: string, result: GeminiNanoClassificationResult) {
  try {
    const cache = JSON.parse(localStorage.getItem(classificationCacheKey) || "{}") as Record<
      string,
      { result: GeminiNanoClassificationResult; storedAt: number }
    >;
    cache[normalizeSatText(product)] = { result, storedAt: Date.now() };
    const recent = Object.entries(cache)
      .sort(([, first], [, second]) => second.storedAt - first.storedAt)
      .slice(0, 40);
    localStorage.setItem(classificationCacheKey, JSON.stringify(Object.fromEntries(recent)));
  } catch {
    // El caché es una optimización; la consulta puede continuar sin él.
  }
}

function nanoCandidateRecords(
  product: string,
  context: GeminiNanoProductContext,
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
  ).slice(0, 6);
}
function buildLocalClassification(
  context: GeminiNanoProductContext,
  candidates: SatSearchRecord[],
): GeminiNanoClassificationResult {
  const ignoredTerms = new Set(["producto", "servicio", "articulo", "equipo", "portatil", "hibrido", "general"]);
  const usefulTerms = context.searchTerms
    .map((term) => ({ label: term, normalized: normalizeSatText(term) }))
    .filter((term) => !ignoredTerms.has(term.normalized));
  const selectedCandidates = candidates[0]?.i.endsWith("00")
    ? candidates.slice(0, 1)
    : candidates.slice(0, 2);
  const suggestions = selectedCandidates.map((record) => {
    const searchable = `${record.normalizedDescription} ${record.normalizedSimilar}`;
    const matches = usefulTerms
      .filter((term) => {
        const words = term.normalized.split(" ").filter((word) => word.length > 3);
        return words.some((word) => searchable.includes(word.slice(0, Math.min(6, word.length))));
      })
      .map((term) => term.label)
      .slice(0, 2);
    return {
      code: record.i,
      reason: matches.length
        ? `Coincide con ${matches.join(" y ")}.`.slice(0, 96)
        : "Coincide directamente con la descripción oficial del catálogo.",
    };
  });
  return {
    suggestions,
    note: suggestions.length
      ? "Resultados calculados con la interpretación de Gemini y las descripciones oficiales del catálogo."
      : "No encontré una coincidencia directa suficientemente segura. Agrega el tipo, uso o presentación del producto.",
  };
}

async function classifyCurrentProduct() {
  const product = query.value.trim();
  if (product.length < 2 || isClassifying.value) return;

  const cachedResult = readCachedClassification(product);
  if (cachedResult) {
    nanoClassification.value = cachedResult;
    classificationError.value = "";
    return;
  }

  searchCatalog();
  const directContext = directProductContext(product);
  classifyingQuery.value = product;
  classificationPhase.value = directContext ? "matching" : "understanding";
  classificationError.value = "";
  nanoClassification.value = null;
  nanoProgress.value = 0;
  if (["downloadable", "downloading"].includes(nanoAvailability.value)) {
    nanoAvailability.value = "downloading";
  }

  const reportProgress = (progress: number) => {
    nanoProgress.value = progress;
    nanoAvailability.value = progress < 1 ? "downloading" : "available";
  };

  try {
    const context =
      directContext ||
      (await understandSatProduct(product, reportProgress));
    classificationPhase.value = "matching";
    const candidates = nanoCandidateRecords(product, context, Boolean(directContext));

    const result = buildLocalClassification(context, candidates);
    nanoClassification.value = result;
    persistClassification(product, result);
    nanoAvailability.value = "available";
  } catch (classificationFailure) {
    classificationError.value =
      classificationFailure instanceof Error
        ? classificationFailure.message
        : "No se pudo clasificar este producto.";
    nanoAvailability.value = await getGeminiNanoAvailability();
  } finally {
    classifyingQuery.value = "";
    classificationPhase.value = "idle";
  }
}
function openNanoSuggestion(code: string) {
  const record = recordByCode.value.get(code);
  if (!record) return;
  if (!searchResults.value.some((candidate) => candidate.i === code)) {
    searchResults.value = [record, ...searchResults.value];
  }
  selectRecord(record);
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

function readNanoCache(): Record<string, CachedNanoResult> {
  try {
    const parsed = JSON.parse(localStorage.getItem(nanoCacheKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistNanoResult(code: string, description: string, result: GeminiNanoResult) {
  const nextCache = {
    ...nanoCache.value,
    [code]: { ...result, description, generatedAt: Date.now() },
  };
  const recentEntries = Object.entries(nextCache)
    .sort(([, first], [, second]) => second.generatedAt - first.generatedAt)
    .slice(0, nanoCacheLimit);
  nanoCache.value = Object.fromEntries(recentEntries);
  localStorage.setItem(nanoCacheKey, JSON.stringify(nanoCache.value));
}

async function checkGeminiNano() {
  nanoAvailability.value = "checking";
  nanoAvailability.value = await getGeminiNanoAvailability();
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

async function generateWithGeminiNano() {
  const record = selected.value;
  if (!record || generatingCode.value) return;

  generatingCode.value = record.i;
  nanoError.value = "";
  nanoProgress.value = 0;
  if (["downloadable", "downloading"].includes(nanoAvailability.value)) {
    nanoAvailability.value = "downloading";
  }

  try {
    const result = await generateSatUsageExamples(
      {
        code: record.i,
        description: record.d,
        similarWords: record.s,
        officialChildren: officialChildrenFor(record),
      },
      (progress) => {
        nanoProgress.value = progress;
        nanoAvailability.value = progress < 1 ? "downloading" : "available";
      },
    );
    persistNanoResult(record.i, record.d, result);
    nanoAvailability.value = "available";
  } catch (generationError) {
    nanoError.value =
      generationError instanceof Error
        ? generationError.message
        : "No se pudieron generar ejemplos.";
    nanoAvailability.value = await getGeminiNanoAvailability();
  } finally {
    generatingCode.value = "";
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
  nanoClassification.value = null;
  classificationError.value = "";
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(searchCatalog, 220);
});

watch(selected, () => {
  nanoError.value = "";
  nanoProgress.value = 0;
});

onMounted(() => {
  loadCatalog();
  checkGeminiNano();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (copyTimer) clearTimeout(copyTimer);
});
