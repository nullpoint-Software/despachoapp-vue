<template>
    <transition name="fade">
        <div class="modal-overlay">
            <div class="modal-content relative bg-gray-50">
                <!-- Encabezado -->
                <div class="flex items-center space-x-4 mb-6 p-4 bg-white rounded-lg shadow">
                    <div>
                        <h3 class="text-2xl font-bold text-black">
                            <i class="pi pi-print text-3xl text-blue-500"></i>
                            {{ "Le gustaría imprimir el recibo?" }}
                        </h3>
                    </div>
                </div>
                <div class="flex justify-center space-x-6 mt-6 px-4">
                    <Button label="Si" icon="pi pi-check" class="p-button-primary" @click="ok" />
                    <Button label="No" icon="pi pi-times" class="p-button-text" @click="close" />
                </div>
            </div>
        </div>
    </transition>
</template>
<script setup>
import Button from "primevue/button";
const emit = defineEmits(["close", "ok"]);
function close(){
    emit("close")
}
function ok(){
    emit("ok")
}
</script>
<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    backdrop-filter: blur(4px);
    background-color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}

.modal-content {
    background-color: #f9fafb;
    border-radius: 0.5rem;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 30rem;
    padding: 1.5rem;
    position: relative;
    animation: slideDown 0.3s ease-out;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>