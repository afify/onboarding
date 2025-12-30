import { supabase, getSession } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('traineesPage', () => ({
    trainees: [],
    mentors: [],
    tasks: [],
    progress: [],
    weeks: [],
    showAddModal: false,
    showEditModal: false,
    showDeleteModal: false,
    newTrainee: {
      name: '',
      email: '',
      assigned_mentor_id: '',
      start_date: new Date().toISOString().split('T')[0]
    },
    editingTrainee: null,
    deleteTarget: null,

    async init() {
      const session = await getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      await this.loadData();
      this.subscribeToChanges();
    },

    async loadData() {
      const [traineesRes, mentorsRes, tasksRes, progressRes, weeksRes] = await Promise.all([
        supabase.from('trainees').select('*').order('created_at', { ascending: false }),
        supabase.from('mentors').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('progress').select('*'),
        supabase.from('weeks').select('*').order('week_number')
      ]);

      this.trainees = traineesRes.data || [];
      this.mentors = mentorsRes.data || [];
      this.tasks = tasksRes.data || [];
      this.progress = progressRes.data || [];
      this.weeks = weeksRes.data || [];
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
      if (!this.newTrainee.name.trim()) return;

      const { error } = await supabase.from('trainees').insert({
        name: this.newTrainee.name.trim(),
        email: this.newTrainee.email.trim() || null,
        assigned_mentor_id: this.newTrainee.assigned_mentor_id || null,
        start_date: this.newTrainee.start_date
      });

      if (!error) {
        this.newTrainee = {
          name: '',
          email: '',
          assigned_mentor_id: '',
          start_date: new Date().toISOString().split('T')[0]
        };
        this.showAddModal = false;
      }
    },

    // Edit Trainee
    editTrainee(trainee) {
      this.editingTrainee = { ...trainee };
      this.showEditModal = true;
    },

    async saveTrainee() {
      if (!this.editingTrainee.name.trim()) return;

      const { error } = await supabase
        .from('trainees')
        .update({
          name: this.editingTrainee.name.trim(),
          email: this.editingTrainee.email?.trim() || null,
          assigned_mentor_id: this.editingTrainee.assigned_mentor_id || null,
          start_date: this.editingTrainee.start_date
        })
        .eq('id', this.editingTrainee.id);

      if (!error) {
        this.showEditModal = false;
        this.editingTrainee = null;
      }
    },

    // Delete Trainee
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

      if (!error) {
        this.showDeleteModal = false;
        this.deleteTarget = null;
      }
    }
  }));
});
