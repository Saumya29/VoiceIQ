<template>
  <div class="page-shell page-shell-narrow stack">
    <header class="page-header runner-page-header">
      <div class="page-header-main">
        <button class="btn runner-back-btn" @click="$router.push({ path: `/agents/${agentId}`, query: { locationId: session.locationId } })">← Back</button>
        <div>
          <span class="page-kicker">Testing flywheel</span>
          <h1 class="page-heading">Test Runner</h1>
          <p class="page-subtitle">
            Generate high-signal scenarios, review the synthetic callers, and execute the full
            validation run against this agent.
          </p>
        </div>
      </div>
      <span v-if="retestRunId" class="badge">Re-test run</span>
    </header>

    <section class="stepper-shell surface-card">
      <div
        v-for="step in phaseSteps"
        :key="step.id"
        :class="['step-item', { active: activeStep === step.id, complete: completedSteps.includes(step.id) }]"
      >
        <span class="step-index">{{ step.index }}</span>
        <div>
          <strong>{{ step.title }}</strong>
          <p>{{ step.copy }}</p>
        </div>
      </div>
    </section>

    <div v-if="phase === 'loading'" class="loading-state">Creating re-test run...</div>

    <div v-if="phase === 'config'" class="stack">
      <section class="section-card stack">
        <div class="section-header">
          <div>
            <h2 class="section-title">Configure test generation</h2>
            <p class="section-copy">Choose the scenario mix and how much coverage you want per category.</p>
          </div>
        </div>

        <div class="category-grid">
          <label v-for="cat in availableCategories" :key="cat.id" class="category-tile">
            <input type="checkbox" v-model="selectedCategories" :value="cat.id" />
            <span class="category-check">{{ selectedCategories.includes(cat.id) ? '✓' : '' }}</span>
            <span class="category-copy">
              <strong>{{ cat.label }}</strong>
              <small>{{ cat.description }}</small>
            </span>
          </label>
        </div>

        <div class="config-controls">
          <div class="config-select-card">
            <label class="config-label">Cases per category</label>
            <select v-model="casesPerCategory" class="config-select">
              <option :value="1">1</option>
              <option :value="2">2</option>
              <option :value="3">3</option>
              <option :value="5">5</option>
            </select>
          </div>
          <div class="stat-card config-summary">
            <span class="eyebrow">Projected run</span>
            <strong>{{ selectedCategories.length * casesPerCategory }}</strong>
            <span class="muted">test cases across {{ selectedCategories.length }} categories</span>
          </div>
        </div>

        <div class="config-actions">
          <button
            class="btn-primary"
            @click="generateTests"
            :disabled="generating || selectedCategories.length === 0"
          >
            {{ generating ? 'Generating...' : 'Generate Test Cases' }}
          </button>
        </div>
      </section>

      <div v-if="generateError" class="error-state">{{ generateError }}</div>
    </div>

    <div v-if="phase === 'review'" class="stack">
      <section class="section-card review-hero">
        <div class="section-header">
          <div>
            <h2 class="section-title">Review test cases ({{ testCases.length }})</h2>
            <p class="section-copy">Tighten the generated scenarios before you start execution.</p>
          </div>
          <span class="badge">{{ testCases.length }} total</span>
        </div>
      </section>

      <section v-for="tc in testCases" :key="tc.id" class="section-card test-case-card">
        <div class="tc-header">
          <span class="badge tc-category">{{ formatCategory(tc.category) }}</span>
          <button class="btn edit-toggle" @click="toggleEdit(tc.id)">
            {{ editing === tc.id ? 'Done' : 'Edit' }}
          </button>
        </div>

        <template v-if="editing !== tc.id">
          <h3 class="tc-scenario">{{ tc.scenario }}</h3>
          <div class="tc-persona">
            <strong>{{ tc.persona?.name }}</strong> — {{ tc.persona?.personality }}
            <p>{{ tc.persona?.background }}</p>
            <p><em>Goal: {{ tc.persona?.goal }}</em></p>
          </div>
          <div class="tc-block">
            <span class="eyebrow">Opening message</span>
            <p>"{{ tc.opening_message }}"</p>
          </div>
          <div class="tc-block">
            <span class="eyebrow">Success criteria ({{ tc.success_criteria?.length }})</span>
            <div v-for="(c, i) in tc.success_criteria" :key="i" class="criterion">
              {{ c.description }} <span class="weight">({{ (c.weight * 100).toFixed(0) }}%)</span>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="edit-form">
            <label>Scenario</label>
            <input v-model="tc.scenario" class="edit-input" />
            <label>Opening Message</label>
            <input v-model="tc.opening_message" class="edit-input" />
            <label>Persona Name</label>
            <input v-model="tc.persona.name" class="edit-input" />
            <label>Personality</label>
            <input v-model="tc.persona.personality" class="edit-input" />
            <label>Goal</label>
            <input v-model="tc.persona.goal" class="edit-input" />
            <button class="btn-secondary" @click="saveEdit(tc)">Save Changes</button>
          </div>
        </template>
      </section>

      <div class="review-actions">
        <button class="btn-primary" @click="startExecution">
          Execute All Tests →
        </button>
        <button class="btn-secondary" @click="phase = 'config'">← Reconfigure</button>
      </div>
    </div>

    <div v-if="phase === 'execute'" class="stack">
      <section class="section-card execution-summary">
        <div class="execution-summary-top">
          <div>
            <h2 class="section-title">Executing tests</h2>
            <p class="section-copy">
              Running {{ testCases.length }} test cases. Results update here in real time.
            </p>
          </div>
          <div class="execution-metrics">
            <div class="stat-pill">
              <strong>{{ completedCount }}</strong>
              <span>completed</span>
            </div>
            <div class="stat-pill">
              <strong>{{ testCases.length }}</strong>
              <span>scheduled</span>
            </div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p class="progress-text">{{ completedCount }} / {{ testCases.length }} completed</p>
      </section>

      <section v-for="tc in testCases" :key="tc.id" class="section-card test-case-result">
        <div class="tc-result-header">
          <div class="tc-result-main">
            <span class="badge tc-category">{{ formatCategory(tc.category) }}</span>
            <span class="tc-result-scenario">{{ tc.scenario }}</span>
          </div>
          <span v-if="getResult(tc.id)" :class="['status-badge', getResult(tc.id).verdict]">
            {{ getResult(tc.id).verdict }}
          </span>
          <span v-else-if="executingCaseId === tc.id" class="status-badge running">Running</span>
          <span v-else class="status-badge pending">Pending</span>
        </div>
        <div v-if="getResult(tc.id)" class="tc-score">
          Score: {{ getResult(tc.id).overall_score }}%
        </div>
      </section>

      <section v-if="executionDone" class="section-card execution-done">
        <p>All tests completed.</p>
        <button class="btn-primary" @click="viewResults">View Full Results →</button>
      </section>
      <div v-if="executeError" class="error-state">{{ executeError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useSessionStore } from '@/stores/session.js';
import { buildApiUrl } from '../lib/api.js';

const route = useRoute();
const router = useRouter();
const agentId = route.params.agentId;
const session = useSessionStore();
const retestRunId = route.query.retestRunId || null;

const phase = ref(retestRunId ? 'loading' : 'config');
const generating = ref(false);
const generateError = ref('');

// If retestRunId is set, create a new run with same test cases and go to review
onMounted(async () => {
  if (!retestRunId) return;
  try {
    const res = await axios.post(`/api/v1/tests/runs/${retestRunId}/retest`, { locationId: session.locationId });
    testRun.value = res.data.testRun;
    testCases.value = res.data.testCases;
    phase.value = 'review';
  } catch (err) {
    generateError.value = 'Failed to create re-test: ' + (err.response?.data?.error || err.message);
    phase.value = 'config';
  }
});

const selectedCategories = ref(['happy_path', 'edge_case', 'adversarial']);
const casesPerCategory = ref(2);

const testRun = ref(null);
const testCases = ref([]);
const editing = ref(null);

const results = ref({});
const executingCaseId = ref(null);
const executionDone = ref(false);
const executeError = ref('');

const availableCategories = [
  { id: 'happy_path', label: 'Happy Path', description: 'Cooperative callers following expected flows' },
  { id: 'edge_case', label: 'Edge Cases', description: 'Unusual but valid scenarios' },
  { id: 'adversarial', label: 'Adversarial', description: 'Difficult, rude, or derailing callers' },
  { id: 'data_collection', label: 'Data Collection', description: 'Verify all required fields are collected' },
  { id: 'escalation', label: 'Escalation', description: 'Scenarios that should trigger escalation' },
];

const phaseSteps = [
  { id: 'config', index: '01', title: 'Configure', copy: 'Choose coverage and scenario categories.' },
  { id: 'review', index: '02', title: 'Review', copy: 'Refine synthetic callers before execution.' },
  { id: 'execute', index: '03', title: 'Execute', copy: 'Run the agent and stream results live.' },
];

const completedCount = computed(() => Object.keys(results.value).length);
const progressPercent = computed(() =>
  testCases.value.length ? (completedCount.value / testCases.value.length) * 100 : 0
);
const activeStep = computed(() => (phase.value === 'loading' ? 'config' : phase.value));
const completedSteps = computed(() => {
  if (phase.value === 'review') return ['config'];
  if (phase.value === 'execute') return ['config', 'review'];
  return [];
});

async function generateTests() {
  generating.value = true;
  generateError.value = '';
  try {
    const res = await axios.post('/api/v1/tests/generate', {
      locationId: session.locationId,
      agentId,
      categories: selectedCategories.value,
      casesPerCategory: casesPerCategory.value,
    });
    testRun.value = res.data.testRun;
    testCases.value = res.data.testCases;
    phase.value = 'review';
  } catch (err) {
    generateError.value = 'Failed to generate tests. ' + (err.response?.data?.error || err.message);
  } finally {
    generating.value = false;
  }
}

function toggleEdit(id) {
  editing.value = editing.value === id ? null : id;
}

function formatCategory(category) {
  return category.replace(/_/g, ' ');
}

async function saveEdit(tc) {
  try {
    await axios.put(`/api/v1/tests/cases/${tc.id}`, {
      persona: tc.persona,
      scenario: tc.scenario,
      successCriteria: tc.success_criteria,
      openingMessage: tc.opening_message,
    });
    editing.value = null;
  } catch (err) {
    alert('Failed to save: ' + (err.response?.data?.error || err.message));
  }
}

async function startExecution() {
  phase.value = 'execute';
  executeError.value = '';
  executionDone.value = false;

  // Connect to SSE stream
  const runId = testRun.value.id;
  const eventSource = new EventSource(
    buildApiUrl(`/api/v1/tests/runs/${runId}/stream?locationId=${encodeURIComponent(session.locationId)}`)
  );

  eventSource.addEventListener('test_case_started', (e) => {
    const data = JSON.parse(e.data);
    executingCaseId.value = data.testCaseId;
  });

  eventSource.addEventListener('test_case_completed', (e) => {
    const data = JSON.parse(e.data);
    results.value[data.testCaseId] = data;
    executingCaseId.value = null;
  });

  eventSource.addEventListener('run_completed', () => {
    executionDone.value = true;
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    if (e.data) {
      executeError.value = JSON.parse(e.data).message || 'Execution error';
    }
    eventSource.close();
  });

  eventSource.onerror = () => {
    if (!executionDone.value) {
      executeError.value = 'Connection to server lost.';
    }
    eventSource.close();
  };

  // Trigger execution
  try {
    await axios.post(`/api/v1/tests/runs/${runId}/execute`, { locationId: session.locationId });
  } catch (err) {
    executeError.value = 'Failed to start execution. ' + (err.response?.data?.error || err.message);
  }
}

function getResult(caseId) {
  return results.value[caseId] || null;
}

function viewResults() {
  router.push({ path: `/tests/${testRun.value.id}/results`, query: { locationId: session.locationId } });
}
</script>

<style scoped>
.runner-page-header {
  margin-bottom: 4px;
}

.runner-back-btn {
  width: auto;
  flex: 0 0 auto;
}

.stepper-shell {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 12px;
  border-radius: 28px;
}

.step-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  border-radius: 20px;
  color: var(--text-tertiary);
  background: rgba(248, 250, 252, 0.62);
  border: 1px solid transparent;
}

