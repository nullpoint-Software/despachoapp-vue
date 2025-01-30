<script setup lang="ts">
import { Button } from 'primevue';


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
        <div class="login-form">
            <input type="text" placeholder="sas">
            <Button>Login</Button>
        </div>
    </div>
    </div>
    
    
    
</template>
<style lang="css" scoped>
.container{
    position: relative;
}
.login-container{
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
.logo{
    place-items: center;
    opacity: 48%;
    z-index: 1;
}
.loader{
    position: absolute;
}
</style>