// Utilities
const Utils = {
  formatCurrency(amount) {
    return `${CONFIG.CURRENCY} ${parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-KE', {
      timeZone: CONFIG.TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('en-KE', {
      timeZone: CONFIG.TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('en-KE', {
      timeZone: CONFIG.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  truncate(str, length = 50) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  },

  getPaymentMethodIcon(method) {
    const icons = {
      cash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="10" x2="3" y2="10"/></svg>',
      mpesa: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      payhero: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
    };
    return icons[method] || icons.cash;
  },

  getPaymentMethodName(method) {
    const names = {
      cash: 'Cash',
      mpesa: 'M-Pesa',
      payhero: 'PayHero'
    };
    return names[method] || method;
  },

  getStatusBadgeClass(status) {
    const classes = {
      active: 'badge-success',
      archived: 'badge-secondary',
      pending: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-danger',
      refunded: 'badge-info',
      paid: 'badge-success',
      failed: 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  validatePhone(phone) {
    const re = /^(?:254|0)[17]\d{8}$/;
    return re.test(phone.replace(/\s/g, ''));
  }
};

// Toast notifications
const Toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    toast.querySelector('.toast-close').onclick = () => toast.remove();
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, duration);
  }
};

// Modal
const Modal = {
  show(title, content, options = {}) {
    const container = document.getElementById('modal-container');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>
    `;

    modal.querySelector('.modal-close').onclick = () => this.close();
    modal.onclick = (e) => {
      if (e.target === modal) this.close();
    };

    container.appendChild(modal);
    return modal;
  },

  close() {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
  }
};

// Barcode Scanner
const BarcodeScanner = {
  buffer: '',
  timeout: null,

  init(callback) {
    document.addEventListener('keypress', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      clearTimeout(this.timeout);
      this.buffer += e.key;

      this.timeout = setTimeout(() => {
        if (this.buffer.length >= 3) {
          callback(this.buffer);
        }
        this.buffer = '';
      }, 100);
    });
  },

  clear() {
    this.buffer = '';
    clearTimeout(this.timeout);
  }
};
