import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, validatePassword, sanitizeInput } from './security.js';
import { getInitials as _getInitials, getMentorName as _getMentorName } from './utils.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('adminPanel', () => ({
    get mentors() { return Alpine.store('app').mentors; },
    get trainees() { return Alpine.store('app').trainees; },

    activeTab: 'mentors',

    showAddMentorModal: false,
    showEditMentorModal: false,
    showAddTraineeModal: false,
    showEditTraineeModal: false,
    showDeleteModal: false,

    deleteTarget: null,
    deleteType: null,
    alert: { show: false, type: '', message: '' },

    // Flat properties for CSP compatibility (nested x-model not allowed)
    newMentorName: '',
    newMentorEmail: '',
    newMentorPassword: '',
    newMentorRole: 'mentor',
    editingMentor: null,
    editingMentorName: '',
    editingMentorRole: 'mentor',
    newTraineeName: '',
    newTraineeEmail: '',
    newTraineeMentorIds: [],
    newTraineeStartDate: new Date().toISOString().split('T')[0],
    editingTrainee: null,
    editingTraineeName: '',
    editingTraineeEmail: '',
    editingTraineeMentorIds: [],
    editingTraineeStartDate: '',

    async init() {
      const store = Alpine.store('app');

      await store.initAuth();

      if (!store.session) {
        window.location.href = '/';
        return;
      }

      await store.loadData();

      if (!store.isAdmin) {
        window.location.href = '/dashboard.html';
        return;
      }

      this.subscribeToChanges();
    },

    subscribeToChanges() {
      supabase
        .channel('admin-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mentors' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
          this.loadData();
        })
        .subscribe();
    },

    async loadData() {
      await Alpine.store('app').loadData(true);
    },

    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    getInitials(name) {
      return _getInitials(name);
    },

    getMentorName(mentorId) {
      return _getMentorName(this.mentors, mentorId);
    },

    getMentorTraineeCount(mentorId) {
      return this.trainees.filter(t =>
        (t.assigned_mentor_ids && t.assigned_mentor_ids.includes(mentorId)) ||
        t.assigned_mentor_id === mentorId
      ).length;
    },

    getMentorNames(mentorIds) {
      if (!mentorIds || mentorIds.length === 0) return 'Unassigned';
      return mentorIds
        .map(id => this.mentors.find(m => m.id === id)?.name)
        .filter(Boolean)
        .join(', ') || 'Unassigned';
    },

    toggleMentorSelection(mentorId, isNew = false) {
      const arr = isNew ? this.newTraineeMentorIds : this.editingTraineeMentorIds;
      const idx = arr.indexOf(mentorId);
      if (idx === -1) {
        arr.push(mentorId);
      } else {
        arr.splice(idx, 1);
      }
    },

    isMentorSelected(mentorId, isNew = false) {
      const arr = isNew ? this.newTraineeMentorIds : this.editingTraineeMentorIds;
      return arr.includes(mentorId);
    },

    getAdminCount() {
      return this.mentors.filter(m => m.role === 'admin').length;
    },

    formatDate(date) {
      return Alpine.store('app').formatDate(date);
    },

    getDeleteTargetName() {
      return this.deleteTarget ? this.deleteTarget.name : '';
    },

    getEditingMentorEmail() {
      return this.editingMentor ? this.editingMentor.email : '';
    },

    async addMentor() {
      try {
        const name = sanitizeInput(this.newMentorName, 100);
        const email = sanitizeInput(this.newMentorEmail, 254);
        const password = this.newMentorPassword;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (!isValidEmail(email)) {
          this.showAlert('error', 'Invalid email format');
          return;
        }
        const pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
          this.showAlert('error', pwCheck.message);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (authError) {
          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email,
            password
          });

          if (signupError) throw signupError;

          await supabase.from('mentors').insert({
            id: signupData.user.id,
            email,
            name,
            role: this.newMentorRole
          });
        } else {
          await supabase.from('mentors').insert({
            id: authData.user.id,
            email,
            name,
            role: this.newMentorRole
          });
        }

        this.showAlert('success', `Mentor "${name}" created successfully`);
        this.newMentorName = '';
        this.newMentorEmail = '';
        this.newMentorPassword = '';
        this.newMentorRole = 'mentor';
        this.showAddMentorModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create mentor');
      }
    },

    async addTrainee() {
      try {
        const name = sanitizeInput(this.newTraineeName, 100);
        const email = this.newTraineeEmail ? sanitizeInput(this.newTraineeEmail, 254) : null;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (email && !isValidEmail(email)) {
          this.showAlert('error', 'Invalid email format');
          return;
        }

        await supabase.from('candidates').insert({
          name,
          email,
          type: 'trainee',
          assigned_mentor_ids: this.newTraineeMentorIds.length > 0 ? this.newTraineeMentorIds : [],
          start_date: this.newTraineeStartDate
        });

        this.showAlert('success', `Trainee "${name}" added successfully`);
        this.newTraineeName = '';
        this.newTraineeEmail = '';
        this.newTraineeMentorIds = [];
        this.newTraineeStartDate = new Date().toISOString().split('T')[0];
        this.showAddTraineeModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to add trainee');
      }
    },

    editMentor(mentor) {
      this.editingMentor = { ...mentor };
      this.editingMentorName = mentor.name;
      this.editingMentorRole = mentor.role;
      this.showEditMentorModal = true;
    },

    async saveMentor() {
      try {
        const name = sanitizeInput(this.editingMentorName, 100);
        const role = this.editingMentorRole;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (!['admin', 'mentor'].includes(role)) {
          this.showAlert('error', 'Invalid role');
          return;
        }

        const { error } = await supabase
          .from('mentors')
          .update({
            name,
            role
          })
          .eq('id', this.editingMentor.id);

        if (error) throw error;

        this.showAlert('success', `Mentor "${name}" updated`);
        this.showEditMentorModal = false;
        this.editingMentor = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update mentor');
      }
    },

    editTrainee(trainee) {
      this.editingTrainee = { ...trainee };
      this.editingTraineeName = trainee.name;
      this.editingTraineeEmail = trainee.email || '';
      // Support both old single mentor and new multi-mentor format
      if (trainee.assigned_mentor_ids && trainee.assigned_mentor_ids.length > 0) {
        this.editingTraineeMentorIds = [...trainee.assigned_mentor_ids];
      } else if (trainee.assigned_mentor_id) {
        this.editingTraineeMentorIds = [trainee.assigned_mentor_id];
      } else {
        this.editingTraineeMentorIds = [];
      }
      this.editingTraineeStartDate = trainee.start_date || '';
      this.showEditTraineeModal = true;
    },

    async saveTrainee() {
      try {
        const name = sanitizeInput(this.editingTraineeName, 100);
        const email = this.editingTraineeEmail ? sanitizeInput(this.editingTraineeEmail, 254) : null;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (email && !isValidEmail(email)) {
          this.showAlert('error', 'Invalid email format');
          return;
        }

        const { error } = await supabase
          .from('candidates')
          .update({
            name,
            email,
            assigned_mentor_ids: this.editingTraineeMentorIds.length > 0 ? this.editingTraineeMentorIds : [],
            start_date: this.editingTraineeStartDate
          })
          .eq('id', this.editingTrainee.id);

        if (error) throw error;

        this.showAlert('success', `Trainee "${name}" updated`);
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
          await supabase.from('candidates').delete().eq('id', this.deleteTarget.id);
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