.step-item strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.step-item p {
  font-size: 0.88rem;
  line-height: 1.5;
}

.step-item.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(37, 99, 235, 0.18);
  box-shadow: var(--shadow-sm);
}

.step-item.complete .step-index {
  background: rgba(15, 159, 110, 0.16);
  color: #0d7a55;
}

.step-index {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 700;
  flex: 0 0 auto;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.category-tile {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-height: 120px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--border-soft);
  background: rgba(248, 250, 252, 0.78);
  cursor: pointer;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard),
    background-color var(--ease-standard);
}

.category-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.category-tile input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.category-tile:has(input:checked) {
  background: rgba(237, 244, 255, 0.96);
  border-color: rgba(37, 99, 235, 0.22);
}

.category-check {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-top: 2px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: transparent;
  font-size: 0.82rem;
  font-weight: 800;
  flex: 0 0 auto;
}

.category-tile:has(input:checked) .category-check {
  background: var(--accent);
  color: #fff;
}

.category-copy strong {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.category-copy small {
  display: block;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.55;
}

.config-controls {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.config-select-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--border-soft);
  background: rgba(248, 250, 252, 0.78);
}

.config-label {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.config-select,
.edit-input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-primary);
}

.config-summary {
  gap: 8px;
}

.config-summary strong {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.04em;
}

