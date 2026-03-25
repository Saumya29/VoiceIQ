<template>
  <div class="page-shell dashboard-shell stack">
    <section class="dashboard-hero surface-card">
      <header class="page-header hero-header">
        <div class="page-header-main">
          <div class="hero-copy">
            <span class="page-kicker">VoiceIQ Copilot</span>
            <h1 class="page-title">Voice AI Performance Optimizer</h1>
            <p class="page-subtitle">
              Review live agents, understand prompt quality quickly, and launch the
              validation flywheel without disrupting your current HighLevel workflow.
            </p>
          </div>
        </div>
        <div class="cluster hero-badges">
          <span class="badge">{{ session.isGhlContext ? 'Embedded in HighLevel' : 'Standalone workspace' }}</span>
          <span v-if="demo" class="badge demo-badge">Demo Mode</span>
        </div>
      </header>

      <div class="grid-auto hero-stats">
        <div class="stat-card hero-stat">
          <span class="eyebrow">Agents</span>
          <strong>{{ totalAgents }}</strong>
          <span class="stat-description">Available to analyze and test</span>
        </div>
        <div class="stat-card hero-stat">
          <span class="eyebrow">Active</span>
          <strong>{{ activeAgents }}</strong>
          <span class="stat-description">Live or configured right now</span>
        </div>
        <div class="stat-card hero-stat">
          <span class="eyebrow">Prompt-ready</span>
          <strong>{{ promptReadyAgents }}</strong>
          <span class="stat-description">Ready for automated evaluation</span>
        </div>
      </div>
    </section>

    <section v-if="session.isGhlContext && !session.installed" class="section-card install-banner">
      <div class="install-copy">
        <span class="eyebrow">Authorization required</span>
        <h2>Connect VoiceIQ to your HighLevel account</h2>
        <p>
          VoiceIQ needs permission to inspect your voice agents and push optimized prompts back
          to HighLevel after review.
        </p>
      </div>
      <div class="install-actions">
        <a href="/auth/install" class="btn-primary btn-install">Authorize VoiceIQ</a>
        <p class="install-note">One-time setup. Your agents will appear here immediately after authorization.</p>
      </div>
    </section>

    <div v-if="loading" class="loading-state">Loading agents...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <section v-else class="section-card agents-section">
      <div class="section-header">
        <div>
          <h2 class="section-title">Agent workspace</h2>
          <p class="section-copy">
            Open any agent to analyze the prompt, generate tests, and compare optimization history.
          </p>
        </div>
        <span class="badge">{{ agents.length }} {{ agents.length === 1 ? 'agent' : 'agents' }}</span>
      </div>

      <div class="agents-grid">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="agent-card"
          @click="$router.push({ path: `/agents/${agent.id}`, query: { locationId: session.locationId } })"
        >
          <div class="agent-card-top">
            <div>
              <h3>{{ agent.name }}</h3>
              <p class="agent-phone">{{ agent.phone || 'No phone assigned' }}</p>
            </div>
            <span :class="['status-badge', agent.status]">{{ agent.status }}</span>
          </div>

          <p class="agent-prompt-preview">
            {{ agent.systemPrompt?.substring(0, 170) || 'No prompt configured for this agent yet.' }}
          </p>

          <div class="agent-meta">
            <span class="badge">{{ agent.language || 'Unknown language' }}</span>
            <span class="badge">{{ agent.actions?.length || 0 }} actions</span>
          </div>

          <div class="agent-card-footer">
            <span class="action-hint">Open workspace</span>
            <span class="action-arrow">→</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useSessionStore } from '@/stores/session.js';

const session = useSessionStore();
const agents = ref([]);
const loading = ref(true);
const error = ref('');
const demo = ref(false);

const totalAgents = computed(() => agents.value.length);
const activeAgents = computed(() =>
  agents.value.filter((agent) => ['active', 'configured'].includes(agent.status)).length
);
const promptReadyAgents = computed(() =>
  agents.value.filter((agent) => Boolean(agent.systemPrompt)).length
);

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
.dashboard-shell {
  gap: 24px;
}

.dashboard-hero {
  padding: 32px;
  border-radius: 32px;
}

.hero-header {
  margin-bottom: 24px;
}

.hero-copy {
  max-width: 760px;
}

.hero-badges {
  justify-content: flex-end;
}

.demo-badge {
  background: rgba(194, 122, 11, 0.14);
  color: #9a640e;
}

.hero-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.hero-stat {
  gap: 8px;
}

.hero-stat strong {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.04em;
}

.hero-stat .muted {
  font-size: 0.9rem;
}

.stat-description {
  display: block;
  max-width: 18ch;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.45;
}

.install-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(237, 244, 255, 0.96), rgba(255, 255, 255, 0.86));
}

.install-copy h2 {
  margin: 8px 0 10px;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}

.install-copy p {
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 56ch;
}

.install-actions {
  display: grid;
  justify-items: end;
  gap: 10px;
}

.btn-install {
  width: auto;
}

.install-note {
  color: var(--text-tertiary);
  font-size: 0.88rem;
}

.agents-section {
  gap: 24px;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.agent-card {
  display: grid;
  gap: 18px;
  min-height: 260px;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--border-soft);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.agent-card:hover {
  transform: translateY(-3px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.agent-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.agent-card h3 {
  font-size: 1.08rem;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-phone {
  margin-top: 6px;
  font-size: 0.88rem;
  color: var(--text-tertiary);
}

.agent-prompt-preview {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.58;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agent-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
}

.agent-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.action-hint {
  color: var(--accent-strong);
  font-weight: 600;
}

.action-arrow {
  color: var(--text-muted);
  font-size: 1.15rem;
}

@media (max-width: 900px) {
  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .install-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .install-actions {
    width: 100%;
    justify-items: stretch;
  }
}

@media (max-width: 640px) {
  .dashboard-hero {
    padding: 24px 20px;
    border-radius: 24px;
  }

  .hero-stats,
  .agents-grid {
    grid-template-columns: 1fr;
  }

  .agent-card {
    min-height: 0;
  }
}
</style>
