<script setup lang="ts">
import { computed } from 'vue'
import type { TeamMember } from '../../../shared/contracts/teamOverview'
import UserAvatar from '../../shared/components/UserAvatar.vue'
import StatusBadge from '../../shared/components/StatusBadge.vue'
import type { MemberTaskCounts } from './homeDashboardMetrics'

/**
 * "Equipo hoy" del tablero de Inicio (administrador, `canViewTeam`): una ficha por trabajador activo con su foto
 * (`UserAvatar`, almacén de fotos EPHEMERAL), si tiene sesión, sus tareas abiertas y las que terminó hoy.
 * - Las abiertas y vencidas vienen del resumen del equipo del Host (`team:overview`), que cuenta todas las tareas.
 * - Las terminadas hoy salen de la lista de tareas visibles de la sesión (`completedSince` = hoy): el resumen del
 *   equipo no las trae y no se agregan canales nuevos para ello.
 * - Orden: más tareas abiertas primero, para ver de un vistazo quién está más cargado.
 */
const props = defineProps<{ members: TeamMember[]; taskCountsByMember: Map<string, MemberTaskCounts> | null }>()
const rows = computed(() => props.members.filter(member => member.isActive)
  .map(member => ({ member, completedTodayCount: props.taskCountsByMember?.get(member.userId)?.completedTodayCount ?? null }))
  .sort((first, second) => second.member.openTaskCount - first.member.openTaskCount))
</script>

<template>
  <ul
    v-if="rows.length"
    class="team-today"
    aria-label="Trabajadores activos"
  >
    <li
      v-for="row in rows"
      :key="row.member.userId"
    >
      <UserAvatar
        :user-id="row.member.userId"
        :display-name="row.member.displayName"
        is-decorative
      />
      <span class="team-today-person">
        <strong>{{ row.member.displayName }}</strong>
        <span class="field-help"><span
          class="team-today-dot"
          :class="{ 'is-online': row.member.activeSessionCount > 0 }"
          aria-hidden="true"
        />{{ row.member.activeSessionCount > 0 ? 'En sesión' : 'Sin sesión' }}</span>
      </span>
      <dl class="team-today-counts">
        <div><dt>Abiertas</dt><dd>{{ row.member.openTaskCount }}</dd></div>
        <div><dt>Hoy</dt><dd>{{ row.completedTodayCount ?? '—' }}</dd></div>
      </dl>
      <StatusBadge
        v-if="row.member.overdueTaskCount"
        tone="error"
        class="team-today-overdue"
      >
        {{ row.member.overdueTaskCount }} vencida(s)
      </StatusBadge>
    </li>
  </ul>
  <p
    v-else
    class="field-help"
  >
    No hay trabajadores activos.
  </p>
</template>

<style scoped>
.team-today { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.team-today li { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px; border: 2px solid var(--hairlineColor); }
.team-today-person { display: grid; gap: 2px; flex: 1; min-width: 8rem; overflow-wrap: anywhere; }
.team-today-person .field-help { display: inline-flex; align-items: center; gap: 4px; }
.team-today-dot { display: inline-block; width: 8px; height: 8px; background: var(--strongBorderColor); }
.team-today-dot.is-online { background: var(--successColor); }
.team-today-counts { display: flex; gap: 12px; margin: 0; }
.team-today-counts div { display: grid; justify-items: end; }
.team-today-counts dt { font-family: var(--monoFontFamily); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mutedTextColor); }
.team-today-counts dd { margin: 0; font-family: var(--monoFontFamily); font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
.team-today-overdue { flex-basis: 100%; justify-self: start; width: fit-content; }
</style>
