import { jsPDF } from 'jspdf';
import { supabase } from './supabase-client.js';
import { escapeHtml } from './security.js';
import { getInitials as _getInitials } from './utils.js';

const rawCompany = import.meta.env.VITE_COMPANY || 'Company';
const company = escapeHtml(rawCompany);

document.addEventListener('alpine:init', () => {
  Alpine.data('tasks', () => ({
    filterTrainee: '',
    filterWeek: '',
    filterDay: '',
    generating: false,

    get trainees() {
      return Alpine.store('app').trainees;
    },

    get tasks() {
      return Alpine.store('app').tasks;
    },

    get weeks() {
      return Alpine.store('app').weeks;
    },

    get progress() {
      return Alpine.store('app').progress;
    },

    get categories() {
      return Alpine.store('app').categories;
    },

    get statuses() {
      return Alpine.store('app').statuses;
    },

    get uniqueDays() {
      const days = new Set(this.tasks.map(t => t.day_number).filter(Boolean));
      return Array.from(days).sort((a, b) => a - b);
    },

    async init() {
      await Alpine.store('app').initAuth();

      if (!Alpine.store('app').user) {
        window.location.href = '/';
        return;
      }

      await Alpine.store('app').loadData();
      this.subscribeToRealtime();
    },

    subscribeToRealtime() {
      supabase.channel('tasks-progress-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'progress' }, async () => {
          await Alpine.store('app').refreshProgress();
        })
        .subscribe();
    },

    hasFilters() {
      return Boolean(this.filterTrainee) || Boolean(this.filterWeek) || Boolean(this.filterDay);
    },

    resetFilters() {
      this.filterTrainee = '';
      this.filterWeek = '';
      this.filterDay = '';
    },

    formatDate(date) {
      return Alpine.store('app').formatDate(date);
    },

    getInitials(name) {
      return _getInitials(name);
    },

    getCategory(categoryId) {
      return this.categories.find(c => c.id === categoryId) || { label: 'Unknown', color: '#666' };
    },

    getAllowedStatusIds() {
      return this.statuses
        .filter(s => s.name === 'in_progress' || s.name === 'pending')
        .map(s => s.id);
    },

    getLearningExerciseCategoryIds() {
      return this.categories
        .filter(c => c.name === 'learning' || c.name === 'exercise')
        .map(c => c.id);
    },

    getFilteredProgress() {
      const allowedStatusIds = this.getAllowedStatusIds();
      const allowedCategoryIds = this.getLearningExerciseCategoryIds();

      return this.progress.filter(p => {
        // Must be in_progress or pending status
        if (!allowedStatusIds.includes(p.status_id)) return false;

        // Must have both start_date and due_date
        if (!p.start_date || !p.due_date) return false;

        // Get the task to check category
        const task = this.tasks.find(t => t.id === p.task_id);
        if (!task) return false;

        // Must be learning or exercise category
        if (!allowedCategoryIds.includes(task.category_id)) return false;

        // Apply trainee filter
        if (this.filterTrainee && p.trainee_id !== this.filterTrainee) return false;

        // Apply week filter
        if (this.filterWeek && task.week_id !== this.filterWeek) return false;

        // Apply day filter
        if (this.filterDay && task.day_number !== parseInt(this.filterDay)) return false;

        return true;
      });
    },

    getGroupedRows() {
      const filteredProgress = this.getFilteredProgress();
      const rowMap = new Map();

      for (const prog of filteredProgress) {
        const trainee = this.trainees.find(t => t.id === prog.trainee_id);
        const task = this.tasks.find(t => t.id === prog.task_id);
        if (!trainee || !task) continue;

        const week = this.weeks.find(w => w.id === task.week_id);
        if (!week) continue;

        const day = task.day_number || 1;
        const key = `${trainee.id}-${week.id}-${day}`;

        if (!rowMap.has(key)) {
          rowMap.set(key, {
            trainee,
            week,
            day,
            tasks: []
          });
        }

        rowMap.get(key).tasks.push({
          task,
          startDate: prog.start_date,
          dueDate: prog.due_date
        });
      }

      // Convert to array and sort
      const rows = Array.from(rowMap.values());

      rows.sort((a, b) => {
        const nameCompare = a.trainee.name.localeCompare(b.trainee.name);
        if (nameCompare !== 0) return nameCompare;

        const weekCompare = a.week.week_number - b.week.week_number;
        if (weekCompare !== 0) return weekCompare;

        return a.day - b.day;
      });

      return rows;
    },

    createPDF(row) {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);

      // Color palette
      const colors = {
        primary: [15, 23, 42],
        accent: [20, 184, 166],
        textDark: [30, 41, 59],
        textMuted: [100, 116, 139],
        border: [200, 200, 200],
        white: [255, 255, 255]
      };

      // Get dates from first task
      const firstTask = row.tasks[0];
      const startDate = firstTask?.startDate ? this.formatDate(firstTask.startDate) : '-';
      const dueDate = firstTask?.dueDate ? this.formatDate(firstTask.dueDate) : '-';

      const today = new Date();
      const dateStr = today.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // HEADER BANNER (compact)
      const bannerHeight = 22;

      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, bannerHeight, 'F');

      doc.setFillColor(...colors.accent);
      doc.rect(0, bannerHeight - 1.5, pageWidth, 1.5, 'F');

      // Left side - Company
      doc.setTextColor(...colors.white);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(company.toUpperCase(), margin, 9);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('ONBOARDING PROGRAM', margin, 15);

      // Right side - Trainee, Week/Day, and dates (single line style)
      doc.setTextColor(...colors.white);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(row.trainee.name + '  |  Week ' + row.week.week_number + ' Day ' + row.day, pageWidth - margin, 9, { align: 'right' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 200);
      doc.text('Start: ' + startDate + '  |  Due: ' + dueDate, pageWidth - margin, 15, { align: 'right' });

      let y = bannerHeight + 6;

      // TASKS HEADER
      const taskCount = row.tasks.length;
      doc.setTextColor(...colors.textDark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TASKS (' + taskCount + ')', margin, y);

      y += 4;
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      // TASK LIST
      const sortedTasks = [...row.tasks].sort((a, b) =>
        (a.task.order_index || 0) - (b.task.order_index || 0)
      );

      for (const [i, item] of sortedTasks.entries()) {
        if (y > 265) {
          doc.addPage();
          y = margin;
        }

        const category = this.getCategory(item.task.category_id);

        // Task number
        doc.setTextColor(...colors.textMuted);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text((i + 1) + '.', margin, y);

        // Task title
        doc.setTextColor(...colors.textDark);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(item.task.title, margin + 8, y);

        // Category label (right-aligned text)
        let catColor = colors.accent;
        if (category.color) {
          const hex = category.color.replace('#', '');
          catColor = [
            parseInt(hex.substr(0, 2), 16),
            parseInt(hex.substr(2, 2), 16),
            parseInt(hex.substr(4, 2), 16)
          ];
        }
        doc.setTextColor(...catColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('[' + category.label.toUpperCase() + ']', pageWidth - margin, y, { align: 'right' });

        y += 5;

        // Description
        if (item.task.description) {
          doc.setFontSize(8);
          doc.setTextColor(...colors.textMuted);
          doc.setFont('helvetica', 'normal');
          // Convert literal \n to actual newlines
          const descText = item.task.description.replace(/\\n/g, '\n');
          const descLines = doc.splitTextToSize(descText, contentWidth - 10);
          for (const line of descLines.slice(0, 2)) {
            if (y > 275) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + 8, y);
            y += 4;
          }
        }

        // Separator between tasks
        if (i < sortedTasks.length - 1) {
          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.2);
          doc.line(margin + 8, y, pageWidth - margin, y);
          y += 4;
        } else {
          y += 2;
        }
      }

      // FOOTER
      const footerY = pageHeight - 10;
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

      doc.setFontSize(7);
      doc.setTextColor(...colors.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(company + ' Onboarding System', margin, footerY);
      doc.text('Page 1', pageWidth - margin, footerY, { align: 'right' });

      return { doc, dateStr };
    },

    async viewPDF(row) {
      this.generating = true;
      try {
        const { doc } = this.createPDF(row);
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        this.generating = false;
      }
    },

    async downloadPDF(row) {
      this.generating = true;
      try {
        const { doc, dateStr } = this.createPDF(row);
        const traineeName = row.trainee.name.replace(/\s+/g, '_');
        const filename = `${traineeName}_Week${row.week.week_number}_Day${row.day}_${dateStr.replace(/\//g, '-')}.pdf`;
        doc.save(filename);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        this.generating = false;
      }
    }
  }));
});
