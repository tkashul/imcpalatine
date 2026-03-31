/* ============================================================
   IMC Volunteer Planner — Auth Module
   ============================================================ */
(function () {
  'use strict';

  var Auth = {};

  /* Check if user is authenticated. If on verify page, handle callback. */
  Auth.init = function () {
    var path = window.location.pathname;

    /* Handle magic link verify callback */
    if (path.indexOf('/auth/verify') !== -1) {
      Auth.handleVerify();
      return;
    }

    /* Login page — if already authed, redirect to dashboard */
    if (path.indexOf('/index.html') !== -1 || path === '/' || path === '' || path === 'index.html') {
      if (API.getToken() && API.getUser()) {
        var user = API.getUser();
        if (user.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else {
          window.location.href = '/volunteer/portal.html';
        }
      }
      return;
    }
  };

  /* Password-based login — store session + user, redirect by role */
  Auth.loginWithPassword = function (email, password) {
    return API.login(email, password).then(function (data) {
      if (data && data.session_token) {
        API.setToken(data.session_token);
      }
      if (data && data.user) {
        API.setUser(data.user);
      }

      var user = data && data.user;
      if (user && user.role === 'admin') {
        window.location.href = '/admin/dashboard.html';
      } else {
        window.location.href = '/volunteer/portal.html';
      }
      return data;
    });
  };

  /* Send magic link to the given email */
  Auth.login = function (email) {
    return API.sendMagicLink(email);
  };

  /* Handle the /auth/verify callback — extract token, store, redirect */
  Auth.handleVerify = function () {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');

    if (!token) {
      var el = document.getElementById('verify-status');
      if (el) {
        el.innerHTML = '<p class="text-red">Invalid or missing token. Please request a new sign-in link.</p>' +
          '<a href="/index.html" class="btn btn-secondary mt-2">Back to Sign In</a>';
      }
      return;
    }

    API.verifyToken(token)
      .then(function (data) {
        if (data && data.session_token) {
          API.setToken(data.session_token);
        }
        if (data && data.user) {
          API.setUser(data.user);
        }

        var user = data && data.user;
        if (user && user.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else {
          window.location.href = '/volunteer/portal.html';
        }
      })
      .catch(function (err) {
        var el = document.getElementById('verify-status');
        if (el) {
          el.innerHTML = '<p class="text-red">' + Shared.escapeHtml(err.message) + '</p>' +
            '<a href="/index.html" class="btn btn-secondary mt-2">Back to Sign In</a>';
        }
      });
  };

  /* Logout — clear session, redirect to login */
  Auth.logout = function () {
    API.logout().finally(function () {
      window.location.href = '/index.html';
    });
  };

  /* Get stored user */
  Auth.getUser = function () {
    return API.getUser();
  };

  /* Check if current user is admin */
  Auth.isAdmin = function () {
    var user = API.getUser();
    return user && user.role === 'admin';
  };

  window.Auth = Auth;
})();
