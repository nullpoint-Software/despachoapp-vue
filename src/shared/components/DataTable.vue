<script setup lang="ts">
export interface TableColumn { key: string; label: string; isNumeric?: boolean }
defineProps<{ caption: string; columns: TableColumn[]; rows: { rowId: string; values: Record<string, string> }[] }>()
</script>
<template>
  <div
    class="table-region"
    tabindex="0"
    :aria-label="caption"
  >
    <table>
      <caption>{{ caption }}</caption><thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{ numeric: column.isNumeric }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.rowId"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            :class="{ numeric: column.isNumeric }"
          >
            {{ row.values[column.key] }}
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length">
            No hay registros que mostrar.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
