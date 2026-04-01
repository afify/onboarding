import { supabase, signOut } from './supabase-client.js';

let authPromise = null;
let dataPromise = null;
let idleTimer = null;
let authSubscription = null;

// Session timeout configuration (in milliseconds)
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes idle timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export function initStore(Alpine) {
  Alpine.store('app', {
    // Date formatting utilities (dd-mm-yyyy)
    formatDate(date) {
      if (!date) return '-';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}-${month}-${d.getFullYear()}`;
    },

    formatDateTime(date) {
      if (!date) return '-';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${d.getFullYear()} ${hours}:${mins}`;
    },

    session: null,
    user: null,
    mentor: null,
    isAdmin: false,
    authReady: false,

    mentors: [],
    trainees: [],
    weeks: [],
    tasks: [],
    categories: [],
    statuses: [],
    progress: [],
    activityLog: [],
    dataReady: false,

    // Interview Pipeline Data
    interviewStages: [],
    stageCriteria: [],
    candidates: [],
    interviews: [],
    interviewScores: [],

    async initAuth() {
      // Always return the existing promise if initialization is in progress
      if (authPromise) return authPromise;

      // If already authenticated, return resolved promise
      if (this.authReady && this.session) {
        return Promise.resolve(this.session);
      }

      authPromise = new Promise((resolve, reject) => {
        // Set up cross-tab logout synchronization
        this._setupCrossTabSync();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          // Handle logout events (including from other tabs)
          if (event === 'SIGNED_OUT') {
            this._handleSignOut();
            return;
          }

          // Handle session initialization and refresh
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            this.session = session;
            this.user = session?.user || null;
            this.authReady = true;

            // Start idle timeout tracking if session exists
            if (session) {
              this._startIdleTimer();
            }

            // Keep subscription for ongoing auth events (don't unsubscribe)
            authSubscription = subscription;
            resolve(session);
          }
        });

        // Timeout fallback with proper error handling (10 seconds)
        setTimeout(() => {
          if (!this.authReady) {
            this.authReady = true;
            // Resolve with null session instead of rejecting
            // This allows pages to handle no-session case gracefully
            resolve(null);
          }
        }, 10000);
      });

      return authPromise;
    },

    // Cross-tab session synchronization
    _setupCrossTabSync() {
      window.addEventListener('storage', (event) => {
        // Supabase stores auth in keys starting with 'sb-'
        if (event.key && event.key.includes('auth-token') && !event.newValue) {
          // Token was removed (logout in another tab)
          this._handleSignOut();
          window.location.href = '/';
        }
      });
    },

    // Handle sign out (clear state)
    _handleSignOut() {
      this.session = null;
      this.user = null;
      this.mentor = null;
      this.isAdmin = false;
      this.authReady = false;
      this.dataReady = false;
      this._stopIdleTimer();

      // Clear data arrays
      this.mentors.splice(0, this.mentors.length);
      this.trainees.splice(0, this.trainees.length);
      this.weeks.splice(0, this.weeks.length);
      this.tasks.splice(0, this.tasks.length);
      this.progress.splice(0, this.progress.length);
    },

    // Idle timeout management
    _startIdleTimer() {
      this._stopIdleTimer();

      const resetTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          this._handleIdleTimeout();
        }, IDLE_TIMEOUT);
      };

      // Reset timer on user activity
      ACTIVITY_EVENTS.forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
      });

      // Start initial timer
      resetTimer();
    },

    _stopIdleTimer() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    },

    async _handleIdleTimeout() {
      // Session expired due to inactivity
      console.warn('Session expired due to inactivity');
      await signOut();
      this._showSessionExpiredDialog();
    },

    _showSessionExpiredDialog() {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        backdrop-filter: blur(4px);
      `;

      // Create modal content
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: #1e293b;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;

      // Create icon container
      const iconDiv = document.createElement('div');
      iconDiv.style.marginBottom = '16px';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '48');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', '#f59e0b');
      svg.setAttribute('stroke-width', '2');
      svg.style.margin = '0 auto';
      svg.style.display = 'block';
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '12 6 12 12 16 14');
      svg.appendChild(circle);
      svg.appendChild(polyline);
      iconDiv.appendChild(svg);

      // Create title
      const title = document.createElement('h2');
      title.textContent = 'Session Expired';
      title.style.cssText = 'color: #f1f5f9; font-size: 20px; font-weight: 600; margin: 0 0 12px 0;';

      // Create message
      const message = document.createElement('p');
      message.textContent = 'Your session has expired due to inactivity. Please log in again to continue.';
      message.style.cssText = 'color: #94a3b8; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5;';

      // Create button
      const button = document.createElement('button');
      button.textContent = 'Log In';
      button.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      `;
      button.addEventListener('click', () => {
        window.location.href = '/';
      });
      button.addEventListener('mouseenter', () => button.style.background = '#2563eb');
      button.addEventListener('mouseleave', () => button.style.background = '#3b82f6');

      // Assemble modal
      modal.appendChild(iconDiv);
      modal.appendChild(title);
      modal.appendChild(message);
      modal.appendChild(button);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    },

    async loadData(force = false) {
      if (dataPromise && !force) return dataPromise;
      if (this.dataReady && !force) return;
      if (force) dataPromise = null;

      dataPromise = (async () => {
        const { data, error } = await supabase.rpc('get_app_data');

        if (error) {
          // Sanitize error logging - only log message in development
          if (import.meta.env?.DEV) {
            console.error('Failed to load app data:', error?.message || 'Unknown error');
          }
          return;
        }

        this.mentor = data.mentor;
        this.isAdmin = data.is_admin;
        // Use splice to maintain reactivity instead of replacing arrays
        this.mentors.splice(0, this.mentors.length, ...(data.mentors || []));
        this.trainees.splice(0, this.trainees.length, ...(data.trainees || []));
        this.weeks.splice(0, this.weeks.length, ...(data.weeks || []));
        this.tasks.splice(0, this.tasks.length, ...(data.tasks || []));
        this.categories.splice(0, this.categories.length, ...(data.categories || []));
        this.statuses.splice(0, this.statuses.length, ...(data.statuses || []));
        this.progress.splice(0, this.progress.length, ...(data.progress || []));
        this.activityLog.splice(0, this.activityLog.length, ...(data.activity_log || []));

        // Interview Pipeline Data
        this.interviewStages.splice(0, this.interviewStages.length, ...(data.interview_stages || []));
        this.stageCriteria.splice(0, this.stageCriteria.length, ...(data.stage_criteria || []));
        this.candidates.splice(0, this.candidates.length, ...(data.candidates || []));
        this.interviews.splice(0, this.interviews.length, ...(data.interviews || []));
        this.interviewScores.splice(0, this.interviewScores.length, ...(data.interview_scores || []));

        this.dataReady = true;
      })();

      return dataPromise;
    },

    async refreshData() {
      dataPromise = null;
      this.dataReady = false;
      await this.loadData();
    },

    async refreshProgramData() {
      await this.refreshData();
    },

    async refreshWeeks() {
      const { data } = await supabase.from('weeks').select('*').order('week_number');
      this.weeks.splice(0, this.weeks.length, ...(data || []));
    },

    async refreshTasks() {
      const { data } = await supabase.from('tasks').select('*').order('order_index');
      this.tasks.splice(0, this.tasks.length, ...(data || []));
    },

    async refreshCategories() {
      const { data } = await supabase.from('task_categories').select('*').order('id');
      this.categories.splice(0, this.categories.length, ...(data || []));
    },

    async refreshStatuses() {
      const { data } = await supabase.from('task_statuses').select('*').order('sort_order');
      this.statuses.splice(0, this.statuses.length, ...(data || []));
    },

    async refreshTrainees() {
      const { data } = await supabase.from('candidates').select('*').eq('type', 'trainee').order('created_at');
      this.trainees.splice(0, this.trainees.length, ...(data || []));
    },

    async refreshMentors() {
      const { data } = await supabase.from('mentors').select('*').order('created_at');
      this.mentors.splice(0, this.mentors.length, ...(data || []));
    },

    async refreshProgress() {
      const { data } = await supabase.from('progress').select('*');
      this.progress.splice(0, this.progress.length, ...(data || []));
    },

    // Interview Pipeline Refresh Methods
    async refreshInterviewStages() {
      const { data } = await supabase.from('interview_stages').select('*').eq('is_active', true).order('sort_order');
      this.interviewStages.splice(0, this.interviewStages.length, ...(data || []));
    },

    async refreshStageCriteria() {
      const { data } = await supabase.from('stage_criteria').select('*').order('stage_id').order('sort_order');
      this.stageCriteria.splice(0, this.stageCriteria.length, ...(data || []));
    },

    async refreshCandidates() {
      const { data } = await supabase.from('candidates').select('*').eq('status', 'active').order('created_at', { ascending: false });
      this.candidates.splice(0, this.candidates.length, ...(data || []));
    },

    async refreshInterviews() {
      const { data } = await supabase.from('interviews').select('*').order('created_at', { ascending: false });
      this.interviews.splice(0, this.interviews.length, ...(data || []));
    },

    async refreshInterviewScores() {
      const { data } = await supabase.from('interview_scores').select('*');
      this.interviewScores.splice(0, this.interviewScores.length, ...(data || []));
    },
  });
}
