// Login page entry
import Alpine from 'alpinejs';
window.Alpine = Alpine;

// Hacker console (must be first to intercept fetch)
import './hacker-console.js';

import { signIn, getSession, getMentorProfile } from './supabase-client.js';

// Check if already logged in
(async () => {
  const session = await getSession();
  if (session) {
    window.location.href = '/dashboard.html';
  }
})();

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const card = document.querySelector('.login-card');
    const alpineData = Alpine.$data(card);

    alpineData.error = null;
    alpineData.loading = true;

    try {
      const { data, error } = await signIn(alpineData.email, alpineData.password);

      if (error) {
        alpineData.error = 'Invalid credentials. Please try again.';
        alpineData.loading = false;
        return;
      }

      if (data?.user) {
        const { data: mentor, error: mentorError } = await getMentorProfile(data.user.id);

        if (mentorError || !mentor) {
          alpineData.error = 'Access denied. You are not registered as a mentor.';
          alpineData.loading = false;
          return;
        }

        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      alpineData.error = 'An unexpected error occurred. Please try again.';
      alpineData.loading = false;
    }
  });
});

// Start Alpine
Alpine.start();
