/* ============================================================
   IMC Volunteer Planner — API Client
   ============================================================ */
(function () {
  'use strict';

  var API_BASE = localStorage.getItem('apiUrl') || '';

  function getToken() {
    return localStorage.getItem('session_token');
  }

  function setToken(token) {
    localStorage.setItem('session_token', token);
  }

  function clearSession() {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  async function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var opts = { method: method, headers: headers };
    if (body && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }

    var res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (err) {
      throw new Error('Network error: unable to reach the server.');
    }

    if (res.status === 401) {
      clearSession();
      window.location.href = '/frontend/index.html';
      throw new Error('Session expired. Please sign in again.');
    }

    if (res.status === 204) return null;

    var data;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      var msg = (data && data.error) || (data && data.message) || ('Request failed (' + res.status + ')');
      throw new Error(msg);
    }

    return data;
  }

  window.API = {
    getToken: getToken,
    setToken: setToken,
    clearSession: clearSession,
    getUser: getUser,
    setUser: setUser,

    get: function (path) { return request('GET', path); },
    post: function (path, body) { return request('POST', path, body); },
    put: function (path, body) { return request('PUT', path, body); },
    del: function (path) { return request('DELETE', path); },

    /* --- Auth --- */
    sendMagicLink: function (email) {
      return request('POST', '/api/auth/magic-link', { email: email });
    },
    verifyToken: function (token) {
      return request('POST', '/api/auth/verify', { token: token });
    },
    logout: function () {
      return request('POST', '/api/auth/logout').catch(function () {}).finally(function () {
        clearSession();
      });
    },

    /* --- Events --- */
    listEvents: function () { return request('GET', '/api/events'); },
    getEvent: function (id) { return request('GET', '/api/events/' + id); },
    createEvent: function (data) { return request('POST', '/api/events', data); },
    updateEvent: function (id, data) { return request('PUT', '/api/events/' + id, data); },
    deleteEvent: function (id) { return request('DELETE', '/api/events/' + id); },

    /* --- Shifts --- */
    listShifts: function (eventId) { return request('GET', '/api/events/' + eventId + '/shifts'); },
    createShift: function (eventId, data) { return request('POST', '/api/events/' + eventId + '/shifts', data); },
    updateShift: function (id, data) { return request('PUT', '/api/shifts/' + id, data); },
    deleteShift: function (id) { return request('DELETE', '/api/shifts/' + id); },

    /* --- Locations --- */
    listLocations: function (eventId) { return request('GET', '/api/events/' + eventId + '/locations'); },
    createLocation: function (eventId, data) { return request('POST', '/api/events/' + eventId + '/locations', data); },
    updateLocation: function (id, data) { return request('PUT', '/api/locations/' + id, data); },
    deleteLocation: function (id) { return request('DELETE', '/api/locations/' + id); },

    /* --- Volunteers --- */
    listVolunteers: function () { return request('GET', '/api/volunteers'); },
    getVolunteer: function (id) { return request('GET', '/api/volunteers/' + id); },
    createVolunteer: function (data) { return request('POST', '/api/volunteers', data); },
    updateVolunteer: function (id, data) { return request('PUT', '/api/volunteers/' + id, data); },
    deleteVolunteer: function (id) { return request('DELETE', '/api/volunteers/' + id); },

    /* --- Assignments --- */
    listAssignmentsByEvent: function (eventId) { return request('GET', '/api/events/' + eventId + '/assignments'); },
    createAssignment: function (data) { return request('POST', '/api/assignments', data); },
    updateAssignment: function (id, data) { return request('PUT', '/api/assignments/' + id, data); },
    deleteAssignment: function (id) { return request('DELETE', '/api/assignments/' + id); },
    sendInvites: function (assignmentIds) { return request('POST', '/api/assignments/send-invites', { assignment_ids: assignmentIds }); },

    /* --- My (volunteer self-service) --- */
    mySchedule: function () { return request('GET', '/api/my/schedule'); },
    myUpdateAssignment: function (id, data) { return request('PUT', '/api/my/assignments/' + id, data); },
    myAvailableShifts: function () { return request('GET', '/api/my/available-shifts'); },
    mySignUp: function (shiftId) { return request('POST', '/api/my/sign-up', { shift_id: shiftId }); },

    /* --- Dashboard --- */
    getDashboardStats: function () { return request('GET', '/api/admin/dashboard'); }
  };
})();
