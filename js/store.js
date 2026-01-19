import { supabase } from './supabase-client.js';

let authPromise = null;
let dataPromise = null;

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
      if (authPromise) return authPromise;
      if (this.authReady) return;

      authPromise = new Promise((resolve) => {
        // Listen for auth state changes - wait for INITIAL_SESSION which fires after storage restoration
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          // INITIAL_SESSION fires when Supabase finishes loading session from storage
          // This is the reliable event to wait for
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            this.session = session;
            this.user = session?.user || null;
            this.authReady = true;
            subscription.unsubscribe();
            resolve();
          }
        });

        // Timeout fallback - don't wait forever
        setTimeout(() => {
          if (!this.authReady) {
            this.authReady = true;
            resolve();
          }
        }, 3000);
      });

      return authPromise;
    },

    async loadData(force = false) {
      if (dataPromise && !force) return dataPromise;
      if (this.dataReady && !force) return;
      if (force) dataPromise = null;

      dataPromise = (async () => {
        const { data, error } = await supabase.rpc('get_app_data');

        if (error) {
          console.error('Failed to load app data:', error);
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
      this.weeks = data || [];
    },

    async refreshTasks() {
      const { data } = await supabase.from('tasks').select('*').order('order_index');
      this.tasks = data || [];
    },

    async refreshCategories() {
      const { data } = await supabase.from('task_categories').select('*').order('id');
      this.categories = data || [];
    },

    async refreshStatuses() {
      const { data } = await supabase.from('task_statuses').select('*').order('sort_order');
      this.statuses = data || [];
    },

    async refreshTrainees() {
      const { data } = await supabase.from('candidates').select('*').eq('type', 'trainee').order('created_at');
      this.trainees = data || [];
    },

    async refreshMentors() {
      const { data } = await supabase.from('mentors').select('*').order('created_at');
      this.mentors = data || [];
    },

    async refreshProgress() {
      const { data } = await supabase.from('progress').select('*');
      this.progress = data || [];
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
