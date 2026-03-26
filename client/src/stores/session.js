import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useSessionStore = defineStore('session', () => {
  const locationId = ref(import.meta.env.VITE_DEFAULT_LOCATION_ID || 'demo');
  const user = ref(null);
  const installed = ref(false);
  const isGhlContext = ref(false);
  const loading = ref(true);

  const demo = computed(() => locationId.value === 'demo' || !installed.value);

  // Ask the GHL parent window for encrypted user data via postMessage.
  // GHL Custom Pages run inside an iframe — the parent (GHL) responds
  // with an AES-encrypted payload containing user/location context.
  // Times out after 3s if we're not actually inside GHL.
  function requestGhlSsoData() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('SSO timeout'));
      }, 3000);

      function handler(event) {
        const trusted = ['https://app.gohighlevel.com', 'https://app.leadconnectorhq.com'];
        if (!trusted.some(o => event.origin === o || event.origin.endsWith('.gohighlevel.com') || event.origin.endsWith('.leadconnectorhq.com'))) return;
        if (event.data?.message === 'REQUEST_USER_DATA_RESPONSE') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data.payload);
        }
      }

      window.addEventListener('message', handler);
      window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
    });
  }

  // Resolve locationId with priority:
  // 1. GHL SSO (if inside GHL iframe) — most secure, provides user context
  // 2. URL ?locationId= param (widget mode or direct link)
  // 3. 'demo' fallback (standalone dev mode)
  async function init() {
    loading.value = true;

    try {
      const inIframe = window.self !== window.top;

      if (inIframe) {
        try {
          const encryptedData = await requestGhlSsoData();
          const res = await axios.post('/auth/sso/decrypt', { encryptedData });
          locationId.value = res.data.locationId;
          user.value = res.data.user;
          installed.value = res.data.installed;
          isGhlContext.value = true;
          loading.value = false;
          return;
        } catch (ssoErr) {
          // Not in GHL or SSO failed — fall through to URL param
          console.warn('GHL SSO not available, falling back to URL params');
        }
      }

      // Fallback: read locationId from URL query string or env var default
      const urlLocationId = new URLSearchParams(window.location.search).get('locationId');
      if (urlLocationId) {
        locationId.value = urlLocationId;
      }

      // Check installation status if we have a real locationId
      if (locationId.value && locationId.value !== 'demo') {
        try {
          const res = await axios.get('/auth/status', { params: { locationId: locationId.value } });
          installed.value = res.data.installed;
        } catch (_) {
          // Ignore — will use demo mode
        }
      }
    } catch (err) {
      console.error('Session init error:', err);
    } finally {
      loading.value = false;
    }
  }

  return { locationId, user, installed, isGhlContext, loading, demo, init };
});
