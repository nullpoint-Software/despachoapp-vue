import { noWorkspaceAccess, type WorkspaceAccess } from '../../shared/contracts/workspace'

/**
 * Perfiles de la demo: tres personas fijas del despacho ficticio.
 * Cada perfil declara el acceso que `readWorkspaceAccess` devuelve al iniciar sesión con él.
 * En la entrega 0 ninguno tiene acceso; las entregas siguientes lo van ampliando por módulo.
 */
export type DemoProfileId = 'administrator' | 'accountant' | 'assistant'

/** `roleSummary` describe en una línea qué ve ese rol; la entrada de la demo lo muestra en lugar del nombre. */
export interface DemoProfile { profileId: DemoProfileId; username: string; displayName: string; roleName: string; roleSummary: string; access: WorkspaceAccess }

/** Contraseña pública a propósito: así la reconfirmación de ADR-038 se puede ejercitar en la demo. */
export const demoPassword = 'demo1234'

export const demoProfiles: readonly DemoProfile[] = [
  { profileId: 'administrator', username: 'admin.demo', displayName: 'Ana Torres', roleName: 'Administrador', roleSummary: 'Todo el despacho y el equipo', access: { ...noWorkspaceAccess } },
  { profileId: 'accountant', username: 'contador.demo', displayName: 'Luis Méndez', roleName: 'Contador', roleSummary: 'Clientes, fiscal y cumplimiento', access: { ...noWorkspaceAccess } },
  { profileId: 'assistant', username: 'auxiliar.demo', displayName: 'Carla Ruiz', roleName: 'Auxiliar', roleSummary: 'Tareas, cobros y notas', access: { ...noWorkspaceAccess } }
]
