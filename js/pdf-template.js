/**
 * Reusable PDF Template Module
 * Provides consistent header, footer, and styling across all PDF generation
 */

import { escapeHtml } from './security.js';

const rawCompany = import.meta.env.VITE_COMPANY || 'Company';
const company = escapeHtml(rawCompany);

// Professional color palette
export const colors = {
  primary: [15, 23, 42],       // Dark slate header
  accent: [20, 184, 166],      // Teal accent stripe
  cyan: [0, 212, 255],         // Cyan highlights
  success: [16, 185, 129],     // Green - pass/done
  danger: [239, 68, 68],       // Red - fail/blocked
  warning: [245, 158, 11],     // Amber - pending/in progress
  textDark: [30, 41, 59],      // Primary text
  textMuted: [100, 116, 139],  // Secondary text
  white: [255, 255, 255],
  lightBg: [248, 250, 252],    // Light background
  border: [226, 232, 240]      // Border color
};

/**
 * Add standard header to PDF document
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Object} options - Header options
 * @param {string} options.title - Main title (left side)
 * @param {string} options.subtitle - Subtitle below title
 * @param {string} options.rightTitle - Right side title (e.g., person name)
 * @param {string} options.rightSubtitle - Right side subtitle
 * @param {string} options.rightInfo - Additional right side info
 * @returns {number} Y position after header
 */
export function addHeader(doc, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const bannerHeight = 28;

  const {
    title = company.toUpperCase(),
    subtitle = 'REPORT',
    rightTitle = '',
    rightSubtitle = '',
    rightInfo = ''
  } = options;

  // Dark banner
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, bannerHeight, 'F');

  // Accent stripe at bottom of banner
  doc.setFillColor(...colors.accent);
  doc.rect(0, bannerHeight - 2, pageWidth, 2, 'F');

  // Left side - Company/Title
  doc.setTextColor(...colors.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 200);
  doc.text(subtitle, margin, 20);

  // Right side - Name/Info
  if (rightTitle) {
    doc.setTextColor(...colors.white);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(rightTitle, pageWidth - margin, 9, { align: 'right' });
  }

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 190, 200);

  if (rightSubtitle) {
    doc.text(rightSubtitle, pageWidth - margin, 16, { align: 'right' });
  }

  if (rightInfo) {
    doc.text(rightInfo, pageWidth - margin, 22, { align: 'right' });
  }

  return bannerHeight + 12;
}

/**
 * Add standard footer to PDF document
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Object} options - Footer options
 * @param {string} options.leftText - Left side text
 * @param {boolean} options.showPageNumber - Show page number on right
 */
export function addFooter(doc, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const footerY = pageHeight - 10;

  const {
    leftText = 'Confidential',
    showPageNumber = true
  } = options;

  doc.setTextColor(...colors.textMuted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  doc.text(leftText, margin, footerY);

  if (showPageNumber) {
    const pageCount = doc.internal.getNumberOfPages();
    doc.text(`Page ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
  }
}

/**
 * Add footer to all pages
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Object} options - Footer options
 */
export function addFooterToAllPages(doc, options = {}) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const footerY = pageHeight - 10;

  const { leftText = 'Confidential' } = options;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...colors.textMuted);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(leftText, margin, footerY);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
  }
}

/**
 * Create a section header
 * @param {jsPDF} doc - jsPDF document instance
 * @param {string} title - Section title
 * @param {number} y - Y position
 * @returns {number} Y position after section header
 */
export function addSectionHeader(doc, title, y) {
  doc.setTextColor(...colors.textDark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 15, y);
  return y + 8;
}

/**
 * Create an info card with light background
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} y - Y position
 * @param {number} height - Card height
 * @param {Object} options - Card options
 * @returns {number} Y position after card
 */
export function addInfoCard(doc, y, height, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const { hasBorder = false } = options;

  doc.setFillColor(...colors.lightBg);
  doc.roundedRect(margin, y, contentWidth, height, 3, 3, 'F');

  if (hasBorder) {
    doc.setDrawColor(...colors.border);
    doc.roundedRect(margin, y, contentWidth, height, 3, 3, 'S');
  }

  return y + height + 6;
}

/**
 * Create a status badge colored bar header
 * @param {jsPDF} doc - jsPDF document instance
 * @param {string} title - Section title
 * @param {string} status - Status for color (pass/fail/pending)
 * @param {number} y - Y position
 * @returns {number} Y position after header bar
 */
export function addStatusHeader(doc, title, status, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const statusColor = status === 'pass' ? colors.success :
                      status === 'fail' ? colors.danger : colors.warning;

  // Dark header bar
  doc.setFillColor(...colors.primary);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');

  // Status indicator stripe on left
  doc.setFillColor(...statusColor);
  doc.rect(margin, y, 4, 14, 'F');

  // Title
  doc.setTextColor(...colors.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 10, y + 9);

  // Status badge on right
  const statusText = (status || 'pending').toUpperCase();
  doc.setFillColor(...statusColor);
  const badgeWidth = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(pageWidth - margin - badgeWidth - 4, y + 3, badgeWidth, 8, 2, 2, 'F');
  doc.setTextColor(...colors.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, pageWidth - margin - badgeWidth / 2 - 4, y + 8.5, { align: 'center' });

  return y + 18;
}

/**
 * Check if page break is needed and add new page if so
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} currentY - Current Y position
 * @param {number} neededHeight - Height needed for next content
 * @param {number} bottomMargin - Bottom margin before page break (default 20)
 * @returns {number} Updated Y position (reset if new page added)
 */
export function checkPageBreak(doc, currentY, neededHeight, bottomMargin = 20) {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + neededHeight > pageHeight - bottomMargin) {
    doc.addPage();
    return 20; // Reset to top of new page
  }

  return currentY;
}

/**
 * Format date for PDF display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type: 'short', 'long', 'full'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
  if (!date) return 'N/A';

  const d = new Date(date);

  switch (format) {
    case 'long':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'full':
      return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    case 'short':
    default:
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

/**
 * Get the current generated date formatted
 * @returns {string} Formatted current date
 */
export function getGeneratedDate() {
  return formatDate(new Date(), 'short');
}
