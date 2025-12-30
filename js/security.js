export function escapeHtml(str) {
  if (str == null) return '';
  if (typeof str !== 'string') str = String(str);

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return str.replace(/[&<>"'`=/]/g, char => htmlEscapes[char]);
}

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function isValidName(name, maxLength = 100) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return false;
  const nameRegex = /^[\p{L}\s\-']+$/u;
  return nameRegex.test(trimmed);
}

export function sanitizeInput(input, maxLength = 500) {
  if (input == null) return '';
  if (typeof input !== 'string') input = String(input);
  return input.trim().slice(0, maxLength);
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long' };
  }
  return { valid: true, message: '' };
}

export function validateForm(data, rules) {
  const errors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (!value || (typeof value === 'string' && !value.trim())) continue;

    switch (rule.type) {
      case 'email':
        if (!isValidEmail(value)) {
          errors[field] = 'Invalid email format';
        }
        break;
      case 'name':
        if (!isValidName(value, rule.maxLength || 100)) {
          errors[field] = 'Invalid name format or too long';
        }
        break;
      case 'password':
        const pwResult = validatePassword(value);
        if (!pwResult.valid) {
          errors[field] = pwResult.message;
        }
        break;
      case 'text':
        if (rule.maxLength && value.length > rule.maxLength) {
          errors[field] = `Maximum ${rule.maxLength} characters`;
        }
        break;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

if (typeof window !== 'undefined') {
  window.Security = {
    escapeHtml,
    isValidEmail,
    isValidName,
    sanitizeInput,
    validatePassword,
    validateForm
  };
}
