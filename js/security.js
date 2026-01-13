export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') str = String(str);

  const getEscape = (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      case '/': return '&#x2F;';
      case '`': return '&#x60;';
      case '=': return '&#x3D;';
      default: return char;
    }
  };

  return str.replace(/[&<>"'`=/]/g, getEscape);
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
  if (input === null || input === undefined) return '';
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
  const errors = new Map();

  for (const [field, rule] of Object.entries(rules)) {
    if (!Object.hasOwn(data, field)) {
      if (rule.required) {
        errors.set(field, `${field} is required`);
      }
      continue;
    }
    const value = data[field]; // eslint-disable-line security/detect-object-injection

    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors.set(field, `${field} is required`);
      continue;
    }

    if (!value || (typeof value === 'string' && !value.trim())) continue;

    switch (rule.type) {
      case 'email':
        if (!isValidEmail(value)) {
          errors.set(field, 'Invalid email format');
        }
        break;
      case 'name':
        if (!isValidName(value, rule.maxLength || 100)) {
          errors.set(field, 'Invalid name format or too long');
        }
        break;
      case 'password': {
        const pwResult = validatePassword(value);
        if (!pwResult.valid) {
          errors.set(field, pwResult.message);
        }
        break;
      }
      case 'text':
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.set(field, `Maximum ${rule.maxLength} characters`);
        }
        break;
    }
  }

  return {
    valid: errors.size === 0,
    errors: Object.fromEntries(errors)
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
