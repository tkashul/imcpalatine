/* ============================================================
   IMC Volunteer Planner — Shared Utilities
   ============================================================ */
(function () {
  'use strict';

  /* ---- HTML escaping ---- */
  var ESC_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (ch) {
      return ESC_MAP[ch];
    });
  }

  /* ---- Phone formatting ---- */
  function formatPhone(digits) {
    if (!digits) return '';
    var d = String(digits).replace(/\D/g, '');
    if (d.length === 10) {
      return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    }
    if (d.length === 11 && d[0] === '1') {
      return '(' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7);
    }
    return digits;
  }

  /* ---- Date formatting ---- */
  function formatDate(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateShort(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr + 'T00:00:00');
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var y = String(d.getFullYear()).slice(2);
    return m + '/' + day + '/' + y;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    var parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return h + ':' + m + ' ' + ampm;
  }

  /* ---- Toast notifications ---- */
  function getToastContainer() {
    var el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  function showToast(message, isError) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
    toast.innerHTML = '<span class="toast-icon">' + (isError ? '\u2716' : '\u2714') + '</span>' +
      '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    var delay = isError ? 5000 : 3000;
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, delay);
  }

  /* ---- Modal ---- */
  function showModal(title, contentHtml, actions) {
    closeModal();
    var actionsHtml = '';
    if (actions && actions.length) {
      actionsHtml = '<div class="modal-footer">';
      actions.forEach(function (a, i) {
        actionsHtml += '<button class="btn ' + escapeHtml(a.class || 'btn-secondary') +
          '" data-modal-action="' + i + '">' + escapeHtml(a.label) + '</button>';
      });
      actionsHtml += '</div>';
    }

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h2>' + escapeHtml(title) + '</h2>' +
          '<button class="modal-close" data-modal-action="close">\u00D7</button>' +
        '</div>' +
        '<div class="modal-body">' + contentHtml + '</div>' +
        actionsHtml +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('open');
    });

    overlay.addEventListener('click', function (e) {
      var actionIdx = e.target.getAttribute('data-modal-action');
      if (actionIdx === 'close' || e.target === overlay) {
        closeModal();
        return;
      }
      if (actionIdx !== null && actions && actions[parseInt(actionIdx)]) {
        var action = actions[parseInt(actionIdx)];
        if (typeof action.onClick === 'function') {
          action.onClick();
        }
      }
    });

    return overlay;
  }

  function closeModal() {
    var existing = document.getElementById('modal-overlay');
    if (existing) {
      existing.classList.remove('open');
      setTimeout(function () { existing.remove(); }, 200);
    }
  }

  function confirmDelete(itemName, onConfirm) {
    showModal(
      'Confirm Delete',
      '<p>Are you sure you want to delete <strong>' + escapeHtml(itemName) + '</strong>? This action cannot be undone.</p>',
      [
        { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
        { label: 'Delete', class: 'btn-danger', onClick: function () { closeModal(); onConfirm(); } }
      ]
    );
  }

  /* ---- Tab switching ---- */
  function switchTab(tabGroup, tabId) {
    var buttons = document.querySelectorAll('[data-tab-group="' + tabGroup + '"]');
    var contents = document.querySelectorAll('[data-tab-content-group="' + tabGroup + '"]');

    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    contents.forEach(function (pane) {
      pane.classList.toggle('active', pane.getAttribute('data-tab-id') === tabId);
    });
  }

  /* ---- Debounce ---- */
  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /* ---- Empty state ---- */
  function renderEmpty(message, icon) {
    return '<div class="empty-state">' +
      '<div class="empty-icon">' + (icon || '\u2605') + '</div>' +
      '<div class="empty-title">Nothing here yet</div>' +
      '<div class="empty-desc">' + escapeHtml(message) + '</div>' +
    '</div>';
  }

  /* ---- Loading spinner ---- */
  function renderLoading() {
    return '<div class="loading-spinner"><div class="spinner"></div><span>Loading...</span></div>';
  }

  /* ---- Status badge ---- */
  function statusBadge(status) {
    var map = {
      pending: 'badge-amber',
      invited: 'badge-blue',
      accepted: 'badge-green',
      confirmed: 'badge-green',
      declined: 'badge-red',
      upcoming: 'badge-blue',
      active: 'badge-green',
      past: 'badge-dim',
      volunteer: 'badge-blue',
      admin: 'badge-green'
    };
    var cls = map[status] || 'badge-dim';
    var label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    return '<span class="badge ' + cls + '">' + escapeHtml(label) + '</span>';
  }

  /* ---- Event status helper ---- */
  function getEventStatus(eventDate) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var d = new Date(eventDate + 'T00:00:00');
    if (d.getTime() === today.getTime()) return 'active';
    if (d > today) return 'upcoming';
    return 'past';
  }

  /* ---- Coverage percentage ---- */
  function coveragePercent(filled, total) {
    if (!total) return 0;
    return Math.round((filled / total) * 100);
  }

  function coverageColor(pct) {
    if (pct >= 80) return 'green';
    if (pct >= 50) return 'amber';
    return 'red';
  }

  /* ---- Auth guard ---- */
  function requireAuth() {
    if (!window.API || !window.API.getToken()) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    var user = window.API ? window.API.getUser() : null;
    if (!user || user.role !== 'admin') {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }

  /* ---- Sidebar toggle (mobile) ---- */
  function initSidebar() {
    var toggle = document.querySelector('.sidebar-toggle');
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.querySelector('.sidebar-overlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', function () {
        if (sidebar) sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  }

  /* ---- Exports ---- */
  window.Shared = {
    escapeHtml: escapeHtml,
    formatPhone: formatPhone,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    formatTime: formatTime,
    showToast: showToast,
    showModal: showModal,
    closeModal: closeModal,
    confirmDelete: confirmDelete,
    switchTab: switchTab,
    debounce: debounce,
    renderEmpty: renderEmpty,
    renderLoading: renderLoading,
    statusBadge: statusBadge,
    getEventStatus: getEventStatus,
    coveragePercent: coveragePercent,
    coverageColor: coverageColor,
    requireAuth: requireAuth,
    requireAdmin: requireAdmin,
    initSidebar: initSidebar
  };
})();
