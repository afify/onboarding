// Navbar Component (ES Module)
import { getCurrentUser, getMentorProfile, signOut } from './supabase-client.js';

const navbarHTML = `
  <nav class="navbar" x-data="navbarData()" x-cloak>
    <div class="nav-brand">
      <div class="nav-logo">PT</div>
      <div class="nav-title">PayTabs <span>Onboarding</span></div>
    </div>
    <div class="nav-user">
      <div class="user-info">
        <div class="user-name" x-text="userName">Loading...</div>
        <div class="user-role" x-text="userRole"></div>
      </div>
      <button class="logout-btn" @click="handleLogout">Logout</button>
    </div>
  </nav>
`;

// Inject navbar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const layout = document.querySelector('.app-layout, .admin-layout, .reports-layout');
  if (layout) {
    layout.insertAdjacentHTML('afterbegin', navbarHTML);
  }
});

// Register Alpine component for navbar
document.addEventListener('alpine:init', () => {
  Alpine.data('navbarData', () => ({
    userName: 'Loading...',
    userRole: '',

    async init() {
      try {
        const user = await getCurrentUser();
        if (user) {
          const { data: mentor } = await getMentorProfile(user.id);
          if (mentor) {
            this.userName = mentor.name;
            this.userRole = mentor.role;
          }
        }
      } catch (e) {
        console.error('Navbar init error:', e);
      }
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
