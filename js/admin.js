import { supabase, getSession, getCurrentUser, getMentorProfile, isAdmin } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('adminPanel', () => ({
    // State
    mentors: [],
    trainees: [],
    activeTab: 'mentors',

    // Modal states
    showAddMentorModal: false,
    showEditMentorModal: false,
    showAddTraineeModal: false,
    showEditTraineeModal: false,
    showDeleteModal: false,

    deleteTarget: null,
    deleteType: null,
    alert: { show: false, type: '', message: '' },

    // Form data
    newMentor: { name: '', email: '', password: '', role: 'mentor' },
    editingMentor: null,
    newTrainee: {
      name: '',
      email: '',
      assigned_mentor_id: '',
      start_date: new Date().toISOString().split('T')[0]
    },
    editingTrainee: null,

    async init() {
      // Check admin access
      const session = await getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      const isAdminUser = await isAdmin();
      if (!isAdminUser) {
        window.location.href = '/dashboard.html';
        return;
      }

      await this.loadData();
    },

    async loadData() {
      const { data: mentors } = await supabase.from('mentors').select('*').order('created_at');
      this.mentors = mentors || [];

      const { data: trainees } = await supabase.from('trainees').select('*').order('created_at');
      this.trainees = trainees || [];
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

    getMentorTraineeCount(mentorId) {
      return this.trainees.filter(t => t.assigned_mentor_id === mentorId).length;
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    async addMentor() {
      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: this.newMentor.email,
          password: this.newMentor.password,
          email_confirm: true
        });

        if (authError) {
          // Try signup instead for non-admin
          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: this.newMentor.email,
            password: this.newMentor.password
          });

          if (signupError) throw signupError;

          // Insert into mentors table
          await supabase.from('mentors').insert({
            id: signupData.user.id,
            email: this.newMentor.email,
            name: this.newMentor.name,
            role: this.newMentor.role
          });
        } else {
          // Insert into mentors table
          await supabase.from('mentors').insert({
            id: authData.user.id,
            email: this.newMentor.email,
            name: this.newMentor.name,
            role: this.newMentor.role
          });
        }

        this.showAlert('success', `Mentor "${this.newMentor.name}" created successfully`);
        this.newMentor = { name: '', email: '', password: '', role: 'mentor' };
        this.showAddMentorModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create mentor');
      }
    },

    async addTrainee() {
      try {
        await supabase.from('trainees').insert({
          name: this.newTrainee.name,
          email: this.newTrainee.email || null,
          assigned_mentor_id: this.newTrainee.assigned_mentor_id || null,
          start_date: this.newTrainee.start_date
        });

        this.showAlert('success', `Trainee "${this.newTrainee.name}" added successfully`);
        this.newTrainee = {
          name: '',
          email: '',
          assigned_mentor_id: '',
          start_date: new Date().toISOString().split('T')[0]
        };
        this.showAddTraineeModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to add trainee');
      }
    },

    // Edit Mentor
    editMentor(mentor) {
      this.editingMentor = { ...mentor };
      this.showEditMentorModal = true;
    },

    async saveMentor() {
      try {
        const { error } = await supabase
          .from('mentors')
          .update({
            name: this.editingMentor.name,
            role: this.editingMentor.role
          })
          .eq('id', this.editingMentor.id);

        if (error) throw error;

        this.showAlert('success', `Mentor "${this.editingMentor.name}" updated`);
        this.showEditMentorModal = false;
        this.editingMentor = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update mentor');
      }
    },

    // Edit Trainee
    editTrainee(trainee) {
      this.editingTrainee = { ...trainee };
      this.showEditTraineeModal = true;
    },

    async saveTrainee() {
      try {
        const { error } = await supabase
          .from('trainees')
          .update({
            name: this.editingTrainee.name,
            email: this.editingTrainee.email || null,
            assigned_mentor_id: this.editingTrainee.assigned_mentor_id || null,
            start_date: this.editingTrainee.start_date
          })
          .eq('id', this.editingTrainee.id);

        if (error) throw error;

        this.showAlert('success', `Trainee "${this.editingTrainee.name}" updated`);
        this.showEditTraineeModal = false;
        this.editingTrainee = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update trainee');
      }
    },

    confirmDeleteMentor(mentor) {
      this.deleteTarget = mentor;
      this.deleteType = 'mentor';
      this.showDeleteModal = true;
    },

    confirmDeleteTrainee(trainee) {
      this.deleteTarget = trainee;
      this.deleteType = 'trainee';
      this.showDeleteModal = true;
    },

    async executeDelete() {
      try {
        if (this.deleteType === 'trainee') {
          await supabase.from('trainees').delete().eq('id', this.deleteTarget.id);
          this.showAlert('success', `Trainee "${this.deleteTarget.name}" deleted`);
        } else if (this.deleteType === 'mentor') {
          await supabase.from('mentors').delete().eq('id', this.deleteTarget.id);
          this.showAlert('success', `Mentor "${this.deleteTarget.name}" deleted`);
        }

        this.showDeleteModal = false;
        this.deleteTarget = null;
        this.deleteType = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to delete');
      }
    }
  }));
});
