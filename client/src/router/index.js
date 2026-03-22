import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
  },
  {
    path: '/agents/:agentId',
    name: 'agent-detail',
    component: () => import('@/views/AgentDetailView.vue'),
  },
  {
    path: '/agents/:agentId/test',
    name: 'test-runner',
    component: () => import('@/views/TestRunnerView.vue'),
  },
  {
    path: '/tests/:runId/results',
    name: 'test-results',
    component: () => import('@/views/TestResultsView.vue'),
  },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
