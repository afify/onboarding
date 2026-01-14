import { supabase } from './supabase-client.js';

const activityHTML = `
  <aside class="sidebar-right" x-data="activityFeed">
    <div class="activity-header">
      <span class="activity-title">Activity Feed</span>
      <div class="activity-live">LIVE</div>
    </div>
    <div class="activity-list">
      <template x-if="activityLog.length === 0">
        <div class="activity-empty">No activity yet</div>
      </template>
      <template x-for="activity in activityLog.slice(0, 7)" :key="activity.id">
        <div class="activity-item" @click="openActivityModal(activity)" style="cursor: pointer;">
          <div class="activity-avatar" x-text="getMentorInitials(activity.mentor_id)"></div>
          <div class="activity-content">
            <div class="activity-text">
              <strong x-text="getActivityMentorName(activity)"></strong>
              <span x-text="getActivityAction(activity)"></span>
              <span class="highlight" x-text="getActivityTarget(activity)" x-show="getActivityTarget(activity)"></span>
              <span x-text="getActivitySuffix(activity)" x-show="getActivitySuffix(activity)"></span>
            </div>
            <div class="activity-time" x-text="formatTime(activity.created_at)"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Activity Detail Modal - teleported to body -->
    <template x-teleport="body">
      <div class="modal-overlay" x-show="showActivityModal" x-cloak @click.self="showActivityModal = false" style="display: none;">
        <div class="modal-content activity-detail-modal" @click.stop>
          <div class="modal-header">
            <h2 class="modal-title">Activity Details</h2>
            <button class="modal-close" @click="showActivityModal = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="modal-body" x-show="selectedActivity">
            <div class="activity-detail-section">
              <div class="activity-detail-row">
                <span class="activity-detail-label">User</span>
                <span class="activity-detail-value" x-text="getSelectedMentorName()"></span>
              </div>
              <div class="activity-detail-row">
                <span class="activity-detail-label">Action</span>
                <span class="activity-detail-value">
                  <span class="activity-action-badge" :class="getActionBadgeClass(selectedActivity)" x-text="getSelectedAction()"></span>
                </span>
              </div>
              <div class="activity-detail-row">
                <span class="activity-detail-label">Entity Type</span>
                <span class="activity-detail-value" x-text="getSelectedEntityType()"></span>
              </div>
              <div class="activity-detail-row">
                <span class="activity-detail-label">Time</span>
                <span class="activity-detail-value" x-text="getSelectedTime()"></span>
              </div>
            </div>

            <template x-if="hasSelectedDetails()">
              <div class="activity-detail-section">
                <h3 class="activity-detail-section-title">Details</h3>
                <template x-for="(value, key) in getSelectedDetails()" :key="key">
                  <div class="activity-detail-row" x-show="value !== null && value !== undefined">
                    <span class="activity-detail-label" x-text="formatDetailKey(key)"></span>
                    <span class="activity-detail-value" x-text="formatDetailValue(key, value)"></span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </aside>
`;

document.addEventListener('DOMContentLoaded', () => {
  const layout = document.querySelector('.app-layout, .admin-layout, .reports-layout');
  if (layout) {
    layout.insertAdjacentHTML('beforeend', activityHTML);
  }
});

