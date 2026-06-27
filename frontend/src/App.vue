<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterView } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';

const route = useRoute();
const useAppLayout = computed(() => route.meta.layout === 'app');
</script>

<template>
  <AppLayout v-if="useAppLayout">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>
