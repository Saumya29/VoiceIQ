<template>
  <div class="page-shell page-shell-narrow stack">
    <header class="page-header detail-page-header">
      <div class="page-header-main">
        <button class="btn detail-back-btn" @click="$router.push({ path: '/', query: { locationId: session.locationId } })">← Back</button>
        <div>
          <span class="page-kicker">Agent workspace</span>
          <h1 class="page-heading">{{ headerTitle }}</h1>
          <p class="page-subtitle">{{ headerSubtitle }}</p>
        </div>
      </div>
      <span v-if="agent" :class="['status-badge', agent.status]">{{ agent.status }}</span>
    </header>

    <div v-if="loadingAgent" class="loading-state">Loading agent details...</div>
    <div v-else-if="agentError" class="error-state">{{ agentError }}</div>

    <template v-else>
      <section class="detail-overview grid-auto">
        <div class="stat-card">
          <span class="eyebrow">Phone</span>
          <strong class="metric-value metric-value-mono">{{ agent.phone || 'Not assigned' }}</strong>
          <span class="muted">Connected line for this agent</span>
        </div>
        <div class="stat-card">
          <span class="eyebrow">Language</span>
          <strong class="metric-value">{{ formatLanguage(agent.language) }}</strong>
          <span class="muted">Primary language in the prompt</span>
        </div>
        <div class="stat-card">
          <span class="eyebrow">Runtime</span>
          <strong class="metric-value metric-value-mono">{{ Math.floor((agent.maxCallDuration || 0) / 60) }} min</strong>
          <span class="muted">Maximum call duration</span>
        </div>
      </section>

      <div class="tabs surface-card">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'prompt'" class="tab-content stack">
        <section class="section-card">
          <div class="section-header">
            <div>
              <h3 class="section-title">System prompt</h3>
              <p class="section-copy">The core prompt VoiceIQ will inspect, test, and refine.</p>
            </div>
          </div>
          <pre class="prompt-box">{{ agent.systemPrompt || 'No prompt configured' }}</pre>
        </section>

        <section v-if="agent.welcomeMessage" class="section-card">
          <div class="section-header">
            <div>
              <h3 class="section-title">Welcome message</h3>
              <p class="section-copy">The opening line callers hear before the conversation starts.</p>
            </div>
          </div>
          <pre class="prompt-box">{{ agent.welcomeMessage }}</pre>
        </section>

        <section class="section-card">
          <div class="section-header">
            <div>
              <h3 class="section-title">Configuration snapshot</h3>
              <p class="section-copy">Quick reference for the current agent setup.</p>
            </div>
          </div>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Phone</span>
              <span class="meta-value">{{ agent.phone || 'None' }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Language</span>
              <span class="meta-value">{{ formatLanguage(agent.language) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Max Call Duration</span>
              <span class="meta-value">{{ Math.floor((agent.maxCallDuration || 0) / 60) }} min</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Actions</span>
              <span class="meta-value">{{ formatActions(agent.actions) }}</span>
            </div>
          </div>
        </section>
      </div>

      <div v-if="activeTab === 'analysis'" class="tab-content stack">
        <div v-if="!analysis && !loadingAnalysis" class="empty-state">
          <p>No analysis yet. Analyze this agent's prompt to identify goals, rules, flows, and potential weaknesses.</p>
          <button class="btn-primary" @click="runAnalysis" :disabled="!agent.systemPrompt">
            Analyze Prompt
          </button>
        </div>
        <div v-if="loadingAnalysis" class="loading-state">
          Analyzing prompt with GPT-4o... This may take 10-15 seconds.
        </div>
        <div v-if="analysisError" class="error-state">{{ analysisError }}</div>

        <div v-if="analysis" class="analysis-results stack">
          <section class="section-card analysis-summary">
            <div class="section-header">
              <div>
                <h3 class="section-title">Summary</h3>
                <p class="section-copy">A synthesized read of the current prompt and likely performance gaps.</p>
              </div>
            </div>
            <p>{{ analysis.summary }}</p>
          </section>

          <section v-if="analysis.goals?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Goals ({{ analysis.goals.length }})</h3>
            </div>
            <div v-for="goal in analysis.goals" :key="goal.id" class="analysis-item">
              <span :class="['priority-badge', goal.priority]">{{ goal.priority }}</span>
              <span>{{ goal.description }}</span>
            </div>
          </section>

          <section v-if="analysis.rules?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Rules ({{ analysis.rules.length }})</h3>
            </div>
            <div v-for="rule in analysis.rules" :key="rule.id" class="analysis-item">
              <span class="category-badge">{{ rule.category }}</span>
              <span>{{ rule.description }}</span>
            </div>
          </section>

          <section v-if="analysis.conversationFlows?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Conversation Flows ({{ analysis.conversationFlows.length }})</h3>
            </div>
            <div v-for="flow in analysis.conversationFlows" :key="flow.id" class="flow-card">
              <h4>{{ flow.name }}</h4>
              <ol>
                <li v-for="(step, i) in flow.steps" :key="i">{{ step }}</li>
              </ol>
              <p class="happy-path">Happy path: {{ flow.happyPath }}</p>
            </div>
          </section>

          <section v-if="analysis.dataCollection?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Data Collection ({{ analysis.dataCollection.length }})</h3>
            </div>
            <div v-for="(item, i) in analysis.dataCollection" :key="i" class="analysis-item">
              <span :class="['required-badge', { required: item.required }]">
                {{ item.required ? 'Required' : 'Optional' }}
              </span>
              <strong>{{ item.field }}</strong> — {{ item.method }}
            </div>
          </section>

          <section v-if="analysis.boundaries?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Boundaries ({{ analysis.boundaries.length }})</h3>
            </div>
            <div v-for="b in analysis.boundaries" :key="b.id" class="analysis-item">
              {{ b.description }}
            </div>
          </section>

          <section v-if="analysis.escalationTriggers?.length" class="section-card analysis-section">
            <div class="section-header">
              <h3 class="section-title">Escalation Triggers ({{ analysis.escalationTriggers.length }})</h3>
            </div>
            <div v-for="e in analysis.escalationTriggers" :key="e.id" class="analysis-item">
              <strong>Trigger:</strong> {{ e.trigger }}<br />
              <strong>Action:</strong> {{ e.action }}
            </div>
          </section>

          <section v-if="analysis.potentialWeaknesses?.length" class="section-card analysis-section weaknesses">
            <div class="section-header">
              <h3 class="section-title">Potential Weaknesses ({{ analysis.potentialWeaknesses.length }})</h3>
            </div>
            <div v-for="w in analysis.potentialWeaknesses" :key="w.id" class="analysis-item">
              <span :class="['severity-badge', w.severity]">{{ w.severity }}</span>
              <span>{{ w.description }}</span>
            </div>
          </section>

          <div class="analysis-actions">
            <button class="btn-primary" @click="$router.push({ path: `/agents/${agentId}/test`, query: { locationId: session.locationId } })">
              Generate Tests →
            </button>
            <button class="btn-secondary" @click="runAnalysis">
              Re-analyze
            </button>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'history'" class="tab-content stack">
        <div v-if="loadingHistory" class="loading-state">Loading history...</div>
        <div v-else-if="!testRuns.length && !optimizations.length" class="empty-state">
          <p>No test runs or optimizations yet. Analyze the agent first, then generate and run tests.</p>
        </div>
        <template v-else>
          <section v-if="testRuns.length" class="section-card history-section">
            <div class="section-header">
              <h3 class="section-title">Test Runs ({{ testRuns.length }})</h3>
            </div>
            <div v-for="run in testRuns" :key="run.id" class="history-card" @click="$router.push({ path: `/tests/${run.id}/results`, query: { locationId: session.locationId } })">
              <div class="history-card-header">
                <span :class="['run-status', run.status]">{{ run.status }}</span>
                <span class="history-date">{{ formatDate(run.created_at) }}</span>
              </div>
              <div class="history-card-body">
                <span class="history-score" v-if="run.overall_score != null">Score: {{ run.overall_score }}%</span>
                <span class="history-cases">{{ run.completed_cases || 0 }}/{{ run.total_cases }} cases</span>
                <span class="history-verdicts">
                  <span class="v-pass" v-if="run.passed">{{ run.passed }} passed</span>
                  <span class="v-fail" v-if="run.failed">{{ run.failed }} failed</span>
                </span>
              </div>
            </div>
          </section>

          <section v-if="optimizations.length" class="section-card history-section">
            <div class="section-header">
              <h3 class="section-title">Optimizations ({{ optimizations.length }})</h3>
            </div>
            <div v-for="opt in optimizations" :key="opt.id" class="history-card" @click="$router.push({ path: `/optimizations/${opt.id}`, query: { locationId: session.locationId } })">
              <div class="history-card-header">
                <span :class="['opt-status', opt.status]">{{ opt.status }}</span>
                <span class="history-date">{{ formatDate(opt.created_at) }}</span>
              </div>
              <div class="history-card-body">
                <span>{{ opt.change_summary || 'Prompt optimization' }}</span>
              </div>
            </div>
          </section>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { useSessionStore } from '@/stores/session.js';

const route = useRoute();
const session = useSessionStore();
const agentId = route.params.agentId;

const agent = ref(null);
const loadingAgent = ref(true);
const agentError = ref('');

const analysis = ref(null);
const loadingAnalysis = ref(false);
const analysisError = ref('');

const testRuns = ref([]);
const optimizations = ref([]);
const loadingHistory = ref(false);

const activeTab = ref('prompt');
const tabs = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'history', label: 'History' },
];

const headerTitle = computed(() => {
  if (loadingAgent.value) return 'Agent workspace';
  return agent.value?.name || 'Agent workspace';
});

const headerSubtitle = computed(() => {
  if (loadingAgent.value) {
    return 'Loading agent configuration, prompt details, and optimization history.';
  }
  return agent.value?.businessName || 'Voice agent details and optimization history';
});

onMounted(async () => {
  try {
    const res = await axios.get(`/api/v1/agents/${agentId}`, {
      params: { locationId: session.locationId },
    });
    agent.value = res.data.agent;
  } catch (err) {
    agentError.value = 'Failed to load agent.';
  } finally {
    loadingAgent.value = false;
  }

  loadingHistory.value = true;
  try {
    const [runsRes, optRes] = await Promise.all([
      axios.get('/api/v1/tests/runs', { params: { agentId } }),
      axios.get('/api/v1/optimizations', { params: { agentId } }),
    ]);
    testRuns.value = runsRes.data.runs || [];
    optimizations.value = optRes.data.optimizations || [];
  } catch (err) {
    console.error('Failed to load history:', err);
  } finally {
    loadingHistory.value = false;
  }
});

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatLanguage(language) {
  if (!language) return 'Unspecified';
  if (language === 'en-US') return 'English (US)';
  return language;
}

function formatActions(actions) {
  const count = actions?.length || 0;
  return count ? `${count} configured` : 'None configured';
}

async function runAnalysis() {
  loadingAnalysis.value = true;
  analysisError.value = '';
  try {
    const res = await axios.get(`/api/v1/agents/${agentId}/analysis`, {
      params: { locationId: session.locationId },
    });
    analysis.value = res.data.analysis;
    activeTab.value = 'analysis';
  } catch (err) {
    analysisError.value = 'Failed to analyze agent. ' + (err.response?.data?.error || '');
  } finally {
    loadingAnalysis.value = false;
  }
}
</script>

<style scoped>
.detail-page-header {
  margin-bottom: 8px;
}

.detail-back-btn {
  width: auto;
  flex: 0 0 auto;
}

.detail-overview {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-overview .stat-card {
  gap: 10px;
}

.metric-value {
  font-size: 1.35rem;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.metric-value-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}

.tabs {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-radius: 24px;
  overflow-x: auto;
}

.tab {
  flex: 1 0 0;
  border: none;
  border-radius: 18px;
  padding: 14px 20px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color var(--ease-standard), color var(--ease-standard), box-shadow var(--ease-standard);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.tab-content {
  min-height: 300px;
}

.prompt-box {
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid var(--border-soft);
  border-radius: 20px;
  padding: 20px;
  font-size: 0.94rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--text-secondary);
  max-height: 460px;
  overflow-y: auto;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.meta-item {
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 16px;
}

.meta-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.meta-value {
  font-size: 0.98rem;
  color: var(--text-primary);
}

.analysis-summary {
  background: linear-gradient(135deg, rgba(237, 244, 255, 0.94), rgba(255, 255, 255, 0.88));
}

.analysis-summary p {
  font-size: 0.98rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.analysis-item {
  padding: 12px 14px;
  font-size: 0.94rem;
  color: var(--text-secondary);
  line-height: 1.5;
  border-left: 3px solid rgba(148, 163, 184, 0.26);
  margin-bottom: 10px;
  border-radius: 0 16px 16px 0;
  background: rgba(248, 250, 252, 0.75);
}

.weaknesses .analysis-item {
  border-left-color: rgba(194, 122, 11, 0.4);
  background: rgba(255, 246, 232, 0.88);
}

.priority-badge,
.category-badge,
.severity-badge,
.required-badge {
  display: inline-block;
  font-size: 0.66rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  margin-right: 8px;
  letter-spacing: 0.06em;
}

.priority-badge.high,
.severity-badge.high,
.required-badge.required {
  background: rgba(209, 67, 67, 0.14);
  color: #b42323;
}

.priority-badge.medium,
.severity-badge.medium {
  background: rgba(194, 122, 11, 0.14);
  color: #9a640e;
}

.priority-badge.low,
.severity-badge.low,
.required-badge {
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
}

.category-badge {
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent-strong);
}

.flow-card {
  background: rgba(248, 250, 252, 0.8);
  border: 1px solid var(--border-soft);
  border-radius: 20px;
  padding: 18px;
  margin-bottom: 12px;
}

.flow-card h4 {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.flow-card ol {
  margin: 0 0 12px 18px;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.5;
}

.happy-path {
  font-size: 0.88rem;
  color: var(--text-tertiary);
}

.analysis-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.history-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  margin-bottom: 12px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  background: rgba(248, 250, 252, 0.82);
  cursor: pointer;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.history-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.history-card-body {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 0.92rem;
  color: var(--text-secondary);
}

.history-date {
  font-size: 0.84rem;
  color: var(--text-muted);
}

.history-score {
  font-weight: 600;
  color: var(--text-primary);
}

.run-status,
.opt-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.run-status.completed,
.opt-status.applied {
  background: rgba(15, 159, 110, 0.12);
  color: #0d7a55;
}

.run-status.running,
.opt-status.approved {
  background: rgba(37, 99, 235, 0.12);
  color: var(--accent-strong);
}

.run-status.pending {
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
}

.run-status.failed,
.opt-status.rejected {
  background: rgba(209, 67, 67, 0.13);
  color: #b42323;
}

.history-verdicts {
  display: flex;
  gap: 8px;
}

.v-pass {
  color: var(--success);
}

.v-fail {
  color: var(--danger);
}

@media (max-width: 900px) {
  .detail-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .detail-overview {
    grid-template-columns: 1fr;
  }

  .tabs {
    padding: 6px;
  }

  .tab {
    min-width: 140px;
    flex: 0 0 auto;
    padding: 12px 16px;
  }

  .analysis-actions {
    justify-content: stretch;
  }

  .history-card-header,
  .history-card-body {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
