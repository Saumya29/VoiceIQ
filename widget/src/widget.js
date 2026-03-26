import '@fontsource-variable/geist';

(function () {
  'use strict';

  const WIDGET_ID = 'voiceiq-widget';
  const PANEL_WIDTH = 520;
  const APP_URL = window.VOICEIQ_APP_URL || 'http://localhost:5173';

  // Extract locationId from HighLevel URL: /location/{id}/...
  function getLocationId() {
    const match = window.location.pathname.match(/\/location\/([^/]+)/);
    return match ? match[1] : 'demo';
  }

  // Prevent double init
  if (document.getElementById(WIDGET_ID)) return;

  // ── Styles ──
  const style = document.createElement('style');
  style.textContent = `
    #${WIDGET_ID}-launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 58px;
      height: 58px;
      border-radius: 20px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.24);
      cursor: pointer;
      box-shadow: 0 18px 36px rgba(37, 99, 235, 0.28);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${WIDGET_ID}-launcher:hover {
      transform: translateY(-2px);
      box-shadow: 0 22px 44px rgba(37, 99, 235, 0.34);
      border-color: rgba(255, 255, 255, 0.42);
    }
    #${WIDGET_ID}-launcher svg {
      width: 28px;
      height: 28px;
    }
    #${WIDGET_ID}-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #dc2626;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${WIDGET_ID}-panel {
      position: fixed;
      top: 0;
      right: -${PANEL_WIDTH}px;
      width: ${PANEL_WIDTH}px;
      height: 100vh;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(18px);
      box-shadow: -18px 0 48px rgba(15, 23, 42, 0.16);
      border-left: 1px solid rgba(148, 163, 184, 0.2);
      z-index: 99998;
      transition: right 0.3s ease;
      display: flex;
      flex-direction: column;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${WIDGET_ID}-panel.open {
      right: 0;
    }
    #${WIDGET_ID}-panel.fullscreen {
      width: 100vw;
      right: -100vw;
    }
    #${WIDGET_ID}-panel.fullscreen.open {
      right: 0;
    }
    #${WIDGET_ID}-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.92));
      flex-shrink: 0;
    }
    #${WIDGET_ID}-topbar-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    #${WIDGET_ID}-topbar-actions {
      display: flex;
      gap: 8px;
    }
    #${WIDGET_ID}-topbar-actions button {
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      padding: 7px 10px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }
    #${WIDGET_ID}-topbar-actions button:hover {
      background: #ffffff;
      color: #0f172a;
      transform: translateY(-1px);
    }
    #${WIDGET_ID}-iframe {
      flex: 1;
      border: none;
      width: 100%;
    }
    #${WIDGET_ID}-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.24);
      backdrop-filter: blur(2px);
      z-index: 99997;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    #${WIDGET_ID}-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }
    @media (max-width: 768px) {
      #${WIDGET_ID}-launcher {
        width: 52px;
        height: 52px;
        right: 14px;
        bottom: 14px;
        border-radius: 18px;
      }
      #${WIDGET_ID}-panel,
      #${WIDGET_ID}-panel.fullscreen {
        width: 100vw;
        right: -100vw;
        border-left: none;
        box-shadow: none;
      }
      #${WIDGET_ID}-topbar {
        padding: 12px 14px;
      }
      #${WIDGET_ID}-btn-fullscreen {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  // ── Overlay ──
  const overlay = document.createElement('div');
  overlay.id = `${WIDGET_ID}-overlay`;
  document.body.appendChild(overlay);

  // ── Launcher button ──
  const launcher = document.createElement('button');
  launcher.id = `${WIDGET_ID}-launcher`;
  launcher.title = 'VoiceIQ';
  launcher.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
    <span id="${WIDGET_ID}-badge">0</span>
  `;
  document.body.appendChild(launcher);

  // ── Panel ──
  const locationId = getLocationId();
  const iframeSrc = `${APP_URL}/?locationId=${locationId}`;

  const panel = document.createElement('div');
  panel.id = `${WIDGET_ID}-panel`;
  panel.innerHTML = `
    <div id="${WIDGET_ID}-topbar">
      <span id="${WIDGET_ID}-topbar-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        VoiceIQ
      </span>
      <div id="${WIDGET_ID}-topbar-actions">
        <button id="${WIDGET_ID}-btn-fullscreen" title="Toggle fullscreen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          Expand
        </button>
        <button id="${WIDGET_ID}-btn-close" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <iframe id="${WIDGET_ID}-iframe" src="${iframeSrc}"></iframe>
  `;
  document.body.appendChild(panel);

  // ── State ──
  let isOpen = false;
  let isFullscreen = false;

  function openPanel() {
    isOpen = true;
    panel.classList.add('open');
    overlay.classList.add('visible');
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    overlay.classList.remove('visible');
  }

  function toggleFullscreen() {
    const btn = document.getElementById(`${WIDGET_ID}-btn-fullscreen`);
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      panel.classList.add('fullscreen');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        Collapse
      `;
    } else {
      panel.classList.remove('fullscreen');
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        Expand
      `;
    }
  }

  // ── Events ──
  launcher.addEventListener('click', () => {
    isOpen ? closePanel() : openPanel();
  });

  overlay.addEventListener('click', closePanel);

  document.getElementById(`${WIDGET_ID}-btn-close`).addEventListener('click', closePanel);
  document.getElementById(`${WIDGET_ID}-btn-fullscreen`).addEventListener('click', toggleFullscreen);

  // Listen for postMessage from iframe (badge updates)
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'voiceiq') return;

    const badge = document.getElementById(`${WIDGET_ID}-badge`);

    if (event.data.type === 'badge') {
      const count = event.data.count || 0;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (event.data.type === 'navigate') {
      // Allow iframe to request fullscreen for certain views
      if (event.data.fullscreen && !isFullscreen) {
        toggleFullscreen();
      }
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });
})();
