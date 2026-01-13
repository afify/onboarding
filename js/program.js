import { supabase } from './supabase-client.js';
import { sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('programPage', () => ({
    get weeks() { return Alpine.store('app').weeks; },
    get tasks() { return Alpine.store('app').tasks; },
    get categories() { return Alpine.store('app').categories; },
    get statuses() { return Alpine.store('app').statuses; },
    get isAdminUser() { return Alpine.store('app').isAdmin; },

    expandedWeek: null,

    showAddWeekModal: false,
    showEditWeekModal: false,
    showAddTaskModal: false,
    showEditTaskModal: false,
    showDeleteModal: false,
    showCategoriesModal: false,
    showAddCategoryModal: false,
    showEditCategoryModal: false,
    showStatusesModal: false,
    showAddStatusModal: false,
    showEditStatusModal: false,

    deleteTarget: null,
    deleteType: null,

    alert: { show: false, type: '', message: '' },

    // Flat properties for CSP compatibility
    // Week
    newWeekNumber: '',
    newWeekTitle: '',
    newWeekDescription: '',
    editingWeek: null,
    editingWeekNumber: '',
    editingWeekTitle: '',
    editingWeekDescription: '',

    // Task
    newTaskWeekId: '',
    newTaskTitle: '',
    newTaskDescription: '',
    newTaskCategoryId: null,
    newTaskOrderIndex: 1,
    newTaskDayNumber: 1,
    editingTask: null,
    editingTaskTitle: '',
    editingTaskDescription: '',
    editingTaskCategoryId: null,
    editingTaskWeekId: null,
    editingTaskDayNumber: 1,
    editingTaskOrderIndex: 1,
    selectedWeekForTask: null,

    // Category
    newCategoryName: '',
    newCategoryLabel: '',
    newCategoryColor: '#00d4ff',
    newCategoryIcon: 'book',
    newCategoryHasScore: false,
    editingCategory: null,
    editingCategoryName: '',
    editingCategoryLabel: '',
    editingCategoryColor: '#00d4ff',
    editingCategoryIcon: 'book',
    editingCategoryHasScore: false,

    // Status
    newStatusName: '',
    newStatusLabel: '',
    newStatusColor: '#6b7280',
    newStatusSortOrder: 1,
    editingStatus: null,
    editingStatusName: '',
    editingStatusLabel: '',
    editingStatusColor: '#6b7280',
    editingStatusSortOrder: 1,

    async init() {
      const store = Alpine.store('app');

      await store.initAuth();

      if (!store.session) {
        window.location.href = '/';
        return;
      }

      await store.loadData();

      if (!store.mentor) {
        window.location.href = '/';
        return;
      }

      this.subscribeToChanges();
    },

    subscribeToChanges() {
      supabase
        .channel('program-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_categories' }, () => {
          this.loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_statuses' }, () => {
          this.loadData();
        })
        .subscribe();
    },

    async loadData() {
      await Alpine.store('app').refreshProgramData();
    },

    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    toggleWeek(weekId) {
      this.expandedWeek = this.expandedWeek === weekId ? null : weekId;
    },

    getTaskCount(weekId) {
      return this.tasks.filter(t => t.week_id === weekId).length;
    },

    // CSP-safe helper methods
    taskCountLabel(weekId) {
      return this.getTaskCount(weekId) + ' tasks';
    },

    categoryTaskCountLabel(categoryId) {
      return this.getTaskCountForCategory(categoryId) + ' tasks';
    },

    dayLabel(dayNumber) {
      return 'Day ' + (dayNumber || 1);
    },

    formatDescription(description) {
      if (!description) return 'No description';
      // Convert literal \n to actual newlines
      return description.replace(/\\n/g, '\n');
    },

    weekLabel(weekNumber) {
      return 'Week ' + weekNumber;
    },

    categoryIconStyle(color) {
      return 'background: ' + color + '20; color: ' + color;
    },

    categoryBadgeStyle(color) {
      return 'background: ' + color + '1a; color: ' + color;
    },

    statusColorStyle(color) {
      return 'background: ' + color + '20; color: ' + color;
    },

    statusOrderLabel(sortOrder) {
      return 'Order: ' + sortOrder;
    },

    beforeTaskLabel(title) {
      return 'Before: ' + title;
    },

    taskPositionLabel(task) {
      if (this.editingTask && task.id === this.editingTask.id) {
        return 'Current position (' + task.order_index + ')';
      }
      return 'Position ' + task.order_index + ': ' + task.title;
    },

    deleteTargetName() {
      if (!this.deleteTarget) return '';
      return this.deleteTarget.title || this.deleteTarget.label || ('Week ' + this.deleteTarget.week_number);
    },

    getSelectedWeekNumber() {
      return this.selectedWeekForTask ? this.selectedWeekForTask.week_number : '';
    },

    getSelectedWeekId() {
      return this.selectedWeekForTask ? this.selectedWeekForTask.id : null;
    },

    getEditingTaskWeekId() {
      return this.editingTask ? this.editingTaskWeekId : null;
    },

    getTasksForWeek(weekId) {
      return this.tasks.filter(t => t.week_id === weekId);
    },

    getEstimatedDuration() {
      return this.weeks.length * 5;
    },

    getNextOrderIndex(weekId) {
      if (!weekId) return 1;
      const weekTasks = this.tasks.filter(t => t.week_id === weekId);
      if (weekTasks.length === 0) return 1;
      return Math.max(...weekTasks.map(t => t.order_index || 0)) + 1;
    },

    getCategory(categoryId) {
      return this.categories.find(c => c.id === categoryId) || { name: 'unknown', label: 'Unknown', color: '#888' };
    },

    getDefaultCategoryId() {
      const learning = this.categories.find(c => c.name === 'learning');
      return learning?.id || (this.categories[0]?.id || null);
    },

    async addWeek() {
      try {
        const title = sanitizeInput(this.newWeekTitle, 200);
        const description = sanitizeInput(this.newWeekDescription, 1000) || null;
        const weekNum = parseInt(this.newWeekNumber);

        if (!title || isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
          this.showAlert('error', 'Invalid week number or title');
          return;
        }

        const { error } = await supabase.from('weeks').insert({
          week_number: weekNum,
          title,
          description
        });

        if (error) throw error;

        this.showAddWeekModal = false;
        this.showAlert('success', `Week ${weekNum} created successfully`);
        this.newWeekNumber = '';
        this.newWeekTitle = '';
        this.newWeekDescription = '';
        await this.loadData();
      } catch (err) {
        this.showAddWeekModal = false;
        console.error('Error creating week:', err);
        this.showAlert('error', err.message || err.details || 'Failed to create week');
      }
    },

    editWeek(week) {
      this.editingWeek = { ...week };
      this.editingWeekNumber = week.week_number;
      this.editingWeekTitle = week.title;
      this.editingWeekDescription = week.description || '';
      this.showEditWeekModal = true;
    },

    async saveWeek() {
      try {
        const title = sanitizeInput(this.editingWeekTitle, 200);
        const description = sanitizeInput(this.editingWeekDescription, 1000) || null;
        const weekNum = parseInt(this.editingWeekNumber);

        if (!title || isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
          this.showAlert('error', 'Invalid week number or title');
          return;
        }

        const { error } = await supabase
          .from('weeks')
          .update({
            week_number: weekNum,
            title,
            description
          })
          .eq('id', this.editingWeek.id);

        if (error) throw error;

        this.showAlert('success', `Week ${weekNum} updated successfully`);
        this.showEditWeekModal = false;
        this.editingWeek = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update week');
      }
    },

    confirmDeleteWeek(week) {
      this.deleteTarget = week;
      this.deleteType = 'week';
      this.showDeleteModal = true;
    },

    openAddTaskModal(week) {
      this.selectedWeekForTask = week;
      const nextOrder = this.getNextOrderIndex(week.id);
      this.newTaskWeekId = week.id;
      this.newTaskTitle = '';
      this.newTaskDescription = '';
      this.newTaskCategoryId = this.getDefaultCategoryId();
      this.newTaskOrderIndex = nextOrder;
      this.newTaskDayNumber = 1;
      this.showAddTaskModal = true;
    },

    async addTask() {
      try {
        const title = sanitizeInput(this.newTaskTitle, 200);
        const description = sanitizeInput(this.newTaskDescription, 2000) || null;
        const selectedOrder = parseInt(this.newTaskOrderIndex);
        const dayNumber = parseInt(this.newTaskDayNumber);

        if (!title) {
          this.showAlert('error', 'Task title is required');
          return;
        }

        const nextOrder = this.getNextOrderIndex(this.newTaskWeekId);

        if (selectedOrder < nextOrder) {
          const tasksToShift = this.tasks.filter(
            t => t.week_id === this.newTaskWeekId && t.order_index >= selectedOrder
          );
          for (const task of tasksToShift) {
            await supabase.from('tasks').update({ order_index: task.order_index + 1 }).eq('id', task.id);
          }
        }

        const { error } = await supabase.from('tasks').insert({
          week_id: this.newTaskWeekId,
          title,
          description,
          category_id: this.newTaskCategoryId,
          order_index: selectedOrder,
          day_number: dayNumber
        });

        if (error) throw error;

        this.showAlert('success', `Task "${title}" created successfully`);
        this.newTaskWeekId = '';
        this.newTaskTitle = '';
        this.newTaskDescription = '';
        this.newTaskCategoryId = null;
        this.newTaskOrderIndex = 1;
        this.newTaskDayNumber = 1;
        this.showAddTaskModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create task');
      }
    },

    editTask(task) {
      this.editingTask = { ...task };
      this.editingTaskTitle = task.title;
      this.editingTaskDescription = task.description || '';
      this.editingTaskCategoryId = task.category_id;
      this.editingTaskWeekId = task.week_id;
      this.editingTaskDayNumber = task.day_number || 1;
      this.editingTaskOrderIndex = task.order_index || 1;
      this.showEditTaskModal = true;
    },

    async saveTask() {
      try {
        const title = sanitizeInput(this.editingTaskTitle, 200);
        const description = sanitizeInput(this.editingTaskDescription, 2000) || null;

        if (!title) {
          this.showAlert('error', 'Task title is required');
          return;
        }

        const newOrder = parseInt(this.editingTaskOrderIndex);
        const originalTask = this.tasks.find(t => t.id === this.editingTask.id);
        const oldOrder = originalTask?.order_index || 0;

        if (newOrder !== oldOrder) {
          const weekTasks = this.tasks.filter(t => t.week_id === this.editingTaskWeekId && t.id !== this.editingTask.id);

          if (newOrder < oldOrder) {
            for (const task of weekTasks) {
              if (task.order_index >= newOrder && task.order_index < oldOrder) {
                await supabase.from('tasks').update({ order_index: task.order_index + 1 }).eq('id', task.id);
              }
            }
          } else {
            for (const task of weekTasks) {
              if (task.order_index > oldOrder && task.order_index <= newOrder) {
                await supabase.from('tasks').update({ order_index: task.order_index - 1 }).eq('id', task.id);
              }
            }
          }
        }

        const { error } = await supabase
          .from('tasks')
          .update({
            title,
            description,
            category_id: this.editingTaskCategoryId,
            order_index: newOrder,
            week_id: this.editingTaskWeekId,
            day_number: parseInt(this.editingTaskDayNumber)
          })
          .eq('id', this.editingTask.id);

        if (error) throw error;

        this.showAlert('success', `Task "${title}" updated successfully`);
        this.showEditTaskModal = false;
        this.editingTask = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update task');
      }
    },

    confirmDeleteTask(task) {
      this.deleteTarget = task;
      this.deleteType = 'task';
      this.showDeleteModal = true;
    },

    async executeDelete() {
      try {
        if (this.deleteType === 'week') {
          const { error } = await supabase
            .from('weeks')
            .delete()
            .eq('id', this.deleteTarget.id);

          if (error) throw error;
          this.showAlert('success', `Week ${this.deleteTarget.week_number} deleted successfully`);
        } else if (this.deleteType === 'task') {
          const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', this.deleteTarget.id);

          if (error) throw error;
          this.showAlert('success', `Task "${this.deleteTarget.title}" deleted successfully`);
        } else if (this.deleteType === 'category') {
          const { error } = await supabase
            .from('task_categories')
            .delete()
            .eq('id', this.deleteTarget.id);

          if (error) throw error;
          this.showAlert('success', `Category "${this.deleteTarget.label}" deleted successfully`);
        } else if (this.deleteType === 'status') {
          const { error } = await supabase
            .from('task_statuses')
            .delete()
            .eq('id', this.deleteTarget.id);

          if (error) throw error;
          this.showAlert('success', `Status "${this.deleteTarget.label}" deleted successfully`);
        }

        this.showDeleteModal = false;
        this.deleteTarget = null;
        this.deleteType = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to delete');
      }
    },

    openCategoriesModal() {
      this.showCategoriesModal = true;
    },

    openAddCategoryModal() {
      this.newCategoryName = '';
      this.newCategoryLabel = '';
      this.newCategoryColor = '#00d4ff';
      this.newCategoryIcon = 'book';
      this.newCategoryHasScore = false;
      this.showAddCategoryModal = true;
    },

    async addCategory() {
      try {
        const name = sanitizeInput(this.newCategoryName, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.newCategoryLabel, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase.from('task_categories').insert({
          name,
          label,
          color: this.newCategoryColor,
          icon: this.newCategoryIcon,
          has_score: this.newCategoryHasScore
        });

        if (error) throw error;

        this.showAlert('success', `Category "${label}" created successfully`);
        this.newCategoryName = '';
        this.newCategoryLabel = '';
        this.newCategoryColor = '#00d4ff';
        this.newCategoryIcon = 'book';
        this.newCategoryHasScore = false;
        this.showAddCategoryModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create category');
      }
    },

    editCategory(category) {
      this.editingCategory = { ...category };
      this.editingCategoryName = category.name;
      this.editingCategoryLabel = category.label;
      this.editingCategoryColor = category.color;
      this.editingCategoryIcon = category.icon;
      this.editingCategoryHasScore = category.has_score;
      this.showEditCategoryModal = true;
    },

    async saveCategory() {
      try {
        const name = sanitizeInput(this.editingCategoryName, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.editingCategoryLabel, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase
          .from('task_categories')
          .update({
            name,
            label,
            color: this.editingCategoryColor,
            icon: this.editingCategoryIcon,
            has_score: this.editingCategoryHasScore
          })
          .eq('id', this.editingCategory.id);

        if (error) throw error;

        this.showAlert('success', `Category "${label}" updated successfully`);
        this.showEditCategoryModal = false;
        this.editingCategory = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update category');
      }
    },

    confirmDeleteCategory(category) {
      this.deleteTarget = category;
      this.deleteType = 'category';
      this.showDeleteModal = true;
    },

    getTaskCountForCategory(categoryId) {
      return this.tasks.filter(t => t.category_id === categoryId).length;
    },

    openStatusesModal() {
      this.showStatusesModal = true;
    },

    openAddStatusModal() {
      const nextOrder = this.statuses.length > 0 ? Math.max(...this.statuses.map(s => s.sort_order || 0)) + 1 : 1;
      this.newStatusName = '';
      this.newStatusLabel = '';
      this.newStatusColor = '#6b7280';
      this.newStatusSortOrder = nextOrder;
      this.showAddStatusModal = true;
    },

    async addStatus() {
      try {
        const name = sanitizeInput(this.newStatusName, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.newStatusLabel, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase.from('task_statuses').insert({
          name,
          label,
          color: this.newStatusColor,
          sort_order: parseInt(this.newStatusSortOrder)
        });

        if (error) throw error;

        this.showAlert('success', `Status "${label}" created successfully`);
        this.newStatusName = '';
        this.newStatusLabel = '';
        this.newStatusColor = '#6b7280';
        this.newStatusSortOrder = 1;
        this.showAddStatusModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create status');
      }
    },

    editStatus(status) {
      this.editingStatus = { ...status };
      this.editingStatusName = status.name;
      this.editingStatusLabel = status.label;
      this.editingStatusColor = status.color;
      this.editingStatusSortOrder = status.sort_order;
      this.showEditStatusModal = true;
    },

    async saveStatus() {
      try {
        const name = sanitizeInput(this.editingStatusName, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.editingStatusLabel, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase
          .from('task_statuses')
          .update({
            name,
            label,
            color: this.editingStatusColor,
            sort_order: parseInt(this.editingStatusSortOrder)
          })
          .eq('id', this.editingStatus.id);

        if (error) throw error;

        this.showAlert('success', `Status "${label}" updated successfully`);
        this.showEditStatusModal = false;
        this.editingStatus = null;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to update status');
      }
    },

    confirmDeleteStatus(status) {
      this.deleteTarget = status;
      this.deleteType = 'status';
      this.showDeleteModal = true;
    },

    // CSP-safe icon setters
    setNewCategoryIcon(icon) {
      this.newCategoryIcon = icon;
    },

    setEditingCategoryIcon(icon) {
      this.editingCategoryIcon = icon;
    }
  }));
});
