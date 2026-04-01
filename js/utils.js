export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getMentorName(mentors, mentorId) {
  const mentor = mentors.find(m => m.id === mentorId);
  return mentor?.name || 'Unassigned';
}

export function formatTime(timestamp, formatDateFn) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return formatDateFn ? formatDateFn(date) : date.toLocaleDateString();
}
