import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput, validateFile, generateSecureFilename } from './security.js';
import {
  colors,
  addHeader,
  addFooterToAllPages,
  checkPageBreak as pdfCheckPageBreak
} from './pdf-template.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('interviewsPage', () => ({
    // Computed getters from store (with null guards for initial load)
    get candidates() { return Alpine.store('app')?.candidates || []; },
    get interviewStages() { return Alpine.store('app')?.interviewStages || []; },
    get stageCriteria() { return Alpine.store('app')?.stageCriteria || []; },
    get interviews() { return Alpine.store('app')?.interviews || []; },
    get interviewScores() { return Alpine.store('app')?.interviewScores || []; },
    get mentors() { return Alpine.store('app')?.mentors || []; },

    // Modal states
    showAddCandidateModal: false,
    showCandidateDetailModal: false,
    showConductInterviewModal: false,
    showStagesConfigModal: false,
    showDeleteModal: false,
    showReportModal: false,

    // Report data
    reportData: null,

    // Alert state
    alert: { show: false, type: '', message: '' },

    // Drag and drop state
    draggingCandidate: null,
    dragOverStage: null,
    draggingStageIndex: null,

    // Add candidate form
    newCandidateName: '',
    newCandidateEmail: '',
    newCandidatePhone: '',
    newCandidatePosition: '',
    newCandidateNotes: '',
    newCandidateResume: null,
    newCandidateCodeSubmission: null,

    // Detail view
    detailCandidate: null,

    // Conduct interview
    conductingInterview: null,
    criteriaScores: new Map(),
    interviewOverallNotes: '',
    interviewDecision: 'pending',

    // Stage configuration
    configTab: 'stages',
    newStageLabel: '',
    newStageColor: '#6b7280',
    newStageDescription: '',
    editingStage: null,
    selectedStageForCriteria: '',

    // Criteria configuration
    newCriteriaName: '',
    newCriteriaWeight: 1,
    newCriteriaDescription: '',
    editingCriteria: null,

    // Delete confirmation
    deleteModalTitle: '',
    deleteModalMessage: '',
    deleteTarget: null,
    deleteType: null,

    // Rejection modal
    showRejectModal: false,
    rejectTarget: null,
    rejectionReason: '',

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
        .channel('interviews-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interview_stages' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_criteria' }, () => {
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

    formatDateTime(date) {
      return Alpine.store('app').formatDateTime(date);
    },

    // Utility methods
    getInitials(name) {
      if (!name) return '?';
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

    formatDecision(decision) {
      if (!decision) return 'Pending';
      return decision.charAt(0).toUpperCase() + decision.slice(1);
    },

    // Candidate filtering
    // Filter to only active candidates (not rejected/hired)
    get activeCandidates() {
      return this.candidates.filter(c => c.status === 'active');
    },

    getUnassignedCandidates() {
      return this.activeCandidates.filter(c => !c.current_stage_id);
    },

    getCandidatesForStage(stageId) {
      return this.activeCandidates.filter(c => c.current_stage_id === stageId);
    },

    // Hardcoded status columns
    getRejectedCandidates() {
      return this.candidates.filter(c => c.status === 'rejected');
    },

    getHiredCandidates() {
      return this.candidates.filter(c => c.status === 'hired');
    },

    // Stats
    getCompletedInterviewsCount() {
      return this.interviews.filter(i => i.status === 'completed').length;
    },

    getScheduledInterviewsCount() {
      return this.interviews.filter(i => i.status === 'scheduled').length;
    },

    // Interview helpers
    getCandidateInterviews(candidateId) {
      return this.interviews
        .filter(i => i.candidate_id === candidateId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    getInterviewCountText(candidate, stageId) {
      const stageInterviews = this.interviews.filter(
        i => i.candidate_id === candidate.id && i.stage_id === stageId
      );
      const completed = stageInterviews.filter(i => i.status === 'completed').length;
      return `${completed} interview${completed !== 1 ? 's' : ''}`;
    },

    getCriteriaForStage(stageId) {
      return this.stageCriteria.filter(c => c.stage_id === stageId);
    },

    // Criteria scoring
    getCriteriaScore(criteriaId) {
      return this.criteriaScores.has(criteriaId) ? this.criteriaScores.get(criteriaId) : 0;
    },

    setCriteriaScore(criteriaId, value) {
      this.criteriaScores.set(criteriaId, parseInt(value, 10));
    },

    // Drag and drop handlers
    getDraggingClass(candidate) {
      if (!candidate || !this.draggingCandidate) return {};
      return { 'dragging': this.draggingCandidate.id === candidate.id };
    },

    handleDragStart(event, candidate) {
      this.draggingCandidate = candidate;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', candidate.id);
    },

    handleDragEnd() {
      this.draggingCandidate = null;
      this.dragOverStage = null;
    },

    handleDragOver(event, stageId) {
      event.preventDefault();
      this.dragOverStage = stageId;
    },

    handleDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        this.dragOverStage = null;
      }
    },

    async handleDrop(event, stageId) {
      event.preventDefault();
      this.dragOverStage = null;

      if (!this.draggingCandidate) return;

      const candidateId = this.draggingCandidate.id;
      const currentStageId = this.draggingCandidate.current_stage_id;
      const wasRejected = this.draggingCandidate.status === 'rejected';

      // Skip if dropping on same stage (unless reactivating from rejected)
      if (currentStageId === stageId && !wasRejected) {
        this.draggingCandidate = null;
        return;
      }

      try {
        const updateData = {
          current_stage_id: stageId,
          updated_at: new Date().toISOString()
        };

        // Reactivate if candidate was rejected
        if (wasRejected) {
          updateData.status = 'active';
          updateData.rejection_reason = null;
          updateData.rejected_at = null;
          updateData.rejected_by = null;
        }

        const { error } = await supabase
          .from('candidates')
          .update(updateData)
          .eq('id', candidateId);

        if (error) throw error;

        const targetName = stageId ? this.getStageName(stageId) : 'New Candidates';
        const message = wasRejected
          ? `Reactivated and moved to ${targetName}`
          : `Moved candidate to ${targetName}`;
        this.showAlert('success', message);
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to move candidate');
      }

      this.draggingCandidate = null;
    },

    // Stage drag and drop (for reordering)
    handleStageDragStart(event, index) {
      this.draggingStageIndex = index;
      event.dataTransfer.effectAllowed = 'move';
    },

    handleStageDragOver(event) {
      event.preventDefault();
    },

    async handleStageDrop(event, targetIndex) {
      event.preventDefault();
      if (this.draggingStageIndex === null || this.draggingStageIndex === targetIndex) {
        this.draggingStageIndex = null;
        return;
      }

      const stages = [...this.interviewStages];
      const [draggedStage] = stages.splice(this.draggingStageIndex, 1);
      stages.splice(targetIndex, 0, draggedStage);

      try {
        for (const [index, stage] of stages.entries()) {
          await supabase
            .from('interview_stages')
            .update({ sort_order: index })
            .eq('id', stage.id);
        }
        await this.loadData();
        this.showAlert('success', 'Stage order updated');
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to reorder stages');
      }

      this.draggingStageIndex = null;
    },

    // Modal openers
    openAddCandidateModal() {
      this.detailCandidate = null;
      this.newCandidateName = '';
      this.newCandidateEmail = '';
      this.newCandidatePhone = '';
      this.newCandidatePosition = '';
      this.newCandidateNotes = '';
      this.newCandidateResume = null;
      this.newCandidateCodeSubmission = null;
      this.showAddCandidateModal = true;
    },

    openCandidateDetailModal(candidate) {
      this.detailCandidate = candidate;
      this.showCandidateDetailModal = true;
    },

    openEditCandidateModal(candidate) {
      this.detailCandidate = candidate;
      this.newCandidateName = candidate.name;
      this.newCandidateEmail = candidate.email || '';
      this.newCandidatePhone = candidate.phone || '';
      this.newCandidatePosition = candidate.position_applied || '';
      this.newCandidateNotes = candidate.notes || '';
      this.newCandidateResume = null;
      this.newCandidateCodeSubmission = null;
      this.showAddCandidateModal = true;
    },

    openConductInterviewModal(candidate) {
      if (!candidate.current_stage_id) {
        this.showAlert('error', 'Move candidate to a stage first');
        return;
      }
      this.conductingInterview = candidate;
      this.criteriaScores = new Map();
      this.interviewOverallNotes = '';
      this.interviewDecision = 'pending';

      // Initialize criteria scores
      const criteria = this.getCriteriaForStage(candidate.current_stage_id);
      criteria.forEach(c => {
        this.criteriaScores.set(c.id, 0);
      });

      this.showConductInterviewModal = true;
    },

    openConductInterviewFromDetail() {
      this.showCandidateDetailModal = false;
      this.openConductInterviewModal(this.detailCandidate);
    },

    openStagesConfigModal() {
      this.configTab = 'stages';
      this.newStageLabel = '';
      this.newStageColor = '#6b7280';
      this.newStageDescription = '';
      this.selectedStageForCriteria = '';
      this.showStagesConfigModal = true;
    },

    openEditStageModal(stage) {
      this.editingStage = stage;
      this.newStageLabel = stage.label;
      this.newStageColor = stage.color;
      this.newStageDescription = stage.description || '';
    },

    openEditCriteriaModal(criteria) {
      this.editingCriteria = criteria;
      this.newCriteriaName = criteria.name;
      this.newCriteriaWeight = criteria.weight;
      this.newCriteriaDescription = criteria.description || '';
    },

    // Resume handling
    handleResumeUpload(event) {
      const file = event.target.files?.[0];
      if (file) {
        this.newCandidateResume = file;
      }
    },

    async uploadResume(file, candidateId) {
      // Validate file before upload
      const validation = validateFile(file, 'resume');
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Generate secure filename (UUID-based)
      const secureFilename = generateSecureFilename(file.name);
      const path = `${candidateId}/${secureFilename}`;

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

    // Code submission handling
    handleCodeSubmissionUpload(event) {
      const file = event.target.files?.[0];
      if (file) {
        this.newCandidateCodeSubmission = file;
      }
    },

    async uploadCodeSubmission(file, candidateId) {
      // Validate file before upload
      const validation = validateFile(file, 'code');
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      // Generate secure filename (UUID-based)
      const secureFilename = generateSecureFilename(file.name);
      const path = `${candidateId}/${secureFilename}`;

      const { error } = await supabase.storage
        .from('code-submissions')
        .upload(path, file, { upsert: true });

      if (error) throw error;
      return path;
    },

    async downloadCodeSubmission(candidate) {
      if (!candidate.code_submission_path) return;

      const { data, error } = await supabase.storage
        .from('code-submissions')
        .download(candidate.code_submission_path);

      if (error) {
        this.showAlert('error', 'Failed to download code submission');
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.name.replace(/\s+/g, '_')}_code_submission.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },

    // CRUD operations
    async addCandidate() {
      try {
        const name = sanitizeInput(this.newCandidateName, 100);
        const email = this.newCandidateEmail ? sanitizeInput(this.newCandidateEmail, 254) : null;
        const phone = this.newCandidatePhone ? sanitizeInput(this.newCandidatePhone, 20) : null;
        const position = this.newCandidatePosition ? sanitizeInput(this.newCandidatePosition, 100) : null;
        const notes = this.newCandidateNotes ? sanitizeInput(this.newCandidateNotes, 1000) : null;

        if (!isValidName(name)) {
          this.showAlert('error', 'Invalid name format');
          return;
        }
        if (email && !isValidEmail(email)) {
          this.showAlert('error', 'Invalid email format');
          return;
        }

        // Check if editing existing candidate
        if (this.detailCandidate) {
          const updateData = { name, email, phone, position_applied: position, notes, updated_at: new Date().toISOString() };

          if (this.newCandidateResume) {
            const resumePath = await this.uploadResume(this.newCandidateResume, this.detailCandidate.id);
            updateData.resume_path = resumePath;
          }

          if (this.newCandidateCodeSubmission) {
            const codePath = await this.uploadCodeSubmission(this.newCandidateCodeSubmission, this.detailCandidate.id);
            updateData.code_submission_path = codePath;
          }

          const { error } = await supabase
            .from('candidates')
            .update(updateData)
            .eq('id', this.detailCandidate.id);

          if (error) throw error;

          this.showAlert('success', `Candidate "${name}" updated`);
          this.detailCandidate = null;
        } else {
          const { data: newCandidate, error } = await supabase
            .from('candidates')
            .insert({ name, email, phone, position_applied: position, notes })
            .select()
            .single();

          if (error) throw error;

          const fileUpdates = {};

          if (this.newCandidateResume && newCandidate) {
            const resumePath = await this.uploadResume(this.newCandidateResume, newCandidate.id);
            fileUpdates.resume_path = resumePath;
          }

          if (this.newCandidateCodeSubmission && newCandidate) {
            const codePath = await this.uploadCodeSubmission(this.newCandidateCodeSubmission, newCandidate.id);
            fileUpdates.code_submission_path = codePath;
          }

          if (Object.keys(fileUpdates).length > 0) {
            await supabase
              .from('candidates')
              .update(fileUpdates)
              .eq('id', newCandidate.id);
          }

          this.showAlert('success', `Candidate "${name}" added`);
        }

        this.showAddCandidateModal = false;
        this.newCandidateResume = null;
        this.newCandidateCodeSubmission = null;
        this.detailCandidate = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to save candidate');
      }
    },

    async submitInterview() {
      if (!this.conductingInterview) return;

      try {
        const candidate = this.conductingInterview;
        const stageId = candidate.current_stage_id;
        const criteria = this.getCriteriaForStage(stageId);

        // Calculate overall score as weighted average
        let totalWeight = 0;
        let weightedSum = 0;
        criteria.forEach(c => {
          const score = this.getCriteriaScore(c.id);
          const weight = parseFloat(c.weight) || 1;
          weightedSum += score * weight;
          totalWeight += weight;
        });
        const overallScore = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : null;

        // Create interview record
        const { data: interview, error: interviewError } = await supabase
          .from('interviews')
          .insert({
            candidate_id: candidate.id,
            stage_id: stageId,
            interviewer_id: Alpine.store('app').mentor.id,
            status: 'completed',
            overall_score: overallScore,
            decision: this.interviewDecision,
            notes: sanitizeInput(this.interviewOverallNotes, 2000),
            completed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (interviewError) throw interviewError;

        // Save criteria scores
        if (criteria.length > 0 && interview) {
          const scoreRecords = criteria.map(c => ({
            interview_id: interview.id,
            criteria_id: c.id,
            score: this.getCriteriaScore(c.id)
          }));

          const { error: scoresError } = await supabase
            .from('interview_scores')
            .insert(scoreRecords);

          if (scoresError) throw scoresError;
        }

        // Handle decision
        if (this.interviewDecision === 'pass') {
          await this.handlePassDecision(candidate);
        } else if (this.interviewDecision === 'fail') {
          this.showAlert('success', 'Interview completed. Candidate marked for review.');
        } else {
          this.showAlert('success', 'Interview saved as pending.');
        }

        this.showConductInterviewModal = false;
        this.conductingInterview = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to submit interview');
      }
    },

    async handlePassDecision(candidate) {
      const currentStage = this.interviewStages.find(s => s.id === candidate.current_stage_id);
      const currentIndex = this.interviewStages.indexOf(currentStage);
      const nextStage = this.interviewStages[currentIndex + 1];

      if (nextStage) {
        // Move to next stage
        await supabase
          .from('candidates')
          .update({ current_stage_id: nextStage.id, updated_at: new Date().toISOString() })
          .eq('id', candidate.id);

        this.showAlert('success', `Candidate passed! Moved to ${nextStage.label}`);
      } else {
        // Final stage passed - convert to trainee
        try {
          const { error } = await supabase.rpc('convert_candidate_to_trainee', {
            candidate_id_param: candidate.id
          });

          if (error) throw error;

          this.showAlert('success', `Candidate hired! New trainee created.`);
        } catch (err) {
          this.showAlert('error', err.message || 'Failed to convert candidate');
        }
      }
    },

    confirmRejectCandidate(candidate) {
      this.rejectTarget = candidate;
      this.rejectionReason = '';
      this.showRejectModal = true;
    },

    async executeReject() {
      try {
        if (!this.rejectionReason.trim()) {
          this.showAlert('error', 'Please provide a rejection reason');
          return;
        }

        const reason = sanitizeInput(this.rejectionReason, 1000);
        const store = Alpine.store('app');
        const currentMentor = store.mentors?.find(m => m.user_id === store.session?.user?.id);

        // Find the Rejected stage
        const rejectedStage = this.interviewStages.find(s =>
          s.name === 'rejected' || s.label.toLowerCase() === 'rejected'
        );

        const updateData = {
          status: 'rejected',
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
          rejected_by: currentMentor?.id || null,
          updated_at: new Date().toISOString()
        };

        // Move to Rejected stage if it exists
        if (rejectedStage) {
          updateData.current_stage_id = rejectedStage.id;
        }

        await supabase
          .from('candidates')
          .update(updateData)
          .eq('id', this.rejectTarget.id);

        this.showAlert('success', `${this.rejectTarget.name} has been rejected`);
        this.showRejectModal = false;
        this.showCandidateDetailModal = false;
        this.rejectTarget = null;
        this.rejectionReason = '';
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to reject candidate');
      }
    },

    confirmDeleteStage(stage) {
      this.deleteTarget = stage;
      this.deleteType = 'stage';
      this.deleteModalTitle = 'Delete Stage';
      this.deleteModalMessage = `Are you sure you want to delete "${stage.label}"?`;
      this.showDeleteModal = true;
    },

    confirmDeleteCriteria(criteria) {
      this.deleteTarget = criteria;
      this.deleteType = 'criteria';
      this.deleteModalTitle = 'Delete Criteria';
      this.deleteModalMessage = `Are you sure you want to delete "${criteria.name}"?`;
      this.showDeleteModal = true;
    },

    async executeDelete() {
      try {
        if (this.deleteType === 'stage') {
          await supabase
            .from('interview_stages')
            .delete()
            .eq('id', this.deleteTarget.id);
          this.showAlert('success', 'Stage deleted');
        } else if (this.deleteType === 'criteria') {
          await supabase
            .from('stage_criteria')
            .delete()
            .eq('id', this.deleteTarget.id);
          this.showAlert('success', 'Criteria deleted');
        }

        this.showDeleteModal = false;
        this.deleteTarget = null;
        this.deleteType = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to delete');
      }
    },

    // Stage management
    async addStage() {
      try {
        const label = sanitizeInput(this.newStageLabel, 100);
        const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const color = this.newStageColor;
        const description = this.newStageDescription ? sanitizeInput(this.newStageDescription, 500) : null;

        if (!label.trim()) {
          this.showAlert('error', 'Stage label is required');
          return;
        }

        const sortOrder = this.interviewStages.length;

        const { error } = await supabase
          .from('interview_stages')
          .insert({ name, label, color, description, sort_order: sortOrder });

        if (error) throw error;

        this.showAlert('success', `Stage "${label}" added`);
        this.newStageLabel = '';
        this.newStageColor = '#6b7280';
        this.newStageDescription = '';
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to add stage');
      }
    },

    async saveStage() {
      if (!this.editingStage) return;

      try {
        const label = sanitizeInput(this.newStageLabel, 100);
        const color = this.newStageColor;
        const description = this.newStageDescription ? sanitizeInput(this.newStageDescription, 500) : null;

        const { error } = await supabase
          .from('interview_stages')
          .update({ label, color, description })
          .eq('id', this.editingStage.id);

        if (error) throw error;

        this.showAlert('success', `Stage "${label}" updated`);
        this.editingStage = null;
        this.newStageLabel = '';
        this.newStageColor = '#6b7280';
        this.newStageDescription = '';
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update stage');
      }
    },

    // Criteria management
    async addCriteria() {
      if (!this.selectedStageForCriteria) {
        this.showAlert('error', 'Select a stage first');
        return;
      }

      try {
        const name = sanitizeInput(this.newCriteriaName, 100);
        const weight = parseFloat(this.newCriteriaWeight) || 1;
        const description = this.newCriteriaDescription ? sanitizeInput(this.newCriteriaDescription, 500) : null;

        if (!name.trim()) {
          this.showAlert('error', 'Criteria name is required');
          return;
        }

        const existingCriteria = this.getCriteriaForStage(this.selectedStageForCriteria);
        const sortOrder = existingCriteria.length;

        const { error } = await supabase
          .from('stage_criteria')
          .insert({
            stage_id: this.selectedStageForCriteria,
            name,
            weight,
            description,
            sort_order: sortOrder
          });

        if (error) throw error;

        this.showAlert('success', `Criteria "${name}" added`);
        this.newCriteriaName = '';
        this.newCriteriaWeight = 1;
        this.newCriteriaDescription = '';
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to add criteria');
      }
    },

    async saveCriteria() {
      if (!this.editingCriteria) return;

      try {
        const name = sanitizeInput(this.newCriteriaName, 100);
        const weight = parseFloat(this.newCriteriaWeight) || 1;
        const description = this.newCriteriaDescription ? sanitizeInput(this.newCriteriaDescription, 500) : null;

        const { error } = await supabase
          .from('stage_criteria')
          .update({ name, weight, description })
          .eq('id', this.editingCriteria.id);

        if (error) throw error;

        this.showAlert('success', `Criteria "${name}" updated`);
        this.editingCriteria = null;
        this.newCriteriaName = '';
        this.newCriteriaWeight = 1;
        this.newCriteriaDescription = '';
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update criteria');
      }
    },

    // Report generation
    generateReport(candidate, stageId = null) {
      if (!candidate) return;

      // Get interviews for this candidate, optionally filtered by stage
      let candidateInterviews = this.interviews.filter(i =>
        i.candidate_id === candidate.id && i.status === 'completed'
      );

      if (stageId) {
        candidateInterviews = candidateInterviews.filter(i => i.stage_id === stageId);
      }

      // Group interviews by stage
      const stageReports = [];
      const processedStages = new Set();

      for (const interview of candidateInterviews) {
        if (processedStages.has(interview.stage_id)) continue;
        processedStages.add(interview.stage_id);

        const stage = this.interviewStages.find(s => s.id === interview.stage_id);
        const stageInterviews = candidateInterviews.filter(i => i.stage_id === interview.stage_id);
        const latestInterview = stageInterviews.sort((a, b) =>
          new Date(b.completed_at) - new Date(a.completed_at)
        )[0];

        const criteria = this.getCriteriaForStage(interview.stage_id);
        const scores = this.interviewScores.filter(s => s.interview_id === latestInterview.id);

        // Build criteria scores with weighted totals
        const criteriaScores = criteria.map(c => {
          const scoreRecord = scores.find(s => s.criteria_id === c.id);
          const score = scoreRecord?.score ?? 0;
          const weight = parseFloat(c.weight) || 1;
          const total = score * weight;

          return {
            name: c.name,
            weight: weight,
            score: score,
            maxScore: c.max_score || 10,
            total: total,
            notes: scoreRecord?.notes || ''
          };
        });

        // Calculate totals
        const totalWeightedScore = criteriaScores.reduce((sum, c) => sum + c.total, 0);
        const maxPossibleScore = criteriaScores.reduce((sum, c) => {
          const weight = c.weight > 0 ? c.weight : 0; // Only count positive weights for max
          return sum + (c.maxScore * weight);
        }, 0);

        stageReports.push({
          stageName: stage?.label || 'Unknown Stage',
          stageColor: stage?.color || '#6b7280',
          interviewer: this.getMentorName(latestInterview.interviewer_id),
          date: latestInterview.completed_at || latestInterview.created_at,
          decision: latestInterview.decision,
          overallScore: latestInterview.overall_score,
          notes: latestInterview.notes,
          criteria: criteriaScores,
          totalWeightedScore: totalWeightedScore,
          maxPossibleScore: maxPossibleScore
        });
      }

      this.reportData = {
        candidate: {
          name: candidate.name,
          position: candidate.position_applied || 'Not specified',
          email: candidate.email || '',
          phone: candidate.phone || '',
          currentStage: this.getStageName(candidate.current_stage_id)
        },
        stages: stageReports,
        generatedAt: new Date().toISOString()
      };

      this.showCandidateDetailModal = false;
      this.showReportModal = true;
    },

    getDecisionClass(decision) {
      if (decision === 'pass') return 'decision-pass';
      if (decision === 'fail') return 'decision-fail';
      return 'decision-pending';
    },

    getDecisionLabel(decision) {
      if (decision === 'pass') return 'PASS';
      if (decision === 'fail') return 'FAIL';
      return 'PENDING';
    },

    exportReportPDF() {
      if (!this.reportData) return;

      const doc = new window.jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const data = this.reportData;

      // Colors
      const colors = {
        primary: [15, 23, 42],
        accent: [20, 184, 166],
        cyan: [0, 212, 255],
        textDark: [30, 41, 59],
        textMuted: [100, 116, 139],
        white: [255, 255, 255],
        pass: [16, 185, 129],
        fail: [239, 68, 68],
        pending: [107, 114, 128]
      };

      // === HEADER BANNER ===
      const bannerHeight = 28;
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, bannerHeight, 'F');
      doc.setFillColor(...colors.accent);
      doc.rect(0, bannerHeight - 2, pageWidth, 2, 'F');

      doc.setTextColor(...colors.white);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('INTERVIEW REPORT', margin, 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('CANDIDATE ASSESSMENT', margin, 20);

      const generatedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.setTextColor(...colors.white);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(data.candidate.name, pageWidth - margin, 9, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('Generated: ' + generatedDate, pageWidth - margin, 16, { align: 'right' });
      doc.text(data.candidate.position, pageWidth - margin, 22, { align: 'right' });

      let y = bannerHeight + 12;

      // === CANDIDATE INFO CARD ===
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 3, 3, 'F');

      doc.setTextColor(...colors.textDark);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Current Stage:', margin + 5, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.text(data.candidate.currentStage, margin + 35, y + 7);

      if (data.candidate.email) {
        doc.setFont('helvetica', 'bold');
        doc.text('Email:', margin + 5, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.text(data.candidate.email, margin + 18, y + 13);
      }

      y += 22;

      // === STAGE REPORTS ===
      for (const stage of data.stages) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        // Stage header
        doc.setFillColor(...colors.primary);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(stage.stageName, margin + 4, y + 7);

        const decisionColor = stage.decision === 'pass' ? colors.pass : stage.decision === 'fail' ? colors.fail : colors.pending;
        doc.setTextColor(...decisionColor);
        doc.text((stage.decision || 'pending').toUpperCase(), pageWidth - margin - 4, y + 7, { align: 'right' });

        y += 14;

        // Interviewer info
        doc.setTextColor(...colors.textMuted);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const stageDate = stage.date ? new Date(stage.date).toLocaleDateString() : 'N/A';
        doc.text(`Interviewer: ${stage.interviewer} | Date: ${stageDate}`, margin, y);
        y += 6;

        // Criteria table
        if (stage.criteria && stage.criteria.length > 0) {
          // Table header
          doc.setFillColor(240, 240, 245);
          doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
          doc.setTextColor(...colors.textDark);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('Criteria', margin + 3, y + 4);
          doc.text('Weight', pageWidth - margin - 55, y + 4);
          doc.text('Score', pageWidth - margin - 35, y + 4);
          doc.text('Total', pageWidth - margin - 10, y + 4, { align: 'right' });
          y += 8;

          for (const c of stage.criteria) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.textDark);
            doc.text(c.name, margin + 3, y + 3);
            doc.text(c.weight.toString(), pageWidth - margin - 55, y + 3);
            doc.text(`${c.score}/${c.maxScore}`, pageWidth - margin - 35, y + 3);

            if (c.weight < 0) {
              doc.setTextColor(...colors.fail);
            } else {
              doc.setTextColor(...colors.cyan);
            }
            doc.text(c.total.toFixed(1), pageWidth - margin - 10, y + 3, { align: 'right' });
            y += 5;
          }

          // Total row
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
          doc.setTextColor(...colors.textDark);
          doc.setFont('helvetica', 'bold');
          doc.text('TOTAL', margin + 3, y + 4);
          doc.setTextColor(...colors.cyan);
          doc.text(`${stage.totalWeightedScore.toFixed(1)} / ${stage.maxPossibleScore.toFixed(1)}`, pageWidth - margin - 10, y + 4, { align: 'right' });
          y += 10;
        }

        // Notes
        if (stage.notes) {
          y += 4; // Add padding-top (~10px) before notes
          doc.setTextColor(...colors.textMuted);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          const notesLines = doc.splitTextToSize(`Notes: ${stage.notes}`, pageWidth - margin * 2 - 10);
          doc.text(notesLines, margin + 3, y);
          y += notesLines.length * 4 + 4;
        }

        y += 8;
      }

      // Download the PDF
      const today = new Date().toISOString().split('T')[0];
      const filename = `${data.candidate.name.replace(/\s+/g, '_')}_Interview_Report_${today}.pdf`;
      doc.save(filename);
      this.showAlert('success', 'Report downloaded successfully');
    },

    // Generate report data for a candidate
    buildReportData(candidate) {
      // Get interviews for this candidate
      const candidateInterviews = this.interviews.filter(i =>
        i.candidate_id === candidate.id && i.status === 'completed'
      );

      // Group interviews by stage
      const stageReports = [];
      const processedStages = new Set();

      for (const interview of candidateInterviews) {
        if (processedStages.has(interview.stage_id)) continue;
        processedStages.add(interview.stage_id);

        const stage = this.interviewStages.find(s => s.id === interview.stage_id);
        const stageInterviews = candidateInterviews.filter(i => i.stage_id === interview.stage_id);
        const latestInterview = stageInterviews.sort((a, b) =>
          new Date(b.completed_at) - new Date(a.completed_at)
        )[0];

        const criteria = this.getCriteriaForStage(interview.stage_id);
        const scores = this.interviewScores.filter(s => s.interview_id === latestInterview.id);

        const criteriaScores = criteria.map(c => {
          const scoreRecord = scores.find(s => s.criteria_id === c.id);
          const score = scoreRecord?.score ?? 0;
          const weight = parseFloat(c.weight) || 1;
          const total = score * weight;

          return {
            name: c.name,
            weight: weight,
            score: score,
            maxScore: c.max_score || 10,
            total: total,
            notes: scoreRecord?.notes || ''
          };
        });

        const totalWeightedScore = criteriaScores.reduce((sum, c) => sum + c.total, 0);
        const maxPossibleScore = criteriaScores.reduce((sum, c) => {
          const weight = c.weight > 0 ? c.weight : 0;
          return sum + (c.maxScore * weight);
        }, 0);

        stageReports.push({
          stageName: stage?.label || 'Unknown Stage',
          stageColor: stage?.color || '#6b7280',
          interviewer: this.getMentorName(latestInterview.interviewer_id),
          date: latestInterview.completed_at || latestInterview.created_at,
          decision: latestInterview.decision,
          overallScore: latestInterview.overall_score,
          notes: latestInterview.notes,
          criteria: criteriaScores,
          totalWeightedScore: totalWeightedScore,
          maxPossibleScore: maxPossibleScore
        });
      }

      return {
        candidate: {
          name: candidate.name,
          position: candidate.position_applied || 'Not specified',
          email: candidate.email || '',
          phone: candidate.phone || '',
          currentStage: this.getStageName(candidate.current_stage_id)
        },
        stages: stageReports,
        generatedAt: new Date().toISOString()
      };
    },

    createPDFDocument(data) {
      const doc = new window.jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Calculate overall totals upfront
      const overallWeighted = data.stages.reduce((sum, s) => sum + s.totalWeightedScore, 0);
      const overallMax = data.stages.reduce((sum, s) => sum + s.maxPossibleScore, 0);
      const overallPercentage = overallMax > 0 ? Math.round((overallWeighted / overallMax) * 100) : 0;

      // Use template header with Current Stage included
      let y = addHeader(doc, {
        subtitle: 'INTERVIEW ASSESSMENT REPORT',
        rightTitle: data.candidate.name,
        rightSubtitle: 'Stage: ' + data.candidate.currentStage,
        rightInfo: data.candidate.position
      });

      // Remove extra space from header
      y -= 8;

      // === ASSESSMENT SUMMARY CARD (with total) ===
      const totalStages = data.stages.length;
      const passedStages = data.stages.filter(s => s.decision === 'pass').length;
      const failedStages = data.stages.filter(s => s.decision === 'fail').length;
      const pendingStages = totalStages - passedStages - failedStages;

      doc.setFillColor(...colors.white);
      doc.setDrawColor(...colors.border);
      doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

      const summaryY = y + 10;

      // Inline format: Label: Value
      doc.setFontSize(10);

      // Stages
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text('Stages:', margin + 6, summaryY);
      doc.setTextColor(...colors.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(totalStages.toString(), margin + 28, summaryY);

      // Passed
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text('Passed:', margin + 42, summaryY);
      doc.setTextColor(...colors.success);
      doc.setFont('helvetica', 'bold');
      doc.text(passedStages.toString(), margin + 66, summaryY);

      // Failed
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text('Failed:', margin + 80, summaryY);
      doc.setTextColor(...colors.danger);
      doc.setFont('helvetica', 'bold');
      doc.text(failedStages.toString(), margin + 100, summaryY);

      // Pending
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text('Pending:', margin + 108, summaryY);
      doc.setTextColor(...colors.warning);
      doc.setFont('helvetica', 'bold');
      doc.text(pendingStages.toString(), margin + 130, summaryY);

      // Total Score (right aligned)
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text('Total:', pageWidth - margin - 45, summaryY);
      doc.setTextColor(...colors.cyan);
      doc.setFont('helvetica', 'bold');
      doc.text(`${overallWeighted.toFixed(0)}/${overallMax.toFixed(0)} (${overallPercentage}%)`, pageWidth - margin - 6, summaryY, { align: 'right' });

      y += 20;

      // === STAGE REPORTS ===
      for (const stage of data.stages) {
        // Estimate height needed for this stage (tight estimate)
        const criteriaHeight = stage.criteria ? stage.criteria.length * 6 + 14 : 0;
        const notesHeight = stage.notes ? 14 : 0;
        const stageHeight = 24 + criteriaHeight + notesHeight;

        y = pdfCheckPageBreak(doc, y, stageHeight, 12);

        // Stage header bar with interviewer info inline
        const stageDate = stage.date ? new Date(stage.date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }) : 'N/A';
        const interviewerText = `${stage.interviewer} • ${stageDate}`;

        const statusColor = stage.decision === 'pass' ? colors.success :
                            stage.decision === 'fail' ? colors.danger : colors.warning;

        // Dark header bar
        doc.setFillColor(...colors.primary);
        doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');

        // Status indicator stripe on left
        doc.setFillColor(...statusColor);
        doc.rect(margin, y, 3, 12, 'F');

        // Stage title + Interviewer info (next to each other)
        doc.setTextColor(...colors.white);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(stage.stageName, margin + 8, y + 8);

        const stageNameWidth = doc.getTextWidth(stage.stageName);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 190, 200);
        doc.text(interviewerText, margin + 12 + stageNameWidth, y + 8);

        // Status badge on right
        const statusText = (stage.decision || 'pending').toUpperCase();
        doc.setFillColor(...statusColor);
        const badgeWidth = doc.getTextWidth(statusText) + 6;
        doc.roundedRect(pageWidth - margin - badgeWidth - 3, y + 2.5, badgeWidth, 7, 2, 2, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(statusText, pageWidth - margin - badgeWidth / 2 - 3, y + 7, { align: 'center' });

        y += 14;

        // Criteria table
        if (stage.criteria && stage.criteria.length > 0) {
          // Table header
          doc.setFillColor(...colors.lightBg);
          doc.rect(margin, y, contentWidth, 7, 'F');
          doc.setTextColor(...colors.textMuted);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('CRITERIA', margin + 4, y + 5);
          doc.text('WEIGHT', pageWidth - margin - 60, y + 5);
          doc.text('SCORE', pageWidth - margin - 35, y + 5);
          doc.text('TOTAL', pageWidth - margin - 4, y + 5, { align: 'right' });
          y += 8;

          // Table rows
          let alternate = false;
          for (const c of stage.criteria) {
            if (alternate) {
              doc.setFillColor(252, 252, 253);
              doc.rect(margin, y - 1, contentWidth, 6, 'F');
            }
            alternate = !alternate;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...colors.textDark);

            // Truncate long criteria names
            let criteriaName = c.name;
            if (doc.getTextWidth(criteriaName) > 85) {
              while (doc.getTextWidth(criteriaName + '...') > 85) {
                criteriaName = criteriaName.slice(0, -1);
              }
              criteriaName += '...';
            }
            doc.text(criteriaName, margin + 4, y + 4);

            // Weight with color indicator
            const weightText = c.weight > 0 ? `${c.weight}x` : `${c.weight}x`;
            doc.setTextColor(c.weight < 0 ? colors.danger[0] : colors.textDark[0],
                            c.weight < 0 ? colors.danger[1] : colors.textDark[1],
                            c.weight < 0 ? colors.danger[2] : colors.textDark[2]);
            doc.text(weightText, pageWidth - margin - 60, y + 4);

            doc.setTextColor(...colors.textDark);
            doc.text(`${c.score}/${c.maxScore}`, pageWidth - margin - 35, y + 4);

            // Total with color based on positive/negative
            const totalColor = c.total < 0 ? colors.danger : colors.accent;
            doc.setTextColor(...totalColor);
            doc.setFont('helvetica', 'bold');
            doc.text(c.total.toFixed(1), pageWidth - margin - 4, y + 4, { align: 'right' });

            y += 6;
          }

          // Total row
          doc.setFillColor(...colors.primary);
          doc.rect(margin, y, contentWidth, 8, 'F');
          doc.setTextColor(...colors.white);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text('STAGE TOTAL', margin + 4, y + 5.5);

          const percentage = stage.maxPossibleScore > 0
            ? Math.round((stage.totalWeightedScore / stage.maxPossibleScore) * 100)
            : 0;
          doc.text(`${stage.totalWeightedScore.toFixed(1)} / ${stage.maxPossibleScore.toFixed(1)} (${percentage}%)`,
                   pageWidth - margin - 4, y + 5.5, { align: 'right' });
          y += 8;
        }

        // Notes section
        if (stage.notes) {
          y += 4; // Add padding-top (~10px) before notes
          y = pdfCheckPageBreak(doc, y, 14);
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(251, 191, 36);
          doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'FD');

          doc.setTextColor(...colors.textMuted);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('NOTES', margin + 4, y + 4);

          doc.setTextColor(...colors.textDark);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          const notesLines = doc.splitTextToSize(stage.notes, contentWidth - 10);
          doc.text(notesLines.slice(0, 2).join(' '), margin + 4, y + 9);
          y += 14;
        }

        y += 2;
      }

      // Add footer to all pages using template
      addFooterToAllPages(doc, { leftText: 'Confidential - Interview Assessment Report' });

      return doc;
    },

    viewCandidatePDF(candidate) {
      if (!candidate) return;

      try {
        const data = this.buildReportData(candidate);
        const doc = this.createPDFDocument(data);
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } catch (err) {
        console.error('PDF generation error:', err);
        this.showAlert('error', 'Failed to generate PDF');
      }
    },

    downloadCandidatePDF(candidate) {
      if (!candidate) return;

      try {
        const data = this.buildReportData(candidate);
        const doc = this.createPDFDocument(data);

        const today = new Date().toISOString().split('T')[0];
        const filename = `${candidate.name.replace(/\s+/g, '_')}_Interview_Report_${today}.pdf`;
        doc.save(filename);

        this.showAlert('success', 'Report downloaded successfully');
      } catch (err) {
        console.error('PDF generation error:', err);
        this.showAlert('error', 'Failed to generate PDF');
      }
    },

    hasCompletedInterviews(candidate) {
      return this.interviews.some(i =>
        i.candidate_id === candidate.id && i.status === 'completed'
      );
    },

    rejectCandidate(candidate) {
      if (!candidate) return;
      this.confirmRejectCandidate(candidate);
    },

    downloadAllCandidatesReport() {
      try {
        const doc = new window.jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;

        // Get all candidates
        const allCandidates = this.candidates;

        // Calculate stats
        const hired = allCandidates.filter(c => c.status === 'hired').length;
        const rejected = allCandidates.filter(c => c.status === 'rejected').length;
        const active = allCandidates.filter(c => c.status === 'active').length;
        const totalInterviews = this.interviews.filter(i => i.status === 'completed').length;

        // Use template header
        let y = addHeader(doc, {
          subtitle: 'ALL CANDIDATES REPORT',
          rightTitle: `${allCandidates.length} Candidates`,
          rightSubtitle: `${totalInterviews} Interviews`,
          rightInfo: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });

        y -= 8;

        // Summary card
        doc.setFillColor(...colors.white);
        doc.setDrawColor(...colors.border);
        doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');

        const summaryY = y + 10;
        doc.setFontSize(10);

        // Total
        doc.setTextColor(...colors.textMuted);
        doc.setFont('helvetica', 'normal');
        doc.text('Total:', margin + 6, summaryY);
        doc.setTextColor(...colors.textDark);
        doc.setFont('helvetica', 'bold');
        doc.text(allCandidates.length.toString(), margin + 24, summaryY);

        // Active
        doc.setTextColor(...colors.textMuted);
        doc.setFont('helvetica', 'normal');
        doc.text('Active:', margin + 38, summaryY);
        doc.setTextColor(...colors.accent);
        doc.setFont('helvetica', 'bold');
        doc.text(active.toString(), margin + 58, summaryY);

        // Hired
        doc.setTextColor(...colors.textMuted);
        doc.setFont('helvetica', 'normal');
        doc.text('Hired:', margin + 70, summaryY);
        doc.setTextColor(...colors.success);
        doc.setFont('helvetica', 'bold');
        doc.text(hired.toString(), margin + 88, summaryY);

        // Rejected
        doc.setTextColor(...colors.textMuted);
        doc.setFont('helvetica', 'normal');
        doc.text('Rejected:', margin + 100, summaryY);
        doc.setTextColor(...colors.danger);
        doc.setFont('helvetica', 'bold');
        doc.text(rejected.toString(), margin + 126, summaryY);

        // Pass rate
        const passRate = allCandidates.length > 0 ? Math.round((hired / allCandidates.length) * 100) : 0;
        doc.setTextColor(...colors.textMuted);
        doc.setFont('helvetica', 'normal');
        doc.text('Pass Rate:', pageWidth - margin - 35, summaryY);
        doc.setTextColor(...colors.cyan);
        doc.setFont('helvetica', 'bold');
        doc.text(`${passRate}%`, pageWidth - margin - 6, summaryY, { align: 'right' });

        y += 22;

        // Table header
        doc.setFillColor(...colors.primary);
        doc.rect(margin, y, contentWidth, 10, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');

        const colX = [margin + 4, margin + 42, margin + 62, margin + 80, margin + 100, margin + 140];
        doc.text('CANDIDATE', colX[0], y + 7);
        doc.text('STATUS', colX[1], y + 7);
        doc.text('STAGES', colX[2], y + 7);
        doc.text('SCORE', colX[3], y + 7);
        doc.text('DECISION', colX[4], y + 7);
        doc.text('INTERVIEWER', colX[5], y + 7);

        y += 12;

        // Sort: hired first, then active, then rejected
        const sortedCandidates = [...allCandidates].sort((a, b) => {
          const order = { 'hired': 0, 'active': 1, 'rejected': 2, 'withdrawn': 3 };
          return (order[a.status] || 4) - (order[b.status] || 4);
        });

        for (let i = 0; i < sortedCandidates.length; i++) {
          const candidate = sortedCandidates[i];

          // Check page break
          y = pdfCheckPageBreak(doc, y, 10, 12);
          if (y < 20) {
            // Re-draw table header on new page
            doc.setFillColor(...colors.primary);
            doc.rect(margin, y, contentWidth, 10, 'F');
            doc.setTextColor(...colors.white);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CANDIDATE', colX[0], y + 7);
            doc.text('STATUS', colX[1], y + 7);
            doc.text('STAGES', colX[2], y + 7);
            doc.text('SCORE', colX[3], y + 7);
            doc.text('DECISION', colX[4], y + 7);
            doc.text('INTERVIEWER', colX[5], y + 7);
            y += 12;
          }

          // Alternate row colors
          if (i % 2 === 0) {
            doc.setFillColor(...colors.lightBg);
            doc.rect(margin, y - 3, contentWidth, 9, 'F');
          }

          // Get candidate interviews
          const candidateInterviews = this.interviews.filter(int =>
            int.candidate_id === candidate.id && int.status === 'completed'
          );

          // Calculate average score
          const scores = candidateInterviews.map(int => parseFloat(int.overall_score) || 0);
          const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length * 10).toFixed(0) : '-';

          // Get last interview
          const lastInterview = candidateInterviews.sort((a, b) =>
            new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at)
          )[0];
          const lastDecision = lastInterview?.decision || '-';
          const lastStage = lastInterview ? this.interviewStages.find(s => s.id === lastInterview.stage_id)?.label || '' : '';
          const interviewer = lastInterview ? this.mentors.find(m => m.id === lastInterview.interviewer_id)?.name || '-' : '-';

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');

          // Candidate name
          doc.setTextColor(...colors.textDark);
          const displayName = candidate.name.length > 22 ? candidate.name.substring(0, 20) + '...' : candidate.name;
          doc.text(displayName, colX[0], y + 4);

          // Status - colored text
          const statusColor = candidate.status === 'hired' ? colors.success :
                              candidate.status === 'rejected' ? colors.danger : colors.accent;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...statusColor);
          doc.text(candidate.status.toUpperCase(), colX[1], y + 4);

          // Stages
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.textDark);
          doc.text(`${candidateInterviews.length}/${this.interviewStages.length}`, colX[2], y + 4);

          // Score - plain text, no color
          doc.setTextColor(...colors.textDark);
          doc.setFont('helvetica', 'normal');
          doc.text(avgScore !== '-' ? `${avgScore}%` : '-', colX[3], y + 4);

          // Last decision with stage - plain text, no color
          doc.setTextColor(...colors.textDark);
          doc.setFont('helvetica', 'normal');
          if (lastDecision === 'pass') {
            doc.text(`PASS (${lastStage})`, colX[4], y + 4);
          } else if (lastDecision === 'fail') {
            doc.text(`FAIL (${lastStage})`, colX[4], y + 4);
          } else {
            doc.text('-', colX[4], y + 4);
          }

          // Interviewer
          doc.text(interviewer, colX[5], y + 4);

          y += 9;
        }

        // Footer
        addFooterToAllPages(doc, { leftText: 'Confidential - All Candidates Report' });

        // View in browser
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } catch (err) {
        console.error('Error generating all candidates report:', err);
        this.showAlert('error', 'Failed to generate report');
      }
    }
  }));
});