document.addEventListener('alpine:init', () => {
  Alpine.data('activityFeed', () => ({
    subscription: null,
    showActivityModal: false,
    selectedActivity: null,

    get activityLog() {
      return Alpine.store('app').activityLog;
    },

    async init() {
      try {
        const store = Alpine.store('app');

        if (!store.dataReady) {
          await store.initAuth();
          await store.loadData();
        }

        this.subscription = supabase
          .channel('activity-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
            store.activityLog.unshift(payload.new);
            if (store.activityLog.length > 50) store.activityLog.pop();
          })
          .subscribe();

      } catch (e) {
        console.error('Activity feed init error:', e);
      }
    },

    destroy() {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
    },

    getMentorInitials(mentorId) {
      const mentor = Alpine.store('app').mentors.find(m => m.id === mentorId);
      if (!mentor) return '??';
      return mentor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    getActivityMentorName(activity) {
      const mentor = Alpine.store('app').mentors.find(m => m.id === activity.mentor_id);
      return mentor?.name || 'Someone';
    },

    getActivityAction(activity) {
      const action = activity.action;
      const type = activity.entity_type;

      if (type === 'progress' && activity.details) {
        const status = activity.details.status;
        const statusText = status === 'done' ? 'completed' : status === 'in_progress' ? 'started' : status === 'blocked' ? 'blocked' : status;
        return ` marked as ${statusText}`;
      }
      if (type === 'notes') {
        return action === 'DELETE' ? ' deleted a note' : ' added a note';
      }
      if (type === 'trainees') {
        if (action === 'INSERT') return ' added trainee';
        if (action === 'UPDATE') return ' updated trainee';
        if (action === 'DELETE') return ' removed trainee';
      }
      if (type === 'weeks') {
        if (action === 'INSERT') return ' created';
        if (action === 'UPDATE') return ' updated';
        if (action === 'DELETE') return ' deleted';
      }
      if (type === 'tasks') {
        if (action === 'INSERT') return ' created task';
        if (action === 'UPDATE') return ' updated task';
        if (action === 'DELETE') return ' deleted task';
      }
      if (type === 'mentors') {
        if (action === 'INSERT') return ' added mentor';
        if (action === 'UPDATE') return ' updated mentor';
        if (action === 'DELETE') return ' removed mentor';
      }
      if (type === 'task_categories') {
        if (action === 'INSERT') return ' created category';
        if (action === 'UPDATE') return ' updated category';
        if (action === 'DELETE') return ' deleted category';
      }
      return ' made an update';
    },

    getActivityTarget(activity) {
      const store = Alpine.store('app');
      const type = activity.entity_type;

      if (type === 'progress' && activity.details) {
        const task = store.tasks.find(t => t.id === activity.details.task_id);
        return task?.title || 'a task';
      }
      if (type === 'notes') return '';
      if (type === 'trainees') return activity.details?.name || 'a trainee';
      if (type === 'weeks') return 'Week ' + (activity.details?.week_number || '?');
      if (type === 'tasks') return activity.details?.title || 'a task';
      if (type === 'mentors') return activity.details?.name || 'a mentor';
      if (type === 'task_categories') return activity.details?.label || 'a category';
      return '';
    },

    getActivitySuffix(activity) {
      if (activity.entity_type === 'progress' && activity.details) {
        const store = Alpine.store('app');
        const trainee = store.trainees.find(t => t.id === activity.details.trainee_id);
        const status = activity.details.status;
        const statusText = status === 'done' ? 'completed' : status === 'in_progress' ? 'started' : status === 'blocked' ? 'blocked' : status;
        return ' as ' + statusText + ' for ' + (trainee?.name || 'trainee');
      }
      return '';
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return 'Just now';
      if (mins < 60) return mins + 'm ago';
      if (hours < 24) return hours + 'h ago';
      if (days < 7) return days + 'd ago';
      return this.formatDate(date);
    },

    formatDate(date) {
      return Alpine.store('app').formatDate(date);
    },

    openActivityModal(activity) {
      this.selectedActivity = activity;
      this.showActivityModal = true;
    },

    getSelectedMentorName() {
      return this.selectedActivity ? this.getActivityMentorName(this.selectedActivity) : '';
    },

    getSelectedAction() {
      return this.selectedActivity ? this.selectedActivity.action : '';
    },

    getSelectedEntityType() {
      return this.selectedActivity ? this.formatEntityType(this.selectedActivity.entity_type) : '';
    },

    getSelectedTime() {
      return this.selectedActivity ? this.formatFullTime(this.selectedActivity.created_at) : '';
    },

    hasSelectedDetails() {
      return this.selectedActivity && this.selectedActivity.details && Object.keys(this.selectedActivity.details).length > 0;
    },

    getSelectedDetails() {
      return this.selectedActivity && this.selectedActivity.details ? this.selectedActivity.details : {};
    },

    getActionBadgeClass(activity) {
      if (!activity) return '';
      const action = activity.action;
      if (action === 'INSERT') return 'badge-insert';
      if (action === 'UPDATE') return 'badge-update';
      if (action === 'DELETE') return 'badge-delete';
      return '';
    },

    formatEntityType(type) {
      if (!type) return '';
      const typeMap = new Map([
        ['progress', 'Task Progress'],
        ['notes', 'Notes'],
        ['trainees', 'Trainee'],
        ['weeks', 'Program Week'],
        ['tasks', 'Task'],
        ['mentors', 'Mentor'],
        ['task_categories', 'Category'],
        ['interview_stages', 'Interview Stage'],
        ['stage_criteria', 'Stage Criteria'],
        ['candidates', 'Candidate'],
        ['candidate_scores', 'Candidate Score']
      ]);
      return typeMap.get(type) || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    formatFullTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    },

    formatDetailKey(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    formatDetailValue(key, value) {
      if (value === null || value === undefined) return '-';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (key.includes('id') && typeof value === 'string' && value.length > 20) {
        return value.substring(0, 8) + '...';
      }
      if (key.includes('date') || key.includes('_at')) {
        return this.formatFullTime(value);
      }
      return String(value);
    }
  }));
});
