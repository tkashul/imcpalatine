const { requireAuth, requireAdmin } = require('./shared/auth');
const { parseBody, serverError, notFound, unauthorized, forbidden, json, CORS_HEADERS } = require('./shared/response');

const { handleMagicLink, handleVerify, handleLogout, handlePasswordLogin, handleSetPassword } = require('./api/auth');
const { listEvents, createEvent, getEvent, updateEvent, deleteEvent } = require('./api/events');
const { createShift, updateShift, deleteShift } = require('./api/shifts');
const { createLocation, updateLocation, deleteLocation } = require('./api/locations');
const { listVolunteers, getVolunteer, createVolunteer, updateVolunteer, deleteVolunteer } = require('./api/volunteers');
const {
  listByEvent,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  sendInvites,
  mySchedule,
  myUpdateAssignment,
  myAvailableShifts,
  mySignUp,
} = require('./api/assignments');

// Route definitions — order matters for matching
const routes = [
  // Auth
  { method: 'POST', pattern: /^\/api\/auth\/magic-link$/, handler: 'authMagicLink' },
  { method: 'GET', pattern: /^\/api\/auth\/verify$/, handler: 'authVerify' },
  { method: 'POST', pattern: /^\/api\/auth\/verify$/, handler: 'authVerify' },
  { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: 'authPasswordLogin' },
  { method: 'POST', pattern: /^\/api\/auth\/set-password$/, handler: 'authSetPassword' },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, handler: 'authLogout' },

  // Events
  { method: 'GET', pattern: /^\/api\/events$/, handler: 'eventsList' },
  { method: 'POST', pattern: /^\/api\/events$/, handler: 'eventsCreate' },
  { method: 'GET', pattern: /^\/api\/events\/([^/]+)$/, handler: 'eventsGet' },
  { method: 'PUT', pattern: /^\/api\/events\/([^/]+)$/, handler: 'eventsUpdate' },
  { method: 'DELETE', pattern: /^\/api\/events\/([^/]+)$/, handler: 'eventsDelete' },

  // Shifts (nested under events for create)
  { method: 'POST', pattern: /^\/api\/events\/([^/]+)\/shifts$/, handler: 'shiftsCreate' },
  { method: 'PUT', pattern: /^\/api\/shifts\/([^/]+)$/, handler: 'shiftsUpdate' },
  { method: 'DELETE', pattern: /^\/api\/shifts\/([^/]+)$/, handler: 'shiftsDelete' },

  // Locations (nested under events for create)
  { method: 'POST', pattern: /^\/api\/events\/([^/]+)\/locations$/, handler: 'locationsCreate' },
  { method: 'PUT', pattern: /^\/api\/locations\/([^/]+)$/, handler: 'locationsUpdate' },
  { method: 'DELETE', pattern: /^\/api\/locations\/([^/]+)$/, handler: 'locationsDelete' },

  // Volunteers
  { method: 'GET', pattern: /^\/api\/volunteers$/, handler: 'volunteersList' },
  { method: 'GET', pattern: /^\/api\/volunteers\/([^/]+)$/, handler: 'volunteersGet' },
  { method: 'POST', pattern: /^\/api\/volunteers$/, handler: 'volunteersCreate' },
  { method: 'PUT', pattern: /^\/api\/volunteers\/([^/]+)$/, handler: 'volunteersUpdate' },
  { method: 'DELETE', pattern: /^\/api\/volunteers\/([^/]+)$/, handler: 'volunteersDelete' },

  // Assignments
  { method: 'GET', pattern: /^\/api\/assignments\/event\/([^/]+)$/, handler: 'assignmentsByEvent' },
  { method: 'POST', pattern: /^\/api\/assignments$/, handler: 'assignmentsCreate' },
  { method: 'PUT', pattern: /^\/api\/assignments\/([^/]+)$/, handler: 'assignmentsUpdate' },
  { method: 'DELETE', pattern: /^\/api\/assignments\/([^/]+)$/, handler: 'assignmentsDelete' },
  { method: 'POST', pattern: /^\/api\/assignments\/invite$/, handler: 'assignmentsInvite' },

  // My (volunteer self-service)
  { method: 'GET', pattern: /^\/api\/my\/schedule$/, handler: 'mySchedule' },
  { method: 'GET', pattern: /^\/api\/my\/available-shifts$/, handler: 'myAvailableShifts' },
  { method: 'POST', pattern: /^\/api\/my\/sign-up$/, handler: 'mySignUp' },
  { method: 'PUT', pattern: /^\/api\/my\/assignments\/([^/]+)$/, handler: 'myUpdateAssignment' },
];

