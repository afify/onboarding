import { supabase } from './supabase-client.js';
import { sanitizeInput } from './security.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('curriculumPage', () => ({
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

    newWeek: { week_number: '', title: '', description: '' },
    editingWeek: null,
    newTask: { week_id: '', title: '', description: '', category_id: null, order_index: 1, day_number: 1 },
    editingTask: null,
    selectedWeekForTask: null,
    newCategory: { name: '', label: '', color: '#00d4ff', icon: 'book', has_score: false },
    editingCategory: null,
    newStatus: { name: '', label: '', color: '#6b7280', sort_order: 1 },
    editingStatus: null,

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

      if (this.weeks.length > 0) {
        this.expandedWeek = this.weeks[0].id;
      }
    },

    async loadData() {
      await Alpine.store('app').refreshCurriculumData();
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
        const title = sanitizeInput(this.newWeek.title, 200);
        const description = sanitizeInput(this.newWeek.description, 1000) || null;
        const weekNum = parseInt(this.newWeek.week_number);

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
        this.newWeek = { week_number: '', title: '', description: '' };
        await this.loadData();
      } catch (err) {
        this.showAddWeekModal = false;
        console.error('Error creating week:', err);
        this.showAlert('error', err.message || err.details || 'Failed to create week');
      }
    },

    editWeek(week) {
      this.editingWeek = { ...week };
      this.showEditWeekModal = true;
    },

    async saveWeek() {
      try {
        const title = sanitizeInput(this.editingWeek.title, 200);
        const description = sanitizeInput(this.editingWeek.description, 1000) || null;
        const weekNum = parseInt(this.editingWeek.week_number);

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
      this.newTask = { week_id: week.id, title: '', description: '', category_id: this.getDefaultCategoryId(), order_index: nextOrder };
      this.showAddTaskModal = true;
    },

    async addTask() {
      try {
        const title = sanitizeInput(this.newTask.title, 200);
        const description = sanitizeInput(this.newTask.description, 2000) || null;
        const selectedOrder = parseInt(this.newTask.order_index);
        const dayNumber = parseInt(this.newTask.day_number);

        if (!title) {
          this.showAlert('error', 'Task title is required');
          return;
        }

        const nextOrder = this.getNextOrderIndex(this.newTask.week_id);

        if (selectedOrder < nextOrder) {
          const tasksToShift = this.tasks.filter(
            t => t.week_id === this.newTask.week_id && t.order_index >= selectedOrder
          );
          for (const task of tasksToShift) {
            await supabase.from('tasks').update({ order_index: task.order_index + 1 }).eq('id', task.id);
          }
        }

        const { error } = await supabase.from('tasks').insert({
          week_id: this.newTask.week_id,
          title,
          description,
          category_id: this.newTask.category_id,
          order_index: selectedOrder,
          day_number: dayNumber
        });

        if (error) throw error;

        this.showAlert('success', `Task "${title}" created successfully`);
        this.newTask = { week_id: '', title: '', description: '', category_id: null, order_index: 1 };
        this.showAddTaskModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create task');
      }
    },

    editTask(task) {
      this.editingTask = { ...task };
      this.showEditTaskModal = true;
    },

    async saveTask() {
      try {
        const title = sanitizeInput(this.editingTask.title, 200);
        const description = sanitizeInput(this.editingTask.description, 2000) || null;

        if (!title) {
          this.showAlert('error', 'Task title is required');
          return;
        }

        const newOrder = parseInt(this.editingTask.order_index);
        const originalTask = this.tasks.find(t => t.id === this.editingTask.id);
        const oldOrder = originalTask?.order_index || 0;

        if (newOrder !== oldOrder) {
          const weekTasks = this.tasks.filter(t => t.week_id === this.editingTask.week_id && t.id !== this.editingTask.id);

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
            category_id: this.editingTask.category_id,
            order_index: newOrder,
            week_id: this.editingTask.week_id,
            day_number: parseInt(this.editingTask.day_number)
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
      this.newCategory = { name: '', label: '', color: '#00d4ff', icon: 'book', has_score: false };
      this.showAddCategoryModal = true;
    },

    async addCategory() {
      try {
        const name = sanitizeInput(this.newCategory.name, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.newCategory.label, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase.from('task_categories').insert({
          name,
          label,
          color: this.newCategory.color,
          icon: this.newCategory.icon,
          has_score: this.newCategory.has_score
        });

        if (error) throw error;

        this.showAlert('success', `Category "${label}" created successfully`);
        this.newCategory = { name: '', label: '', color: '#00d4ff', icon: 'book', has_score: false };
        this.showAddCategoryModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create category');
      }
    },

    editCategory(category) {
      this.editingCategory = { ...category };
      this.showEditCategoryModal = true;
    },

    async saveCategory() {
      try {
        const name = sanitizeInput(this.editingCategory.name, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.editingCategory.label, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase
          .from('task_categories')
          .update({
            name,
            label,
            color: this.editingCategory.color,
            icon: this.editingCategory.icon,
            has_score: this.editingCategory.has_score
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
      this.newStatus = { name: '', label: '', color: '#6b7280', sort_order: nextOrder };
      this.showAddStatusModal = true;
    },

    async addStatus() {
      try {
        const name = sanitizeInput(this.newStatus.name, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.newStatus.label, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase.from('task_statuses').insert({
          name,
          label,
          color: this.newStatus.color,
          sort_order: parseInt(this.newStatus.sort_order)
        });

        if (error) throw error;

        this.showAlert('success', `Status "${label}" created successfully`);
        this.newStatus = { name: '', label: '', color: '#6b7280', sort_order: 1 };
        this.showAddStatusModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create status');
      }
    },

    editStatus(status) {
      this.editingStatus = { ...status };
      this.showEditStatusModal = true;
    },

    async saveStatus() {
      try {
        const name = sanitizeInput(this.editingStatus.name, 50).toLowerCase().replace(/\s+/g, '_');
        const label = sanitizeInput(this.editingStatus.label, 100);

        if (!name || !label) {
          this.showAlert('error', 'Name and label are required');
          return;
        }

        const { error } = await supabase
          .from('task_statuses')
          .update({
            name,
            label,
            color: this.editingStatus.color,
            sort_order: parseInt(this.editingStatus.sort_order)
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

    getTaskCountForStatus(statusId) {
      return 0;
    }
  }));
});
