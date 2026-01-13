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
        await signOut();
        window.location.href = '/';
      } catch (e) {
        console.error('Logout error:', e);
      }
    }
  }));
});
