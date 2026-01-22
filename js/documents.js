import { supabase } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('documentsPage', () => ({
    // Data
    resumes: [],
    codeSubmissions: [],
    candidates: [],

    // State
    loading: true,
    bucketFilter: '',
    searchQuery: '',
    showDeleteModal: false,
    deleteTarget: null,

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
      this.candidates = store.candidates || [];
      await this.loadDocuments();
    },

    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    get allDocuments() {
      return [...this.resumes, ...this.codeSubmissions];
    },

    get filteredDocuments() {
      let result = this.allDocuments;

      if (this.bucketFilter) {
        result = result.filter(doc => doc.bucket === this.bucketFilter);
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(doc =>
          doc.name.toLowerCase().includes(query) ||
          (doc.candidateName && doc.candidateName.toLowerCase().includes(query))
        );
      }

      return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    async loadDocuments() {
      this.loading = true;

      try {
        // Load resumes
        const { data: resumeFiles, error: resumeError } = await supabase.storage
          .from('resumes')
          .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (resumeError) throw resumeError;

        this.resumes = (resumeFiles || [])
          .filter(f => f.name !== '.emptyFolderPlaceholder')
          .map(f => ({
            ...f,
            bucket: 'resumes',
            candidateName: this.getCandidateNameByResumePath(f.name)
          }));

        // Load code submissions
        const { data: codeFiles, error: codeError } = await supabase.storage
          .from('code-submissions')
          .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (codeError && codeError.message !== 'The resource was not found') {
          throw codeError;
        }

        this.codeSubmissions = (codeFiles || [])
          .filter(f => f.name !== '.emptyFolderPlaceholder')
          .map(f => ({
            ...f,
            bucket: 'code-submissions',
            candidateName: this.getCandidateNameByCodePath(f.name)
          }));

      } catch (err) {
        console.error('Error loading documents:', err);
        this.showAlert('error', err.message || 'Failed to load documents');
      } finally {
        this.loading = false;
      }
    },

    getCandidateNameByResumePath(filename) {
      // Extract candidate ID from filename (format: {uuid}.pdf)
      const candidateId = filename.replace(/\.[^/.]+$/, '');
      const candidate = this.candidates.find(c => c.id === candidateId);
      return candidate?.name || null;
    },

    getCandidateNameByCodePath(filename) {
      const candidateId = filename.replace(/\.[^/.]+$/, '');
      const candidate = this.candidates.find(c => c.id === candidateId);
      return candidate?.name || null;
    },

    getFileSize(doc) {
      return doc.metadata && doc.metadata.size ? doc.metadata.size : null;
    },

    formatFileSize(bytes) {
      if (!bytes) return '-';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    formatDate(date) {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    async viewDocument(doc) {
      try {
        const { data, error } = await supabase.storage
          .from(doc.bucket)
          .download(doc.name);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        window.open(url, '_blank');
      } catch (err) {
        this.showAlert('error', 'Failed to view document');
      }
    },

    async downloadDocument(doc) {
      try {
        const { data, error } = await supabase.storage
          .from(doc.bucket)
          .download(doc.name);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        this.showAlert('error', 'Failed to download document');
      }
    },

    getDeleteTargetName() {
      return this.deleteTarget ? this.deleteTarget.name : '';
    },

    confirmDelete(doc) {
      this.deleteTarget = doc;
      this.showDeleteModal = true;
    },

    async executeDelete() {
      if (!this.deleteTarget) return;

      try {
        const { error } = await supabase.storage
          .from(this.deleteTarget.bucket)
          .remove([this.deleteTarget.name]);

        if (error) throw error;

        // Also clear resume_path or code_submission_path from candidate if linked
        const candidateId = this.deleteTarget.name.replace(/\.[^/.]+$/, '');
        const updateField = this.deleteTarget.bucket === 'resumes'
          ? { resume_path: null }
          : { code_submission_path: null };

        await supabase
          .from('candidates')
          .update(updateField)
          .eq('id', candidateId);

        this.showAlert('success', 'Document deleted');
        this.showDeleteModal = false;
        this.deleteTarget = null;
        await this.loadDocuments();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to delete document');
      }
    }
  }));
});
