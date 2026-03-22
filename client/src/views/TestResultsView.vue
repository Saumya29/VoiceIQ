<template>
  <div class="test-results">
    <header class="results-header">
      <button class="back-btn" @click="$router.back()">← Back</button>
      <h1>Test Results</h1>
    </header>

    <div v-if="loading" class="loading">Loading results...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!-- KPI Dashboard -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-value" :class="scoreClass">{{ run.overall_score ?? '—' }}%</span>
          <span class="kpi-label">Overall Score</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value pass">{{ run.passed }}</span>
          <span class="kpi-label">Passed</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value partial">{{ run.partial }}</span>
          <span class="kpi-label">Partial</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value fail">{{ run.failed }}</span>
          <span class="kpi-label">Failed</span>
        </div>
      </div>

      <!-- Results list -->
      <div v-for="tc in testCases" :key="tc.id" class="result-card" @click="toggleExpand(tc.id)">
        <div class="result-header">
          <span class="tc-category">{{ tc.category }}</span>
          <span class="result-scenario">{{ tc.scenario }}</span>
          <span v-if="getResult(tc.id)" :class="['verdict-badge', getResult(tc.id).verdict]">
            {{ getResult(tc.id).verdict }} — {{ getResult(tc.id).overall_score }}%
          </span>
        </div>

        <div v-if="expanded === tc.id && getResult(tc.id)" class="result-detail">
          <div class="criteria-results">
            <h4>Criteria Results</h4>
            <div v-for="(cr, i) in getResult(tc.id).criteria_results" :key="i" class="criterion-result">
              <span :class="['cr-badge', cr.passed ? 'pass' : 'fail']">{{ cr.passed ? 'PASS' : 'FAIL' }}</span>
              <span>{{ cr.description }}</span>
              <p v-if="cr.reasoning" class="cr-reasoning">{{ cr.reasoning }}</p>
            </div>
          </div>

          <div class="conversation">
            <h4>Conversation ({{ getResult(tc.id).turn_count }} turns)</h4>
            <div v-for="(turn, i) in getResult(tc.id).conversation" :key="i" :class="['turn', turn.role]">
              <span class="turn-role">{{ turn.role === 'agent' ? 'Agent' : 'Caller' }}</span>
              <p>{{ turn.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="results-actions">
        <button class="btn-primary" @click="generateOptimization" :disabled="optimizing">
          {{ optimizing ? 'Generating...' : 'Generate Optimization →' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const runId = route.params.runId;
const locationId = route.query.locationId || 'demo';

const loading = ref(true);
const error = ref('');
const run = ref({});
const testCases = ref([]);
const results = ref([]);
const expanded = ref(null);

const scoreClass = computed(() => {
  const s = run.value.overall_score;
  if (s >= 80) return 'pass';
  if (s >= 50) return 'partial';
  return 'fail';
});

onMounted(async () => {
  try {
    const res = await axios.get(`/api/v1/tests/runs/${runId}`);
    run.value = res.data.run;
    testCases.value = res.data.testCases;
    results.value = res.data.results;
  } catch (err) {
    error.value = 'Failed to load results.';
  } finally {
    loading.value = false;
  }
});

function getResult(caseId) {
  return results.value.find(r => r.test_case_id === caseId) || null;
}

function toggleExpand(id) {
  expanded.value = expanded.value === id ? null : id;
}

const optimizing = ref(false);

async function generateOptimization() {
  optimizing.value = true;
  try {
    const res = await axios.post('/api/v1/optimizations/generate', {
      runId,
      locationId,
    });
    router.push({
      path: `/optimizations/${res.data.optimization.id}`,
      query: { locationId },
    });
  } catch (err) {
    alert('Failed to generate optimization: ' + (err.response?.data?.error || err.message));
  } finally {
    optimizing.value = false;
  }
}
</script>

<style scoped>
.test-results {
  padding: 32px 40px;
  max-width: 960px;
  margin: 0 auto;
}

.results-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.results-header h1 {
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

.loading, .error {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
  font-size: 15px;
}

.error { color: #dc2626; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.kpi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.kpi-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
}

.kpi-value.pass { color: #059669; }
.kpi-value.partial { color: #d97706; }
.kpi-value.fail { color: #dc2626; }

.kpi-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.result-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
  cursor: pointer;
}

.result-card:hover { border-color: #93c5fd; }

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
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

.result-scenario { flex: 1; }

.verdict-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.verdict-badge.pass { background: #d1fae5; color: #065f46; }
.verdict-badge.partial { background: #fef3c7; color: #92400e; }
.verdict-badge.fail { background: #fee2e2; color: #991b1b; }

.result-detail {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.result-detail h4 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.criterion-result {
  padding: 6px 0;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.cr-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.cr-badge.pass { background: #d1fae5; color: #065f46; }
.cr-badge.fail { background: #fee2e2; color: #991b1b; }

.cr-reasoning {
  width: 100%;
  font-size: 12px;
  color: #6b7280;
  margin: 2px 0 0 36px;
  font-style: italic;
}

.conversation {
  margin-top: 16px;
}

.turn {
  padding: 8px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.turn.agent { background: #eff6ff; }
.turn.caller { background: #f9fafb; }

.turn-role {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  display: block;
  margin-bottom: 2px;
}

.turn p { margin: 0; color: #374151; }

.results-actions {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
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
</style>
