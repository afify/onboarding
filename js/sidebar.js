const currentPath = window.location.pathname;

const isActive = (path) => {
  if (path === '/dashboard.html' && (currentPath === '/' || currentPath === '/dashboard.html')) return true;
  return currentPath === path;
};

const sidebarHTML = `
  <aside class="sidebar-left" x-data="sidebarData()">
    <div class="sidebar-section-title">Navigation</div>
    <div class="nav-menu">
      <a href="/dashboard.html" class="nav-item ${isActive('/dashboard.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        <span>Dashboard</span>
      </a>
      <a href="/trainees.html" class="nav-item ${isActive('/trainees.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <span>Trainees</span>
      </a>
      <a href="/curriculum.html" class="nav-item ${isActive('/curriculum.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <span>Curriculum</span>
      </a>
      <a href="/tracking.html" class="nav-item ${isActive('/tracking.html') ? 'active' : ''}">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
        <span>Tracking</span>
      </a>
      <a href="/admin.html" class="nav-item ${isActive('/admin.html') ? 'active' : ''}" x-show="isAdminUser" x-cloak>
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <span>Admins</span>
      </a>
    </div>
    <div id="sidebar-extra"></div>
  </aside>
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
    get isAdminUser() {
      return Alpine.store('app').isAdmin;
    }
  }));
});