exports.handler = async (event) => {
  try {
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    const path = event.path || event.rawPath || '/';
    const queryParams = event.queryStringParameters || {};

    // CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: '',
      };
    }

    // Match route
    let matched = null;
    let params = [];

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern);
      if (match) {
        matched = route;
        params = match.slice(1); // capture groups
        break;
      }
    }

    if (!matched) {
      return notFound(`No route for ${method} ${path}`);
    }

    const body = parseBody(event);

    // --- Auth routes (no auth required for magic-link and verify) ---
    if (matched.handler === 'authMagicLink') {
      return await handleMagicLink(body);
    }

    if (matched.handler === 'authVerify') {
      return await handleVerify(queryParams, body);
    }

    if (matched.handler === 'authPasswordLogin') {
      return await handlePasswordLogin(body);
    }

    if (matched.handler === 'authSetPassword') {
      const auth = await requireAdmin(event);
      return await handleSetPassword(auth, body);
    }

    if (matched.handler === 'authLogout') {
      const auth = await requireAuth(event);
      return await handleLogout(auth);
    }

    // --- All other routes require auth ---
    const auth = await requireAuth(event);
    if (!auth) {
      return unauthorized();
    }

    // --- Events ---
    if (matched.handler === 'eventsList') {
      return await listEvents(auth);
    }
    if (matched.handler === 'eventsCreate') {
      return await createEvent(auth, body);
    }
    if (matched.handler === 'eventsGet') {
      return await getEvent(auth, params[0]);
    }
    if (matched.handler === 'eventsUpdate') {
      return await updateEvent(auth, params[0], body);
    }
    if (matched.handler === 'eventsDelete') {
      return await deleteEvent(auth, params[0]);
    }

    // --- Shifts ---
    if (matched.handler === 'shiftsCreate') {
      return await createShift(auth, params[0], body);
    }
    if (matched.handler === 'shiftsUpdate') {
      return await updateShift(auth, params[0], body);
    }
    if (matched.handler === 'shiftsDelete') {
      return await deleteShift(auth, params[0], body);
    }

    // --- Locations ---
    if (matched.handler === 'locationsCreate') {
      return await createLocation(auth, params[0], body);
    }
    if (matched.handler === 'locationsUpdate') {
      return await updateLocation(auth, params[0], body);
    }
    if (matched.handler === 'locationsDelete') {
      return await deleteLocation(auth, params[0], body);
    }

    // --- Volunteers ---
    if (matched.handler === 'volunteersList') {
      return await listVolunteers(auth);
    }
    if (matched.handler === 'volunteersGet') {
      return await getVolunteer(auth, params[0]);
    }
    if (matched.handler === 'volunteersCreate') {
      return await createVolunteer(auth, body);
    }
    if (matched.handler === 'volunteersUpdate') {
      return await updateVolunteer(auth, params[0], body);
    }
    if (matched.handler === 'volunteersDelete') {
      return await deleteVolunteer(auth, params[0]);
    }

    // --- Assignments ---
    if (matched.handler === 'assignmentsByEvent') {
      return await listByEvent(auth, params[0]);
    }
    if (matched.handler === 'assignmentsCreate') {
      return await createAssignment(auth, body);
    }
    if (matched.handler === 'assignmentsUpdate') {
      return await updateAssignment(auth, params[0], body);
    }
    if (matched.handler === 'assignmentsDelete') {
      return await deleteAssignment(auth, params[0], body);
    }
    if (matched.handler === 'assignmentsInvite') {
      return await sendInvites(auth, body);
    }

    // --- My routes ---
    if (matched.handler === 'mySchedule') {
      return await mySchedule(auth);
    }
    if (matched.handler === 'myAvailableShifts') {
      return await myAvailableShifts(auth);
    }
    if (matched.handler === 'mySignUp') {
      return await mySignUp(auth, body);
    }
    if (matched.handler === 'myUpdateAssignment') {
      return await myUpdateAssignment(auth, params[0], body);
    }

    return notFound(`Handler not implemented: ${matched.handler}`);
  } catch (err) {
    console.error('Unhandled error:', err);
    return serverError(err.message || 'Internal server error');
  }
};
