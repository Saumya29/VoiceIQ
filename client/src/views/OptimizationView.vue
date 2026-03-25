<template>
  <div class="optimization-view">
    <header class="opt-header">
      <button class="back-btn" @click="$router.back()">← Back</button>
      <h1>Prompt Optimization</h1>
      <span v-if="optimization" :class="['status-badge', optimization.status]">{{ optimization.status }}</span>
    </header>

    <div v-if="loading" class="loading">Loading optimization...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="optimization">
      <!-- Failure Patterns -->
      <div v-if="optimization.failure_patterns?.length" class="section">
        <h2>Failure Patterns Addressed</h2>
        <div v-for="(fp, i) in optimization.failure_patterns" :key="i" class="pattern-card">
          <span :class="['severity-badge', fp.severity]">{{ fp.severity }}</span>
          <span>{{ fp.pattern }}</span>
        </div>
      </div>

      <!-- Changes Summary -->
      <div v-if="optimization.changes_summary?.length" class="section">
        <h2>Changes Made</h2>
        <div v-for="(change, i) in optimization.changes_summary" :key="i" class="change-item">
          <span :class="['change-type', change.type]">{{ change.type }}</span>
          <span>{{ change.description }}</span>
        </div>
      </div>

      <!-- Expected Improvements -->
      <div v-if="optimization.expected_improvements" class="section">
        <h2>Expected Improvements</h2>
        <p class="improvements-text">{{ optimization.expected_improvements }}</p>
      </div>

      <!-- Side-by-side Diff -->
      <div class="section">
        <h2>Prompt Diff</h2>
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
      </div>

      <!-- Actions -->
      <div class="actions" v-if="optimization.status === 'generated'">
        <button class="btn-primary" @click="approve" :disabled="actionLoading">
          {{ actionLoading ? 'Processing...' : 'Approve' }}
        </button>
        <button class="btn-danger" @click="reject" :disabled="actionLoading">Reject</button>
      </div>

      <div class="actions" v-if="optimization.status === 'approved'">
        <button class="btn-primary" @click="apply" :disabled="actionLoading">
          {{ actionLoading ? 'Applying...' : 'Apply to HighLevel' }}
        </button>
        <button class="btn-secondary" @click="retest">Re-test with Optimized Prompt →</button>
      </div>

      <div class="actions" v-if="optimization.status === 'applied'">
        <p class="applied-msg">Optimization applied to HighLevel.</p>
        <button class="btn-secondary" @click="retest">Re-test with Optimized Prompt →</button>
      </div>

      <div v-if="actionError" class="error">{{ actionError }}</div>
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
.optimization-view {
  padding: 32px 40px;
  max-width: 1100px;
  margin: 0 auto;
}

.opt-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.opt-header h1 {
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

.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  text-transform: uppercase;
  margin-left: auto;
}

.status-badge.generated { background: #dbeafe; color: #1e40af; }
.status-badge.approved { background: #d1fae5; color: #065f46; }
.status-badge.applied { background: #d1fae5; color: #065f46; }
.status-badge.rejected { background: #fee2e2; color: #991b1b; }

.loading, .error {
  text-align: center;
  padding: 60px 0;
  color: #6b7280;
  font-size: 15px;
}

.error { color: #dc2626; }

.section {
  margin-bottom: 24px;
}

.section h2 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.pattern-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fffbeb;
  border-left: 3px solid #fbbf24;
  margin-bottom: 8px;
  font-size: 13px;
  border-radius: 0 6px 6px 0;
}

.severity-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.severity-badge.high { background: #fee2e2; color: #991b1b; }
.severity-badge.medium { background: #fef3c7; color: #92400e; }
.severity-badge.low { background: #f3f4f6; color: #6b7280; }

.change-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: #374151;
}

.change-type {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.change-type.added { background: #d1fae5; color: #065f46; }
.change-type.modified { background: #dbeafe; color: #1e40af; }
.change-type.removed { background: #fee2e2; color: #991b1b; }

.improvements-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 0;
}

.diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.diff-panel h3 {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 8px 0;
}

.diff-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 1.7;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 600px;
  overflow-y: auto;
  color: #374151;
  margin: 0;
}

.diff-content.original { border-top: 3px solid #fca5a5; }
.diff-content.optimized { border-top: 3px solid #86efac; }

.diff-content .highlight-removed {
  background: #fee2e2;
  color: #991b1b;
  border-radius: 3px;
  padding: 1px 2px;
  text-decoration: line-through;
  text-decoration-color: #f8717180;
}

.diff-content .highlight-added {
  background: #dcfce7;
  color: #166534;
  border-radius: 3px;
  padding: 1px 2px;
}

.diff-content .unchanged {
  color: #374151;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.btn-danger {
  background: #fff;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-danger:hover { background: #fef2f2; }

.applied-msg {
  font-size: 14px;
  color: #059669;
  font-weight: 500;
  margin: 0;
}
</style>
