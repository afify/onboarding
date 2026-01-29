import Alpine from '@alpinejs/csp';
window.Alpine = Alpine;

import './hacker-console.js';

import { signIn, getSession, getMentorProfile } from './supabase-client.js';

(async () => {
  const session = await getSession();
  if (session) {
    window.location.href = '/dashboard.html';
  }
})();

// Register Alpine.data component for CSP compatibility
Alpine.data('loginForm', () => ({
  email: '',
  password: '',
  loading: false,
  error: null,

  get buttonText() {
    return this.loading ? 'Signing in...' : 'Sign In';
  },

  async handleSubmit() {
    this.error = null;
    this.loading = true;

    try {
      const { data, error } = await signIn(this.email, this.password);

      if (error) {
        this.error = 'Invalid credentials. Please try again.';
        this.loading = false;
        return;
      }

      if (data?.user) {
        const { data: mentor, error: mentorError } = await getMentorProfile(data.user.id);

        if (mentorError || !mentor) {
          this.error = 'Access denied. You are not registered as a mentor.';
          this.loading = false;
          return;
        }

        window.location.href = '/dashboard.html';
      }
    } catch (err) {
      // Sanitize error logging - only log message, not full stack/object
      if (import.meta.env?.DEV) {
        console.error('Login error:', err?.message || 'Unknown error');
      }
      this.error = 'An unexpected error occurred. Please try again.';
      this.loading = false;
    } finally {
      // Security: Clear password from memory after login attempt
      this.password = '';
    }
  }
}));

Alpine.start();
