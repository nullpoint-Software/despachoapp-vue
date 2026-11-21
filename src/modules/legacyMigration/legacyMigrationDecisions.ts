import type { LegacyConflict, LegacyDecision, LegacyIssue, LegacyMigrationPreview } from '../../../shared/contracts/legacyMigration'

/**
 * Decisiones del asistente de migración (8.1). Viven sólo en memoria del Renderer (sin `localStorage`); el Host vuelve
 * a validar cada una al ejecutar ('Decisions incomplete' / 'Invalid decision'). Las funciones devuelven mapas nuevos
 * para que Vue detecte el cambio.
 */
type DecisionItem = LegacyConflict | LegacyIssue
/** Lo único que estas reglas leen de la vista previa (también sirve para el plan del Host en las pruebas). */
type DecisionSource = Pick<LegacyMigrationPreview, 'conflicts' | 'issues'>

/** Un conflicto o incidencia necesita decisión cuando el Host le ofrece opciones (regla única para la lista y el conteo). */
export function needsDecision(item: DecisionItem): boolean { return item.allowedChoices.length > 0 }

/**
 * Una decisión completa: una opción que el renglón permite hoy (un cambio en un pago puede perder `applyChange`) y,
 * para `create`, con el usuario nuevo escrito (el Host lo exige).
 */
export function isDecisionComplete(item: DecisionItem, decision: LegacyDecision | undefined): boolean {
  return decision !== undefined && item.allowedChoices.includes(decision.choice) && !(decision.choice === 'create' && !decision.username)
}

export interface LegacyDecisionItems { conflicts: LegacyConflict[]; dependents: LegacyIssue[]; issues: LegacyIssue[] }
/**
 * Lo que hay que decidir con las decisiones actuales (Ruling 19, mismas reglas que `LegacyMigrationPlanner.resolve`).
 * Cuando un cliente con `dependentKeys` se rechaza:
 * - cada pago nuevo que depende de él aparece como renglón propio (tipo `orphanPayment`: se queda sin cliente) con
 *   `officeMovement` | `reject`;
 * - un pago cambiado (ya es un conflicto propio) pierde `applyChange`, porque ya no tiene a qué cliente volver.
 * Si el cliente deja de rechazarse esos renglones desaparecen y sus decisiones dejan de enviarse (`carryOverDecisions`).
 */
export function decisionItems(preview: DecisionSource, decisions: Map<string, LegacyDecision>): LegacyDecisionItems {
  const ownerByDependentKey = new Map<string, LegacyConflict>()
  for (const conflict of preview.conflicts) {
    if (decisions.get(conflict.key)?.choice !== 'reject') continue
    for (const key of conflict.dependentKeys) ownerByDependentKey.set(key, conflict)
  }
  const conflictKeys = new Set(preview.conflicts.map(conflict => conflict.key))
  const conflicts = preview.conflicts.map(conflict => ownerByDependentKey.has(conflict.key) ? { ...conflict, allowedChoices: conflict.allowedChoices.filter(choice => choice !== 'applyChange') } : conflict)
  const dependents: LegacyIssue[] = [...ownerByDependentKey].filter(([key]) => !conflictKeys.has(key)).map(([key, owner]) => {
    const separator = key.indexOf(':')
    return { key, kind: 'orphanPayment', sourceTable: key.slice(0, separator), legacyId: key.slice(separator + 1), legacyLabel: `Pago ${key.slice(separator + 1)} (${key.slice(0, separator)}) de ${owner.legacyLabel}, cliente rechazado`, allowedChoices: ['officeMovement', 'reject'], isInformational: false }
  })
  return { conflicts, dependents, issues: preview.issues }
}

/** Miembros de un grupo de RFC repetido: los conflictos `duplicateRfc` con el mismo RFC (viaja en `currentLabel`). */
function rfcGroupOf(items: DecisionItem[], item: DecisionItem): LegacyConflict[] {
  if (item.kind !== 'duplicateRfc' || !('currentLabel' in item)) return []
  return items.filter((other): other is LegacyConflict => other.kind === 'duplicateRfc' && 'currentLabel' in other && other.currentLabel === item.currentLabel)
}

/**
 * Principal propuesto al elegir "Elegir el principal": el que ya eligió otro miembro del mismo RFC, o el primero del
 * grupo. Así todos apuntan al mismo y el Host no rechaza con 'Invalid decision'.
 */
