// Main app entry - imports Alpine and all components
import Alpine from 'alpinejs';

// Make Alpine available globally
window.Alpine = Alpine;

// Import all component modules (they register with Alpine.data on alpine:init)
import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

// Start Alpine
Alpine.start();
