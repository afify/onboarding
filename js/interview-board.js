import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput } from './security.js';

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
    getUnassignedCandidates() {
      return this.candidates.filter(c => !c.current_stage_id);
    },

    getCandidatesForStage(stageId) {
      return this.candidates.filter(c => c.current_stage_id === stageId);
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

      if (currentStageId === stageId) {
        this.draggingCandidate = null;
        return;
      }

      try {
        const { error } = await supabase
          .from('candidates')
          .update({ current_stage_id: stageId, updated_at: new Date().toISOString() })
          .eq('id', candidateId);

        if (error) throw error;

        this.showAlert('success', `Moved candidate to ${stageId ? this.getStageName(stageId) : 'New Candidates'}`);
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
      this.newCandidateName = '';
      this.newCandidateEmail = '';
      this.newCandidatePhone = '';
      this.newCandidatePosition = '';
      this.newCandidateNotes = '';
      this.newCandidateResume = null;
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

          if (this.newCandidateResume && newCandidate) {
            const resumePath = await this.uploadResume(this.newCandidateResume, newCandidate.id);
            await supabase
              .from('candidates')
              .update({ resume_path: resumePath })
              .eq('id', newCandidate.id);
          }

          this.showAlert('success', `Candidate "${name}" added`);
        }

        this.showAddCandidateModal = false;
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
      this.deleteTarget = candidate;
      this.deleteType = 'reject';
      this.deleteModalTitle = 'Reject Candidate';
      this.deleteModalMessage = `Are you sure you want to reject "${candidate.name}"? This will remove them from the pipeline.`;
      this.showDeleteModal = true;
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
        if (this.deleteType === 'reject') {
          await supabase
            .from('candidates')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', this.deleteTarget.id);
          this.showAlert('success', 'Candidate rejected');
          this.showCandidateDetailModal = false;
        } else if (this.deleteType === 'stage') {
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
          doc.setTextColor(...colors.textMuted);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          const notesLines = doc.splitTextToSize(`Notes: ${stage.notes}`, pageWidth - margin * 2 - 10);
          doc.text(notesLines, margin + 3, y);
          y += notesLines.length * 4 + 4;
        }

        y += 8;
      }

      return doc;
    },

    viewCandidatePDF(candidate) {
      if (!candidate) return;

      const candidateInterviews = this.interviews.filter(i =>
        i.candidate_id === candidate.id && i.status === 'completed'
      );

      if (candidateInterviews.length === 0) {
        this.showAlert('warning', 'No completed interviews to generate report');
        return;
      }

      // Show the styled modal report
      this.reportData = this.buildReportData(candidate);
      this.showReportModal = true;
    },

    async downloadCandidatePDF(candidate) {
      if (!candidate) return;

      const candidateInterviews = this.interviews.filter(i =>
        i.candidate_id === candidate.id && i.status === 'completed'
      );

      if (candidateInterviews.length === 0) {
        this.showAlert('warning', 'No completed interviews to generate report');
        return;
      }

      // Build report data and show modal temporarily to capture it
      this.reportData = this.buildReportData(candidate);
      this.showReportModal = true;

      // Wait for modal to render, then capture and download
      await new Promise(resolve => setTimeout(resolve, 300));

      const reportContent = document.querySelector('.report-content');
      if (!reportContent) {
        this.showAlert('error', 'Could not generate PDF');
        return;
      }

      try {
        const canvas = await window.html2canvas(reportContent, {
          scale: 4,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          allowTaint: true,
          imageTimeout: 0
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new window.jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 10;

        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight + 10;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        const today = new Date().toISOString().split('T')[0];
        const filename = `${candidate.name.replace(/\s+/g, '_')}_Interview_Report_${today}.pdf`;
        pdf.save(filename);

        this.showReportModal = false;
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

    async rejectCandidate(candidate) {
      if (!candidate) return;

      if (!confirm(`Are you sure you want to reject ${candidate.name}?`)) {
        return;
      }

      try {
        const { error } = await supabase
          .from('candidates')
          .update({ status: 'rejected' })
          .eq('id', candidate.id);

        if (error) throw error;

        await Alpine.store('app').loadData();
        this.showAlert('success', `${candidate.name} has been rejected`);
      } catch (err) {
        console.error('Error rejecting candidate:', err);
        this.showAlert('error', err.message || 'Failed to reject candidate');
      }
    }
  }));
});
