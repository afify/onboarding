import { supabase, getSession, getCurrentUser, getMentorProfile } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('tracking', () => ({
    // State
    currentMentor: null,
    weeks: [],
    tasks: [],
    trainees: [],
    mentors: [],
    categories: [],
    statuses: [],
    progress: [],

    // Filters
    filters: {
      trainee: '',
      week: '',
      status: ''
    },

    // Modal state
    showEditModal: false,
    editingItem: null,
    editForm: {
      status_id: null,
      start_date: '',
      due_date: '',
      score: null
    },

    // Initialize
    async init() {
      // Check authentication
      const session = await getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      const user = await getCurrentUser();
      const { data: mentor } = await getMentorProfile(user.id);

      if (!mentor) {
        window.location.href = '/';
        return;
      }

      this.currentMentor = mentor;

      // Load data
      await this.loadData();

      // Subscribe to realtime updates
      this.subscribeToRealtime();
    },

    async loadData() {
      // Load weeks
      const { data: weeks } = await supabase
        .from('weeks')
        .select('*')
        .order('week_number');
      this.weeks = weeks || [];

      // Load tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .order('order_index');
      this.tasks = tasks || [];

      // Load trainees
      const { data: trainees } = await supabase
        .from('trainees')
        .select('*')
        .order('created_at');
      this.trainees = trainees || [];

      // Load mentors
      const { data: mentors } = await supabase
        .from('mentors')
        .select('*');
      this.mentors = mentors || [];

      // Load categories
      const { data: categories } = await supabase
        .from('task_categories')
        .select('*')
        .order('id');
      this.categories = categories || [];

      // Load statuses
      const { data: statuses } = await supabase
        .from('task_statuses')
        .select('*')
        .order('sort_order');
      this.statuses = statuses || [];

      // Load progress
      const { data: progress } = await supabase
        .from('progress')
        .select('*');
      this.progress = progress || [];
    },

    subscribeToRealtime() {
      // Subscribe to progress changes
      supabase
        .channel('tracking-progress-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, (payload) => {
          this.handleProgressChange(payload);
        })
        .subscribe();

      // Subscribe to trainees
      supabase
        .channel('tracking-trainees-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trainees' }, () => {
          this.loadData();
        })
        .subscribe();
    },

    handleProgressChange(payload) {
      if (payload.eventType === 'INSERT') {
        this.progress.push(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        const idx = this.progress.findIndex(p => p.id === payload.new.id);
        if (idx !== -1) {
          this.progress[idx] = payload.new;
        }
      } else if (payload.eventType === 'DELETE') {
        this.progress = this.progress.filter(p => p.id !== payload.old.id);
      }
    },

    // Helpers
    getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getMentorName(mentorId) {
      const mentor = this.mentors.find(m => m.id === mentorId);
      return mentor?.name || 'Unknown';
    },

    getWeekNumber(weekId) {
      const week = this.weeks.find(w => w.id === weekId);
      return week?.week_number || 1;
    },

    getCategory(categoryId) {
      return this.categories.find(c => c.id === categoryId) || { name: 'unknown', label: 'Unknown', color: '#888' };
    },

    isScorableCategory(categoryId) {
      const category = this.getCategory(categoryId);
      return category.has_score === true;
    },

    getStatus(statusId) {
      return this.statuses.find(s => s.id === statusId) || this.getDefaultStatus();
    },

    getDefaultStatus() {
      return this.statuses.find(s => s.name === 'pending') || { id: null, name: 'pending', label: 'Pending', color: '#6b7280' };
    },

    getDefaultStatusId() {
      return this.getDefaultStatus().id;
    },

    getTaskStatusId(traineeId, taskId) {
      const prog = this.progress.find(p => p.trainee_id === traineeId && p.task_id === taskId);
      return prog?.status_id || this.getDefaultStatusId();
    },

    getTaskProgress(traineeId, taskId) {
      return this.progress.find(p => p.trainee_id === traineeId && p.task_id === taskId);
    },


    formatTime(timestamp) {
      if (!timestamp) return '-';
      const date = new Date(timestamp);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
      return date.toLocaleDateString();
    },

    // Stats
    getTotalTasksCount() {
      return this.tasks.length * this.trainees.length;
    },

    getStatusCount(statusName) {
      const status = this.statuses.find(s => s.name === statusName);
      if (!status) return 0;

      if (statusName === 'pending') {
        const trackedCount = this.progress.length;
        const totalPossible = this.getTotalTasksCount();
        const explicitPending = this.progress.filter(p => p.status_id === status.id).length;
        return (totalPossible - trackedCount) + explicitPending;
      }
      return this.progress.filter(p => p.status_id === status.id).length;
    },

    // Filters
    resetFilters() {
      this.filters.trainee = '';
      this.filters.week = '';
      this.filters.status = '';
    },

    getFilteredTasks() {
      const result = [];

      for (const trainee of this.trainees) {
        // Filter by trainee
        if (this.filters.trainee && trainee.id !== this.filters.trainee) {
          continue;
        }

        for (const task of this.tasks) {
          // Filter by week
          if (this.filters.week && task.week_id !== this.filters.week) {
            continue;
          }

          const statusId = this.getTaskStatusId(trainee.id, task.id);
          const status = this.getStatus(statusId);

          // Filter by status (filters.status contains status_id as string)
          if (this.filters.status && statusId !== parseInt(this.filters.status)) {
            continue;
          }

          const prog = this.getTaskProgress(trainee.id, task.id);
          const weekNumber = this.getWeekNumber(task.week_id);

          result.push({
            trainee,
            task,
            weekNumber,
            statusId,
            status,
            score: prog?.score,
            startDate: prog?.start_date,
            dueDate: prog?.due_date,
            startedAt: prog?.started_at,
            completedAt: prog?.completed_at,
            updatedAt: prog?.updated_at,
            updatedBy: prog?.updated_by_mentor_id ? this.getMentorName(prog.updated_by_mentor_id) : null
          });
        }
      }

      // Sort by trainee name, then week, then task order
      result.sort((a, b) => {
        const nameCompare = a.trainee.name.localeCompare(b.trainee.name);
        if (nameCompare !== 0) return nameCompare;

        const weekCompare = a.weekNumber - b.weekNumber;
        if (weekCompare !== 0) return weekCompare;

        return (a.task.order_index || 0) - (b.task.order_index || 0);
      });

      return result;
    },

    // Date helpers
    isOverdue(item) {
      if (!item.dueDate || item.status?.name === 'done') return false;
      return new Date(item.dueDate) < new Date();
    },

    isDueSoon(item) {
      if (!item.dueDate || item.status?.name === 'done') return false;
      const due = new Date(item.dueDate);
      const now = new Date();
      const diffDays = (due - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    },

    formatDateTime(timestamp) {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleString();
    },

    // Duration calculation
    calculateDuration(startedAt, completedAt) {
      if (!startedAt) return null;

      const start = new Date(startedAt);
      const end = completedAt ? new Date(completedAt) : new Date();
      const diffMs = end - start;

      if (diffMs < 0) return null;

      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        const remainingHours = diffHours % 24;
        return remainingHours > 0 ? `${diffDays}d ${remainingHours}h` : `${diffDays}d`;
      }
      if (diffHours > 0) {
        const remainingMins = diffMins % 60;
        return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`;
      }
      return `${diffMins}m`;
    },

    formatDuration(item) {
      const prog = this.getTaskProgress(item.trainee.id, item.task.id);
      if (!prog?.duration_minutes) return '-';

      const mins = prog.duration_minutes;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;

      if (hours > 0) {
        return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
      }
      return `${mins}m`;
    },

    getDurationStatus(item) {
      const prog = this.getTaskProgress(item.trainee.id, item.task.id);
      if (!prog?.duration_minutes) return 'not-started';
      if (item.status?.name === 'done') return 'completed';
      return 'in-progress';
    },

    // Modal functions
    openEditModal(item) {
      this.editingItem = item;
      const prog = this.getTaskProgress(item.trainee.id, item.task.id);
      this.editForm = {
        status_id: item.statusId || this.getDefaultStatusId(),
        start_date: item.startDate || '',
        due_date: item.dueDate || '',
        score: item.score || null,
        duration_minutes: prog?.duration_minutes || null
      };
      this.showEditModal = true;
    },

    async saveProgress() {
      const existingProgress = this.progress.find(
        p => p.trainee_id === this.editingItem.trainee.id && p.task_id === this.editingItem.task.id
      );

      // Only include score if category supports it
      const scoreValue = this.isScorableCategory(this.editingItem.task.category_id)
        ? (this.editForm.score ? parseInt(this.editForm.score) : null)
        : null;

      const updateData = {
        status_id: parseInt(this.editForm.status_id),
        start_date: this.editForm.start_date || null,
        due_date: this.editForm.due_date || null,
        score: scoreValue,
        duration_minutes: this.editForm.duration_minutes ? parseInt(this.editForm.duration_minutes) : null,
        updated_by_mentor_id: this.currentMentor.id,
        updated_at: new Date().toISOString()
      };

      if (existingProgress) {
        await supabase
          .from('progress')
          .update(updateData)
          .eq('id', existingProgress.id);

        // Optimistic update
        Object.assign(existingProgress, updateData);
      } else {
        const { data } = await supabase
          .from('progress')
          .insert({
            trainee_id: this.editingItem.trainee.id,
            task_id: this.editingItem.task.id,
            ...updateData
          })
          .select()
          .single();

        if (data) {
          this.progress.push(data);
        }
      }

      this.showEditModal = false;
      this.editingItem = null;
    }
  }));
});
