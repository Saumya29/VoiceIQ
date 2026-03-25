<template>
  <div class="page-shell page-shell-narrow stack">
    <header class="page-header results-page-header">
      <div class="page-header-main">
        <button class="btn results-back-btn" @click="$router.back()">← Back</button>
        <div>
          <span class="page-kicker">Validation results</span>
          <h1 class="page-heading">Test Results</h1>
          <p class="page-subtitle">
            Review pass rates, inspect failures, and decide whether this prompt is ready for optimization.
          </p>
        </div>
      </div>
      <span v-if="run.status" :class="['status-badge', run.status]">{{ run.status }}</span>
    </header>

    <div v-if="loading" class="loading-state">Loading results...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <template v-else>
      <section class="results-hero surface-card">
        <div class="hero-top">
          <div>
            <span class="eyebrow">Run summary</span>
            <h2 class="hero-score-title">Overall performance</h2>
          </div>
          <div class="hero-score-block">
            <span class="hero-score" :class="scoreClass">{{ run.overall_score ?? '—' }}%</span>
            <span class="muted">{{ results.length }} evaluated scenarios</span>
          </div>
        </div>

        <div v-if="parentRun" class="before-after">
          <div class="before-after-header">
            <h3>Before / After Comparison</h3>
            <span class="badge">{{ scoreDelta > 0 ? 'Improving' : scoreDelta < 0 ? 'Regression' : 'Flat' }}</span>
          </div>
          <div class="ba-grid">
            <div class="ba-card">
              <span class="ba-label">Before</span>
              <span class="ba-score" :class="baScoreClass(parentRun.overall_score)">{{ parentRun.overall_score ?? '—' }}%</span>
              <div class="ba-stats">
                <span class="pass">{{ parentRun.passed }} pass</span>
                <span class="partial">{{ parentRun.partial }} partial</span>
                <span class="fail">{{ parentRun.failed }} fail</span>
              </div>
            </div>
            <div class="ba-card">
              <span class="ba-label">After</span>
              <span class="ba-score" :class="baScoreClass(run.overall_score)">{{ run.overall_score ?? '—' }}%</span>
              <div class="ba-stats">
                <span class="pass">{{ run.passed }} pass</span>
                <span class="partial">{{ run.partial }} partial</span>
                <span class="fail">{{ run.failed }} fail</span>
              </div>
            </div>
            <div class="ba-delta" :class="deltaClass">
              {{ scoreDelta > 0 ? '+' : '' }}{{ scoreDelta }}% {{ scoreDelta > 0 ? 'improvement' : scoreDelta < 0 ? 'regression' : 'no change' }}
            </div>
          </div>

          <div v-if="confidence" class="confidence-banner" :class="confidence.level">
            <span class="confidence-label">Deployment confidence: {{ confidence.level.toUpperCase() }}</span>
            <span class="confidence-detail">{{ confidence.detail }}</span>
          </div>
        </div>
      </section>

      <section class="kpi-grid">
        <div class="stat-card kpi-card">
          <span class="eyebrow">Overall Score</span>
          <strong class="kpi-value" :class="scoreClass">{{ run.overall_score ?? '—' }}%</strong>
          <span class="muted">Weighted performance across all criteria</span>
        </div>
        <div class="stat-card kpi-card">
          <span class="eyebrow">Passed</span>
          <strong class="kpi-value pass">{{ run.passed }}</strong>
          <span class="muted">Scenarios meeting expectations</span>
        </div>
        <div class="stat-card kpi-card">
          <span class="eyebrow">Partial</span>
          <strong class="kpi-value partial">{{ run.partial }}</strong>
          <span class="muted">Scenarios needing refinement</span>
        </div>
        <div class="stat-card kpi-card">
          <span class="eyebrow">Failed</span>
          <strong class="kpi-value fail">{{ run.failed }}</strong>
          <span class="muted">Scenarios blocking deployment</span>
        </div>
      </section>

      <section class="stack">
        <div
          v-for="tc in testCases"
          :key="tc.id"
          class="section-card result-card"
          @click="toggleExpand(tc.id)"
        >
          <div class="result-header">
            <div class="result-main">
              <span class="badge tc-category">{{ formatCategory(tc.category) }}</span>
              <span class="result-scenario">{{ tc.scenario }}</span>
            </div>
            <div class="result-status">
              <span v-if="getResult(tc.id)" :class="['status-badge', getResult(tc.id).verdict]">
                {{ getResult(tc.id).verdict }} {{ getResult(tc.id).overall_score }}%
              </span>
              <span class="expand-indicator">{{ expanded === tc.id ? '−' : '+' }}</span>
            </div>
          </div>

          <div v-if="expanded === tc.id && getResult(tc.id)" class="result-detail">
            <div class="criteria-results">
              <h4>Criteria Results</h4>
              <div v-for="(cr, i) in getResult(tc.id).criteria_results" :key="i" class="criterion-result">
                <span :class="['status-badge', cr.passed ? 'pass' : 'fail']">
                  {{ cr.passed ? 'PASS' : 'FAIL' }}
                </span>
                <span class="criterion-copy">{{ cr.description }}</span>
                <p v-if="cr.reasoning" class="cr-reasoning">{{ cr.reasoning }}</p>
                <p v-if="cr.suggestion && !cr.passed" class="cr-suggestion">Fix: {{ cr.suggestion }}</p>
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
      </section>

      <section class="section-card results-actions">
        <div class="section-header">
          <div>
            <h2 class="section-title">Next step</h2>
            <p class="section-copy">Generate an optimized prompt based on the failures surfaced in this run.</p>
          </div>
        </div>
        <button class="btn-primary" @click="generateOptimization" :disabled="optimizing">
          {{ optimizing ? 'Generating...' : 'Generate Optimization →' }}
        </button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useSessionStore } from '@/stores/session.js';

