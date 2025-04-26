<script setup>
import { defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { ref, watch, nextTick } from 'vue'
import Loader from './Loader.vue'

const route = useRoute()
const isLoading = ref(true)

watch(
  () => route.fullPath,
  async () => {
    isLoading.value = true

    // Wait for DOM updates after route change
    await nextTick()

    // Optionally wait for a longer chain of ticks
    // await new Promise(resolve => setTimeout(resolve, 200)); // Allow child async setup, extra delay

    isLoading.value = false
  },
  { immediate: true }
)

</script>

<template>

    <div v-if="isLoading">
        <Loader />
    </div>
    <RouterView v-else class="lg:ml-30 lg:mr-20 mt-20" />
</template>
