<template>
    <div class="h-auto min-h-screen w-full bg-slate-200 text-slate-900 flex flex-col">
        <!-- Navigation Bar -->
        <nav class="flex justify-between items-center p-2 bg-stone-50 shadow-lg">
            <div class="flex items-center space-x-2">
                <button @click="menuOpen = true" class="md:hidden text-slate-900 text-2xl ml-4 cursor-pointer">
                    <i class="pi pi-bars"></i>
                </button>
                <img :src="mainImageSrc" alt="Company Logo" class="w-20 md:w-20" />
                <!-- <span class="hidden md:block text-lg font-bold text-slate-900">
                    DESPACHO CONTABLE Y FISCAL SÁNCHEZ
                </span> -->
            </div>
            <div class="hidden md:flex text-slate-900 space-x-3 items-center mr-4 ">
                <Avatar v-tooltip.bottom="ProfileName" :image="profilePicture" shape="circle" />
                <span class="font-bold">{{ ProfileName }}</span>
                <Divider layout="vertical"></Divider>
                <Button label="Logout" icon="pi pi-sign-out" class="flex-auto cursor-pointer" severity="danger"
                    text></Button>
            </div>

            <!-- Botón Menú en Móviles -->
            <Drawer v-model:visible="menuOpen" header="Drawer">
                <template #header>
                    <img :src="logoTextImageSrc" alt="Company Logo" class=" w-60" />
                </template>
                <MenuOptions></MenuOptions>
                <template #footer>
                    <div class="items-center">
                        <div class="flex gap-2 mx-2 items-center align-middle space-y-0 space-x-1">
                            <Avatar :image="profilePicture" shape="circle" />
                            <span class="font-bold">{{ ProfileName }}</span>
                        </div>
                        <br>
                        <div class="flex items-center">
                            <Button label="Account" icon="pi pi-user" class="flex-auto text-slate-900"
                                outlined></Button>
                            <Button label="Logout" icon="pi pi-sign-out" class="flex-auto" severity="danger"
                                text></Button>
                        </div>

                    </div>
                </template>
            </Drawer>
        </nav>
        <!-- sidebar-->
        <div class="flex flex-grow">
            <div class="hidden p-4 md:block container max-w-50 ml-0 p-2 bg-stone-50 ">
                <MenuOptions @closeMenu="menuOpen = false"></MenuOptions>
            </div>
            <!-- Contenido -->
             <RouterView/>
        </div>
    </div>
</template>
<script>
import { ref } from "vue";
import mainImageSrc from "@/assets/img/logsymbolblack.png";
import logoTextImageSrc from "@/assets/img/textblack.png";
import "primeicons/primeicons.css";
import Drawer from 'primevue/drawer';
import Button from 'primevue/button';
import Divider from "primevue/divider";
import { Avatar } from "primevue";
import profilePicture from "@/assets/img/havatar.jpg"
import MenuOptions from "@/components/adminApp/MenuOptions.vue";
import { RouterView } from "vue-router";
export default {
    components: { Drawer, Button, Avatar, Divider, MenuOptions, RouterView },
    setup() {
        const menuOpen = ref(false);
        const ProfileName = ref("Hachikuji Mayoi");
        return { mainImageSrc, menuOpen, profilePicture, logoTextImageSrc, ProfileName };
    },
};
</script>