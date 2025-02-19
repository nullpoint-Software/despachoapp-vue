<template>
    <div class="shadow-md  p-4 m-5 bg-stone-100 text-slate-900 h-full w-full">
        <div class="font-bold text-2xl pl-2">Clientes</div>
    </div>
</template>
<script setup>
import * as cs from '@/service/adminApp/clienteService';
cs.getClientes();
</script>