.config-actions,
.review-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.test-case-card {
  gap: 18px;
}

.tc-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.tc-category {
  text-transform: capitalize;
}

.edit-toggle {
  width: auto;
}

.tc-scenario {
  font-size: 1.1rem;
  line-height: 1.35;
  letter-spacing: -0.02em;
}

.tc-persona,
.tc-block p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.tc-persona p {
  margin-top: 6px;
}

.tc-block {
  display: grid;
  gap: 8px;
}

.criterion {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.76);
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.weight {
  color: var(--text-muted);
}

.edit-form {
  display: grid;
  gap: 10px;
}

.edit-form label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.execution-summary {
  position: sticky;
  top: 12px;
  z-index: 1;
}

.execution-summary-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.execution-metrics {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-pill {
  display: grid;
  gap: 4px;
  min-width: 110px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid var(--border-soft);
}

.stat-pill strong {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 1.2rem;
  line-height: 1;
}

.stat-pill span {
  font-size: 0.82rem;
  color: var(--text-tertiary);
}

.progress-bar-container {
  height: 10px;
  background: rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #60a5fa);
  border-radius: 999px;
  transition: width 220ms ease;
}

.progress-text {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.test-case-result {
  gap: 10px;
}

.tc-result-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
}

.tc-result-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tc-result-scenario {
  color: var(--text-primary);
  font-weight: 500;
}

.tc-score {
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.execution-done {
  display: grid;
  gap: 14px;
  justify-items: center;
  text-align: center;
}

.execution-done p {
  color: var(--success);
  font-size: 1rem;
  font-weight: 600;
}

@media (max-width: 900px) {
  .stepper-shell {
    grid-template-columns: 1fr;
  }

  .config-controls {
    grid-template-columns: 1fr;
  }

  .execution-summary-top,
  .tc-result-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .category-grid {
    grid-template-columns: 1fr;
  }

  .tc-header,
  .tc-result-main {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
