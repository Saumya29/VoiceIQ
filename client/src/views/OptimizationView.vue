<template>
  <div class="page-shell stack">
    <header class="page-header optimization-page-header">
      <div class="page-header-main">
        <button class="btn optimization-back-btn" @click="$router.back()">← Back</button>
        <div>
          <span class="page-kicker">Optimization review</span>
          <h1 class="page-heading">Prompt Optimization</h1>
          <p class="page-subtitle">
            Review what changed, why it changed, and whether this revision should move forward.
          </p>
        </div>
      </div>
      <span v-if="optimization" :class="['status-badge', optimization.status]">{{ optimization.status }}</span>
    </header>

    <div v-if="loading" class="loading-state">Loading optimization...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <template v-else-if="optimization">
      <section class="optimization-hero surface-card">
        <div class="hero-copy">
          <span class="eyebrow">Optimization status</span>
          <h2>Prompt rewrite ready for review</h2>
          <p>
            Inspect the failure patterns, confirm the change summary, and decide whether to
            approve, apply, or re-test this prompt.
          </p>
        </div>
        <div class="hero-meta">
          <div class="stat-pill">
            <strong>{{ optimization.failure_patterns?.length || 0 }}</strong>
            <span>failure patterns</span>
          </div>
          <div class="stat-pill">
            <strong>{{ optimization.changes_summary?.length || 0 }}</strong>
            <span>changes proposed</span>
          </div>
        </div>
      </section>

      <section v-if="optimization.failure_patterns?.length" class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">Failure Patterns Addressed</h2>
            <p class="section-copy">The behaviors this optimization attempts to correct.</p>
          </div>
        </div>
        <div class="stack-sm">
          <div v-for="(fp, i) in optimization.failure_patterns" :key="i" class="pattern-card">
            <span :class="['status-badge', fp.severity]">{{ fp.severity }}</span>
            <span>{{ fp.pattern }}</span>
          </div>
        </div>
      </section>

      <section v-if="optimization.changes_summary?.length" class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">Changes Made</h2>
            <p class="section-copy">A concise breakdown of the edits proposed by the optimizer.</p>
          </div>
        </div>
        <div class="stack-sm">
          <div v-for="(change, i) in optimization.changes_summary" :key="i" class="change-item">
            <span :class="['status-badge', change.type]">{{ change.type }}</span>
            <span>{{ change.description }}</span>
          </div>
        </div>
      </section>

      <section v-if="optimization.expected_improvements" class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">Expected Improvements</h2>
            <p class="section-copy">What should improve when this prompt is re-tested.</p>
          </div>
        </div>
        <p class="improvements-text">{{ optimization.expected_improvements }}</p>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">Prompt Diff</h2>
            <p class="section-copy">Side-by-side comparison of the original prompt and the optimized draft.</p>
          </div>
        </div>
        <div class="diff-container">
          <div class="diff-panel">
            <h3>Original</h3>
            <pre class="diff-content original"><template v-for="(part, i) in leftParts" :key="i"><span :class="part.type">{{ part.text }}</span></template></pre>
          </div>
          <div class="diff-panel">
            <h3>Optimized</h3>
            <pre class="diff-content optimized"><template v-for="(part, i) in rightParts" :key="i"><span :class="part.type">{{ part.text }}</span></template></pre>
          </div>
        </div>
      </section>

      <section class="section-card actions-card" v-if="optimization.status === 'generated'">
        <div class="section-header">
          <div>
            <h2 class="section-title">Decision</h2>
            <p class="section-copy">Approve this prompt for application, or reject it and keep the current one.</p>
          </div>
        </div>
        <div class="actions">
          <button class="btn-primary" @click="approve" :disabled="actionLoading">
            {{ actionLoading ? 'Processing...' : 'Approve' }}
          </button>
          <button class="btn-danger" @click="reject" :disabled="actionLoading">Reject</button>
        </div>
      </section>

      <section class="section-card actions-card" v-if="optimization.status === 'approved'">
        <div class="section-header">
          <div>
            <h2 class="section-title">Ready to apply</h2>
            <p class="section-copy">Push the approved prompt into HighLevel or re-test it before deployment.</p>
          </div>
        </div>
        <div class="actions">
          <button class="btn-primary" @click="apply" :disabled="actionLoading">
            {{ actionLoading ? 'Applying...' : 'Apply to HighLevel' }}
          </button>
          <button class="btn-secondary" @click="retest">Re-test with Optimized Prompt →</button>
        </div>
      </section>

      <section class="section-card actions-card" v-if="optimization.status === 'applied'">
        <div class="section-header">
          <div>
            <h2 class="section-title">Applied successfully</h2>
            <p class="section-copy">The optimized prompt is now live in HighLevel.</p>
          </div>
        </div>
        <div class="actions">
          <p class="applied-msg">Optimization applied to HighLevel.</p>
          <button class="btn-secondary" @click="retest">Re-test with Optimized Prompt →</button>
        </div>
      </section>

      <div v-if="actionError" class="error-state">{{ actionError }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { diffWords } from 'diff';
import { useSessionStore } from '@/stores/session.js';

const route = useRoute();
const router = useRouter();
const optimizationId = route.params.optimizationId;
const session = useSessionStore();

const optimization = ref(null);
const loading = ref(true);
const error = ref('');
const actionLoading = ref(false);
const actionError = ref('');

const leftParts = computed(() => {
  if (!optimization.value) return [];
  const changes = diffWords(
    optimization.value.original_prompt || '',
    optimization.value.optimized_prompt || ''
  );
  // Left panel: show unchanged + removed (skip added)
  return changes
    .filter(c => !c.added)
    .map(c => ({ type: c.removed ? 'highlight-removed' : 'unchanged', text: c.value }));
});

const rightParts = computed(() => {
  if (!optimization.value) return [];
  const changes = diffWords(
    optimization.value.original_prompt || '',
    optimization.value.optimized_prompt || ''
  );
  // Right panel: show unchanged + added (skip removed)
  return changes
    .filter(c => !c.removed)
    .map(c => ({ type: c.added ? 'highlight-added' : 'unchanged', text: c.value }));
});

onMounted(async () => {
  try {
    const res = await axios.get(`/api/v1/optimizations/${optimizationId}`);
    optimization.value = res.data.optimization;
  } catch (err) {
    error.value = 'Failed to load optimization.';
  } finally {
    loading.value = false;
  }
});

async function approve() {
  actionLoading.value = true;
  actionError.value = '';
  try {
    const res = await axios.post(`/api/v1/optimizations/${optimizationId}/approve`);
    optimization.value = res.data.optimization;
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Failed to approve';
  } finally {
    actionLoading.value = false;
  }
}

async function apply() {
  actionLoading.value = true;
  actionError.value = '';
  try {
    const res = await axios.post(`/api/v1/optimizations/${optimizationId}/apply`);
    optimization.value = res.data.optimization;
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Failed to apply';
  } finally {
    actionLoading.value = false;
  }
}

async function reject() {
  actionLoading.value = true;
  try {
    const res = await axios.post(`/api/v1/optimizations/${optimizationId}/reject`);
    optimization.value = res.data.optimization;
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Failed to reject';
  } finally {
    actionLoading.value = false;
  }
}

function retest() {
  router.push({
    path: `/agents/${optimization.value.agent_id}/test`,
    query: { locationId: session.locationId, retestRunId: optimization.value.test_run_id },
  });
}
</script>

<style scoped>
.optimization-page-header {
  margin-bottom: 4px;
}

.optimization-back-btn {
  width: auto;
  flex: 0 0 auto;
}

.optimization-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  padding: 28px;
  border-radius: 28px;
}

