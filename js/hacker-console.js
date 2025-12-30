function escapeHtml(str) {
  if (str == null) return '';
  if (typeof str !== 'string') str = String(str);
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  return str.replace(/[&<>"'`=/]/g, char => htmlEscapes[char]);
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

const state = {
  logs: [],
  logId: 0,
  filter: '',
  hidden: getCookie('hacker-console-hidden') === 'true'
};

function toggleConsole(hide) {
  state.hidden = hide;
  setCookie('hacker-console-hidden', hide ? 'true' : 'false');

  const consoleEl = document.querySelector('.hacker-console');
  const toggleBtn = document.querySelector('.hacker-console-toggle');

  if (consoleEl) {
    consoleEl.classList.toggle('hidden', hide);
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle('visible', hide);
  }

  document.body.classList.toggle('console-hidden', hide);
}

function addLog(log) {
  state.logs.unshift({ ...log, id: ++state.logId });
  if (state.logs.length > 100) state.logs.pop();
  renderLogs();
}

function createLogEntry(log) {
  const methodClass = log.method.toLowerCase().replace('←', '').replace('→', '');

  const entry = document.createElement('div');
  entry.className = `log-entry log-${methodClass}`;

  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = log.time;

  const method = document.createElement('span');
  method.className = `log-method ${methodClass}`;
  method.textContent = log.method;

  const endpoint = document.createElement('span');
  endpoint.className = 'log-endpoint';
  endpoint.title = log.endpoint;
  endpoint.textContent = log.endpoint;

  const status = document.createElement('span');
  status.className = `log-status ${log.ok ? 'success' : 'error'}`;
  status.textContent = log.status;

  const duration = document.createElement('span');
  duration.className = 'log-duration';
  duration.textContent = `${log.duration}ms`;

  entry.appendChild(time);
  entry.appendChild(method);
  entry.appendChild(endpoint);
  entry.appendChild(status);
  entry.appendChild(duration);

  return entry;
}

function renderLogs() {
  const body = document.getElementById('hacker-log-body');
  if (!body) return;

  const filtered = state.filter
    ? state.logs.filter(l =>
        l.endpoint.toLowerCase().includes(state.filter) ||
        l.method.toLowerCase().includes(state.filter))
    : state.logs;

  body.replaceChildren(...filtered.map(createLogEntry));

  const reqCount = document.getElementById('hacker-req-count');
  const okCount = document.getElementById('hacker-ok-count');
  const errCount = document.getElementById('hacker-err-count');
  if (reqCount) reqCount.textContent = state.logs.length;
  if (okCount) okCount.textContent = state.logs.filter(l => l.ok).length;
  if (errCount) errCount.textContent = state.logs.filter(l => !l.ok).length;

  requestAnimationFrame(() => { body.scrollTop = 0; });
}

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

function createConsole() {
  if (document.querySelector('.hacker-console')) return;

  const consoleEl = document.createElement('div');
  consoleEl.className = 'hacker-console';
  if (state.hidden) consoleEl.classList.add('hidden');

  const header = document.createElement('div');
  header.className = 'console-header';

  const title = document.createElement('div');
  title.className = 'console-title';
  title.textContent = 'SUPABASE NETWORK';

  const headerRight = document.createElement('div');
  headerRight.className = 'console-header-right';

  const stats = document.createElement('div');
  stats.className = 'console-stats';

  const createStat = (label, id) => {
    const stat = document.createElement('div');
    stat.className = 'console-stat';
    stat.textContent = `${label}: `;
    const value = document.createElement('span');
    value.className = 'console-stat-value';
    value.id = id;
    value.textContent = '0';
    stat.appendChild(value);
    return stat;
  };

  stats.appendChild(createStat('REQ', 'hacker-req-count'));
  stats.appendChild(createStat('OK', 'hacker-ok-count'));
  stats.appendChild(createStat('ERR', 'hacker-err-count'));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'console-close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.title = 'Hide console';
  closeBtn.addEventListener('click', () => toggleConsole(true));

  headerRight.appendChild(stats);
  headerRight.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(headerRight);

  const body = document.createElement('div');
  body.className = 'console-body';
  body.id = 'hacker-log-body';

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'console-input';

  const prompt = document.createElement('span');
  prompt.className = 'console-prompt';
  prompt.textContent = 'root@supabase:~$';

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'console-input-field';
  filterInput.id = 'hacker-filter';
  filterInput.placeholder = 'filter logs...';

  inputWrapper.appendChild(prompt);
  inputWrapper.appendChild(filterInput);

  consoleEl.appendChild(header);
  consoleEl.appendChild(body);
  consoleEl.appendChild(inputWrapper);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'hacker-console-toggle';
  if (state.hidden) toggleBtn.classList.add('visible');
  toggleBtn.innerHTML = '▼';
  toggleBtn.title = 'Show console';
  toggleBtn.addEventListener('click', () => toggleConsole(false));

  document.body.appendChild(consoleEl);
  document.body.appendChild(toggleBtn);

  if (state.hidden) {
    document.body.classList.add('console-hidden');
  }

  filterInput.addEventListener('input', (e) => {
    state.filter = e.target.value.toLowerCase();
    renderLogs();
  });

  renderLogs();
}

if (document.body) {
  createConsole();
} else {
  document.addEventListener('DOMContentLoaded', createConsole);
}
