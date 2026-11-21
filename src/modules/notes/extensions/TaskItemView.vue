<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import SpringCheck from '../../../shared/vueBits/SpringCheck.vue'

/**
 * Tarea de una nota como tarjeta (pulido 2026-10-03): la casilla Spring Check (Vue Bits) y el texto editable en la
 * misma línea. Al marcarla, el texto se atenúa y se tacha. Antes la casilla y el texto quedaban en renglones distintos.
 */
const props = defineProps(nodeViewProps)
function toggle(isChecked: boolean): void { if (props.editor.isEditable) props.updateAttributes({ checked: isChecked }) }
</script>

<template>
  <NodeViewWrapper
    as="li"
    class="note-task"
    data-type="taskItem"
    :data-checked="node.attrs.checked ? 'true' : 'false'"
  >
    <SpringCheck
      class="note-task-check"
      :is-checked="Boolean(node.attrs.checked)"
      :is-disabled="!editor.isEditable"
      :aria-label="node.attrs.checked ? 'Marcar como pendiente' : 'Marcar como hecha'"
      @change="toggle"
    />
    <NodeViewContent class="note-task-content" />
  </NodeViewWrapper>
</template>
