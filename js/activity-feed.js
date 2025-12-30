import { supabase } from './supabase-client.js';
import { escapeHtml } from './security.js';

const activityHTML = `
  <aside class="sidebar-right" x-data="activityFeed()">
    <div class="activity-header">
      <span class="activity-title">Activity Feed</span>
      <div class="activity-live">LIVE</div>
    </div>
    <div class="activity-list">
      <template x-if="$store.app.activityLog.length === 0">
        <div class="activity-empty">No activity yet</div>
      </template>
      <template x-for="activity in $store.app.activityLog.slice(0, 20)" :key="activity.id">
        <div class="activity-item">
          <div class="activity-avatar" x-text="getMentorInitials(activity.mentor_id)"></div>
          <div class="activity-content">
            <div class="activity-text" x-html="formatActivity(activity)"></div>
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

    formatActivity(activity) {
      const store = Alpine.store('app');
      const mentor = store.mentors.find(m => m.id === activity.mentor_id);
      const mentorName = escapeHtml(mentor?.name || 'Someone');
      const action = activity.action;

      if (activity.entity_type === 'progress' && activity.details) {
        const task = store.tasks.find(t => t.id === activity.details.task_id);
        const trainee = store.trainees.find(t => t.id === activity.details.trainee_id);
        const taskTitle = escapeHtml(task?.title || 'a task');
        const traineeName = escapeHtml(trainee?.name || 'trainee');
        const status = activity.details.status;
        const statusText = status === 'done' ? 'completed' : status === 'in_progress' ? 'started' : status === 'blocked' ? 'blocked' : escapeHtml(status);
        return `<strong>${mentorName}</strong> marked <span class="highlight">${taskTitle}</span> as ${statusText} for ${traineeName}`;
      }

      if (activity.entity_type === 'notes') {
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted a note`;
        return `<strong>${mentorName}</strong> added a note`;
      }

      if (activity.entity_type === 'trainees') {
        const traineeName = escapeHtml(activity.details?.name || 'a trainee');
        if (action === 'INSERT') return `<strong>${mentorName}</strong> added trainee <span class="highlight">${traineeName}</span>`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated trainee <span class="highlight">${traineeName}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> removed trainee <span class="highlight">${traineeName}</span>`;
      }

      if (activity.entity_type === 'weeks') {
        const weekNum = escapeHtml(activity.details?.week_number || '?');
        const weekTitle = escapeHtml(activity.details?.title || '');
        if (action === 'INSERT') return `<strong>${mentorName}</strong> created <span class="highlight">Week ${weekNum}</span>${weekTitle ? ': ' + weekTitle : ''}`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated <span class="highlight">Week ${weekNum}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted <span class="highlight">Week ${weekNum}</span>`;
      }

      if (activity.entity_type === 'tasks') {
        const taskTitle = escapeHtml(activity.details?.title || 'a task');
        if (action === 'INSERT') return `<strong>${mentorName}</strong> created task <span class="highlight">${taskTitle}</span>`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated task <span class="highlight">${taskTitle}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted task <span class="highlight">${taskTitle}</span>`;
      }

      if (activity.entity_type === 'mentors') {
        const mentorTargetName = escapeHtml(activity.details?.name || 'a mentor');
        if (action === 'INSERT') return `<strong>${mentorName}</strong> added mentor <span class="highlight">${mentorTargetName}</span>`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated mentor <span class="highlight">${mentorTargetName}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> removed mentor <span class="highlight">${mentorTargetName}</span>`;
      }

      return `<strong>${mentorName}</strong> made an update`;
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
      return date.toLocaleDateString();
    }
  }));
});
