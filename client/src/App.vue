<template>
  <div id="voiceiq-app">
    <div v-if="session.loading" class="app-loading">Loading VoiceIQ...</div>
    <router-view v-else />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useSessionStore } from '@/stores/session.js';

const session = useSessionStore();
onMounted(() => session.init());
</script>

<style scoped>
#voiceiq-app {
  min-height: 100vh;
  background: #f9fafb;
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #6b7280;
  font-size: 15px;
}
</style>
