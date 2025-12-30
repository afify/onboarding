import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('dashboard', () => ({
    get currentMentor() { return Alpine.store('app').mentor; },
    get weeks() { return Alpine.store('app').weeks; },
    get tasks() { return Alpine.store('app').tasks; },
    get trainees() { return Alpine.store('app').trainees; },
    get mentors() { return Alpine.store('app').mentors; },
    get progress() { return Alpine.store('app').progress; },
    get activities() { return Alpine.store('app').activityLog; },

    notes: [],
    selectedWeek: 1,
    expandedTrainee: null,
    showAddModal: false,
    showEditNoteModal: false,
    showDeleteNoteModal: false,
    editingNote: { id: null, content: '' },
    deleteNoteTarget: null,
    newNote: '',
    newTrainee: {
      name: '',
      email: '',
      assigned_mentor_id: '',
      start_date: new Date().toISOString().split('T')[0]
    },

    async init() {
      const store = Alpine.store('app');

      await store.initAuth();

      if (!store.session) {
        window.location.href = '/';
        return;
      }

      await store.loadData();

      if (!store.mentor) {
        window.location.href = '/';
        return;
      }

      await this.loadNotes();

      this.subscribeToRealtime();
    },

    async loadNotes() {
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      this.notes = notes || [];
    },

    async loadData() {
      await Alpine.store('app').loadData(true);
      await this.loadNotes();
    },

    subscribeToRealtime() {
      const store = Alpine.store('app');

      supabase
        .channel('dashboard-progress-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, (payload) => {
          this.handleProgressChange(payload);
        })
        .subscribe();

      supabase
        .channel('dashboard-notes-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
          this.notes.unshift(payload.new);
        })
        .subscribe();

      supabase
        .channel('dashboard-trainees-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trainees' }, () => {
          this.loadData();
        })
        .subscribe();
    },

    handleProgressChange(payload) {
      const store = Alpine.store('app');
      if (payload.eventType === 'INSERT') {
        store.progress.push(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        const idx = store.progress.findIndex(p => p.id === payload.new.id);
        if (idx !== -1) {
          store.progress[idx] = payload.new;
        }
      } else if (payload.eventType === 'DELETE') {
        store.progress = store.progress.filter(p => p.id !== payload.old.id);
      }
    },

    getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getMentorName(mentorId) {
      const mentor = this.mentors.find(m => m.id === mentorId);
      return mentor?.name || 'Unassigned';
    },

    getMentorInitials(mentorId) {
      const mentor = this.mentors.find(m => m.id === mentorId);
      return mentor ? this.getInitials(mentor.name) : '?';
    },

    getWeekTaskCount(weekId) {
      return this.tasks.filter(t => t.week_id === weekId).length;
    },

    getSelectedWeekNumber() {
      const week = this.weeks.find(w => w.id === this.selectedWeek);
      return week?.week_number || 1;
    },

    getTasksForWeek(weekId) {
      return this.tasks.filter(t => t.week_id === weekId);
    },

    getTaskStatus(traineeId, taskId) {
      const prog = this.progress.find(p => p.trainee_id === traineeId && p.task_id === taskId);
      return prog?.status || 'pending';
    },

    formatStatus(status) {
      const labels = {
        pending: 'Pending',
        in_progress: 'In Progress',
        done: 'Done',
        blocked: 'Blocked'
      };
      return labels[status] || status;
    },

    getCurrentWeek(traineeId) {
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId && p.status === 'done');
      const completedTaskIds = traineeProgress.map(p => p.task_id);

      for (const week of this.weeks) {
        const weekTasks = this.tasks.filter(t => t.week_id === week.id);
        const allDone = weekTasks.every(t => completedTaskIds.includes(t.id));
        if (!allDone) {
          return week.week_number;
        }
      }
      return 6;
    },

    getTraineeProgress(traineeId) {
      const totalTasks = this.tasks.length;
      if (totalTasks === 0) return 0;

      const doneTasks = this.progress.filter(p => p.trainee_id === traineeId && p.status === 'done').length;
      return Math.round((doneTasks / totalTasks) * 100);
    },

    getAverageProgress() {
      if (this.trainees.length === 0) return 0;
      const total = this.trainees.reduce((sum, t) => sum + this.getTraineeProgress(t.id), 0);
      return Math.round(total / this.trainees.length);
    },

    getCompletedTasksCount() {
      return this.progress.filter(p => p.status === 'done').length;
    },

    getTotalTasksCount() {
      return this.tasks.length * this.trainees.length;
    },

    getInProgressCount() {
      return this.progress.filter(p => p.status === 'in_progress').length;
    },

    getStatusPercent(status) {
      const total = this.getTotalTasksCount();
      if (total === 0) return 0;

      let count;
      if (status === 'pending') {
        const tracked = this.progress.length;
        count = total - tracked + this.progress.filter(p => p.status === 'pending').length;
      } else {
        count = this.progress.filter(p => p.status === status).length;
      }

      return Math.round((count / total) * 100);
    },

    getTraineeNotes(traineeId) {
      return this.notes.filter(n => n.trainee_id === traineeId).slice(0, 5);
    },

    async cycleTaskStatus(traineeId, taskId) {
      const currentStatus = this.getTaskStatus(traineeId, taskId);
      const statusOrder = ['pending', 'in_progress', 'done', 'blocked'];
      const currentIdx = statusOrder.indexOf(currentStatus);
      const newStatus = statusOrder[(currentIdx + 1) % statusOrder.length];

      const existingProgress = this.progress.find(p => p.trainee_id === traineeId && p.task_id === taskId);

      if (existingProgress) {
        await supabase
          .from('progress')
          .update({ status: newStatus, updated_by_mentor_id: this.currentMentor.id, updated_at: new Date().toISOString() })
          .eq('id', existingProgress.id);
      } else {
        await supabase
          .from('progress')
          .insert({
            trainee_id: traineeId,
            task_id: taskId,
            status: newStatus,
            updated_by_mentor_id: this.currentMentor.id
          });
      }

      if (existingProgress) {
        existingProgress.status = newStatus;
      } else {
        this.progress.push({
          id: crypto.randomUUID(),
          trainee_id: traineeId,
          task_id: taskId,
          status: newStatus,
          updated_by_mentor_id: this.currentMentor.id
        });
      }
    },

    async addNote(traineeId) {
      const content = sanitizeInput(this.newNote, 2000);
      if (!content) return;

      await supabase
        .from('notes')
        .insert({
          trainee_id: traineeId,
          mentor_id: this.currentMentor.id,
          content
        });

      this.newNote = '';
    },

    editNote(note) {
      this.editingNote = { ...note };
      this.showEditNoteModal = true;
    },

    async saveNote() {
      const content = sanitizeInput(this.editingNote.content, 2000);
      if (!content) return;

      const { error } = await supabase
        .from('notes')
        .update({ content })
        .eq('id', this.editingNote.id);

      if (!error) {
        const idx = this.notes.findIndex(n => n.id === this.editingNote.id);
        if (idx !== -1) {
          this.notes[idx].content = content;
        }
        this.showEditNoteModal = false;
        this.editingNote = { id: null, content: '' };
      }
    },

    confirmDeleteNote(note) {
      this.deleteNoteTarget = note;
      this.showDeleteNoteModal = true;
    },

    async executeDeleteNote() {
      if (!this.deleteNoteTarget) return;

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', this.deleteNoteTarget.id);

      if (!error) {
        this.notes = this.notes.filter(n => n.id !== this.deleteNoteTarget.id);
        this.showDeleteNoteModal = false;
        this.deleteNoteTarget = null;
      }
    },

    showResetProgressModal: false,
    resetProgressTarget: null,

    async resetTaskProgress(traineeId, taskId) {
      const existingProgress = this.progress.find(p => p.trainee_id === traineeId && p.task_id === taskId);

      if (existingProgress) {
        const { error } = await supabase
          .from('progress')
          .delete()
          .eq('id', existingProgress.id);

        if (!error) {
          this.progress = this.progress.filter(p => p.id !== existingProgress.id);
        }
      }
    },

    confirmResetAllProgress(trainee) {
      this.resetProgressTarget = trainee;
      this.showResetProgressModal = true;
    },

    async executeResetAllProgress() {
      if (!this.resetProgressTarget) return;

      const { error } = await supabase
        .from('progress')
        .delete()
        .eq('trainee_id', this.resetProgressTarget.id);

      if (!error) {
        this.progress = this.progress.filter(p => p.trainee_id !== this.resetProgressTarget.id);
        this.showResetProgressModal = false;
        this.resetProgressTarget = null;
      }
    },

    async addTrainee() {
      const name = sanitizeInput(this.newTrainee.name, 100);
      const email = this.newTrainee.email ? sanitizeInput(this.newTrainee.email, 254) : null;

      if (!isValidName(name)) return;
      if (email && !isValidEmail(email)) return;

      await supabase
        .from('trainees')
        .insert({
          name,
          email,
          assigned_mentor_id: this.newTrainee.assigned_mentor_id || null,
          start_date: this.newTrainee.start_date
        });

      this.newTrainee = {
        name: '',
        email: '',
        assigned_mentor_id: '',
        start_date: new Date().toISOString().split('T')[0]
      };
      this.showAddModal = false;
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return date.toLocaleDateString();
    },

    formatActivity(activity) {
      const mentor = this.mentors.find(m => m.id === activity.mentor_id);
      const mentorName = mentor?.name || 'Someone';

      if (activity.entity_type === 'progress' && activity.details) {
        const task = this.tasks.find(t => t.id === activity.details.task_id);
        const trainee = this.trainees.find(t => t.id === activity.details.trainee_id);
        const taskName = task?.title || 'a task';
        const traineeName = trainee?.name || 'a trainee';
        const status = activity.details.status;

        return `<strong>${mentorName}</strong> marked <span class="highlight">${taskName}</span> as ${status} for ${traineeName}`;
      }

      if (activity.entity_type === 'notes') {
        return `<strong>${mentorName}</strong> added a note`;
      }

      if (activity.entity_type === 'trainees' && activity.action === 'INSERT') {
        return `<strong>${mentorName}</strong> added a new trainee`;
      }

      return `<strong>${mentorName}</strong> made an update`;
    },

    async handleLogout() {
      await signOut();
      window.location.href = '/';
    }
  }));
});
