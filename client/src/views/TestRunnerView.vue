<template>
  <div class="test-runner">
    <header class="runner-header">
      <button class="back-btn" @click="$router.push({ path: `/agents/${agentId}`, query: { locationId } })">← Back</button>
      <h1>Test Runner</h1>
    </header>

    <!-- Retest loading -->
    <div v-if="phase === 'loading'" class="loading">Creating re-test run...</div>

    <!-- Phase 1: Config -->
    <div v-if="phase === 'config'" class="phase-config">
      <h2>Configure Test Generation</h2>
      <p class="phase-desc">Select test categories and how many cases to generate per category.</p>

      <div class="config-section">
        <label class="config-label">Categories</label>
        <div class="checkbox-group">
          <label v-for="cat in availableCategories" :key="cat.id" class="checkbox-item">
            <input type="checkbox" v-model="selectedCategories" :value="cat.id" />
            <span>
              <strong>{{ cat.label }}</strong>
              <small>{{ cat.description }}</small>
            </span>
          </label>
        </div>
      </div>

      <div class="config-section">
        <label class="config-label">Cases per category</label>
        <select v-model="casesPerCategory" class="config-select">
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="5">5</option>
        </select>
      </div>

      <div class="config-summary">
        Total: {{ selectedCategories.length * casesPerCategory }} test cases across {{ selectedCategories.length }} categories
      </div>

      <button
        class="btn-primary"
        @click="generateTests"
        :disabled="generating || selectedCategories.length === 0"
      >
        {{ generating ? 'Generating...' : 'Generate Test Cases' }}
      </button>
      <div v-if="generateError" class="error">{{ generateError }}</div>
    </div>

    <!-- Phase 2: Review -->
    <div v-if="phase === 'review'" class="phase-review">
      <div class="review-header">
        <h2>Review Test Cases ({{ testCases.length }})</h2>
        <p class="phase-desc">Review and edit generated test cases before execution.</p>
      </div>

      <div v-for="tc in testCases" :key="tc.id" class="test-case-card">
        <div class="tc-header">
          <span class="tc-category">{{ tc.category }}</span>
          <button class="edit-toggle" @click="toggleEdit(tc.id)">
            {{ editing === tc.id ? 'Done' : 'Edit' }}
          </button>
        </div>

        <template v-if="editing !== tc.id">
          <h4>{{ tc.scenario }}</h4>
          <div class="tc-persona">
            <strong>{{ tc.persona?.name }}</strong> — {{ tc.persona?.personality }}
            <p>{{ tc.persona?.background }}</p>
            <p><em>Goal: {{ tc.persona?.goal }}</em></p>
          </div>
          <div class="tc-opening">
            <span class="label">Opening:</span> "{{ tc.opening_message }}"
          </div>
          <div class="tc-criteria">
            <span class="label">Criteria ({{ tc.success_criteria?.length }}):</span>
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
      </div>

      <div class="review-actions">
        <button class="btn-primary" @click="startExecution">
          Execute All Tests →
        </button>
        <button class="btn-secondary" @click="phase = 'config'">← Reconfigure</button>
      </div>
    </div>

    <!-- Phase 3: Execution -->
    <div v-if="phase === 'execute'" class="phase-execute">
      <h2>Executing Tests...</h2>
      <p class="phase-desc">Running {{ testCases.length }} test cases. Results will appear in real-time.</p>

      <div class="progress-bar-container">
        <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-text">{{ completedCount }} / {{ testCases.length }} completed</p>

      <div v-for="tc in testCases" :key="tc.id" class="test-case-result">
        <div class="tc-result-header">
          <span class="tc-category">{{ tc.category }}</span>
          <span>{{ tc.scenario }}</span>
          <span v-if="getResult(tc.id)" :class="['verdict-badge', getResult(tc.id).verdict]">
            {{ getResult(tc.id).verdict }}
          </span>
          <span v-else-if="executingCaseId === tc.id" class="running-indicator">Running...</span>
          <span v-else class="pending-indicator">Pending</span>
        </div>
        <div v-if="getResult(tc.id)" class="tc-score">
          Score: {{ getResult(tc.id).overall_score }}%
        </div>
      </div>

      <div v-if="executionDone" class="execution-done">
        <p>All tests completed!</p>
        <button class="btn-primary" @click="viewResults">View Full Results →</button>
      </div>
      <div v-if="executeError" class="error">{{ executeError }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const agentId = route.params.agentId;
const locationId = route.query.locationId || new URLSearchParams(window.location.search).get('locationId') || 'demo';
const retestRunId = route.query.retestRunId || null;

const phase = ref(retestRunId ? 'loading' : 'config');
const generating = ref(false);
const generateError = ref('');

// If retestRunId is set, create a new run with same test cases and go to review
onMounted(async () => {
  if (!retestRunId) return;
  try {
    const res = await axios.post(`/api/v1/tests/runs/${retestRunId}/retest`, { locationId });
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

const completedCount = computed(() => Object.keys(results.value).length);
const progressPercent = computed(() =>
  testCases.value.length ? (completedCount.value / testCases.value.length) * 100 : 0
);

async function generateTests() {
  generating.value = true;
  generateError.value = '';
  try {
    const res = await axios.post('/api/v1/tests/generate', {
      locationId,
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
  const eventSource = new EventSource(`/api/v1/tests/runs/${runId}/stream?locationId=${locationId}`);

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
    await axios.post(`/api/v1/tests/runs/${runId}/execute`, { locationId });
  } catch (err) {
    executeError.value = 'Failed to start execution. ' + (err.response?.data?.error || err.message);
  }
}

function getResult(caseId) {
  return results.value[caseId] || null;
}

function viewResults() {
  router.push({ path: `/tests/${testRun.value.id}/results`, query: { locationId } });
}
</script>

<style scoped>
.test-runner {
  padding: 32px 40px;
  max-width: 960px;
  margin: 0 auto;
}

.runner-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.runner-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
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

.back-btn:hover { background: #f9fafb; }

h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
}

.phase-desc {
  color: #6b7280;
  font-size: 14px;
  margin: 0 0 24px 0;
}

/* Config phase */
.config-section { margin-bottom: 20px; }

.config-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.checkbox-group { display: flex; flex-direction: column; gap: 8px; }

.checkbox-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.checkbox-item input { margin-top: 3px; }

.checkbox-item strong { display: block; font-size: 14px; color: #111827; }
.checkbox-item small { display: block; font-size: 12px; color: #6b7280; }

.config-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.config-summary {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
}

/* Review phase */
.review-header { margin-bottom: 16px; }

.test-case-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tc-category {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  background: #ede9fe;
  color: #5b21b6;
}

.edit-toggle {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #374151;
}

.edit-toggle:hover { background: #f9fafb; }

.test-case-card h4 {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.tc-persona {
  font-size: 13px;
  color: #374151;
  margin-bottom: 8px;
  line-height: 1.5;
}

.tc-persona p { margin: 2px 0; }

.tc-opening, .tc-criteria {
  font-size: 13px;
  color: #374151;
  margin-bottom: 8px;
}

.label {
  font-weight: 600;
  color: #6b7280;
  font-size: 12px;
}

.criterion {
  padding: 4px 0 4px 12px;
  border-left: 2px solid #e5e7eb;
  margin: 4px 0;
  font-size: 13px;
}

.weight {
  color: #9ca3af;
  font-size: 11px;
}

/* Edit form */
.edit-form { display: flex; flex-direction: column; gap: 8px; }

.edit-form label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.edit-input {
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.review-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

/* Execute phase */
.progress-bar-container {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 20px;
}

.test-case-result {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
}

.tc-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.verdict-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  margin-left: auto;
}

.verdict-badge.pass { background: #d1fae5; color: #065f46; }
.verdict-badge.partial { background: #fef3c7; color: #92400e; }
.verdict-badge.fail { background: #fee2e2; color: #991b1b; }

.running-indicator {
  margin-left: auto;
  font-size: 12px;
  color: #3b82f6;
  font-weight: 500;
}

.pending-indicator {
  margin-left: auto;
  font-size: 12px;
  color: #9ca3af;
}

.tc-score {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  padding-left: 80px;
}

.execution-done {
  text-align: center;
  padding: 24px;
  margin-top: 16px;
}

.execution-done p {
  font-size: 16px;
  font-weight: 600;
  color: #059669;
  margin-bottom: 12px;
}

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

.error {
  color: #dc2626;
  font-size: 14px;
  margin-top: 12px;
}

.loading {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
  font-size: 15px;
}
</style>
