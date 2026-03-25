import { createApp } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import router from './router/index.js';
import App from './App.vue';
import { apiBaseUrl } from './lib/api.js';
import './assets/styles/main.css';

axios.defaults.baseURL = apiBaseUrl;

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
