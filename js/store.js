import { supabase, getSession } from './supabase-client.js';

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

    async initAuth() {
      if (authPromise) return authPromise;
      if (this.authReady) return;

      authPromise = (async () => {
        this.session = await getSession();
        this.user = this.session?.user || null;
        this.authReady = true;
      })();

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
        this.mentors = data.mentors || [];
        this.trainees = data.trainees || [];
        this.weeks = data.weeks || [];
        this.tasks = data.tasks || [];
        this.categories = data.categories || [];
        this.statuses = data.statuses || [];
        this.progress = data.progress || [];
        this.activityLog = data.activity_log || [];

        this.dataReady = true;
      })();

      return dataPromise;
    },

    async refreshData() {
      dataPromise = null;
      this.dataReady = false;
      await this.loadData();
    },

    async refreshCurriculumData() {
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
      const { data } = await supabase.from('trainees').select('*').order('created_at');
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
  });
}