export function defaultPrimaryLegacyClientId(items: DecisionItem[], decisions: Map<string, LegacyDecision>, item: DecisionItem): string {
  const group = rfcGroupOf(items, item)
  for (const member of group) {
    const decision = decisions.get(member.key)
    if (member.key !== item.key && decision?.choice === 'primary') return decision.legacyClientId
  }
  return group[0]?.legacyId ?? item.legacyId
}

/**
 * RFC de los grupos que el Host rechazaría (mismas reglas que `LegacyMigrationPlanner.resolve`): los miembros no
 * rechazados apuntan a principales distintos, o a uno que no es miembro o que fue rechazado.
 */
export function inconsistentRfcGroups(preview: DecisionSource, decisions: Map<string, LegacyDecision>): string[] {
  const rfcs: string[] = []
  for (const conflict of preview.conflicts) {
    if (conflict.kind !== 'duplicateRfc' || conflict.currentLabel === null || rfcs.includes(conflict.currentLabel)) continue
    const group = rfcGroupOf(preview.conflicts, conflict)
    const chosen = new Set(group.flatMap(member => { const decision = decisions.get(member.key); return decision?.choice === 'primary' ? [decision.legacyClientId] : [] }))
    const [primaryId] = chosen
    const primary = group.find(member => member.legacyId === primaryId)
    if (chosen.size > 1 || (primaryId !== undefined && (!primary || decisions.get(primary.key)?.choice !== 'primary'))) rfcs.push(conflict.currentLabel)
  }
  return rfcs
}

/**
 * "Aplicar a todos": copia la opción a cada elemento del grupo que la permite; los demás conservan lo que tenían. Con
 * `primary` cada grupo de RFC queda con un solo principal (`defaultPrimaryLegacyClientId`).
 */
export function applyToAll(decisions: Map<string, LegacyDecision>, items: DecisionItem[], choice: LegacyDecision): Map<string, LegacyDecision> {
  const next = new Map(decisions)
  for (const item of items) {
    if (!item.allowedChoices.includes(choice.choice)) continue
    next.set(item.key, choice.choice === 'primary' ? { key: item.key, choice: 'primary', legacyClientId: defaultPrimaryLegacyClientId(items, next, item) } : { ...choice, key: item.key })
  }
  return next
}

/** Conflictos, pagos de clientes rechazados e incidencias que aún no tienen una decisión completa, en ese orden. */
export function pendingKeys(preview: DecisionSource, decisions: Map<string, LegacyDecision>): string[] {
  const { conflicts, dependents, issues } = decisionItems(preview, decisions)
  return [...conflicts, ...dependents, ...issues].filter(needsDecision).filter(item => !isDecisionComplete(item, decisions.get(item.key))).map(item => item.key)
}

/** Decisiones cuya clave está entre `items` con esa opción permitida (y, para `link`, con el destino entre los candidatos). */
function keepApplicable(previous: Map<string, LegacyDecision>, items: DecisionItem[]): Map<string, LegacyDecision> {
  const itemByKey = new Map(items.filter(needsDecision).map(item => [item.key, item]))
  const next = new Map<string, LegacyDecision>()
  for (const [key, decision] of previous) {
    const item = itemByKey.get(key)
    if (!item || !item.allowedChoices.includes(decision.choice)) continue
    if (decision.choice === 'link' && !('candidates' in item && item.candidates.some(candidate => candidate.targetId === decision.targetId))) continue
    next.set(key, decision)
  }
  return next
}
/**
 * Las decisiones que siguen aplicando a `preview`: tras "Volver a analizar" y también al ejecutar, para no enviar la de
 * un pago cuyo cliente ya no se rechaza (el Host rechaza claves sin uso). Dos pasos: primero las de conflictos e
 * incidencias (entre ellas los rechazos de clientes) y, con ellas, las de los pagos que dependen de esos rechazos.
 */
export function carryOverDecisions(previous: Map<string, LegacyDecision>, preview: DecisionSource): Map<string, LegacyDecision> {
  const { conflicts, dependents, issues } = decisionItems(preview, keepApplicable(previous, [...preview.conflicts, ...preview.issues]))
  return keepApplicable(previous, [...conflicts, ...dependents, ...issues])
}
