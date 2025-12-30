// Hacker Console - Pure Vanilla JS (no Alpine dependency)
// Intercepts fetch AND WebSocket for Supabase requests

// State
const state = {
  logs: [],
  logId: 0,
  filter: ''
};

// Add log entry and update UI
function addLog(log) {
  state.logs.unshift({ ...log, id: ++state.logId });
  if (state.logs.length > 100) state.logs.pop();
  renderLogs();
}

// Render logs to console
function renderLogs() {
  const body = document.getElementById('hacker-log-body');
  if (!body) return;

  const filtered = state.filter
    ? state.logs.filter(l =>
        l.endpoint.toLowerCase().includes(state.filter) ||
        l.method.toLowerCase().includes(state.filter))
    : state.logs;

  body.innerHTML = filtered.map(log => `
    <div class="log-entry log-${log.method.toLowerCase().replace('←', '').replace('→', '')}">
      <span class="log-time">${log.time}</span>
      <span class="log-method ${log.method.toLowerCase()}">${log.method}</span>
      <span class="log-endpoint" title="${log.endpoint}">${log.endpoint}</span>
      <span class="log-status ${log.ok ? 'success' : 'error'}">${log.status}</span>
      <span class="log-duration">${log.duration}ms</span>
    </div>
  `).join('');

  // Update stats
  const reqCount = document.getElementById('hacker-req-count');
  const okCount = document.getElementById('hacker-ok-count');
  const errCount = document.getElementById('hacker-err-count');
  if (reqCount) reqCount.textContent = state.logs.length;
  if (okCount) okCount.textContent = state.logs.filter(l => l.ok).length;
  if (errCount) errCount.textContent = state.logs.filter(l => !l.ok).length;

  // Scroll to top (use rAF to avoid forced layout)
  requestAnimationFrame(() => { body.scrollTop = 0; });
}

// Intercept Fetch requests
if (!window._fetchIntercepted) {
  window._fetchIntercepted = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : (url.url || url.toString());
    const isSupabase = urlStr.includes('supabase') || urlStr.includes('/rest/') || urlStr.includes('/auth/');

    if (isSupabase) {
      const start = performance.now();
      const method = (options.method || 'GET').toUpperCase();

      try {
        const response = await originalFetch(url, options);
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method,
          endpoint: urlStr.replace(/https?:\/\/[^\/]+/, '').split('?')[0] || '/',
          status: response.status,
          ok: response.ok,
          duration: Math.round(performance.now() - start)
        });
        return response;
      } catch (err) {
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method,
          endpoint: urlStr.replace(/https?:\/\/[^\/]+/, '').split('?')[0] || '/',
          status: 'ERR',
          ok: false,
          duration: Math.round(performance.now() - start)
        });
        throw err;
      }
    }
    return originalFetch(url, options);
  };
}

// Intercept WebSocket connections
if (!window._wsIntercepted) {
  window._wsIntercepted = true;
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function(url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    const urlStr = url.toString();
    const isSupabase = urlStr.includes('supabase') || urlStr.includes('realtime');

    if (isSupabase) {
      addLog({
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        method: 'WS',
        endpoint: '/realtime/connect',
        status: 'OPEN',
        ok: true,
        duration: 0
      });

      const originalSend = ws.send.bind(ws);
      ws.send = function(data) {
        let endpoint = '/realtime/send';
        try {
          const parsed = JSON.parse(data);
          if (parsed.event) endpoint = `/realtime/${parsed.event}`;
        } catch {}
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method: 'WS→',
          endpoint,
          status: 'SEND',
          ok: true,
          duration: 0
        });
        return originalSend(data);
      };

      ws.addEventListener('message', (event) => {
        let endpoint = '/realtime/msg';
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event) endpoint = `/realtime/${parsed.event}`;
        } catch {}
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method: '←WS',
          endpoint,
          status: 'RECV',
          ok: true,
          duration: 0
        });
      });

      ws.addEventListener('close', () => {
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method: 'WS',
          endpoint: '/realtime/close',
          status: 'CLOSE',
          ok: true,
          duration: 0
        });
      });

      ws.addEventListener('error', () => {
        addLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          method: 'WS',
          endpoint: '/realtime/error',
          status: 'ERR',
          ok: false,
          duration: 0
        });
      });
    }

    return ws;
  };

  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  window.WebSocket.prototype = OriginalWebSocket.prototype;
}

// Create console HTML
function createConsole() {
  if (document.querySelector('.hacker-console')) return;

  const consoleEl = document.createElement('div');
  consoleEl.className = 'hacker-console';
  consoleEl.innerHTML = `
    <div class="console-header">
      <div class="console-title">SUPABASE NETWORK</div>
      <div class="console-stats">
        <div class="console-stat">REQ: <span class="console-stat-value" id="hacker-req-count">0</span></div>
        <div class="console-stat">OK: <span class="console-stat-value" id="hacker-ok-count">0</span></div>
        <div class="console-stat">ERR: <span class="console-stat-value" id="hacker-err-count">0</span></div>
      </div>
    </div>
    <div class="console-body" id="hacker-log-body"></div>
    <div class="console-input">
      <span class="console-prompt">root@supabase:~$</span>
      <input type="text" class="console-input-field" id="hacker-filter" placeholder="filter logs...">
    </div>
  `;
  document.body.appendChild(consoleEl);

  // Filter input handler
  document.getElementById('hacker-filter').addEventListener('input', (e) => {
    state.filter = e.target.value.toLowerCase();
    renderLogs();
  });

  // Initial render
  renderLogs();
}

// Initialize when DOM is ready
if (document.body) {
  createConsole();
} else {
  document.addEventListener('DOMContentLoaded', createConsole);
}
