<script setup>
import { Button } from 'primevue';
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
import { InputText } from 'primevue';
const initialValues = ref({
    username: '',
    email: ''
});

</script>
<template>
    <div class="container">
        <div class="loader">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
        </div>
        <div class="background">
            <img src="../assets/img/logobig.png" class="logo">
        </div>
        <div class="login-container">
            <Form v-slot="$form" class="flex justify-center flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <InputText name="username" type="text" placeholder="Username" />

                </div>
                <div class="flex flex-col gap-1">
                    <InputText name="email" type="text" placeholder="Email" />

                </div>
                <Button type="submit" severity="secondary" label="Submit" />
            </Form>
        </div>
    </div>



</template>
<style lang="css" scoped>
.container {
    position: relative;
}

.login-container {
    padding: 10px;
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.6);
    opacity: 100%;
    text-align: center;
    max-width: 300px;
    margin: 0 auto;
    z-index: 2;
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    right: 0;
}

.logo {
    place-items: center;
    opacity: 48%;
    z-index: 1;
}

.loader {
    position: absolute;
}
</style>