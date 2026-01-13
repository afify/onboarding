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
        <div class="activity-item">
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
    }
  }));
});
