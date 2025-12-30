// Admin page entry
import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';
Alpine.plugin(collapse);
window.Alpine = Alpine;

// Hacker console (must be first to intercept fetch)
import './hacker-console.js';

// Shared components
import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

// Page-specific component
import './admin.js';

// Start Alpine after all components are registered
Alpine.start();
