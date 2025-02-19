<template>

    <div class="flex space-x-4 bg-blue-900 p-2 rounded-lg shadow-md">
        <template v-for="item in items" :key="item.label">
            <router-link v-if="item.route" v-slot="{ href, navigate }" :to="'/app/' + item.route" custom>
                <a v-ripple 
                    class="flex items-center cursor-pointer text-slate-900 dark:text-surface-0 px-4 py-2 bg-white rounded-lg hover:bg-gray-200 transition"
                    :href="href" @click="navigate; emit('closeMenu')">
                    <span :class="item.icon" />
                    <span class="ml-2">{{ item.label }}</span>
                </a>
            </router-link>
            <a v-else v-ripple 
                class="flex items-center cursor-pointer text-slate-900 dark:text-surface-0 px-4 py-2 bg-white rounded-lg hover:bg-gray-200 transition"
                :href="item.url" :target="item.target">
                <span :class="item.icon" />
                <span class="ml-2">{{ item.label }}</span>
                <span v-if="item.items" class="pi pi-angle-down text-primary ml-auto" />
            </a>
        </template>
    </div>
</template>

<script setup>
import { ref } from "vue";
import { PanelMenu } from "primevue";
import { RouterLink, useRouter } from "vue-router";
import { defineEmits } from "vue";

const router = useRouter();
const emit = defineEmits(["closeMenu"]);
const items = ref([
    {
        label: 'Inicio',
        icon: 'pi pi-home',
        route: 'inicio'
    },
    {
        label: 'Tareas',
        icon: 'pi pi-list-check',
        route: 'tareas'
    },
    {
        label: 'Clientes',
        icon: 'pi pi-address-book',
        route: 'clientes'
    },
    {
        label: 'Pagos',
        icon: 'pi pi-money-bill',
        route: 'pagos'
    }
]);
</script>