.hero-copy h2 {
  margin: 8px 0 10px;
  font-size: 1.5rem;
  letter-spacing: -0.03em;
}

.hero-copy p {
  max-width: 60ch;
  color: var(--text-secondary);
  line-height: 1.6;
}

.hero-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stat-pill {
  display: grid;
  gap: 4px;
  min-width: 120px;
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(248, 250, 252, 0.86);
  border: 1px solid var(--border-soft);
}

.stat-pill strong {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 1.2rem;
  line-height: 1;
}

.stat-pill span {
  color: var(--text-tertiary);
  font-size: 0.84rem;
}

.pattern-card,
.change-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--text-secondary);
}

.pattern-card {
  background: rgba(255, 246, 232, 0.78);
}

.improvements-text {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(237, 244, 255, 0.9), rgba(255, 255, 255, 0.88));
  border: 1px solid rgba(37, 99, 235, 0.14);
  color: var(--text-secondary);
  line-height: 1.7;
}

.diff-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.diff-panel {
  min-width: 0;
}

.diff-panel h3 {
  margin-bottom: 10px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.diff-content {
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid var(--border-soft);
  border-radius: 22px;
  padding: 18px;
  font-size: 0.84rem;
  font-family: var(--font-mono);
  line-height: 1.75;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 620px;
  overflow-y: auto;
  color: var(--text-secondary);
  margin: 0;
}

.diff-content.original {
  box-shadow: inset 0 3px 0 rgba(209, 67, 67, 0.28);
}

.diff-content.optimized {
  box-shadow: inset 0 3px 0 rgba(15, 159, 110, 0.28);
}

.diff-content .highlight-removed {
  background: rgba(209, 67, 67, 0.14);
  color: #b42323;
  border-radius: 6px;
  padding: 1px 3px;
  text-decoration: line-through;
  text-decoration-color: rgba(180, 35, 35, 0.45);
}

.diff-content .highlight-added {
  background: rgba(15, 159, 110, 0.14);
  color: #0d7a55;
  border-radius: 6px;
  padding: 1px 3px;
}

.diff-content .unchanged {
  color: var(--text-secondary);
}

.actions-card {
  display: grid;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.applied-msg {
  color: var(--success);
  font-weight: 600;
}

@media (max-width: 900px) {
  .optimization-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-meta {
    justify-content: flex-start;
  }

  .diff-container {
    grid-template-columns: 1fr;
  }
}
</style>
