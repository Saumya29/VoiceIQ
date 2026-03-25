<template>
  <div id="voiceiq-app" class="app-shell">
    <div v-if="session.loading" class="app-loading">
      <div class="loading-card surface-card">
        <span class="page-kicker">VoiceIQ</span>
        <h1>Preparing your workspace</h1>
        <p>Loading agents, session context, and the optimizer UI.</p>
      </div>
    </div>
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
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.loading-card {
  width: min(460px, 100%);
  padding: 32px;
  border-radius: 28px;
  text-align: left;
}

.loading-card h1 {
  margin: 0 0 12px;
  font-size: clamp(1.8rem, 1.4rem + 1vw, 2.4rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.loading-card p {
  color: var(--text-secondary);
  font-size: 0.98rem;
  line-height: 1.65;
}

@media (max-width: 640px) {
  .loading-card {
    padding: 24px;
  }
}
</style>
