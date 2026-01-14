import Alpine from '@alpinejs/csp';
import collapse from '@alpinejs/collapse';
import { jsPDF } from 'jspdf';
import { initStore } from './store.js';

Alpine.plugin(collapse);
window.Alpine = Alpine;
window.jsPDF = jsPDF;

initStore(Alpine);

import './hacker-console.js';

import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

import './interview-board.js';

Alpine.start();
