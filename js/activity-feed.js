// Activity Feed Component (ES Module)
import { supabase } from './supabase-client.js';

const activityHTML = `
  <aside class="sidebar-right" x-data="activityFeed()">
    <div class="activity-header">
      <span class="activity-title">Activity Feed</span>
      <div class="activity-live">LIVE</div>
    </div>
    <div class="activity-list">
      <template x-if="activities.length === 0">
        <div class="activity-empty">No activity yet</div>
      </template>
      <template x-for="activity in activities.slice(0, 20)" :key="activity.id">
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

// Inject activity feed when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const layout = document.querySelector('.app-layout, .admin-layout, .reports-layout');
  if (layout) {
    layout.insertAdjacentHTML('beforeend', activityHTML);
  }
});

// Register Alpine component
document.addEventListener('alpine:init', () => {
  Alpine.data('activityFeed', () => ({
    activities: [],
    mentors: [],
    tasks: [],
    trainees: [],
    weeks: [],
    subscription: null,

    async init() {
      try {
        // Load mentors, tasks, trainees, weeks for formatting
        const [mentorsRes, tasksRes, traineesRes, weeksRes, activityRes] = await Promise.all([
          supabase.from('mentors').select('id, name'),
          supabase.from('tasks').select('id, title'),
          supabase.from('trainees').select('id, name'),
          supabase.from('weeks').select('id, week_number, title'),
          supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50)
        ]);

        this.mentors = mentorsRes.data || [];
        this.tasks = tasksRes.data || [];
        this.trainees = traineesRes.data || [];
        this.weeks = weeksRes.data || [];
        this.activities = activityRes.data || [];

        // Subscribe to realtime updates
        this.subscription = supabase
          .channel('activity-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
            this.activities.unshift(payload.new);
            if (this.activities.length > 50) this.activities.pop();
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
      const mentor = this.mentors.find(m => m.id === mentorId);
      if (!mentor) return '??';
      return mentor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    formatActivity(activity) {
      const mentor = this.mentors.find(m => m.id === activity.mentor_id);
      const mentorName = mentor?.name || 'Someone';
      const action = activity.action;

      // Progress updates
      if (activity.entity_type === 'progress' && activity.details) {
        const task = this.tasks.find(t => t.id === activity.details.task_id);
        const trainee = this.trainees.find(t => t.id === activity.details.trainee_id);
        const taskTitle = task?.title || 'a task';
        const traineeName = trainee?.name || 'trainee';
        const status = activity.details.status;
        const statusText = status === 'done' ? 'completed' : status === 'in_progress' ? 'started' : status === 'blocked' ? 'blocked' : status;
        return `<strong>${mentorName}</strong> marked <span class="highlight">${taskTitle}</span> as ${statusText} for ${traineeName}`;
      }

      // Notes
      if (activity.entity_type === 'notes') {
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted a note`;
        return `<strong>${mentorName}</strong> added a note`;
      }

      // Trainees
      if (activity.entity_type === 'trainees') {
        const traineeName = activity.details?.name || 'a trainee';
        if (action === 'INSERT') return `<strong>${mentorName}</strong> added trainee <span class="highlight">${traineeName}</span>`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated trainee <span class="highlight">${traineeName}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> removed trainee <span class="highlight">${traineeName}</span>`;
      }

      // Weeks
      if (activity.entity_type === 'weeks') {
        const weekNum = activity.details?.week_number || '?';
        const weekTitle = activity.details?.title || '';
        if (action === 'INSERT') return `<strong>${mentorName}</strong> created <span class="highlight">Week ${weekNum}</span>${weekTitle ? ': ' + weekTitle : ''}`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated <span class="highlight">Week ${weekNum}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted <span class="highlight">Week ${weekNum}</span>`;
      }

      // Tasks
      if (activity.entity_type === 'tasks') {
        const taskTitle = activity.details?.title || 'a task';
        if (action === 'INSERT') return `<strong>${mentorName}</strong> created task <span class="highlight">${taskTitle}</span>`;
        if (action === 'UPDATE') return `<strong>${mentorName}</strong> updated task <span class="highlight">${taskTitle}</span>`;
        if (action === 'DELETE') return `<strong>${mentorName}</strong> deleted task <span class="highlight">${taskTitle}</span>`;
      }

      // Mentors
      if (activity.entity_type === 'mentors') {
        const mentorTargetName = activity.details?.name || 'a mentor';
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
