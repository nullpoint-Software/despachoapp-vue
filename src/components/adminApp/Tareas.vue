<template>
    <div class="shadow-md p-4 bg-transparent text-white w-full">
        <div class="flex-auto font-extrabold text-2xl sm:text-4xl mb-6 text-center">Tareas</div>
        <div id="kanban-board">
            <KanbanBoard />
        </div>


    </div>
</template>

<script setup>
import { onMounted } from 'vue';
import KanbanBoard from '../kanbanComponents/KanbanBoard.vue';
import {driverObjTareasMain} from '../tour/tareas';
onMounted(()=>{
    const done = localStorage.getItem('tourTareasDone');
    if (!done) {
    driverObjTareasMain.drive()
    }
})
</script>
