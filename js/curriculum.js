import { supabase, getSession, getCurrentUser, getMentorProfile, isAdmin } from './supabase-client.js';

document.addEventListener('alpine:init', () => {
  Alpine.data('curriculumPage', () => ({
    // State
    weeks: [],
    tasks: [],
    categories: [],
    statuses: [],
    expandedWeek: null,
    isAdminUser: false,

    // Modal states
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

    // Delete confirmation state
    deleteTarget: null,
    deleteType: null,

    // Alert state
    alert: { show: false, type: '', message: '' },

    // Form data
    newWeek: { week_number: '', title: '', description: '' },
    editingWeek: null,
    newTask: { week_id: '', title: '', description: '', category_id: null, order_index: 1 },
    editingTask: null,
    selectedWeekForTask: null,
    newCategory: { name: '', label: '', color: '#00d4ff', icon: 'book', has_score: false },
    editingCategory: null,
    newStatus: { name: '', label: '', color: '#6b7280', sort_order: 1 },
    editingStatus: null,

    // Initialize
    async init() {
      // Check authentication
      const session = await getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      const user = await getCurrentUser();
      const { data: mentor } = await getMentorProfile(user.id);

      if (!mentor) {
        window.location.href = '/';
        return;
      }

      // Check if user is admin
      this.isAdminUser = await isAdmin();

      // Load data
      await this.loadData();

      // Expand first week by default
      if (this.weeks.length > 0) {
        this.expandedWeek = this.weeks[0].id;
      }
    },

    async loadData() {
      // Load weeks
      const { data: weeks } = await supabase
        .from('weeks')
        .select('*')
        .order('week_number');
      this.weeks = weeks || [];

      // Load tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .order('order_index');
      this.tasks = tasks || [];

      // Load categories
      const { data: categories } = await supabase
        .from('task_categories')
        .select('*')
        .order('id');
      this.categories = categories || [];

      // Load statuses
      const { data: statuses } = await supabase
        .from('task_statuses')
        .select('*')
        .order('sort_order');
      this.statuses = statuses || [];
    },

    // Alert helper
    showAlert(type, message) {
      this.alert = { show: true, type, message };
      setTimeout(() => { this.alert.show = false; }, 4000);
    },

    // Helpers
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
      // Each week = 5 working days
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

    // Week CRUD operations
    async addWeek() {
      try {
        const { error } = await supabase.from('weeks').insert({
          week_number: parseInt(this.newWeek.week_number),
          title: this.newWeek.title.trim(),
          description: this.newWeek.description.trim() || null
        });

        if (error) throw error;

        this.showAlert('success', `Week ${this.newWeek.week_number} created successfully`);
        this.newWeek = { week_number: '', title: '', description: '' };
        this.showAddWeekModal = false;
        await this.loadData();
      } catch (err) {
        this.showAlert('error', err.message || 'Failed to create week');
      }
    },

    editWeek(week) {
      this.editingWeek = { ...week };
      this.showEditWeekModal = true;
    },

    async saveWeek() {
      try {
        const { error } = await supabase
          .from('weeks')
          .update({
            week_number: parseInt(this.editingWeek.week_number),
            title: this.editingWeek.title.trim(),
            description: this.editingWeek.description?.trim() || null
          })
          .eq('id', this.editingWeek.id);

        if (error) throw error;

        this.showAlert('success', `Week ${this.editingWeek.week_number} updated successfully`);
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

    // Task CRUD operations
    openAddTaskModal(week) {
      this.selectedWeekForTask = week;
      const nextOrder = this.getNextOrderIndex(week.id);
      this.newTask = { week_id: week.id, title: '', description: '', category_id: this.getDefaultCategoryId(), order_index: nextOrder };
      this.showAddTaskModal = true;
    },

    async addTask() {
      try {
        const selectedOrder = parseInt(this.newTask.order_index);
        const nextOrder = this.getNextOrderIndex(this.newTask.week_id);

        // If inserting before existing tasks, shift them down
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
          title: this.newTask.title.trim(),
          description: this.newTask.description.trim() || null,
          category_id: this.newTask.category_id,
          order_index: selectedOrder
        });

        if (error) throw error;

        this.showAlert('success', `Task "${this.newTask.title}" created successfully`);
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
        const newOrder = parseInt(this.editingTask.order_index);
        const originalTask = this.tasks.find(t => t.id === this.editingTask.id);
        const oldOrder = originalTask?.order_index || 0;

        // Handle reordering if order changed
        if (newOrder !== oldOrder) {
          const weekTasks = this.tasks.filter(t => t.week_id === this.editingTask.week_id && t.id !== this.editingTask.id);

          if (newOrder < oldOrder) {
            // Moving up: shift tasks between newOrder and oldOrder down
            for (const task of weekTasks) {
              if (task.order_index >= newOrder && task.order_index < oldOrder) {
                await supabase.from('tasks').update({ order_index: task.order_index + 1 }).eq('id', task.id);
              }
            }
          } else {
            // Moving down: shift tasks between oldOrder and newOrder up
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
            title: this.editingTask.title.trim(),
            description: this.editingTask.description?.trim() || null,
            category_id: this.editingTask.category_id,
            order_index: newOrder
          })
          .eq('id', this.editingTask.id);

        if (error) throw error;

        this.showAlert('success', `Task "${this.editingTask.title}" updated successfully`);
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

    // Execute delete operation
    async executeDelete() {
      try {
        if (this.deleteType === 'week') {
          // Delete will cascade to tasks due to foreign key constraint
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

    // Category CRUD operations
    openCategoriesModal() {
      this.showCategoriesModal = true;
    },

    openAddCategoryModal() {
      this.newCategory = { name: '', label: '', color: '#00d4ff', icon: 'book', has_score: false };
      this.showAddCategoryModal = true;
    },

    async addCategory() {
      try {
        const { error } = await supabase.from('task_categories').insert({
          name: this.newCategory.name.trim().toLowerCase().replace(/\s+/g, '_'),
          label: this.newCategory.label.trim(),
          color: this.newCategory.color,
          icon: this.newCategory.icon,
          has_score: this.newCategory.has_score
        });

        if (error) throw error;

        this.showAlert('success', `Category "${this.newCategory.label}" created successfully`);
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
        const { error } = await supabase
          .from('task_categories')
          .update({
            name: this.editingCategory.name.trim().toLowerCase().replace(/\s+/g, '_'),
            label: this.editingCategory.label.trim(),
            color: this.editingCategory.color,
            icon: this.editingCategory.icon,
            has_score: this.editingCategory.has_score
          })
          .eq('id', this.editingCategory.id);

        if (error) throw error;

        this.showAlert('success', `Category "${this.editingCategory.label}" updated successfully`);
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

    // Status CRUD operations
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
        const { error } = await supabase.from('task_statuses').insert({
          name: this.newStatus.name.trim().toLowerCase().replace(/\s+/g, '_'),
          label: this.newStatus.label.trim(),
          color: this.newStatus.color,
          sort_order: parseInt(this.newStatus.sort_order)
        });

        if (error) throw error;

        this.showAlert('success', `Status "${this.newStatus.label}" created successfully`);
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
        const { error } = await supabase
          .from('task_statuses')
          .update({
            name: this.editingStatus.name.trim().toLowerCase().replace(/\s+/g, '_'),
            label: this.editingStatus.label.trim(),
            color: this.editingStatus.color,
            sort_order: parseInt(this.editingStatus.sort_order)
          })
          .eq('id', this.editingStatus.id);

        if (error) throw error;

        this.showAlert('success', `Status "${this.editingStatus.label}" updated successfully`);
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
      // This would need progress data - for now return 0
      return 0;
    }
  }));
});
