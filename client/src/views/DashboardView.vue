<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div>
        <h1>VoiceIQ</h1>
        <p class="subtitle">Voice AI Performance Optimizer</p>
      </div>
      <span v-if="demo" class="demo-badge">Demo Mode</span>
    </header>

    <div v-if="session.isGhlContext && !session.installed" class="install-banner">
      <p>VoiceIQ needs authorization to access your voice agents.</p>
      <a href="/auth/install" class="btn-install">Authorize VoiceIQ</a>
      <p class="install-note">One-time setup. After authorization, your agents will appear here.</p>
    </div>

    <div v-if="loading" class="loading">Loading agents...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="agents-grid">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="agent-card"
        @click="$router.push({ path: `/agents/${agent.id}`, query: { locationId: session.locationId } })"
      >
        <div class="agent-card-header">
          <h3>{{ agent.name }}</h3>
          <span :class="['status-badge', agent.status]">{{ agent.status }}</span>
        </div>
        <p class="agent-phone">{{ agent.phone || 'No phone assigned' }}</p>
        <p class="agent-prompt-preview">
          {{ agent.systemPrompt?.substring(0, 150) || 'No prompt configured' }}
        </p>
        <div class="agent-card-footer">
          <span class="action-hint">Click to analyze & test</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useSessionStore } from '@/stores/session.js';

const session = useSessionStore();
const agents = ref([]);
const loading = ref(true);
const error = ref('');
const demo = ref(false);

onMounted(async () => {
  try {
    const res = await axios.get('/api/v1/agents', {
      params: { locationId: session.locationId },
    });
    agents.value = res.data.agents;
    demo.value = res.data.demo || false;
  } catch (err) {
    error.value = 'Failed to load agents. Is the backend running?';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.dashboard {
  padding: 32px 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.subtitle {
  color: #6b7280;
  font-size: 14px;
  margin-top: 4px;
}

.demo-badge {
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
}

.loading, .error {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
  font-size: 15px;
}

.error {
  color: #dc2626;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.agent-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.agent-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.agent-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.agent-card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  text-transform: uppercase;
}

.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.agent-phone {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.agent-prompt-preview {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 16px;
}

.agent-card-footer {
  border-top: 1px solid #f3f4f6;
  padding-top: 12px;
}

.action-hint {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 500;
}

.install-banner {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
}

.install-banner p {
  color: #1e40af;
  font-size: 14px;
  margin-bottom: 12px;
}

.btn-install {
  display: inline-block;
  background: #1A56DB;
  color: #fff;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 8px;
}

.btn-install:hover {
  background: #1e40af;
}

.install-note {
  font-size: 12px;
  color: #6b7280 !important;
}
</style>
