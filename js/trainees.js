import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('traineesPage', () => ({
    get trainees() { return Alpine.store('app').trainees; },
    get mentors() { return Alpine.store('app').mentors; },
    get tasks() { return Alpine.store('app').tasks; },
    get progress() { return Alpine.store('app').progress; },
    get weeks() { return Alpine.store('app').weeks; },

    showAddModal: false,
    showEditModal: false,
    showDeleteModal: false,
    alert: { show: false, type: '', message: '' },
    newTrainee: {
      name: '',
      email: '',
      assigned_mentor_id: '',
      start_date: new Date().toISOString().split('T')[0]
    },
    editingTrainee: null,
    deleteTarget: null,

    async init() {
      const store = Alpine.store('app');

      await store.initAuth();

      if (!store.session) {
        window.location.href = '/';
        return;
      }

      await store.loadData();

      this.subscribeToChanges();
    },

    async loadData() {
      await Alpine.store('app').loadData(true);
    },

    subscribeToChanges() {
      supabase
        .channel('trainees-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trainees' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, () => {
          this.loadData();
        })
        .subscribe();
    },

    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    getInitials(name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getMentorName(mentorId) {
      const mentor = this.mentors.find(m => m.id === mentorId);
      return mentor?.name || 'Unassigned';
    },

    getProgress(traineeId) {
      const totalTasks = this.tasks.length;
      if (totalTasks === 0) return 0;
      const doneTasks = this.progress.filter(p => p.trainee_id === traineeId && p.status === 'done').length;
      return Math.round((doneTasks / totalTasks) * 100);
    },

    getCompletedTasks(traineeId) {
      return this.progress.filter(p => p.trainee_id === traineeId && p.status === 'done').length;
    },

    getCurrentWeek(traineeId) {
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId && p.status === 'done');
      const completedTaskIds = traineeProgress.map(p => p.task_id);

      for (const week of this.weeks) {
        const weekTasks = this.tasks.filter(t => t.week_id === week.id);
        const allDone = weekTasks.length > 0 && weekTasks.every(t => completedTaskIds.includes(t.id));
        if (!allDone) {
          return week.week_number;
        }
      }
      return this.weeks.length || 1;
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

      const { error } = await supabase.from('trainees').insert({
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

    editTrainee(trainee) {
      this.editingTrainee = { ...trainee };
      this.showEditModal = true;
    },

    async saveTrainee() {
      const name = sanitizeInput(this.editingTrainee.name, 100);
      const email = this.editingTrainee.email ? sanitizeInput(this.editingTrainee.email, 254) : null;

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
        .update({
          name,
          email,
          assigned_mentor_id: this.editingTrainee.assigned_mentor_id || null,
          start_date: this.editingTrainee.start_date
        })
        .eq('id', this.editingTrainee.id);

      if (error) {
        this.showAlert('error', error.message || 'Failed to update trainee');
      } else {
        this.showAlert('success', `Trainee "${name}" updated successfully`);
        this.showEditModal = false;
        this.editingTrainee = null;
      }
    },

    confirmDelete(trainee) {
      this.deleteTarget = trainee;
      this.showDeleteModal = true;
    },

    async executeDelete() {
      if (!this.deleteTarget) return;

      const { error } = await supabase
        .from('trainees')
        .delete()
        .eq('id', this.deleteTarget.id);

      if (error) {
        this.showAlert('error', error.message || 'Failed to delete trainee');
      } else {
        this.showAlert('success', `Trainee "${this.deleteTarget.name}" deleted successfully`);
        this.showDeleteModal = false;
        this.deleteTarget = null;
      }
    }
  }));
});
