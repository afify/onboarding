import { supabase, getSession, getCurrentUser, getMentorProfile, signOut } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('dashboard', () => ({
    // State
    currentMentor: null,
    weeks: [],
    tasks: [],
    trainees: [],
    mentors: [],
    progress: [],
    notes: [],
    activities: [],
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

      // Load progress
      const { data: progress } = await supabase
        .from('progress')
        .select('*');
      this.progress = progress || [];

      // Load notes
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      this.notes = notes || [];

      // Load recent activity
      const { data: activities } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      this.activities = activities || [];
    },

    subscribeToRealtime() {
      // Subscribe to progress changes
      supabase
        .channel('progress-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, (payload) => {
          this.handleProgressChange(payload);
        })
        .subscribe();

      // Subscribe to activity log
      supabase
        .channel('activity-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
          this.activities.unshift(payload.new);
        })
        .subscribe();

      // Subscribe to notes
      supabase
        .channel('notes-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
          this.notes.unshift(payload.new);
        })
        .subscribe();

      // Subscribe to trainees
      supabase
        .channel('trainees-changes')
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
      // Calculate based on progress
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

    // Analytics helpers
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
        // Pending = total possible - all tracked progress entries
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

      // Optimistic update
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
      if (!this.newNote.trim()) return;

      await supabase
        .from('notes')
        .insert({
          trainee_id: traineeId,
          mentor_id: this.currentMentor.id,
          content: this.newNote.trim()
        });

      this.newNote = '';
    },

    // Edit Note
    editNote(note) {
      this.editingNote = { ...note };
      this.showEditNoteModal = true;
    },

    async saveNote() {
      if (!this.editingNote.content.trim()) return;

      const { error } = await supabase
        .from('notes')
        .update({ content: this.editingNote.content.trim() })
        .eq('id', this.editingNote.id);

      if (!error) {
        // Update local state
        const idx = this.notes.findIndex(n => n.id === this.editingNote.id);
        if (idx !== -1) {
          this.notes[idx].content = this.editingNote.content.trim();
        }
        this.showEditNoteModal = false;
        this.editingNote = { id: null, content: '' };
      }
    },

    // Delete Note
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
        // Update local state
        this.notes = this.notes.filter(n => n.id !== this.deleteNoteTarget.id);
        this.showDeleteNoteModal = false;
        this.deleteNoteTarget = null;
      }
    },

    // Reset Progress
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
      if (!this.newTrainee.name.trim()) return;

      await supabase
        .from('trainees')
        .insert({
          name: this.newTrainee.name.trim(),
          email: this.newTrainee.email.trim() || null,
          assigned_mentor_id: this.newTrainee.assigned_mentor_id || null,
          start_date: this.newTrainee.start_date
        });

      // Reset form
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
