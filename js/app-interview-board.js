import Alpine from '@alpinejs/csp';
import collapse from '@alpinejs/collapse';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { initStore } from './store.js';

Alpine.plugin(collapse);
window.Alpine = Alpine;
window.jsPDF = jsPDF;
window.html2canvas = html2canvas;

initStore(Alpine);

import './hacker-console.js';

import './navbar.js';
import './sidebar.js';
import './activity-feed.js';

import './interview-board.js';

Alpine.start();
