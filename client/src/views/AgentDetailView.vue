<template>
  <div class="agent-detail">
    <header class="detail-header">
      <button class="back-btn" @click="$router.push({ path: '/', query: { locationId: session.locationId } })">← Back</button>
      <div>
        <h1>{{ agent?.name || 'Loading...' }}</h1>
        <p class="subtitle">{{ agent?.businessName }}</p>
      </div>
      <span v-if="agent" :class="['status-badge', agent.status]">{{ agent.status }}</span>
    </header>

    <div v-if="loadingAgent" class="loading">Loading agent...</div>
    <div v-else-if="agentError" class="error">{{ agentError }}</div>

    <template v-else>
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Prompt Tab -->
      <div v-if="activeTab === 'prompt'" class="tab-content">
        <div class="prompt-section">
          <h3>System Prompt</h3>
          <pre class="prompt-box">{{ agent.systemPrompt || 'No prompt configured' }}</pre>
        </div>
        <div v-if="agent.welcomeMessage" class="prompt-section">
          <h3>Welcome Message</h3>
          <pre class="prompt-box">{{ agent.welcomeMessage }}</pre>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Phone</span>
            <span class="meta-value">{{ agent.phone || 'None' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Language</span>
            <span class="meta-value">{{ agent.language }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Max Call Duration</span>
            <span class="meta-value">{{ Math.floor(agent.maxCallDuration / 60) }} min</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Actions</span>
            <span class="meta-value">{{ agent.actions?.length || 0 }} configured</span>
          </div>
        </div>
      </div>

      <!-- Analysis Tab -->
      <div v-if="activeTab === 'analysis'" class="tab-content">
        <div v-if="!analysis && !loadingAnalysis" class="empty-state">
          <p>No analysis yet. Analyze this agent's prompt to identify goals, rules, flows, and potential weaknesses.</p>
          <button class="btn-primary" @click="runAnalysis" :disabled="!agent.systemPrompt">
            Analyze Prompt
          </button>
        </div>
        <div v-if="loadingAnalysis" class="loading">
          Analyzing prompt with GPT-4o... This may take 10-15 seconds.
        </div>
        <div v-if="analysisError" class="error">{{ analysisError }}</div>

        <div v-if="analysis" class="analysis-results">
          <div class="analysis-summary">
            <h3>Summary</h3>
            <p>{{ analysis.summary }}</p>
          </div>

          <div v-if="analysis.goals?.length" class="analysis-section">
            <h3>Goals ({{ analysis.goals.length }})</h3>
            <div v-for="goal in analysis.goals" :key="goal.id" class="analysis-item">
              <span :class="['priority-badge', goal.priority]">{{ goal.priority }}</span>
              <span>{{ goal.description }}</span>
            </div>
          </div>

          <div v-if="analysis.rules?.length" class="analysis-section">
            <h3>Rules ({{ analysis.rules.length }})</h3>
            <div v-for="rule in analysis.rules" :key="rule.id" class="analysis-item">
              <span class="category-badge">{{ rule.category }}</span>
              <span>{{ rule.description }}</span>
            </div>
          </div>

          <div v-if="analysis.conversationFlows?.length" class="analysis-section">
            <h3>Conversation Flows ({{ analysis.conversationFlows.length }})</h3>
            <div v-for="flow in analysis.conversationFlows" :key="flow.id" class="flow-card">
              <h4>{{ flow.name }}</h4>
              <ol>
                <li v-for="(step, i) in flow.steps" :key="i">{{ step }}</li>
              </ol>
              <p class="happy-path">Happy path: {{ flow.happyPath }}</p>
            </div>
          </div>

          <div v-if="analysis.dataCollection?.length" class="analysis-section">
            <h3>Data Collection ({{ analysis.dataCollection.length }})</h3>
            <div v-for="(item, i) in analysis.dataCollection" :key="i" class="analysis-item">
              <span :class="['required-badge', { required: item.required }]">
                {{ item.required ? 'Required' : 'Optional' }}
              </span>
              <strong>{{ item.field }}</strong> — {{ item.method }}
            </div>
          </div>

          <div v-if="analysis.boundaries?.length" class="analysis-section">
            <h3>Boundaries ({{ analysis.boundaries.length }})</h3>
            <div v-for="b in analysis.boundaries" :key="b.id" class="analysis-item">
              {{ b.description }}
            </div>
          </div>

          <div v-if="analysis.escalationTriggers?.length" class="analysis-section">
            <h3>Escalation Triggers ({{ analysis.escalationTriggers.length }})</h3>
            <div v-for="e in analysis.escalationTriggers" :key="e.id" class="analysis-item">
              <strong>Trigger:</strong> {{ e.trigger }}<br />
              <strong>Action:</strong> {{ e.action }}
            </div>
          </div>

          <div v-if="analysis.potentialWeaknesses?.length" class="analysis-section weaknesses">
            <h3>Potential Weaknesses ({{ analysis.potentialWeaknesses.length }})</h3>
            <div v-for="w in analysis.potentialWeaknesses" :key="w.id" class="analysis-item">
              <span :class="['severity-badge', w.severity]">{{ w.severity }}</span>
              <span>{{ w.description }}</span>
            </div>
          </div>

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

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div v-if="loadingHistory" class="loading">Loading history...</div>
        <div v-else-if="!testRuns.length && !optimizations.length" class="empty-state">
          <p>No test runs or optimizations yet. Analyze the agent first, then generate and run tests.</p>
        </div>
        <template v-else>
          <div v-if="testRuns.length" class="history-section">
            <h3>Test Runs ({{ testRuns.length }})</h3>
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
          </div>
          <div v-if="optimizations.length" class="history-section">
            <h3>Optimizations ({{ optimizations.length }})</h3>
            <div v-for="opt in optimizations" :key="opt.id" class="history-card" @click="$router.push({ path: `/optimizations/${opt.id}`, query: { locationId: session.locationId } })">
              <div class="history-card-header">
                <span :class="['opt-status', opt.status]">{{ opt.status }}</span>
                <span class="history-date">{{ formatDate(opt.created_at) }}</span>
              </div>
              <div class="history-card-body">
                <span>{{ opt.change_summary || 'Prompt optimization' }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
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
.agent-detail {
  padding: 32px 40px;
  max-width: 960px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.back-btn {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
}

.back-btn:hover {
  background: #f9fafb;
}

.detail-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.subtitle {
  color: #6b7280;
  font-size: 13px;
  margin: 2px 0 0 0;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  text-transform: uppercase;
  margin-left: auto;
}

.status-badge.active { background: #d1fae5; color: #065f46; }
.status-badge.configured { background: #dbeafe; color: #1e40af; }
.status-badge.inactive { background: #f3f4f6; color: #6b7280; }

.loading, .error {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
  font-size: 15px;
}

.error { color: #dc2626; }

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.tab {
  background: none;
  border: none;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tab:hover { color: #111827; }
.tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }

.tab-content { min-height: 300px; }

/* Prompt tab */
.prompt-section { margin-bottom: 24px; }
.prompt-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.prompt-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #374151;
  max-height: 400px;
  overflow-y: auto;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.meta-item {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.meta-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.meta-value {
  font-size: 14px;
  color: #111827;
}

/* Analysis tab */
.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
}

.empty-state p { margin-bottom: 16px; }

.btn-primary {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }

.btn-secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-secondary:hover { background: #f9fafb; }

.analysis-summary {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.analysis-summary h3 {
  font-size: 14px;
  font-weight: 600;
  color: #0369a1;
  margin: 0 0 8px 0;
}

.analysis-summary p {
  font-size: 14px;
  color: #374151;
  line-height: 1.5;
  margin: 0;
}

.analysis-section {
  margin-bottom: 24px;
}

.analysis-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.analysis-item {
  padding: 8px 12px;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
  border-left: 3px solid #e5e7eb;
  margin-bottom: 8px;
}

.weaknesses .analysis-item {
  border-left-color: #fbbf24;
  background: #fffbeb;
}

.priority-badge, .category-badge, .severity-badge, .required-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  margin-right: 8px;
}

.priority-badge.high { background: #fee2e2; color: #991b1b; }
.priority-badge.medium { background: #fef3c7; color: #92400e; }
.priority-badge.low { background: #f3f4f6; color: #6b7280; }

.severity-badge.high { background: #fee2e2; color: #991b1b; }
.severity-badge.medium { background: #fef3c7; color: #92400e; }
.severity-badge.low { background: #f3f4f6; color: #6b7280; }

.category-badge { background: #ede9fe; color: #5b21b6; }

.required-badge { background: #f3f4f6; color: #6b7280; }
.required-badge.required { background: #fee2e2; color: #991b1b; }

.flow-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.flow-card h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #111827;
}

.flow-card ol {
  margin: 0 0 8px 0;
  padding-left: 20px;
  font-size: 13px;
  color: #374151;
}

.flow-card li { margin-bottom: 4px; }

.happy-path {
  font-size: 12px;
  color: #059669;
  margin: 0;
  font-style: italic;
}

.analysis-actions {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

/* History tab */
.history-section { margin-bottom: 32px; }
.history-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
}

.history-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.history-card:hover { border-color: #3b82f6; }

.history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.history-card-body {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.history-date { font-size: 12px; color: #9ca3af; }

.history-score { font-weight: 600; color: #111827; }

.run-status, .opt-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
}

.run-status.completed, .opt-status.applied { background: #d1fae5; color: #065f46; }
.run-status.running { background: #dbeafe; color: #1e40af; }
.run-status.pending, .opt-status.pending { background: #f3f4f6; color: #6b7280; }
.run-status.failed { background: #fee2e2; color: #991b1b; }
.opt-status.approved { background: #dbeafe; color: #1e40af; }
.opt-status.rejected { background: #fee2e2; color: #991b1b; }

.history-verdicts { display: flex; gap: 8px; }
.v-pass { color: #059669; }
.v-fail { color: #dc2626; }
</style>
