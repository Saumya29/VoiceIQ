<template>
  <div class="dashboard">
    <h1>VoiceIQ</h1>
    <p>Voice AI Performance Optimizer</p>
    <p v-if="status">Backend status: {{ status }}</p>
    <p v-else>Connecting to backend...</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const status = ref('');

onMounted(async () => {
  try {
    const res = await axios.get('/api/v1/health');
    status.value = res.data.data.status;
  } catch (err) {
    status.value = 'error - backend not reachable';
  }
});
</script>

<style scoped>
.dashboard {
  padding: 40px;
  text-align: center;
}

h1 {
  font-size: 32px;
  color: #111827;
  margin-bottom: 8px;
}

p {
  color: #6b7280;
  font-size: 16px;
}
</style>