const route = useRoute();
const router = useRouter();
const runId = route.params.runId;
const session = useSessionStore();

const loading = ref(true);
const error = ref('');
const run = ref({});
const testCases = ref([]);
const results = ref([]);
const expanded = ref(null);
const parentRun = ref(null);

const scoreClass = computed(() => {
  const s = run.value.overall_score;
  if (s >= 80) return 'pass';
  if (s >= 50) return 'partial';
  return 'fail';
});

const scoreDelta = computed(() => {
  if (!parentRun.value || run.value.overall_score == null || parentRun.value.overall_score == null) return 0;
  return Math.round((run.value.overall_score - parentRun.value.overall_score) * 10) / 10;
});

const deltaClass = computed(() => {
  if (scoreDelta.value > 0) return 'positive';
  if (scoreDelta.value < 0) return 'negative';
  return 'neutral';
});

const confidence = computed(() => {
  if (!parentRun.value) return null;
  const before = parentRun.value;
  const after = run.value;
  const newPassing = (after.passed || 0) - (before.passed || 0);
  const regressions = Math.max(0, (before.passed || 0) - (after.passed || 0));
  const delta = scoreDelta.value;

  let level, detail;
  if (regressions === 0 && delta > 0) {
    level = 'high';
    detail = `+${newPassing} tests now passing, 0 regressions. Safe to deploy.`;
  } else if (regressions === 0 && delta === 0) {
    level = 'medium';
    detail = 'No regressions but no improvement either. Review changes.';
  } else if (regressions > 0 && delta > 0) {
    level = 'medium';
    detail = `+${newPassing} new passes but ${regressions} regression(s). Review before deploying.`;
  } else {
    level = 'low';
    detail = `${regressions} regression(s) detected. Do not deploy without fixing.`;
  }
  return { level, detail };
});

function baScoreClass(score) {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'partial';
  return 'fail';
}

