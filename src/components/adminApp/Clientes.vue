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
        id: "2333",
        name: "Juan Perez",
        empresa: "Abarrotes Perez",
        email: "juanp@yahoo.mx",
        tel: "(536) 234 2344",
        dom: "Morelos 18, El Grullo, Jalisco"
    },
    {
        id: "2334",
        name: "Maria López",
        empresa: "Tienda Lupita",
        email: "maria.lopez@gmail.com",
        tel: "(331) 789 5678",
        dom: "Juárez 45, Autlán, Jalisco"
    },
    {
        id: "2335",
        name: "Carlos Ramírez",
        empresa: "Electro Ramírez",
        email: "c.ramirez@hotmail.com",
        tel: "(312) 456 7890",
        dom: "Av. Hidalgo 90, Tonaya, Jalisco"
    },
    {
        id: "2336",
        name: "Ana Torres",
        empresa: "Moda y Estilo",
        email: "ana.torres@outlook.com",
        tel: "(315) 678 1234",
        dom: "Reforma 23, Casimiro Castillo, Jalisco"
    },
    {
        id: "2337",
        name: "Luis Mendoza",
        empresa: "Ferretería Mendoza",
        email: "lmendoza@yahoo.com",
        tel: "(322) 345 6789",
        dom: "Independencia 12, El Limón, Jalisco"
    },
    {
        id: "2338",
        name: "Sofía Herrera",
        empresa: "Papelería Herrera",
        email: "sofia.herrera@gmail.com",
        tel: "(328) 567 8901",
        dom: "Madero 56, Unión de Tula, Jalisco"
    }
];

const columns = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Nombre' },
    { field: 'empresa', header: 'Empresa' },
    { field: 'email', header: 'Correo Electrónico' },
    { field: 'tel', header: 'Teléfono' },
    { field: 'dom', header: 'Domicilio' }
];

cs.getClientes();
</script>
