import Alpine from '@alpinejs/csp';
import collapse from '@alpinejs/collapse';
import { initStore } from './store.js';

Alpine.plugin(collapse);
window.Alpine = Alpine;

initStore(Alpine);

import './hacker-console.js';

import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

import './tasks.js';

Alpine.start();
