import { signOut } from './supabase-client.js';
import { escapeHtml } from './security.js';

const rawCompany = import.meta.env.VITE_COMPANY || 'Company';
const company = escapeHtml(rawCompany);
const companyInitials = escapeHtml(rawCompany.slice(0, 2).toUpperCase());

const navbarHTML = `
  <nav class="navbar" x-data="navbarData" x-cloak>
    <div class="nav-brand">
      <div class="nav-logo">${companyInitials}</div>
      <div class="nav-title">${company} <span>Onboarding</span></div>
    </div>
    <div class="nav-user">
      <div class="user-info">
        <div class="user-name" x-text="mentorName">Loading...</div>
        <div class="user-role" x-text="mentorRole"></div>
      </div>
      <button class="logout-btn" @click="handleLogout">Logout</button>
    </div>
  </nav>
`;

document.addEventListener('DOMContentLoaded', () => {
  const layout = document.querySelector('.app-layout, .admin-layout, .reports-layout');
  if (layout) {
    layout.insertAdjacentHTML('afterbegin', navbarHTML);
  }
});

document.addEventListener('alpine:init', () => {
  Alpine.data('navbarData', () => ({
    get mentorName() {
      const mentor = Alpine.store('app').mentor;
      return mentor?.name || 'Loading...';
    },

    get mentorRole() {
      const mentor = Alpine.store('app').mentor;
      return mentor?.role || '';
    },

    async handleLogout() {
      try {
        const { error } = await signOut();

        if (error) {
          // Log sanitized error (no stack trace)
          console.error('Logout failed:', error.message);
          alert('Logout failed. Please try again.');
          return;
        }

        // Clear Alpine store state
        const store = Alpine.store('app');
        store.session = null;
        store.user = null;
        store.mentor = null;
        store.isAdmin = false;
        store.authReady = false;

        // Clear all arrays
        store.mentors.splice(0, store.mentors.length);
        store.trainees.splice(0, store.trainees.length);
        store.weeks.splice(0, store.weeks.length);
        store.tasks.splice(0, store.tasks.length);
        store.progress.splice(0, store.progress.length);

        // Clear localStorage (except UI preferences)
        const uiPrefs = ['sidebarVisible', 'activityFeedVisible'];
        const savedPrefs = {};
        uiPrefs.forEach(key => {
          savedPrefs[key] = localStorage.getItem(key);
        });
        localStorage.clear();
        uiPrefs.forEach(key => {
          if (savedPrefs[key] !== null) {
            localStorage.setItem(key, savedPrefs[key]);
          }
        });

        // Redirect to login
        window.location.href = '/';
      } catch (e) {
        console.error('Logout error:', e.message || 'Unknown error');
        alert('Logout failed. Please try again.');
      }
    }
  }));
});
