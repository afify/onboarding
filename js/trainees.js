import { jsPDF } from 'jspdf';
import { supabase } from './supabase-client.js';
import { isValidEmail, isValidName, sanitizeInput, escapeHtml } from './security.js';
import { getInitials as _getInitials, getMentorName as _getMentorName } from './utils.js';

const rawCompany = import.meta.env.VITE_COMPANY || 'Company';
const company = escapeHtml(rawCompany);

document.addEventListener('alpine:init', () => {
  Alpine.data('traineesPage', () => ({
    get trainees() { return Alpine.store('app').trainees; },
    get mentors() { return Alpine.store('app').mentors; },
    get tasks() { return Alpine.store('app').tasks; },
    get progress() { return Alpine.store('app').progress; },
    get weeks() { return Alpine.store('app').weeks; },
    get statuses() { return Alpine.store('app').statuses; },
    get categories() { return Alpine.store('app').categories; },
    generatingReport: false,

    showAddModal: false,
    showEditModal: false,
    showDeleteModal: false,
    alert: { show: false, type: '', message: '' },
    // Flat properties for CSP compatibility
    newTraineeName: '',
    newTraineeEmail: '',
    newTraineeMentorIds: [],
    newTraineeStartDate: new Date().toISOString().split('T')[0],
    editingTrainee: null,
    editingTraineeName: '',
    editingTraineeEmail: '',
    editingTraineeMentorIds: [],
    editingTraineeStartDate: '',
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
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
      return _getInitials(name);
    },

    getMentorName(mentorId) {
      return _getMentorName(this.mentors, mentorId);
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

    getDoneStatusId() {
      const doneStatus = this.statuses.find(s => s.name === 'done');
      return doneStatus?.id || null;
    },

    getProgress(traineeId) {
      const totalTasks = this.tasks.length;
      if (totalTasks === 0) return 0;
      const doneStatusId = this.getDoneStatusId();
      const doneTasks = this.progress.filter(p => p.trainee_id === traineeId && p.status_id === doneStatusId).length;
      return Math.round((doneTasks / totalTasks) * 100);
    },

    getCompletedTasks(traineeId) {
      const doneStatusId = this.getDoneStatusId();
      return this.progress.filter(p => p.trainee_id === traineeId && p.status_id === doneStatusId).length;
    },

    getCurrentWeek(traineeId) {
      const doneStatusId = this.getDoneStatusId();
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId && p.status_id === doneStatusId);
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

    // CSP-safe helpers
    getProgressLabel(traineeId) {
      return this.getProgress(traineeId) + '%';
    },

    getProgressStyle(traineeId) {
      return 'width: ' + this.getProgress(traineeId) + '%';
    },

    getDeleteTargetName() {
      return this.deleteTarget ? this.deleteTarget.name : '';
    },

    // Key metrics helpers
    formatStartDate(trainee) {
      if (!trainee.start_date) return 'Not set';
      return new Date(trainee.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    getBlockedTasks(traineeId) {
      const blockedStatus = this.statuses.find(s => s.name === 'blocked');
      const blockedStatusId = blockedStatus?.id || null;
      return this.progress.filter(p => p.trainee_id === traineeId && p.status_id === blockedStatusId).length;
    },

    getAverageScore(traineeId) {
      const scores = this.progress
        .filter(p => p.trainee_id === traineeId && p.score !== null && p.score !== undefined)
        .map(p => p.score);
      if (scores.length === 0) return null;
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      return Math.round(avg * 10) / 10;
    },

    formatAverageScore(traineeId) {
      const avg = this.getAverageScore(traineeId);
      return avg !== null ? avg.toFixed(1) + '/10' : '—';
    },

    getLastActivity(traineeId) {
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId && p.updated_at);
      if (traineeProgress.length === 0) return null;
      const sorted = traineeProgress.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return sorted[0].updated_at;
    },

    formatLastActivity(traineeId) {
      const lastActivity = this.getLastActivity(traineeId);
      if (!lastActivity) return 'No activity';
      const date = new Date(lastActivity);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return diffMins + 'm ago';
      if (diffHours < 24) return diffHours + 'h ago';
      if (diffDays < 7) return diffDays + 'd ago';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    async addTrainee() {
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

      const { error } = await supabase.from('candidates').insert({
        name,
        email,
        type: 'trainee',
        assigned_mentor_ids: this.newTraineeMentorIds.length > 0 ? this.newTraineeMentorIds : [],
        start_date: this.newTraineeStartDate
      });

      if (error) {
        this.showAlert('error', error.message || 'Failed to add trainee');
      } else {
        this.showAlert('success', `Trainee "${name}" added successfully`);
        this.newTraineeName = '';
        this.newTraineeEmail = '';
        this.newTraineeMentorIds = [];
        this.newTraineeStartDate = new Date().toISOString().split('T')[0];
        this.showAddModal = false;
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
      this.showEditModal = true;
    },

    async saveTrainee() {
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
        .from('candidates')
        .delete()
        .eq('id', this.deleteTarget.id);

      if (error) {
        this.showAlert('error', error.message || 'Failed to delete trainee');
      } else {
        this.showAlert('success', `Trainee "${this.deleteTarget.name}" deleted successfully`);
        this.showDeleteModal = false;
        this.deleteTarget = null;
      }
    },

    // Report generation methods
    getTraineeStatusCounts(traineeId) {
      const traineeProgress = this.progress.filter(p => p.trainee_id === traineeId);
      const totalTasks = this.tasks.length;

      const counts = {
        done: 0,
        in_progress: 0,
        blocked: 0,
        pending: 0
      };

      for (const status of this.statuses) {
        const count = traineeProgress.filter(p => p.status_id === status.id).length;
        if (Object.prototype.hasOwnProperty.call(counts, status.name)) {
          counts[status.name] = count;
        }
      }

      // Pending = total tasks - tracked tasks + explicit pending
      const trackedCount = traineeProgress.length;
      counts.pending = (totalTasks - trackedCount) + counts.pending;

      return counts;
    },

    getTraineeWeeklyProgress(traineeId) {
      const result = [];
      const doneStatus = this.statuses.find(s => s.name === 'done');

      for (const week of this.weeks) {
        const weekTasks = this.tasks.filter(t => t.week_id === week.id);
        const doneTasks = weekTasks.filter(task => {
          const prog = this.progress.find(p => p.trainee_id === traineeId && p.task_id === task.id);
          return prog && prog.status_id === doneStatus?.id;
        }).length;

        const percentage = weekTasks.length > 0 ? Math.round((doneTasks / weekTasks.length) * 100) : 0;
        result.push({
          weekNumber: week.week_number,
          percentage,
          done: doneTasks,
          total: weekTasks.length
        });
      }

      return result;
    },

    createTraineeReport(trainee) {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Colors
      const colors = {
        primary: [15, 23, 42],
        accent: [20, 184, 166],
        cyan: [0, 212, 255],
        violet: [124, 58, 237],
        textDark: [30, 41, 59],
        textMuted: [100, 116, 139],
        white: [255, 255, 255],
        done: [16, 185, 129],
        inProgress: [245, 158, 11],
        blocked: [239, 68, 68],
        pending: [107, 114, 128]
      };

      const statusCounts = this.getTraineeStatusCounts(trainee.id);
      const weeklyProgress = this.getTraineeWeeklyProgress(trainee.id);
      const totalTasks = this.tasks.length;
      const completedTasks = statusCounts.done;
      const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // === HEADER BANNER ===
      const bannerHeight = 28;
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, bannerHeight, 'F');
      doc.setFillColor(...colors.accent);
      doc.rect(0, bannerHeight - 2, pageWidth, 2, 'F');

      // Company name (left side)
      doc.setTextColor(...colors.white);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(company.toUpperCase(), margin, 12);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('TRAINEE PROGRESS REPORT', margin, 20);

      // Trainee name, generated date, and start date (right side)
      const startDate = this.formatStartDate(trainee);
      const generatedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      doc.setTextColor(...colors.white);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(trainee.name, pageWidth - margin, 9, { align: 'right' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('Generated: ' + generatedDate, pageWidth - margin, 16, { align: 'right' });
      doc.text('Started: ' + startDate, pageWidth - margin, 22, { align: 'right' });

      let y = bannerHeight + 12;

      // === PROGRESS SUMMARY CARD ===
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'F');

      // Overall progress percentage (left)
      doc.setTextColor(...colors.cyan);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(overallProgress + '%', margin + 10, y + 16);
      doc.setFontSize(9);
      doc.setTextColor(...colors.textMuted);
      doc.text('Overall Progress', margin + 38, y + 16);

      // Tasks completed (right)
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(completedTasks + ' / ' + totalTasks, pageWidth - margin - 10, y + 12, { align: 'right' });
      doc.setFontSize(8);
      doc.setTextColor(...colors.textMuted);
      doc.text('Tasks Completed', pageWidth - margin - 10, y + 20, { align: 'right' });

      y += 32;

      // === STATUS DISTRIBUTION SECTION ===
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('STATUS DISTRIBUTION', margin, y);
      y += 8;

      // Status bars
      const statusData = [
        { name: 'Done', count: statusCounts.done, color: colors.done },
        { name: 'In Progress', count: statusCounts.in_progress, color: colors.inProgress },
        { name: 'Blocked', count: statusCounts.blocked, color: colors.blocked },
        { name: 'Pending', count: statusCounts.pending, color: colors.pending }
      ];

      const barWidth = pageWidth - margin * 2 - 80;
      const barHeight = 8;

      for (const status of statusData) {
        const percentage = totalTasks > 0 ? (status.count / totalTasks) * 100 : 0;

        // Label
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.textMuted);
        doc.text(status.name, margin, y + 6);

        // Background bar
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(margin + 55, y, barWidth, barHeight, 2, 2, 'F');

        // Fill bar
        if (percentage > 0) {
          doc.setFillColor(...status.color);
          doc.roundedRect(margin + 55, y, barWidth * (percentage / 100), barHeight, 2, 2, 'F');
        }

        // Count and percentage
        doc.setTextColor(...colors.textDark);
        doc.setFont('helvetica', 'bold');
        doc.text(status.count + ' (' + Math.round(percentage) + '%)', pageWidth - margin, y + 6, { align: 'right' });

        y += 14;
      }

      y += 8;

      // === WEEKLY PROGRESS SECTION ===
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('WEEKLY PROGRESS', margin, y);
      y += 10;

      // Weekly progress bars (vertical)
      const chartWidth = pageWidth - margin * 2;
      const chartHeight = 50;
      const weekCount = Math.min(weeklyProgress.length, 8);
      const barSpacing = chartWidth / (weekCount + 1);
      const maxBarWidth = 20;

      // Background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, chartWidth, chartHeight + 20, 3, 3, 'F');

      // Grid lines
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      for (let i = 0; i <= 4; i++) {
        const lineY = y + 8 + (chartHeight - 8) * (1 - i / 4);
        doc.line(margin + 5, lineY, margin + chartWidth - 5, lineY);
      }

      // Bars
      const weeksToShow = weeklyProgress.slice(0, weekCount);
      let weekIndex = 0;
      for (const week of weeksToShow) {
        const barX = margin + barSpacing * (weekIndex + 1) - maxBarWidth / 2;
        const barFillHeight = (chartHeight - 8) * (week.percentage / 100);

        // Bar background
        doc.setFillColor(200, 200, 200);
        doc.roundedRect(barX, y + 8, maxBarWidth, chartHeight - 8, 2, 2, 'F');

        // Bar fill
        if (week.percentage > 0) {
          const gradient = week.percentage >= 100 ? colors.done : colors.cyan;
          doc.setFillColor(...gradient);
          doc.roundedRect(barX, y + 8 + (chartHeight - 8 - barFillHeight), maxBarWidth, barFillHeight, 2, 2, 'F');
        }

        // Week label
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textMuted);
        doc.text('W' + week.weekNumber, barX + maxBarWidth / 2, y + chartHeight + 12, { align: 'center' });

        // Percentage on top
        doc.setFontSize(7);
        doc.setTextColor(...colors.textDark);
        doc.text(week.percentage + '%', barX + maxBarWidth / 2, y + 5, { align: 'center' });
        weekIndex++;
      }

      y += chartHeight + 28;

      // === KEY METRICS ===
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('KEY METRICS', margin, y);
      y += 10;

      const metrics = [
        { label: 'Current Week', value: 'Week ' + this.getCurrentWeek(trainee.id) },
        { label: 'Average Score', value: this.formatAverageScore(trainee.id) },
        { label: 'Blocked Tasks', value: statusCounts.blocked.toString() },
        { label: 'In Progress', value: statusCounts.in_progress.toString() }
      ];

      const metricWidth = (pageWidth - margin * 2 - 15) / 4;

      let metricIndex = 0;
      for (const metric of metrics) {
        const metricX = margin + metricIndex * (metricWidth + 5);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(metricX, y, metricWidth, 28, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.textMuted);
        doc.text(metric.label, metricX + metricWidth / 2, y + 10, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textDark);
        doc.text(metric.value, metricX + metricWidth / 2, y + 22, { align: 'center' });
        metricIndex++;
      }

      y += 38;

      // === FOOTER ===
      const footerY = pageHeight - 12;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

      doc.setFontSize(7);
      doc.setTextColor(...colors.textMuted);
      doc.text(company + ' Onboarding System', margin, footerY);
      doc.text('Page 1', pageWidth - margin, footerY, { align: 'right' });

      return doc;
    },

    async viewReport(trainee) {
      this.generatingReport = true;
      try {
        const doc = this.createTraineeReport(trainee);
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } catch (error) {
        console.error('Error generating report:', error);
        this.showAlert('error', 'Failed to generate report');
      } finally {
        this.generatingReport = false;
      }
    },

    async downloadReport(trainee) {
      this.generatingReport = true;
      try {
        const doc = this.createTraineeReport(trainee);
        const traineeName = trainee.name.replace(/\s+/g, '_');
        const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const filename = `${traineeName}_Report_${today}.pdf`;
        doc.save(filename);
      } catch (error) {
        console.error('Error generating report:', error);
        this.showAlert('error', 'Failed to generate report');
      } finally {
        this.generatingReport = false;
      }
    }
  }));
});
