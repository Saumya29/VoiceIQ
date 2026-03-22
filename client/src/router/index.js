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
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
