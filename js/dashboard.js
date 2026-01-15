import { supabase, signOut } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput, escapeHtml } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('dashboard', () => ({
    get currentMentor() { return Alpine.store('app').mentor; },
    get weeks() { return Alpine.store('app').weeks; },
    get tasks() { return Alpine.store('app').tasks; },
    get trainees() { return Alpine.store('app').trainees; },
    get mentors() { return Alpine.store('app').mentors; },
    get progress() { return Alpine.store('app').progress; },
    get categories() { return Alpine.store('app').categories; },
    get statuses() { return Alpine.store('app').statuses; },
    get activities() { return Alpine.store('app').activityLog; },
    get candidates() { return Alpine.store('app').candidates || []; },
    get interviews() { return Alpine.store('app').interviews || []; },
    get interviewStages() { return Alpine.store('app').interviewStages || []; },

    notes: [],
    selectedWeek: 1,
    expandedTrainee: null,
    showAddModal: false,
    showEditNoteModal: false,
    showDeleteNoteModal: false,
    editingNote: { id: null, content: '' },
    deleteNoteTarget: null,
    newNote: '',
    alert: { show: false, type: '', message: '' },
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
          store.progress.splice(idx, 1, payload.new);
        }
      } else if (payload.eventType === 'DELETE') {
        store.progress = store.progress.filter(p => p.id !== payload.old.id);
      }
    },

    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getStatusByName(statusName) {
      return this.statuses.find(s => s.name === statusName);
    },

    getStatusId(statusName) {
      const status = this.getStatusByName(statusName);
      return status?.id || null;
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
      switch (status) {
        case 'pending': return 'Pending';
        case 'in_progress': return 'In Progress';
        case 'done': return 'Done';
        case 'blocked': return 'Blocked';
        default: return status;
      }
    },

    getCurrentWeek(traineeId) {
      const doneStatusId = this.getStatusId('done');
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId && p.status_id === doneStatusId);
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

      const doneStatusId = this.getStatusId('done');
      const doneTasks = this.progress.filter(p => p.trainee_id === traineeId && p.status_id === doneStatusId).length;
      return Math.round((doneTasks / totalTasks) * 100);
    },

    getAverageProgress() {
      if (this.trainees.length === 0) return 0;
      const total = this.trainees.reduce((sum, t) => sum + this.getTraineeProgress(t.id), 0);
      return Math.round(total / this.trainees.length);
    },

    getCompletedTasksCount() {
      const doneStatusId = this.getStatusId('done');
      return this.progress.filter(p => p.status_id === doneStatusId).length;
    },

    getTotalTasksCount() {
      return this.tasks.length * this.trainees.length;
    },

    getInProgressCount() {
      const inProgressStatusId = this.getStatusId('in_progress');
      return this.progress.filter(p => p.status_id === inProgressStatusId).length;
    },

    getStatusPercent(statusName) {
      const total = this.getTotalTasksCount();
      if (total === 0) return 0;

      const statusId = this.getStatusId(statusName);
      let count;
      if (statusName === 'pending') {
        const tracked = this.progress.length;
        count = total - tracked + this.progress.filter(p => p.status_id === statusId).length;
      } else {
        count = this.progress.filter(p => p.status_id === statusId).length;
      }

      return Math.round((count / total) * 100);
    },

    getBlockedCount() {
      const blockedStatusId = this.getStatusId('blocked');
      return this.progress.filter(p => p.status_id === blockedStatusId).length;
    },

    // Interview statistics
    getActiveCandidatesCount() {
      return this.candidates.length;
    },

    getCompletedInterviewsCount() {
      return this.interviews.filter(i => i.status === 'completed').length;
    },

    getScheduledInterviewsCount() {
      return this.interviews.filter(i => i.status === 'scheduled').length;
    },

    getInterviewStagesCount() {
      return this.interviewStages.length;
    },

    getInterviewPassRate() {
      const completed = this.interviews.filter(i => i.status === 'completed');
      if (completed.length === 0) return 0;
      const passed = completed.filter(i => i.decision === 'pass').length;
      return Math.round((passed / completed.length) * 100);
    },

    getCandidatesByStage(stageId) {
      return this.candidates.filter(c => c.current_stage_id === stageId).length;
    },

    getHiredCandidatesCount() {
      return this.candidates.filter(c => c.status === 'hired').length;
    },

    getRejectedCandidatesCount() {
      return this.candidates.filter(c => c.status === 'rejected').length;
    },

    getPendingDecisionsCount() {
      // Candidates still active in the pipeline (not hired, not rejected)
      return this.candidates.filter(c => !c.status || c.status === 'active').length;
    },

    getTotalOutcomes() {
      return this.getHiredCandidatesCount() + this.getRejectedCandidatesCount() + this.getPendingDecisionsCount();
    },

    getOutcomePercent(type) {
      const total = this.getTotalOutcomes();
      if (total === 0) return 0;
      let count = 0;
      if (type === 'hired') count = this.getHiredCandidatesCount();
      else if (type === 'rejected') count = this.getRejectedCandidatesCount();
      else if (type === 'pending') count = this.getPendingDecisionsCount();
      return Math.round((count / total) * 100);
    },

    getRecentInterviews() {
      return this.interviews
        .filter(i => i.status === 'completed')
        .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))
        .slice(0, 5);
    },

    getCandidateName(candidateId) {
      const candidate = this.candidates.find(c => c.id === candidateId);
      return candidate?.name || 'Unknown';
    },

    getCandidateInitials(candidateId) {
      const name = this.getCandidateName(candidateId);
      return this.getInitials(name);
    },

    getInterviewStageName(stageId) {
      const stage = this.interviewStages.find(s => s.id === stageId);
      return stage?.label || 'Unknown Stage';
    },

    formatDecisionShort(decision) {
      if (decision === 'pass') return '✓';
      if (decision === 'fail') return '✗';
      return '?';
    },

    getWeekCompletionPercent(weekId) {
      const weekTasks = this.tasks.filter(t => t.week_id === weekId);
      if (weekTasks.length === 0 || this.trainees.length === 0) return 0;

      const doneStatusId = this.getStatusId('done');
      const totalPossible = weekTasks.length * this.trainees.length;
      const completed = this.progress.filter(p => {
        const task = this.tasks.find(t => t.id === p.task_id);
        return task && task.week_id === weekId && p.status_id === doneStatusId;
      }).length;

      return Math.round((completed / totalPossible) * 100);
    },

    getCategoryTaskCount(categoryId) {
      return this.tasks.filter(t => t.category_id === categoryId).length;
    },

    getCategoryPercent(categoryId) {
      if (this.tasks.length === 0) return 0;
      const count = this.getCategoryTaskCount(categoryId);
      return Math.round((count / this.tasks.length) * 100);
    },

    // CSP-safe helper methods for computed values
    traineesCountLabel() {
      return this.trainees.length + ' trainees';
    },

    progressRingDasharray() {
      return (this.getAverageProgress() * 94.2 / 100) + ' 94.2';
    },

    totalTasksLabel() {
      return '/ ' + this.getTotalTasksCount();
    },

    statusPercentLabel(status) {
      return this.getStatusPercent(status) + '%';
    },

    donutDasharray(status) {
      return (this.getStatusPercent(status) * 4.4) + ' 440';
    },

    donutOffset(statuses) {
      const total = statuses.reduce((sum, s) => sum + this.getStatusPercent(s), 0);
      return -(total * 4.4);
    },

    weekLabel(weekNumber) {
      return 'W' + weekNumber;
    },

    weekCompletionLabel(weekId) {
      return this.getWeekCompletionPercent(weekId) + '%';
    },

    barFillStyle(weekId) {
      return 'height: ' + this.getWeekCompletionPercent(weekId) + '%';
    },

    categoryIconStyle(color) {
      return 'background: ' + color + '20; color: ' + color;
    },

    categoryBarStyle(categoryId, color) {
      return 'width: ' + this.getCategoryPercent(categoryId) + '%; background: linear-gradient(90deg, ' + color + '80, ' + color + ')';
    },

    traineeProgressLabel(traineeId) {
      return this.getTraineeProgress(traineeId) + '%';
    },

    traineeProgressStyle(traineeId) {
      return 'width: ' + this.getTraineeProgress(traineeId) + '%';
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
        const existingNote = this.notes.find(n => n.id === this.editingNote.id);
        if (existingNote) {
          const updatedNote = { ...existingNote, content };
          const idx = this.notes.indexOf(existingNote);
          this.notes.splice(idx, 1, updatedNote);
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

      if (!isValidName(name)) {
        this.showAlert('error', 'Invalid name format');
        return;
      }
      if (email && !isValidEmail(email)) {
        this.showAlert('error', 'Invalid email format');
        return;
      }

      const { error } = await supabase
        .from('trainees')
        .insert({
          name,
          email,
          assigned_mentor_id: this.newTrainee.assigned_mentor_id || null,
          start_date: this.newTrainee.start_date
        });

      if (error) {
        this.showAlert('error', error.message || 'Failed to add trainee');
      } else {
        this.showAlert('success', `Trainee "${name}" added successfully`);
        this.newTrainee = {
          name: '',
          email: '',
          assigned_mentor_id: '',
          start_date: new Date().toISOString().split('T')[0]
        };
        this.showAddModal = false;
      }
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Alpine.store('app').formatDate(date);
    },

    formatActivity(activity) {
      const mentor = this.mentors.find(m => m.id === activity.mentor_id);
      const mentorName = escapeHtml(mentor?.name || 'Someone');

      if (activity.entity_type === 'progress' && activity.details) {
        const task = this.tasks.find(t => t.id === activity.details.task_id);
        const trainee = this.trainees.find(t => t.id === activity.details.trainee_id);
        const taskName = escapeHtml(task?.title || 'a task');
        const traineeName = escapeHtml(trainee?.name || 'a trainee');
        const status = escapeHtml(activity.details.status || 'updated');

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