onMounted(async () => {
  try {
    const res = await axios.get(`/api/v1/tests/runs/${runId}`);
    run.value = res.data.run;
    testCases.value = res.data.testCases;
    results.value = res.data.results;

    // If this is a re-test, fetch the parent run for comparison
    if (run.value.parent_run_id) {
      try {
        const parentRes = await axios.get(`/api/v1/tests/runs/${run.value.parent_run_id}`);
        parentRun.value = parentRes.data.run;
      } catch (_) {
        // Parent run may have been deleted, ignore
      }
    }
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

function formatCategory(category) {
  return category.replace(/_/g, ' ');
}

async function generateOptimization() {
  optimizing.value = true;
  try {
    const res = await axios.post('/api/v1/optimizations/generate', {
      runId,
      locationId: session.locationId,
    });
    router.push({
      path: `/optimizations/${res.data.optimization.id}`,
      query: { locationId: session.locationId },
    });
  } catch (err) {
    alert('Failed to generate optimization: ' + (err.response?.data?.error || err.message));
  } finally {
    optimizing.value = false;
  }
}
</script>

<style scoped>
.results-page-header {
  margin-bottom: 4px;
}

.results-back-btn {
  width: auto;
  flex: 0 0 auto;
}

.results-hero {
  padding: 28px;
  border-radius: 28px;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.hero-score-title {
  margin-top: 8px;
  font-size: 1.45rem;
  letter-spacing: -0.03em;
}

.hero-score-block {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.hero-score {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: clamp(3rem, 2.4rem + 1.5vw, 4rem);
  line-height: 0.92;
  letter-spacing: -0.06em;
  font-weight: 700;
}

.hero-score.pass,
.kpi-value.pass,
.ba-score.pass {
  color: var(--success);
}

.hero-score.partial,
.kpi-value.partial,
.ba-score.partial {
  color: var(--warning);
}

.hero-score.fail,
.kpi-value.fail,
.ba-score.fail {
  color: var(--danger);
}

.before-after {
  display: grid;
  gap: 16px;
  margin-top: 24px;
  padding: 20px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(237, 244, 255, 0.94), rgba(255, 255, 255, 0.9));
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.before-after-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.before-after-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.ba-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ba-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border-soft);
}

.ba-label {
  font-size: 0.76rem;
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.ba-score {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 2.2rem;
  line-height: 1;
  letter-spacing: -0.04em;
  font-weight: 700;
}

.ba-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.84rem;
}

.ba-stats .pass {
  color: var(--success);
}

.ba-stats .partial {
  color: var(--warning);
}

.ba-stats .fail {
  color: var(--danger);
}

.ba-delta {
  grid-column: 1 / -1;
  padding: 14px 16px;
  border-radius: 18px;
  text-align: center;
  font-weight: 700;
}

.ba-delta.positive {
  background: rgba(15, 159, 110, 0.12);
  color: #0d7a55;
}

.ba-delta.negative {
  background: rgba(209, 67, 67, 0.12);
  color: #b42323;
}

.ba-delta.neutral {
  background: rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
}

.confidence-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 18px;
}

.confidence-banner.high {
  background: rgba(15, 159, 110, 0.1);
  border: 1px solid rgba(15, 159, 110, 0.14);
}

.confidence-banner.medium {
  background: rgba(194, 122, 11, 0.1);
  border: 1px solid rgba(194, 122, 11, 0.14);
}

.confidence-banner.low {
  background: rgba(209, 67, 67, 0.1);
  border: 1px solid rgba(209, 67, 67, 0.14);
}

.confidence-label {
  font-size: 0.86rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.confidence-detail {
  color: var(--text-secondary);
  line-height: 1.55;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card {
  gap: 8px;
}

.kpi-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 2rem;
  line-height: 1;
  letter-spacing: -0.04em;
}

.result-card {
  cursor: pointer;
  transition:
    transform var(--ease-standard),
    border-color var(--ease-standard),
    box-shadow var(--ease-standard);
}

.result-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.result-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.result-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.tc-category {
  text-transform: capitalize;
}

.result-scenario {
  color: var(--text-primary);
  font-weight: 500;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.expand-indicator {
  color: var(--text-muted);
  font-size: 1.3rem;
  line-height: 1;
}

.result-detail {
  display: grid;
  gap: 20px;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.criteria-results h4,
.conversation h4 {
  margin-bottom: 12px;
  font-size: 0.96rem;
  font-weight: 600;
}

.criterion-result {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.74);
  margin-bottom: 10px;
}

.criterion-copy {
  color: var(--text-primary);
  line-height: 1.5;
}

.cr-reasoning {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.55;
}

.cr-suggestion {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(237, 244, 255, 0.88);
  color: var(--accent-strong);
  font-size: 0.9rem;
  line-height: 1.5;
}

.conversation {
  display: grid;
  gap: 12px;
}

.turn {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 20px;
  font-size: 0.94rem;
  line-height: 1.55;
}

.turn.agent {
  background: rgba(237, 244, 255, 0.88);
}

.turn.caller {
  background: rgba(248, 250, 252, 0.84);
}

.turn-role {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.turn p {
  color: var(--text-secondary);
}

.results-actions {
  display: grid;
  gap: 16px;
}

@media (max-width: 900px) {
  .hero-top,
  .before-after-header,
  .result-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-score-block {
    justify-items: start;
  }

  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ba-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .results-hero {
    padding: 22px 20px;
    border-radius: 24px;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .result-main,
  .result-status {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
