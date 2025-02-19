<template>
    <div class="shadow-md p-4 m-5 bg-stone-100 text-slate-900 h-full w-full">
        <div class="font-bold text-2xl pl-2">Clientes</div>

        <DataTable :value="customers" tableStyle="min-width: 50rem">
            <Column v-for="col of columns" :key="col.field" :field="col.field" :header="col.header"></Column>
        </DataTable>

    </div>
</template>
<script setup>
import { ref } from "vue";
import * as cs from "@/service/adminApp/clienteService";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import ColumnGroup from "primevue/columngroup"; // optional
import Row from "primevue/row";
const customers = [
    {
        nombre: "Juan Perez"
        
    }]

    const columns = [
    { field: 'code', header: 'Code' },
    { field: 'name', header: 'Name' },
    { field: 'category', header: 'Category' },
    { field: 'quantity', header: 'Quantity' }
];
cs.getClientes();
</script>
