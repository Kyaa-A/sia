/**
 * Shared JavaScript Utilities
 * Common functions used across all pages
 */

(function() {
  'use strict';

  // Create toast container
  function getToastContainer() {
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // SVG Icons
  var icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };

  /**
   * Show a toast notification
   */
  function showToast(options) {
    var type = options.type || 'info';
    var title = options.title || '';
    var message = options.message || '';
    var duration = typeof options.duration === 'number' ? options.duration : 4000;

    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;

    // Build HTML with inline styles to ensure visibility
    var html = '<div class="toast-icon">' + (icons[type] || icons.info) + '</div>';
    html += '<div class="toast-content" style="flex:1;min-width:0;">';
    if (title) {
      html += '<div class="toast-title" style="color:#111827 !important;font-weight:600;font-size:14px;margin-bottom:4px;display:block;visibility:visible;opacity:1;">' + title + '</div>';
    }
    if (message) {
      html += '<div class="toast-message" style="color:#6b7280 !important;font-size:13px;display:block;visibility:visible;opacity:1;">' + message + '</div>';
    }
    html += '</div>';
    html += '<button type="button" class="toast-close" aria-label="Close" style="background:none;border:none;padding:4px;cursor:pointer;color:#9ca3af;width:auto;margin-top:0;">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    html += '</button>';

    toast.innerHTML = html;
    container.appendChild(toast);

    // Animate in
    setTimeout(function() {
      toast.classList.add('show');
    }, 10);

    // Close handler
    function closeToast() {
      toast.classList.remove('show');
      toast.classList.add('hiding');
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }

    var closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.onclick = closeToast;
    }

    // Auto close
    if (duration > 0) {
      setTimeout(closeToast, duration);
    }

    return toast;
  }

  // Convenience functions
  function toastSuccess(title, message, duration) {
    return showToast({ type: 'success', title: title, message: message, duration: duration });
  }

  function toastError(title, message, duration) {
    return showToast({ type: 'error', title: title, message: message, duration: duration || 5000 });
  }

  function toastWarning(title, message, duration) {
    return showToast({ type: 'warning', title: title, message: message, duration: duration });
  }

  function toastInfo(title, message, duration) {
    return showToast({ type: 'info', title: title, message: message, duration: duration });
  }

  /**
   * Set button loading state
   */
  function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
      button.setAttribute('data-original-text', button.textContent);
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  /**
   * Format currency (PHP)
   */
  function formatCurrency(amount) {
    var num = Number(amount) || 0;
    return '₱' + num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Format date
   */
  function formatDate(date) {
    var d = typeof date === 'string' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '—';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /**
   * Format time to 12-hour
   */
  function formatTime(date) {
    var d = typeof date === 'string' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '—';
    var h = d.getHours();
    var m = String(d.getMinutes()).padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + m + ' ' + ampm;
  }

  /**
   * Custom confirm dialog
   */
  function confirmDialog(message, title) {
    return new Promise(function(resolve) {
      var backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10001';

      var modal = document.createElement('div');
      modal.style.cssText = 'background:#fff;padding:24px;border-radius:12px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)';

      var titleEl = document.createElement('h3');
      titleEl.style.cssText = 'margin:0 0 12px;color:#1f2937;font-size:18px';
      titleEl.textContent = title || 'Confirm';

      var msgEl = document.createElement('p');
      msgEl.style.cssText = 'margin:0 0 20px;color:#6b7280;font-size:14px';
      msgEl.textContent = message;

      var btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display:flex;gap:12px;justify-content:center';

      var cancelBtn = document.createElement('button');
      cancelBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-weight:500;cursor:pointer';
      cancelBtn.textContent = 'Cancel';

      var confirmBtn = document.createElement('button');
      confirmBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:none;background:#1e3a5f;color:#fff;font-weight:500;cursor:pointer';
      confirmBtn.textContent = 'Confirm';

      btnContainer.appendChild(cancelBtn);
      btnContainer.appendChild(confirmBtn);
      modal.appendChild(titleEl);
      modal.appendChild(msgEl);
      modal.appendChild(btnContainer);
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      function cleanup(result) {
        document.body.removeChild(backdrop);
        resolve(result);
      }

      cancelBtn.onclick = function() { cleanup(false); };
      confirmBtn.onclick = function() { cleanup(true); };
      backdrop.onclick = function(e) { if (e.target === backdrop) cleanup(false); };
    });
  }

  // Expose to global scope
  window.showToast = showToast;
  window.toastSuccess = toastSuccess;
  window.toastError = toastError;
  window.toastWarning = toastWarning;
  window.toastInfo = toastInfo;
  window.setButtonLoading = setButtonLoading;
  window.formatCurrency = formatCurrency;
  window.formatDate = formatDate;
  window.formatTime = formatTime;
  window.confirmDialog = confirmDialog;

})();
