/* ============================================================
   IMC Volunteer Planner — Admin Page Logic
   ============================================================ */
(function () {
  'use strict';

  var Admin = {};
  var _e = Shared.escapeHtml;

  function buildTimeOptions(selectedVal) {
    var times = [];
    for (var h = 6; h <= 22; h++) {
      times.push((h < 10 ? '0' : '') + h + ':00');
      times.push((h < 10 ? '0' : '') + h + ':30');
    }
    var html = '<option value="">-- select --</option>';
    times.forEach(function (t) {
      var label = Shared.formatTime(t);
      html += '<option value="' + t + '"' + (t === selectedVal ? ' selected' : '') + '>' + label + '</option>';
    });
    return html;
  }

  /* ==========================================================
     Dashboard
     ========================================================== */
  Admin.initDashboard = function () {
    if (!Shared.requireAuth() || !Shared.requireAdmin()) return;
    Shared.initSidebar();

    var main = document.getElementById('dashboard-content');
    main.innerHTML = Shared.renderLoading();

    Promise.all([
      API.listEvents().catch(function () { return []; }),
      API.listVolunteers().catch(function () { return []; })
    ]).then(function (results) {
      var events = results[0] || [];
      var volunteers = results[1] || [];

      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var upcoming = events.filter(function (e) {
        return new Date(e.date + 'T00:00:00') >= today;
      }).sort(function (a, b) { return a.date.localeCompare(b.date); });

      var totalShifts = 0;
      var totalFilled = 0;
      events.forEach(function (e) {
        totalShifts += (e.total_slots || 0);
        totalFilled += (e.filled_slots || 0);
      });

      var pendingInvites = 0;
      events.forEach(function (e) {
        pendingInvites += (e.pending_count || 0);
      });

      var html = '';

      /* Stats row */
      html += '<div class="stats-row">';
      html += '<div class="stat-card accent-blue"><div class="stat-label">Total Events</div>' +
        '<div class="stat-value">' + events.length + '</div></div>';
      html += '<div class="stat-card accent-gold"><div class="stat-label">Total Volunteers</div>' +
        '<div class="stat-value">' + volunteers.length + '</div></div>';
      html += '<div class="stat-card accent-green"><div class="stat-label">Upcoming Events</div>' +
        '<div class="stat-value">' + upcoming.length + '</div></div>';
      html += '<div class="stat-card accent-amber"><div class="stat-label">Pending Invites</div>' +
        '<div class="stat-value">' + pendingInvites + '</div></div>';
      html += '</div>';

      /* Quick Actions */
      html += '<div class="flex gap-2 mb-3">' +
        '<a href="events.html" class="btn btn-primary">+ Create Event</a>' +
        '<a href="volunteers.html" class="btn btn-secondary">+ Add Volunteer</a>' +
      '</div>';

      /* Upcoming Events */
      html += '<div class="section-title">Upcoming Events</div>';
      if (upcoming.length === 0) {
        html += Shared.renderEmpty('No upcoming events. Create one to get started!');
      } else {
        upcoming.slice(0, 5).forEach(function (ev) {
          var filled = ev.filled_slots || 0;
          var total = ev.total_slots || 0;
          var pct = Shared.coveragePercent(filled, total);
          var color = Shared.coverageColor(pct);
          html += '<div class="card clickable" onclick="window.location.href=\'event-detail.html?id=' + _e(ev.eventId) + '\'">' +
            '<div class="card-header"><h3>' + _e(ev.name) + '</h3>' + Shared.statusBadge(Shared.getEventStatus(ev.date)) + '</div>' +
            '<div class="card-meta">' +
              '<span>' + _e(Shared.formatDate(ev.date)) + '</span>' +
              '<span>' + (ev.shift_count || 0) + ' shifts</span>' +
              '<span>' + filled + '/' + total + ' volunteers (' + pct + '%)</span>' +
            '</div>' +
            (ev.description ? '<p class="text-dim" style="font-size:0.88rem">' + _e(ev.description) + '</p>' : '') +
            '<div class="progress-bar"><div class="progress-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
          '</div>';
        });
      }

      /* Recent volunteers */
      html += '<div class="section-title mt-3">Recent Volunteers</div>';
      if (volunteers.length === 0) {
        html += Shared.renderEmpty('No volunteers yet. Add your first volunteer to the roster.');
      } else {
        var recent = volunteers.slice(0, 5);
        html += '<div class="table-wrapper"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>';
        recent.forEach(function (v) {
          html += '<tr><td>' + _e(v.name) + '</td><td>' + _e(v.email || '') + '</td><td>' + _e(Shared.formatPhone(v.phone)) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      main.innerHTML = html;
    }).catch(function (err) {
      main.innerHTML = '<div class="empty-state"><div class="empty-icon">\u26A0</div>' +
        '<div class="empty-title">Error loading dashboard</div>' +
        '<div class="empty-desc">' + _e(err.message) + '</div></div>';
    });
  };

  /* ==========================================================
     Events List
     ========================================================== */
  Admin.initEvents = function () {
    if (!Shared.requireAuth() || !Shared.requireAdmin()) return;
    Shared.initSidebar();

    var main = document.getElementById('events-content');
    main.innerHTML = Shared.renderLoading();

    Admin.loadEvents();

    document.getElementById('btn-create-event').addEventListener('click', function () {
      Admin.showEventForm(null);
    });
  };

  Admin.loadEvents = function () {
    var main = document.getElementById('events-content');
    API.listEvents().then(function (events) {
      events = events || [];
      if (events.length === 0) {
        main.innerHTML = Shared.renderEmpty('No events yet. Click "Create Event" to get started.');
        return;
      }

      events.sort(function (a, b) { return b.date.localeCompare(a.date); });

      var html = '';
      events.forEach(function (ev) {
        var status = Shared.getEventStatus(ev.date);
        var filled = ev.filled_slots || 0;
        var total = ev.total_slots || 0;
        var pct = Shared.coveragePercent(filled, total);
        var color = Shared.coverageColor(pct);

        html += '<div class="card">' +
          '<div class="card-header">' +
            '<div>' +
              '<h3 style="cursor:pointer" onclick="window.location.href=\'event-detail.html?id=' + _e(ev.eventId) + '\'">' + _e(ev.name) + '</h3>' +
              '<div class="card-meta mt-1">' +
                '<span>' + _e(Shared.formatDate(ev.date)) + '</span>' +
                '<span>' + (ev.shift_count || 0) + ' shifts</span>' +
                '<span>' + filled + '/' + total + ' volunteers</span>' +
              '</div>' +
            '</div>' +
            '<div class="flex gap-1 items-center">' +
              Shared.statusBadge(status) +
            '</div>' +
          '</div>' +
          (ev.description ? '<p class="text-dim" style="font-size:0.88rem;margin-bottom:8px">' + _e(ev.description) + '</p>' : '') +
          '<div class="progress-bar"><div class="progress-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
          '<div class="card-actions">' +
            '<a href="event-detail.html?id=' + _e(ev.eventId) + '" class="btn btn-sm btn-primary">Manage</a>' +
            '<button class="btn btn-sm btn-secondary" onclick="Admin.showEventForm(' + "'" + _e(ev.eventId) + "'" + ')">Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="Admin.deleteEvent(' + "'" + _e(ev.eventId) + "','" + _e(ev.name) + "'" + ')">Delete</button>' +
          '</div>' +
        '</div>';
      });

      main.innerHTML = html;
    }).catch(function (err) {
      main.innerHTML = '<div class="empty-state"><div class="empty-icon">\u26A0</div>' +
        '<div class="empty-title">Error loading events</div>' +
        '<div class="empty-desc">' + _e(err.message) + '</div></div>';
    });
  };

  Admin.showEventForm = function (eventId) {
    var title = eventId ? 'Edit Event' : 'Create Event';
    var loadForm = eventId ? API.getEvent(eventId) : Promise.resolve(null);

    loadForm.then(function (ev) {
      ev = ev || {};
      var content =
        '<div class="form-group">' +
          '<label>Event Name <span class="required">*</span></label>' +
          '<input type="text" class="form-input" id="event-name" value="' + _e(ev.name || '') + '" placeholder="e.g., Easter Sunday Parking">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Date <span class="required">*</span></label>' +
          '<input type="date" class="form-input" id="event-date" value="' + _e(ev.date || '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Description</label>' +
          '<textarea class="form-textarea" id="event-desc" placeholder="Brief description of the event...">' + _e(ev.description || '') + '</textarea>' +
        '</div>';

      Shared.showModal(title, content, [
        { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
        { label: eventId ? 'Save Changes' : 'Create Event', class: 'btn-primary', onClick: function () {
          var name = document.getElementById('event-name').value.trim();
          var date = document.getElementById('event-date').value;
          var desc = document.getElementById('event-desc').value.trim();

          if (!name || !date) {
            Shared.showToast('Name and date are required.', true);
            return;
          }

          var data = { name: name, date: date, description: desc };
          var promise = eventId ? API.updateEvent(eventId, data) : API.createEvent(data);

          promise.then(function () {
            Shared.closeModal();
            Shared.showToast(eventId ? 'Event updated.' : 'Event created.');
            Admin.loadEvents();
          }).catch(function (err) {
            Shared.showToast(err.message, true);
          });
        }}
      ]);
    });
  };

  Admin.deleteEvent = function (id, name) {
    Shared.confirmDelete(name, function () {
      API.deleteEvent(id).then(function () {
        Shared.showToast('Event deleted.');
        Admin.loadEvents();
      }).catch(function (err) {
        Shared.showToast(err.message, true);
      });
    });
  };

  /* ==========================================================
     Event Detail
     ========================================================== */
  Admin._eventData = null;
  Admin._shiftsData = [];
  Admin._locationsData = [];
  Admin._assignmentsData = [];
  Admin._volunteersData = [];

  Admin.initEventDetail = function () {
    if (!Shared.requireAuth() || !Shared.requireAdmin()) return;
    Shared.initSidebar();

    var eventId = new URLSearchParams(window.location.search).get('id');
    if (!eventId) {
      document.getElementById('event-detail-content').innerHTML =
        '<div class="empty-state"><div class="empty-icon">\u26A0</div><div class="empty-title">No event specified</div></div>';
      return;
    }

    Admin._eventId = eventId;

    /* Tab switching */
    document.querySelectorAll('[data-tab-group="event-tabs"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Shared.switchTab('event-tabs', btn.getAttribute('data-tab'));
      });
    });

    /* Button handlers */
    var sendAllBtn = document.getElementById('btn-send-all-invites');
    if (sendAllBtn) {
      sendAllBtn.addEventListener('click', function () {
        Admin.sendAllInvites();
      });
    }
    var printBtn = document.getElementById('btn-print-day-sheet');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.open('../print/day-sheet.html?id=' + eventId, '_blank');
      });
    }

    Admin.loadEventDetail(eventId);
  };

  Admin.loadEventDetail = function (eventId) {
    var content = document.getElementById('event-detail-content');
    content.innerHTML = Shared.renderLoading();

    Promise.all([
      API.getEvent(eventId),
      API.listVolunteers().catch(function () { return []; })
    ]).then(function (results) {
      var eventResp = results[0];
      // getEvent returns { ...event, shifts: [...with assignments], locations: [...] }
      var shiftsWithAssignments = eventResp.shifts || [];
      Admin._eventData = eventResp;
      Admin._shiftsData = shiftsWithAssignments.map(function (s) {
        var copy = {};
        for (var k in s) { if (k !== 'assignments') copy[k] = s[k]; }
        return copy;
      });
      Admin._locationsData = eventResp.locations || [];
      // Flatten assignments from all shifts
      var allAssignments = [];
      shiftsWithAssignments.forEach(function (shift) {
        (shift.assignments || []).forEach(function (a) {
          allAssignments.push(Object.assign({}, a, {
            shiftLabel: shift.label,
            shiftStart: shift.timeStart,
            shiftEnd: shift.timeEnd
          }));
        });
      });
      Admin._assignmentsData = allAssignments;
      Admin._volunteersData = results[1] || [];

      Admin.renderEventHeader();
      Admin.renderShifts();
      Admin.renderLocations();
      Admin.renderCoverage();
      content.innerHTML = '';
    }).catch(function (err) {
      content.innerHTML = '<div class="empty-state"><div class="empty-icon">\u26A0</div>' +
        '<div class="empty-title">Error loading event</div>' +
        '<div class="empty-desc">' + _e(err.message) + '</div></div>';
    });
  };

  Admin.renderEventHeader = function () {
    var ev = Admin._eventData;
    if (!ev) return;
    var headerEl = document.getElementById('event-header');
    headerEl.innerHTML =
      '<div class="breadcrumb"><a href="events.html">\u2190 Events</a><span class="sep">/</span><span>' + _e(ev.name) + '</span></div>' +
      '<div class="page-header">' +
        '<div><h1>' + _e(ev.name) + '</h1>' +
        '<p class="text-dim">' + _e(Shared.formatDate(ev.date)) + (ev.description ? ' \u2014 ' + _e(ev.description) : '') + '</p></div>' +
        '<div class="page-actions">' +
          '<button class="btn btn-secondary" id="btn-edit-event">Edit Event</button>' +
        '</div>' +
      '</div>';

    document.getElementById('btn-edit-event').addEventListener('click', function () {
      Admin.showEventForm(ev.eventId);
    });
  };

  Admin.renderShifts = function () {
    var container = document.getElementById('shifts-content');
    var shifts = Admin._shiftsData;
    var assignments = Admin._assignmentsData;
    var locations = Admin._locationsData;

    if (shifts.length === 0) {
      container.innerHTML = Shared.renderEmpty('No shifts created yet. Add a shift to start assigning volunteers.') +
        '<div class="text-center mt-2"><button class="btn btn-primary" onclick="Admin.addShift()">+ Add Shift</button></div>';
      return;
    }

    shifts.sort(function (a, b) { return (a.timeStart || '').localeCompare(b.timeStart || ''); });

    var html = '';
    shifts.forEach(function (shift) {
      var shiftAssignments = assignments.filter(function (a) { return a.shiftId === shift.shiftId; });
      var filled = shiftAssignments.length;
      var max = shift.maxVolunteers || 0;

      html += '<div class="shift-block">';
      html += '<div class="shift-header">' +
        '<div class="shift-time">' + _e(Shared.formatTime(shift.timeStart)) + ' \u2013 ' + _e(Shared.formatTime(shift.timeEnd)) + '</div>' +
        '<div class="shift-meta">' +
          '<span>' + filled + '/' + max + ' volunteers</span>' +
          '<button class="btn btn-xs btn-secondary" onclick="Admin.editShift(\'' + _e(shift.shiftId) + '\')">Edit</button>' +
          '<button class="btn btn-xs btn-danger" onclick="Admin.deleteShift(\'' + _e(shift.shiftId) + '\')">Delete</button>' +
        '</div>' +
      '</div>';

      html += '<div class="shift-body">';
      if (shiftAssignments.length === 0) {
        html += '<p class="text-dim" style="padding:8px 0;font-size:0.88rem">No volunteers assigned to this shift yet.</p>';
      } else {
        shiftAssignments.forEach(function (a) {
          var vol = Admin._volunteersData.find(function (v) { return v.userId === a.userId; });
          var volName = vol ? vol.name : (a.volunteerName || 'Unknown');
          var loc = locations.find(function (l) { return l.locationId === a.locationId; });
          var locName = loc ? loc.name : '';

          html += '<div class="assignment-row">' +
            '<div class="vol-name">' + _e(volName) + '</div>' +
            '<div class="vol-location">' +
              '<select class="form-select" style="max-width:180px;padding:6px 10px;font-size:0.82rem" onchange="Admin.changeAssignmentLocation(\'' + _e(a.assignmentId) + '\', this.value)">' +
                '<option value="">No location</option>';
          locations.forEach(function (l) {
            html += '<option value="' + _e(l.locationId) + '"' + (a.locationId === l.locationId ? ' selected' : '') + '>' + _e(l.name) + '</option>';
          });
          html += '</select>' +
            '</div>' +
            '<div class="vol-status">' + Shared.statusBadge(a.status || 'pending') + '</div>' +
            '<div class="vol-actions">' +
              '<button class="btn btn-xs btn-danger" onclick="Admin.removeAssignment(\'' + _e(a.assignmentId) + '\', \'' + _e(volName) + '\')">Remove</button>' +
            '</div>' +
          '</div>';
        });
      }
      html += '</div>';

      /* Add volunteer to shift */
      html += '<div class="shift-add-row">' +
        '<div class="dropdown-wrapper" id="dd-shift-' + _e(shift.shiftId) + '">' +
          '<button class="btn btn-sm btn-secondary" onclick="Admin.toggleVolunteerDropdown(\'' + _e(shift.shiftId) + '\')">+ Add Volunteer</button>' +
          '<div class="dropdown-menu" id="dd-menu-' + _e(shift.shiftId) + '">' +
            '<div class="dropdown-search"><input type="text" placeholder="Search volunteers..." oninput="Admin.filterVolunteerDropdown(\'' + _e(shift.shiftId) + '\', this.value)"></div>' +
            '<div id="dd-list-' + _e(shift.shiftId) + '">' + Admin.renderVolunteerDropdownItems(shift.shiftId, '') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

      html += '</div>';
    });

    html += '<div class="mt-2"><button class="btn btn-secondary" onclick="Admin.addShift()">+ Add Shift</button></div>';

    container.innerHTML = html;
  };

  Admin.renderVolunteerDropdownItems = function (shiftId, query) {
    var assignments = Admin._assignmentsData;
    var assignedIds = assignments.filter(function (a) { return a.shiftId === shiftId; }).map(function (a) { return a.userId; });

    var available = Admin._volunteersData.filter(function (v) {
      if (assignedIds.indexOf(v.userId) !== -1) return false;
      if (query) {
        return v.name.toLowerCase().indexOf(query.toLowerCase()) !== -1;
      }
      return true;
    });

    if (available.length === 0) {
      return '<div class="dropdown-item" style="color:var(--text-muted);cursor:default">No volunteers available</div>';
    }

    var html = '';
    available.forEach(function (v) {
      html += '<div class="dropdown-item" onclick="Admin.addVolunteerToShift(\'' + _e(shiftId) + '\', \'' + _e(v.userId) + '\')">' +
        _e(v.name) +
        '<span class="item-sub">' + _e(v.email || '') + '</span>' +
      '</div>';
    });
    return html;
  };

  Admin.toggleVolunteerDropdown = function (shiftId) {
    var menu = document.getElementById('dd-menu-' + shiftId);
    if (!menu) return;
    var isOpen = menu.classList.contains('open');

    /* Close all other dropdowns */
    document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
      m.classList.remove('open');
    });

    if (!isOpen) {
      menu.classList.add('open');
      var input = menu.querySelector('input');
      if (input) { input.value = ''; input.focus(); }
      document.getElementById('dd-list-' + shiftId).innerHTML = Admin.renderVolunteerDropdownItems(shiftId, '');
    }
  };

  Admin.filterVolunteerDropdown = function (shiftId, query) {
    var list = document.getElementById('dd-list-' + shiftId);
    if (list) {
      list.innerHTML = Admin.renderVolunteerDropdownItems(shiftId, query);
    }
  };

  Admin.addVolunteerToShift = function (shiftId, volunteerId) {
    /* Close dropdown */
    document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
      m.classList.remove('open');
    });

    API.createAssignment({
      shiftId: shiftId,
      userId: volunteerId,
      eventId: Admin._eventId,
      status: 'pending'
    }).then(function () {
      Shared.showToast('Volunteer assigned.');
      Admin.loadEventDetail(Admin._eventId);
    }).catch(function (err) {
      Shared.showToast(err.message, true);
    });
  };

  Admin.removeAssignment = function (assignmentId, name) {
    Shared.confirmDelete('assignment for ' + name, function () {
      API.deleteAssignment(assignmentId).then(function () {
        Shared.showToast('Assignment removed.');
        Admin.loadEventDetail(Admin._eventId);
      }).catch(function (err) {
        Shared.showToast(err.message, true);
      });
    });
  };

  Admin.changeAssignmentLocation = function (assignmentId, locationId) {
    API.updateAssignment(assignmentId, { locationId: locationId || null }).then(function () {
      Shared.showToast('Location updated.');
    }).catch(function (err) {
      Shared.showToast(err.message, true);
    });
  };

  Admin.sendAllInvites = function () {
    var pending = Admin._assignmentsData.filter(function (a) {
      return a.status === 'pending';
    });

    if (pending.length === 0) {
      Shared.showToast('No pending assignments to invite.', true);
      return;
    }

    var ids = pending.map(function (a) { return a.assignmentId; });

    Shared.showModal('Send Invites', '<p>Send email invitations to <strong>' + ids.length + '</strong> pending volunteer(s)?</p>', [
      { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
      { label: 'Send Invites', class: 'btn-primary', onClick: function () {
        Shared.closeModal();
        API.sendInvites(ids).then(function () {
          Shared.showToast('Invitations sent!');
          Admin.loadEventDetail(Admin._eventId);
        }).catch(function (err) {
          Shared.showToast(err.message, true);
        });
      }}
    ]);
  };

  Admin.addShift = function () {
    var content =
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Start Time <span class="required">*</span></label>' +
          '<select class="form-input" id="shift-start">' + buildTimeOptions('') + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>End Time <span class="required">*</span></label>' +
          '<select class="form-input" id="shift-end">' + buildTimeOptions('') + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Max Volunteers</label>' +
        '<input type="number" class="form-input" id="shift-max" min="1" value="10" placeholder="10">' +
      '</div>';

    Shared.showModal('Add Shift', content, [
      { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
      { label: 'Add Shift', class: 'btn-primary', onClick: function () {
        var start = document.getElementById('shift-start').value;
        var end = document.getElementById('shift-end').value;
        var max = parseInt(document.getElementById('shift-max').value) || 10;

        if (!start || !end) {
          Shared.showToast('Start and end times are required.', true);
          return;
        }

        API.createShift(Admin._eventId, {
          timeStart: start,
          timeEnd: end,
          maxVolunteers: max
        }).then(function () {
          Shared.closeModal();
          Shared.showToast('Shift added.');
          Admin.loadEventDetail(Admin._eventId);
        }).catch(function (err) {
          Shared.showToast(err.message, true);
        });
      }}
    ]);
  };

  Admin.editShift = function (shiftId) {
    var shift = Admin._shiftsData.find(function (s) { return s.shiftId === shiftId; });
    if (!shift) return;

    var content =
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label>Start Time <span class="required">*</span></label>' +
          '<select class="form-input" id="shift-start">' + buildTimeOptions(shift.timeStart || '') + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>End Time <span class="required">*</span></label>' +
          '<select class="form-input" id="shift-end">' + buildTimeOptions(shift.timeEnd || '') + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Max Volunteers</label>' +
        '<input type="number" class="form-input" id="shift-max" min="1" value="' + (shift.maxVolunteers || 10) + '">' +
      '</div>';

    Shared.showModal('Edit Shift', content, [
      { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
      { label: 'Save Changes', class: 'btn-primary', onClick: function () {
        var start = document.getElementById('shift-start').value;
        var end = document.getElementById('shift-end').value;
        var max = parseInt(document.getElementById('shift-max').value) || 10;

        if (!start || !end) {
          Shared.showToast('Start and end times are required.', true);
          return;
        }

        API.updateShift(shiftId, {
          timeStart: start,
          timeEnd: end,
          maxVolunteers: max
        }).then(function () {
          Shared.closeModal();
          Shared.showToast('Shift updated.');
          Admin.loadEventDetail(Admin._eventId);
        }).catch(function (err) {
          Shared.showToast(err.message, true);
        });
      }}
    ]);
  };

  Admin.deleteShift = function (shiftId) {
    Shared.confirmDelete('this shift', function () {
      API.deleteShift(shiftId).then(function () {
        Shared.showToast('Shift deleted.');
        Admin.loadEventDetail(Admin._eventId);
      }).catch(function (err) {
        Shared.showToast(err.message, true);
      });
    });
  };

  /* --- Locations tab --- */
  Admin.renderLocations = function () {
    var container = document.getElementById('locations-content');
    var locations = Admin._locationsData;
    var assignments = Admin._assignmentsData;

    var html = '<div class="mb-2"><button class="btn btn-secondary" onclick="Admin.addLocation()">+ Add Location</button></div>';

    if (locations.length === 0) {
      html += Shared.renderEmpty('No locations defined. Add parking zones or areas for this event.');
      container.innerHTML = html;
      return;
    }

    html += '<div class="table-wrapper"><table><thead><tr><th>Location</th><th>Description</th><th>Assigned Volunteers</th><th>Actions</th></tr></thead><tbody>';
    locations.forEach(function (loc) {
      var locAssignments = assignments.filter(function (a) { return a.locationId === loc.locationId; });
      var volNames = locAssignments.map(function (a) {
        var v = Admin._volunteersData.find(function (vol) { return vol.userId === a.userId; });
        return v ? v.name : (a.volunteerName || 'Unknown');
      });

      html += '<tr>' +
        '<td><strong>' + _e(loc.name) + '</strong></td>' +
        '<td class="text-dim">' + _e(loc.description || '-') + '</td>' +
        '<td>' + (volNames.length ? volNames.map(function (n) { return _e(n); }).join(', ') : '<span class="text-muted">None</span>') + '</td>' +
        '<td>' +
          '<button class="btn btn-xs btn-secondary" onclick="Admin.editLocation(\'' + _e(loc.locationId) + '\')">Edit</button> ' +
          '<button class="btn btn-xs btn-danger" onclick="Admin.deleteLocation(\'' + _e(loc.locationId) + '\', \'' + _e(loc.name) + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';

    container.innerHTML = html;
  };

  Admin.addLocation = function () {
    var content =
      '<div class="form-group">' +
        '<label>Location Name <span class="required">*</span></label>' +
        '<input type="text" class="form-input" id="loc-name" placeholder="e.g., North Lot, Main Entrance">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Description</label>' +
        '<textarea class="form-textarea" id="loc-desc" placeholder="Notes about this location..."></textarea>' +
      '</div>';

    Shared.showModal('Add Location', content, [
      { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
      { label: 'Add Location', class: 'btn-primary', onClick: function () {
        var name = document.getElementById('loc-name').value.trim();
        var desc = document.getElementById('loc-desc').value.trim();

        if (!name) {
          Shared.showToast('Location name is required.', true);
          return;
        }

        API.createLocation(Admin._eventId, { name: name, description: desc }).then(function () {
          Shared.closeModal();
          Shared.showToast('Location added.');
          Admin.loadEventDetail(Admin._eventId);
        }).catch(function (err) {
          Shared.showToast(err.message, true);
        });
      }}
    ]);
  };

  Admin.editLocation = function (locId) {
    var loc = Admin._locationsData.find(function (l) { return l.locationId === locId; });
    if (!loc) return;

    var content =
      '<div class="form-group">' +
        '<label>Location Name <span class="required">*</span></label>' +
        '<input type="text" class="form-input" id="loc-name" value="' + _e(loc.name) + '">' +
      '</div>' +
      '<div class="form-group">' +
        '<label>Description</label>' +
        '<textarea class="form-textarea" id="loc-desc">' + _e(loc.description || '') + '</textarea>' +
      '</div>';

    Shared.showModal('Edit Location', content, [
      { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
      { label: 'Save Changes', class: 'btn-primary', onClick: function () {
        var name = document.getElementById('loc-name').value.trim();
        var desc = document.getElementById('loc-desc').value.trim();

        if (!name) {
          Shared.showToast('Location name is required.', true);
          return;
        }

        API.updateLocation(locId, { name: name, description: desc }).then(function () {
          Shared.closeModal();
          Shared.showToast('Location updated.');
          Admin.loadEventDetail(Admin._eventId);
        }).catch(function (err) {
          Shared.showToast(err.message, true);
        });
      }}
    ]);
  };

  Admin.deleteLocation = function (locId, name) {
    Shared.confirmDelete(name, function () {
      API.deleteLocation(locId).then(function () {
        Shared.showToast('Location deleted.');
        Admin.loadEventDetail(Admin._eventId);
      }).catch(function (err) {
        Shared.showToast(err.message, true);
      });
    });
  };

  /* --- Coverage tab --- */
  Admin.renderCoverage = function () {
    var container = document.getElementById('coverage-content');
    var shifts = Admin._shiftsData;
    var locations = Admin._locationsData;
    var assignments = Admin._assignmentsData;

    if (shifts.length === 0 || locations.length === 0) {
      container.innerHTML = Shared.renderEmpty('Add shifts and locations to see the coverage grid.');
      return;
    }

    shifts.sort(function (a, b) { return (a.timeStart || '').localeCompare(b.timeStart || ''); });

    var totalSlots = 0;
    var filledSlots = 0;
    var acceptedSlots = 0;

    var html = '<div class="coverage-grid"><div class="table-wrapper"><table><thead><tr><th>Shift</th>';
    locations.forEach(function (loc) {
      html += '<th>' + _e(loc.name) + '</th>';
    });
    html += '<th>Unassigned</th></tr></thead><tbody>';

    shifts.forEach(function (shift) {
      html += '<tr>';
      html += '<td>' + _e(Shared.formatTime(shift.timeStart)) + ' \u2013 ' + _e(Shared.formatTime(shift.timeEnd)) + '</td>';

      var shiftAssignments = assignments.filter(function (a) { return a.shiftId === shift.shiftId; });

      locations.forEach(function (loc) {
        var locAssignments = shiftAssignments.filter(function (a) { return a.locationId === loc.locationId; });
        totalSlots++;

        if (locAssignments.length === 0) {
          html += '<td><span class="coverage-cell gap">Empty</span></td>';
        } else {
          var names = [];
          locAssignments.forEach(function (a) {
            var v = Admin._volunteersData.find(function (vol) { return vol.userId === a.userId; });
            var n = v ? v.name : (a.volunteerName || '?');
            var status = a.status || 'pending';
            names.push('<span class="coverage-cell ' + _e(status) + '">' + _e(n) + '</span>');
            filledSlots++;
            if (status === 'accepted' || status === 'confirmed') acceptedSlots++;
          });
          html += '<td>' + names.join('<br>') + '</td>';
        }
      });

      /* Unassigned (no location) */
      var unassigned = shiftAssignments.filter(function (a) { return !a.locationId; });
      if (unassigned.length) {
        var unames = unassigned.map(function (a) {
          var v = Admin._volunteersData.find(function (vol) { return vol.userId === a.userId; });
          return '<span class="coverage-cell pending">' + _e(v ? v.name : '?') + '</span>';
        });
        html += '<td>' + unames.join('<br>') + '</td>';
      } else {
        html += '<td><span class="text-muted">-</span></td>';
      }

      html += '</tr>';
    });

    html += '</tbody></table></div></div>';

    var totalAssignments = assignments.length;
    var totalMaxSlots = shifts.reduce(function (sum, s) { return sum + (s.maxVolunteers || 0); }, 0);
    var overallPct = Shared.coveragePercent(totalAssignments, totalMaxSlots);
    html += '<div class="coverage-total">Overall Coverage: ' + totalAssignments + '/' + totalMaxSlots +
      ' volunteers assigned (' + overallPct + '%)</div>';

    container.innerHTML = html;
  };

  /* ==========================================================
     Volunteers
     ========================================================== */
  Admin._allVolunteers = [];

  Admin.initVolunteers = function () {
    if (!Shared.requireAuth() || !Shared.requireAdmin()) return;
    Shared.initSidebar();

    var main = document.getElementById('volunteers-content');
    main.innerHTML = Shared.renderLoading();

    document.getElementById('btn-add-volunteer').addEventListener('click', function () {
      Admin.showVolunteerForm(null);
    });

    var searchInput = document.getElementById('volunteer-search');
    if (searchInput) {
      searchInput.addEventListener('input', Shared.debounce(function () {
        Admin.searchVolunteers(searchInput.value);
      }, 300));
    }

    Admin.loadVolunteers();
  };

  Admin.loadVolunteers = function () {
    var main = document.getElementById('volunteers-content');
    API.listVolunteers().then(function (volunteers) {
      Admin._allVolunteers = volunteers || [];
      Admin.renderVolunteers(Admin._allVolunteers);
    }).catch(function (err) {
      main.innerHTML = '<div class="empty-state"><div class="empty-icon">\u26A0</div>' +
        '<div class="empty-title">Error loading volunteers</div>' +
        '<div class="empty-desc">' + _e(err.message) + '</div></div>';
    });
  };

  Admin.renderVolunteers = function (volunteers) {
    var main = document.getElementById('volunteers-content');

    if (!volunteers || volunteers.length === 0) {
      main.innerHTML = Shared.renderEmpty('No volunteers in the roster yet. Add your first volunteer to get started.');
      return;
    }

    var html = '<div class="table-wrapper"><table>' +
      '<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Events</th><th>Actions</th></tr></thead>' +
      '<tbody>';

    volunteers.forEach(function (v) {
      html += '<tr>' +
        '<td><strong>' + _e(v.name) + '</strong></td>' +
        '<td>' + _e(v.email || '-') + '</td>' +
        '<td>' + _e(Shared.formatPhone(v.phone)) + '</td>' +
        '<td>' + Shared.statusBadge(v.role || 'volunteer') + '</td>' +
        '<td>' + (v.event_count || 0) + '</td>' +
        '<td>' +
          '<button class="btn btn-xs btn-secondary" onclick="Admin.showVolunteerForm(\'' + _e(v.userId) + '\')">Edit</button> ' +
          '<button class="btn btn-xs btn-danger" onclick="Admin.deleteVolunteer(\'' + _e(v.userId) + '\', \'' + _e(v.name) + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    main.innerHTML = html;
  };

  Admin.searchVolunteers = function (query) {
    if (!query || !query.trim()) {
      Admin.renderVolunteers(Admin._allVolunteers);
      return;
    }

    var q = query.toLowerCase();
    var filtered = Admin._allVolunteers.filter(function (v) {
      return (v.name && v.name.toLowerCase().indexOf(q) !== -1) ||
        (v.email && v.email.toLowerCase().indexOf(q) !== -1) ||
        (v.phone && v.phone.indexOf(q) !== -1);
    });

    Admin.renderVolunteers(filtered);
  };

  Admin.showVolunteerForm = function (volunteerId) {
    var title = volunteerId ? 'Edit Volunteer' : 'Add Volunteer';
    var vol = volunteerId ? Admin._allVolunteers.find(function (v) { return v.userId === volunteerId; }) : null;

    if (volunteerId && !vol) {
      API.getVolunteer(volunteerId).then(function (v) {
        vol = v;
        renderForm(vol);
      });
    } else {
      renderForm(vol);
    }

    function renderForm(v) {
      v = v || {};
      var content =
        '<div class="form-group">' +
          '<label>Full Name <span class="required">*</span></label>' +
          '<input type="text" class="form-input" id="vol-name" value="' + _e(v.name || '') + '" placeholder="First Last">' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Email</label>' +
            '<input type="email" class="form-input" id="vol-email" value="' + _e(v.email || '') + '" placeholder="email@example.com">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Phone</label>' +
            '<input type="tel" class="form-input" id="vol-phone" value="' + _e(v.phone || '') + '" placeholder="(555) 555-5555">' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Role</label>' +
          '<select class="form-select" id="vol-role">' +
            '<option value="volunteer"' + (v.role === 'volunteer' || !v.role ? ' selected' : '') + '>Volunteer</option>' +
            '<option value="admin"' + (v.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Notes</label>' +
          '<textarea class="form-textarea" id="vol-notes" placeholder="Availability, preferences, special skills...">' + _e(v.notes || '') + '</textarea>' +
        '</div>';

      Shared.showModal(title, content, [
        { label: 'Cancel', class: 'btn-secondary', onClick: Shared.closeModal },
        { label: volunteerId ? 'Save Changes' : 'Add Volunteer', class: 'btn-primary', onClick: function () {
          var name = document.getElementById('vol-name').value.trim();
          var email = document.getElementById('vol-email').value.trim();
          var phone = document.getElementById('vol-phone').value.replace(/\D/g, '');
          var role = document.getElementById('vol-role').value;
          var notes = document.getElementById('vol-notes').value.trim();

          if (!name) {
            Shared.showToast('Name is required.', true);
            return;
          }

          var data = { name: name, email: email, phone: phone, role: role, notes: notes };
          var promise = volunteerId ? API.updateVolunteer(volunteerId, data) : API.createVolunteer(data);

          promise.then(function () {
            Shared.closeModal();
            Shared.showToast(volunteerId ? 'Volunteer updated.' : 'Volunteer added.');
            Admin.loadVolunteers();
          }).catch(function (err) {
            Shared.showToast(err.message, true);
          });
        }}
      ]);
    }
  };

  Admin.deleteVolunteer = function (id, name) {
    Shared.confirmDelete(name, function () {
      API.deleteVolunteer(id).then(function () {
        Shared.showToast('Volunteer deleted.');
        Admin.loadVolunteers();
      }).catch(function (err) {
        Shared.showToast(err.message, true);
      });
    });
  };

  /* Close dropdown on outside click */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dropdown-wrapper')) {
      document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
        m.classList.remove('open');
      });
    }
  });

  window.Admin = Admin;
})();
