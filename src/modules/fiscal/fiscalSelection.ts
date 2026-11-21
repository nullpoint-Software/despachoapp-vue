/**
 * "Seleccionar todas" de la tabla Fiscal (2026-10-13). Opera sobre la vista filtrada vigente (pestaña Emitidas o
 * Recibidas del periodo cargado, todas las páginas) y sólo cuenta los UUID seleccionables (ingresos y egresos, los que
 * admite un reporte). Las selecciones fuera de la vista se conservan: quitar la selección sólo retira las de la vista.
 */

/** `true` cuando hay UUID seleccionables y todos están ya en la selección. */
export function areAllSelected(selectedUuids: readonly string[], selectableUuids: readonly string[]): boolean {
  return selectableUuids.length > 0 && selectableUuids.every(uuid => selectedUuids.includes(uuid))
}

/** Alterna: si todos los de la vista están seleccionados los quita; si no, agrega los que falten sin duplicar. */
export function toggleAllSelection(selectedUuids: readonly string[], selectableUuids: readonly string[]): string[] {
  if (areAllSelected(selectedUuids, selectableUuids)) return selectedUuids.filter(uuid => !selectableUuids.includes(uuid))
  return [...new Set([...selectedUuids, ...selectableUuids])]
}
