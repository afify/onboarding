import { supabase } from './supabase-client.js';
import { sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('interviewsPage', () => ({
    // Computed getters from store (with null guards)
    get candidates() { return Alpine.store('app')?.candidates || []; },
    get interviewStages() { return Alpine.store('app')?.interviewStages || []; },
    get stageCriteria() { return Alpine.store('app')?.stageCriteria || []; },

    // Tab state
    activeTab: 'stages',

    // Expanded stage for criteria grouping
    expandedStage: null,

    // Stage modal
    showStageModal: false,
    editingStage: null,
    stageLabel: '',
    stageColor: '#6b7280',
    stageSortOrder: 0,
    stageDescription: '',

    // Criteria modal
    showCriteriaModal: false,
    editingCriteria: null,
    criteriaStageId: '',
    criteriaName: '',
    criteriaMaxScore: 10,
    criteriaWeight: 1,
    criteriaDescription: '',

    // Delete modal
    showDeleteModal: false,
    deleteModalTitle: '',
    deleteModalMessage: '',
    deleteTarget: null,
    deleteType: null,

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
        .channel('interviews-settings')
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

    // Utility methods
    getStageName(stageId) {
      const stage = this.interviewStages.find(s => s.id === stageId);
      return stage?.label || 'Unknown';
    },

    getStageColor(stageId) {
      const stage = this.interviewStages.find(s => s.id === stageId);
      return stage?.color || '#6b7280';
    },

    getCriteriaCountForStage(stageId) {
      return this.stageCriteria.filter(c => c.stage_id === stageId).length;
    },

    getCandidateCountForStage(stageId) {
      return this.candidates.filter(c => c.current_stage_id === stageId).length;
    },

    getCriteriaForStage(stageId) {
      return this.stageCriteria.filter(c => c.stage_id === stageId);
    },

    toggleStage(stageId) {
      this.expandedStage = this.expandedStage === stageId ? null : stageId;
    },

    // Stage modal methods
    openAddStageModal() {
      this.editingStage = null;
      this.stageLabel = '';
      this.stageColor = '#6b7280';
      this.stageSortOrder = this.interviewStages.length;
      this.stageDescription = '';
      this.showStageModal = true;
    },

    openEditStageModal(stage) {
      this.editingStage = stage;
      this.stageLabel = stage.label;
      this.stageColor = stage.color || '#6b7280';
      this.stageSortOrder = stage.sort_order;
      this.stageDescription = stage.description || '';
      this.showStageModal = true;
    },

    async saveStage() {
      try {
        const label = sanitizeInput(this.stageLabel, 100);
        const color = this.stageColor;
        const sortOrder = parseInt(this.stageSortOrder, 10) || 0;
        const description = this.stageDescription ? sanitizeInput(this.stageDescription, 500) : null;

        if (!label.trim()) {
          this.showAlert('error', 'Stage label is required');
          return;
        }

        if (this.editingStage) {
          const { error } = await supabase
            .from('interview_stages')
            .update({ label, color, sort_order: sortOrder, description })
            .eq('id', this.editingStage.id);

          if (error) throw error;
          this.showAlert('success', `Stage "${label}" updated`);
        } else {
          const name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const { error } = await supabase
            .from('interview_stages')
            .insert({ name, label, color, sort_order: sortOrder, description });

          if (error) throw error;
          this.showAlert('success', `Stage "${label}" added`);
        }

        this.showStageModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to save stage');
      }
    },

    confirmDeleteStage(stage) {
      this.deleteTarget = stage;
      this.deleteType = 'stage';
      this.deleteModalTitle = 'Delete Stage';
      this.deleteModalMessage = `Are you sure you want to delete "${stage.label}"? This will also delete all criteria associated with this stage.`;
      this.showDeleteModal = true;
    },

    // Criteria modal methods
    openAddCriteriaModal() {
      this.editingCriteria = null;
      this.criteriaStageId = this.selectedStageFilter || '';
      this.criteriaName = '';
      this.criteriaMaxScore = 10;
      this.criteriaWeight = 1;
      this.criteriaDescription = '';
      this.showCriteriaModal = true;
    },

    openEditCriteriaModal(criteria) {
      this.editingCriteria = criteria;
      this.criteriaStageId = criteria.stage_id;
      this.criteriaName = criteria.name;
      this.criteriaMaxScore = criteria.max_score || 10;
      this.criteriaWeight = criteria.weight || 1;
      this.criteriaDescription = criteria.description || '';
      this.showCriteriaModal = true;
    },

    async saveCriteria() {
      try {
        const name = sanitizeInput(this.criteriaName, 100);
        const maxScore = parseInt(this.criteriaMaxScore, 10) || 10;
        const weight = parseFloat(this.criteriaWeight) || 1;
        const description = this.criteriaDescription ? sanitizeInput(this.criteriaDescription, 500) : null;

        if (!name.trim()) {
          this.showAlert('error', 'Criteria name is required');
          return;
        }
        if (!this.criteriaStageId) {
          this.showAlert('error', 'Stage is required');
          return;
        }

        if (this.editingCriteria) {
          const { error } = await supabase
            .from('stage_criteria')
            .update({
              stage_id: this.criteriaStageId,
              name,
              max_score: maxScore,
              weight,
              description
            })
            .eq('id', this.editingCriteria.id);

          if (error) throw error;
          this.showAlert('success', `Criteria "${name}" updated`);
        } else {
          const existingCriteria = this.stageCriteria.filter(c => c.stage_id === this.criteriaStageId);
          const sortOrder = existingCriteria.length;

          const { error } = await supabase
            .from('stage_criteria')
            .insert({
              stage_id: this.criteriaStageId,
              name,
              max_score: maxScore,
              weight,
              description,
              sort_order: sortOrder
            });

          if (error) throw error;
          this.showAlert('success', `Criteria "${name}" added`);
        }

        this.showCriteriaModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to save criteria');
      }
    },

    confirmDeleteCriteria(criteria) {
      this.deleteTarget = criteria;
      this.deleteType = 'criteria';
      this.deleteModalTitle = 'Delete Criteria';
      this.deleteModalMessage = `Are you sure you want to delete "${criteria.name}"?`;
      this.showDeleteModal = true;
    },

    // Delete execution
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
    }
  }));
});
