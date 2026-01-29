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
  // Require complexity: uppercase, lowercase, number, and symbol
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
    return {
      valid: false,
      message: 'Password must include uppercase, lowercase, number, and symbol'
    };
  }
  return { valid: true, message: '' };
}

// File validation constants
const ALLOWED_RESUME_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const ALLOWED_CODE_TYPES = ['application/zip', 'application/x-zip-compressed'];
const ALLOWED_CODE_EXTENSIONS = ['.zip'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates a file for upload
 * @param {File} file - The file to validate
 * @param {string} type - Either 'resume' or 'code'
 * @returns {{ valid: boolean, message: string }}
 */
export function validateFile(file, type = 'resume') {
  if (!file) {
    return { valid: false, message: 'No file selected' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'File size must be less than 10MB' };
  }

  if (file.size === 0) {
    return { valid: false, message: 'File is empty' };
  }

  // Get file extension
  const fileName = file.name.toLowerCase();
  const ext = '.' + fileName.split('.').pop();

  // Validate based on type
  if (type === 'resume') {
    if (!ALLOWED_RESUME_EXTENSIONS.includes(ext)) {
      return { valid: false, message: 'Resume must be PDF, DOC, or DOCX' };
    }
    if (!ALLOWED_RESUME_TYPES.includes(file.type) && file.type !== '') {
      return { valid: false, message: 'Invalid resume file type' };
    }
  } else if (type === 'code') {
    if (!ALLOWED_CODE_EXTENSIONS.includes(ext)) {
      return { valid: false, message: 'Code submission must be a ZIP file' };
    }
    if (!ALLOWED_CODE_TYPES.includes(file.type) && file.type !== '') {
      return { valid: false, message: 'Invalid code submission file type' };
    }
  }

  // Check for suspicious double extensions
  const parts = fileName.split('.');
  if (parts.length > 2) {
    const suspiciousExts = ['.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.js', '.php'];
    for (const part of parts.slice(0, -1)) {
      if (suspiciousExts.some(sus => part.endsWith(sus.slice(1)))) {
        return { valid: false, message: 'Invalid file name' };
      }
    }
  }

  return { valid: true, message: '' };
}

/**
 * Generates a secure random filename
 * @param {string} originalName - Original file name
 * @returns {string} - Secure filename with UUID
 */
export function generateSecureFilename(originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

/**
 * Sanitizes a CSS color value to prevent CSS injection
 * @param {string} color - Color value to sanitize
 * @returns {string} - Safe color value or default
 */
export function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '#6b7280';

  // Allow hex colors
  if (/^#[0-9A-Fa-f]{3,8}$/.test(color)) {
    return color;
  }

  // Allow rgb/rgba with numbers only
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(color)) {
    return color;
  }

  // Allow named colors (basic set)
  const namedColors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'black', 'white', 'cyan', 'magenta'];
  if (namedColors.includes(color.toLowerCase())) {
    return color;
  }

  // Default to gray for invalid colors
  return '#6b7280';
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
    validateForm,
    validateFile,
    generateSecureFilename,
    sanitizeColor
  };
}
