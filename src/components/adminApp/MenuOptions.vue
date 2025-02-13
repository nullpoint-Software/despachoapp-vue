<template>
    <header class="flex font-semibold font-sans mb-2 ml-2">Opciones</header>
    <PanelMenu :model="items" />
</template>

<script setup>
import { ref } from "vue";
import { PanelMenu } from "primevue";
const items = ref([
    {
        label: 'Inicio',
        icon: 'pi pi-home'
    },
    {
        label: 'Tareas',
        icon: 'pi pi-list-check'
    },
    {
        label: 'Clientes',
        icon: 'pi pi-address-book'
    },
    {
        label: 'Pagos',
        icon: 'pi pi-money-bill'
    }
]);
</script>
