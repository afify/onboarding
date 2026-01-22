const currentPath = window.location.pathname;

const isActive = (path) => {
  if (path === '/dashboard.html' && (currentPath === '/' || currentPath === '/dashboard.html')) return true;
  return currentPath === path;
};

const isInterviewActive = () => {
  return currentPath === '/interviews.html' ||
         currentPath === '/interview-board.html' ||
         currentPath === '/candidates.html';
};

const isOnboardingActive = () => {
  return currentPath === '/trainees.html' ||
         currentPath === '/program.html' ||
         currentPath === '/tracking.html' ||
         currentPath === '/tasks.html';
};

const sidebarHTML = `
  <div class="sidebar-wrapper" x-data="sidebarData()">
    <!-- Toggle button - always visible -->
    <button class="sidebar-toggle-floating" @click="sidebarVisible = !sidebarVisible" :title="sidebarVisible ? 'Hide navigation' : 'Show navigation'">
      <svg x-show="!sidebarVisible" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
      <svg x-show="sidebarVisible" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg>
    </button>

    <aside class="sidebar-left" x-show="sidebarVisible" x-transition:enter="sidebar-enter" x-transition:leave="sidebar-leave">
    <div class="sidebar-section-title">Navigation</div>
    <div class="nav-menu">
      <a href="/dashboard.html" class="nav-item ${isActive('/dashboard.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        <span>Dashboard</span>
      </a>
      <!-- Interviews Dropdown -->
      <div class="nav-dropdown ${isInterviewActive() ? 'expanded' : ''}">
        <button class="nav-item nav-dropdown-toggle ${isInterviewActive() ? 'active' : ''}" @click="interviewsOpen = !interviewsOpen">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <span>Interviews</span>
          <svg class="dropdown-arrow" :class="{ 'rotated': interviewsOpen }" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div class="nav-dropdown-menu" x-show="interviewsOpen" x-collapse>
          <a href="/interview-board.html" class="nav-subitem ${isActive('/interview-board.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
            </svg>
            Board
          </a>
          <a href="/candidates.html" class="nav-subitem ${isActive('/candidates.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Candidates
          </a>
          <a href="/interviews.html" class="nav-subitem ${isActive('/interviews.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Settings
          </a>
        </div>
      </div>

      <!-- Onboarding Dropdown -->
      <div class="nav-dropdown ${isOnboardingActive() ? 'expanded' : ''}">
        <button class="nav-item nav-dropdown-toggle ${isOnboardingActive() ? 'active' : ''}" @click="onboardingOpen = !onboardingOpen">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          <span>Onboarding</span>
          <svg class="dropdown-arrow" :class="{ 'rotated': onboardingOpen }" width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div class="nav-dropdown-menu" x-show="onboardingOpen" x-collapse>
          <a href="/trainees.html" class="nav-subitem ${isActive('/trainees.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            Trainees
          </a>
          <a href="/program.html" class="nav-subitem ${isActive('/program.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
            Program
          </a>
          <a href="/tracking.html" class="nav-subitem ${isActive('/tracking.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            Tracking
          </a>
          <a href="/tasks.html" class="nav-subitem ${isActive('/tasks.html') ? 'active' : ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Tasks
          </a>
        </div>
      </div>

      <a href="/admin.html" class="nav-item ${isActive('/admin.html') ? 'active' : ''}" x-show="isAdminUser" x-cloak>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>Admins</span>
      </a>
      <a href="/documents.html" class="nav-item ${isActive('/documents.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/>
        </svg>
        <span>Documents</span>
      </a>
    </div>
    <div id="sidebar-extra"></div>
  </aside>
  </div>
`;

document.addEventListener('DOMContentLoaded', () => {
  const layout = document.querySelector('.app-layout, .admin-layout, .reports-layout');
  if (layout) {
    layout.insertAdjacentHTML('afterbegin', sidebarHTML);

    const extraContent = document.querySelector('[data-sidebar-content]');
    const sidebarExtra = document.getElementById('sidebar-extra');
    if (extraContent && sidebarExtra) {
      sidebarExtra.appendChild(extraContent);
      extraContent.style.display = 'block';
    }
  }
});

document.addEventListener('alpine:init', () => {
  Alpine.data('sidebarData', () => ({
    onboardingOpen: isOnboardingActive(),
    interviewsOpen: isInterviewActive(),
    sidebarVisible: true,
    layoutEl: null,

    init() {
      // Load saved visibility state from localStorage (default to true)
      this.sidebarVisible = localStorage.getItem('sidebarVisible') !== 'false';

      // Get layout element for toggling class
      this.layoutEl = document.querySelector('.app-layout, .admin-layout, .reports-layout');
      this.updateLayoutClass();

      // Watch sidebarVisible changes and persist to localStorage
      this.$watch('sidebarVisible', (value) => {
        this.updateLayoutClass();
        localStorage.setItem('sidebarVisible', value);
      });
    },

    updateLayoutClass() {
      if (this.layoutEl) {
        this.layoutEl.classList.toggle('sidebar-hidden', !this.sidebarVisible);
      }
    },

    get isAdminUser() {
      return Alpine.store('app').isAdmin;
    }
  }));
});
