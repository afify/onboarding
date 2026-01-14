import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('candidatesPage', () => ({
    // Computed getters from store (with null guards)
    get candidates() { return Alpine.store('app')?.candidates || []; },
    get interviewStages() { return Alpine.store('app')?.interviewStages || []; },
    get interviews() { return Alpine.store('app')?.interviews || []; },
    get mentors() { return Alpine.store('app')?.mentors || []; },

    // Filters
    statusFilter: '',
    stageFilter: '',
    searchQuery: '',

    // Modal states
    showCandidateModal: false,
    showViewModal: false,
    showDeleteModal: false,

    // Form data
    editingCandidate: null,
    viewCandidate: null,
    deleteTarget: null,
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    candidatePosition: '',
    candidateStageId: '',
    candidateNotes: '',
    candidateResume: null,

    // Alert
    alert: { show: false, type: '', message: '' },

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

    subscribeToChanges() {
      supabase
        .channel('candidates-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews' }, () => {
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

    // Computed filtered lists
    get activeCandidates() {
      return this.candidates.filter(c => c.status === 'active');
    },

    get hiredCandidates() {
      return this.candidates.filter(c => c.status === 'hired');
    },

    get rejectedCandidates() {
      return this.candidates.filter(c => c.status === 'rejected');
    },

    get filteredCandidates() {
      let result = this.candidates;

      if (this.statusFilter) {
        result = result.filter(c => c.status === this.statusFilter);
      }

      if (this.stageFilter) {
        if (this.stageFilter === 'unassigned') {
          result = result.filter(c => !c.current_stage_id);
        } else {
          result = result.filter(c => c.current_stage_id === this.stageFilter);
        }
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(c =>
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.position_applied && c.position_applied.toLowerCase().includes(query))
        );
      }

      return result;
    },

    // Utility methods
    getInitials(name) {
      if (!name) return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getAvatarColor(name) {
      if (!name) return '#6b7280';
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    },

    getStageName(stageId) {
      const stage = this.interviewStages.find(s => s.id === stageId);
      return stage?.label || 'Unknown';
    },

    getStageColor(stageId) {
      const stage = this.interviewStages.find(s => s.id === stageId);
      return stage?.color || '#6b7280';
    },

    getMentorName(mentorId) {
      const mentor = this.mentors.find(m => m.id === mentorId);
      return mentor?.name || 'Unknown';
    },

    formatStatus(status) {
      if (!status) return 'Unknown';
      return status.charAt(0).toUpperCase() + status.slice(1);
    },

    formatDecision(decision) {
      if (!decision) return 'Pending';
      return decision.charAt(0).toUpperCase() + decision.slice(1);
    },

    formatDate(date) {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    },

    // Safe accessors for template expressions
    hasEditingCandidateResume() {
      return this.editingCandidate && this.editingCandidate.resume_path;
    },

    getEditingCandidateResumePath() {
      return this.editingCandidate ? this.editingCandidate.resume_path : '';
    },

    getDeleteTargetName() {
      return this.deleteTarget ? this.deleteTarget.name : '';
    },

    getModalTitle() {
      return this.editingCandidate ? 'Edit Candidate' : 'Add Candidate';
    },

    getSubmitButtonText() {
      return this.editingCandidate ? 'Save Changes' : 'Add Candidate';
    },

    getInterviewCount(candidateId) {
      return this.interviews.filter(i => i.candidate_id === candidateId && i.status === 'completed').length;
    },

    getCandidateInterviews(candidateId) {
      return this.interviews
        .filter(i => i.candidate_id === candidateId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    // Modal methods
    openAddCandidateModal() {
      this.editingCandidate = null;
      this.candidateName = '';
      this.candidateEmail = '';
      this.candidatePhone = '';
      this.candidatePosition = '';
      this.candidateStageId = '';
      this.candidateNotes = '';
      this.candidateResume = null;
      this.showCandidateModal = true;
    },

    openEditModal(candidate) {
      this.editingCandidate = candidate;
      this.candidateName = candidate.name;
      this.candidateEmail = candidate.email || '';
      this.candidatePhone = candidate.phone || '';
      this.candidatePosition = candidate.position_applied || '';
      this.candidateStageId = candidate.current_stage_id || '';
      this.candidateNotes = candidate.notes || '';
      this.candidateResume = null;
      this.showCandidateModal = true;
    },

    openViewModal(candidate) {
      this.viewCandidate = candidate;
      this.showViewModal = true;
    },

    openEditFromView() {
      this.showViewModal = false;
      this.openEditModal(this.viewCandidate);
    },

    confirmDelete(candidate) {
      this.deleteTarget = candidate;
      this.showDeleteModal = true;
    },

    // Resume handling
    handleResumeUpload(event) {
      const file = event.target.files?.[0];
      if (file) {
        this.candidateResume = file;
      }
    },

    async uploadResume(file, candidateId) {
      const ext = file.name.split('.').pop();
      const path = `${candidateId}.${ext}`;

      const { error } = await supabase.storage
        .from('resumes')
        .upload(path, file, { upsert: true });

      if (error) throw error;
      return path;
    },

    async downloadResume(candidate) {
      if (!candidate.resume_path) return;

      const { data, error } = await supabase.storage
        .from('resumes')
        .download(candidate.resume_path);

      if (error) {
        this.showAlert('error', 'Failed to download resume');
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = candidate.resume_path;
      a.click();
      URL.revokeObjectURL(url);
    },

    // CRUD operations
    async saveCandidate() {
      try {
        const name = sanitizeInput(this.candidateName, 100);
        const email = this.candidateEmail ? sanitizeInput(this.candidateEmail, 254) : null;
        const phone = this.candidatePhone ? sanitizeInput(this.candidatePhone, 20) : null;
        const position = this.candidatePosition ? sanitizeInput(this.candidatePosition, 100) : null;
        const notes = this.candidateNotes ? sanitizeInput(this.candidateNotes, 1000) : null;
        const stageId = this.candidateStageId || null;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (email && !isValidEmail(email)) {
          this.showAlert('error', 'Invalid email format');
          return;
        }

        if (this.editingCandidate) {
          const updateData = {
            name,
            email,
            phone,
            position_applied: position,
            current_stage_id: stageId,
            notes,
            updated_at: new Date().toISOString()
          };

          if (this.candidateResume) {
            const resumePath = await this.uploadResume(this.candidateResume, this.editingCandidate.id);
            updateData.resume_path = resumePath;
          }

          const { error } = await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', this.editingCandidate.id);

          if (error) throw error;

          this.showAlert('success', `Candidate "${name}" updated`);
        } else {
          const { data: newCandidate, error } = await supabase
            .from('candidates')
            .insert({
              name,
              email,
              phone,
              position_applied: position,
              current_stage_id: stageId,
              notes
            })
            .select()
            .single();

          if (error) throw error;

          if (this.candidateResume && newCandidate) {
            const resumePath = await this.uploadResume(this.candidateResume, newCandidate.id);
            await supabase
              .from('candidates')
              .update({ resume_path: resumePath })
              .eq('id', newCandidate.id);
          }

          this.showAlert('success', `Candidate "${name}" added`);
        }

        this.showCandidateModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to save candidate');
      }
    },

    async executeDelete() {
      try {
        const { error } = await supabase
          .from('candidates')
          .delete()
          .eq('id', this.deleteTarget.id);

        if (error) throw error;

        this.showAlert('success', 'Candidate deleted');
        this.showDeleteModal = false;
        this.deleteTarget = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to delete candidate');
      }
    }
  }));
});
