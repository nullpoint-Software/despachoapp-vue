const STORAGE_KEY = 'despacho.payment-subjects.v1'
export const DEFAULT_SUBJECT_SUGGESTIONS = [
  'Pago de honorarios del mes de',
  'Cuota IMSS del mes de',
  'Préstamo de',
  'Impresión de',
  'Cita SAT',
  'Impuestos',
  'Declaración mensual',
  'Pago provisional',
  'Trámite ante el SAT',
  'Renovación de e.firma'
]

export function validateSubjectSuggestions(values: string[]): string[] {
  const cleaned = values.map((value) => value.trim().replace(/\s+/g, ' '))
  if (cleaned.some((value) => !value))
    throw new Error('Completa las sugerencias vacías antes de guardar.')
  if (cleaned.some((value) => value.length > 200))
    throw new Error('Cada sugerencia puede tener hasta 200 caracteres.')
  if (new Set(cleaned.map((value) => value.toLocaleLowerCase('es-MX'))).size !== cleaned.length)
    throw new Error('Hay sugerencias repetidas. Cambia su texto antes de guardar.')
  return cleaned
}
export function loadSubjectSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string'))
        return validateSubjectSuggestions(parsed)
    }
  } catch {
    /* Recuperar las opciones iniciales si el almacenamiento no está disponible o está dañado. */
  }
  return [...DEFAULT_SUBJECT_SUGGESTIONS]
}
export function saveSubjectSuggestions(values: string[]): string[] {
  const cleaned = validateSubjectSuggestions(values)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
  } catch {
    throw new Error(
      'No se pudieron guardar las sugerencias en este navegador. Comprueba que el almacenamiento esté permitido.'
    )
  }
  return cleaned
}
