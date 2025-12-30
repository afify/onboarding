// Tracking page entry
import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';

Alpine.plugin(collapse);
window.Alpine = Alpine;

// Hacker console (vanilla JS - no Alpine dependency)
import './hacker-console.js';

// Shared components
import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

// Page-specific component
import './tracking.js';

// Start Alpine after all components are registered
Alpine.start();
