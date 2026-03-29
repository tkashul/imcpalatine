const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, created, noContent, badRequest, notFound, forbidden } = require('../shared/response');
const { sendInvite } = require('../shared/email');
const { FRONTEND_URL } = require('../shared/auth');

async function listByEvent(authContext, eventId) {
  // Verify event belongs to org
  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  // Get all shifts for the event
  const shifts = await db.query(`EVENT#${eventId}`, 'SHIFT#');

  const allAssignments = [];
  for (const shift of shifts) {
    const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
    for (const assign of assignments) {
      allAssignments.push({
        ...assign,
        shiftName: shift.name,
        shiftTimeStart: shift.timeStart,
        shiftTimeEnd: shift.timeEnd,
      });
    }
  }

  return ok(allAssignments);
}

async function createAssignment(authContext, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { shiftId, userId, locationId, eventId } = body;
  if (!shiftId || !userId || !eventId) {
    return badRequest('shiftId, userId, and eventId are required');
  }

  // Verify shift exists
  const shiftItem = await db.get(`EVENT#${eventId}`, `SHIFT#${shiftId}`);
  if (!shiftItem) return notFound('Shift not found');
  if (shiftItem.orgId !== authContext.orgId) return forbidden();

  // Verify user exists
  const userItem = await db.get(`USER#${userId}`, 'METADATA');
  if (!userItem) return notFound('User not found');

  // Look up location name if provided
  let locationName = null;
  if (locationId) {
    const locationItem = await db.get(`EVENT#${eventId}`, `LOCATION#${locationId}`);
    if (locationItem) {
      locationName = locationItem.name;
    }
  }

  // Get event details
  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');

  const assignmentId = uuidv4();
  const now = new Date().toISOString();

  // Write to SHIFT partition
  const shiftAssign = {
    pk: `SHIFT#${shiftId}`,
    sk: `ASSIGN#${assignmentId}`,
    entityType: 'Assignment',
    assignmentId,
    shiftId,
    eventId,
    userId,
    orgId: authContext.orgId,
    locationId: locationId || null,
    locationName,
    userName: userItem.name,
    userEmail: userItem.email,
    eventName: eventItem ? eventItem.name : '',
    shiftTimeStart: shiftItem.timeStart,
    shiftTimeEnd: shiftItem.timeEnd,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // Write to USER partition
  const userAssign = {
    pk: `USER#${userId}`,
    sk: `ASSIGN#${assignmentId}`,
    entityType: 'Assignment',
    assignmentId,
    shiftId,
    eventId,
    userId,
    orgId: authContext.orgId,
    locationId: locationId || null,
    locationName,
    userName: userItem.name,
    userEmail: userItem.email,
    eventName: eventItem ? eventItem.name : '',
    eventDate: eventItem ? eventItem.date : '',
    shiftTimeStart: shiftItem.timeStart,
    shiftTimeEnd: shiftItem.timeEnd,
    shiftName: shiftItem.name || '',
    status: 'pending',
    GSI1PK: `ASSIGN#${assignmentId}`,
    GSI1SK: `USER#${userId}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactWrite([
    { Put: { Item: shiftAssign } },
    { Put: { Item: userAssign } },
  ]);

  return created(shiftAssign);
}

async function updateAssignment(authContext, assignmentId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { shiftId, status, locationId, eventId } = body;
  if (!shiftId) {
    return badRequest('shiftId is required');
  }

  const assignItem = await db.get(`SHIFT#${shiftId}`, `ASSIGN#${assignmentId}`);
  if (!assignItem) return notFound('Assignment not found');
  if (assignItem.orgId !== authContext.orgId) return forbidden();

  const updates = {};
  if (status !== undefined) {
    const validStatuses = ['pending', 'invited', 'accepted', 'declined'];
    if (!validStatuses.includes(status)) {
      return badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    updates.status = status;
  }

  if (locationId !== undefined) {
    updates.locationId = locationId;
    if (locationId && eventId) {
      const locationItem = await db.get(`EVENT#${eventId}`, `LOCATION#${locationId}`);
      updates.locationName = locationItem ? locationItem.name : null;
    } else {
      updates.locationName = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  // Update both partitions
  const updatedShift = await db.update(`SHIFT#${shiftId}`, `ASSIGN#${assignmentId}`, updates);
  await db.update(`USER#${assignItem.userId}`, `ASSIGN#${assignmentId}`, updates);

  return ok(updatedShift);
}

async function deleteAssignment(authContext, assignmentId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { shiftId } = body || {};
  if (!shiftId) {
    return badRequest('shiftId is required');
  }

  const assignItem = await db.get(`SHIFT#${shiftId}`, `ASSIGN#${assignmentId}`);
  if (!assignItem) return notFound('Assignment not found');
  if (assignItem.orgId !== authContext.orgId) return forbidden();

  await db.transactWrite([
    { Delete: { Key: { pk: `SHIFT#${shiftId}`, sk: `ASSIGN#${assignmentId}` } } },
    { Delete: { Key: { pk: `USER#${assignItem.userId}`, sk: `ASSIGN#${assignmentId}` } } },
  ]);

  return noContent();
}

async function sendInvites(authContext, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { assignmentIds } = body;
  if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    return badRequest('assignmentIds array is required');
  }

  const results = [];

  for (const entry of assignmentIds) {
    const { assignmentId, shiftId } = entry;
    if (!assignmentId || !shiftId) continue;

    const assignItem = await db.get(`SHIFT#${shiftId}`, `ASSIGN#${assignmentId}`);
    if (!assignItem || assignItem.orgId !== authContext.orgId) {
      results.push({ assignmentId, status: 'not_found' });
      continue;
    }

    // Look up user for email
    const userItem = await db.get(`USER#${assignItem.userId}`, 'METADATA');
    if (!userItem || !userItem.email) {
      results.push({ assignmentId, status: 'no_email' });
      continue;
    }

    const shiftTime = `${assignItem.shiftTimeStart} - ${assignItem.shiftTimeEnd}`;
    const acceptUrl = `${FRONTEND_URL}/assignments/${assignmentId}/accept`;
    const declineUrl = `${FRONTEND_URL}/assignments/${assignmentId}/decline`;

    try {
      await sendInvite(
        userItem.email,
        userItem.name || userItem.email,
        assignItem.eventName || 'Parish Event',
        shiftTime,
        assignItem.locationName || 'TBD',
        acceptUrl,
        declineUrl
      );

      // Update status to 'invited' in both partitions
      await db.update(`SHIFT#${shiftId}`, `ASSIGN#${assignmentId}`, { status: 'invited' });
      await db.update(`USER#${assignItem.userId}`, `ASSIGN#${assignmentId}`, { status: 'invited' });

      results.push({ assignmentId, status: 'invited' });
    } catch (err) {
      console.error(`Failed to send invite for assignment ${assignmentId}:`, err);
      results.push({ assignmentId, status: 'email_failed', error: err.message });
    }
  }

  return ok({ results });
}

async function mySchedule(authContext) {
  const { userId } = authContext;

  const assignments = await db.query(`USER#${userId}`, 'ASSIGN#');

  // Enrich with event and shift details
  const enriched = [];
  for (const assign of assignments) {
    let eventDetails = null;
    let shiftDetails = null;
    let locationDetails = null;

    if (assign.eventId) {
      eventDetails = await db.get(`EVENT#${assign.eventId}`, 'METADATA');
    }
    if (assign.eventId && assign.shiftId) {
      shiftDetails = await db.get(`EVENT#${assign.eventId}`, `SHIFT#${assign.shiftId}`);
    }
    if (assign.eventId && assign.locationId) {
      locationDetails = await db.get(`EVENT#${assign.eventId}`, `LOCATION#${assign.locationId}`);
    }

    enriched.push({
      ...assign,
      event: eventDetails
        ? { name: eventDetails.name, date: eventDetails.date, description: eventDetails.description, status: eventDetails.status }
        : null,
      shift: shiftDetails
        ? { name: shiftDetails.name, timeStart: shiftDetails.timeStart, timeEnd: shiftDetails.timeEnd }
        : null,
      location: locationDetails
        ? { name: locationDetails.name, description: locationDetails.description }
        : null,
    });
  }

  // Sort by event date
  enriched.sort((a, b) => {
    const dateA = a.event ? a.event.date : '';
    const dateB = b.event ? b.event.date : '';
    return dateA.localeCompare(dateB);
  });

  return ok(enriched);
}

async function myUpdateAssignment(authContext, assignmentId, body) {
  const { userId } = authContext;
  const { status } = body;

  if (!status || !['accepted', 'declined'].includes(status)) {
    return badRequest('status must be "accepted" or "declined"');
  }

  // Look up the assignment from the user partition
  const assignItem = await db.get(`USER#${userId}`, `ASSIGN#${assignmentId}`);
  if (!assignItem) return notFound('Assignment not found');

  const updates = { status };

  // Update both partitions
  await db.update(`USER#${userId}`, `ASSIGN#${assignmentId}`, updates);
  if (assignItem.shiftId) {
    await db.update(`SHIFT#${assignItem.shiftId}`, `ASSIGN#${assignmentId}`, updates);
  }

  const updated = await db.get(`USER#${userId}`, `ASSIGN#${assignmentId}`);
  return ok(updated);
}

async function myAvailableShifts(authContext) {
  const { userId, orgId } = authContext;

  // Get all events for the org
  const events = await db.query(`ORG#${orgId}`, 'EVENT#');

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.date >= today);

  // Get user's existing assignments to exclude shifts they're already on
  const myAssignments = await db.query(`USER#${userId}`, 'ASSIGN#');
  const myShiftIds = new Set(myAssignments.map((a) => a.shiftId));

  const availableShifts = [];

  for (const evt of upcomingEvents) {
    const shifts = await db.query(`EVENT#${evt.eventId}`, 'SHIFT#');

    for (const shift of shifts) {
      if (myShiftIds.has(shift.shiftId)) continue;

      // Count current assignments for this shift
      const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
      const maxVol = shift.maxVolunteers || 0;
      if (maxVol > 0 && assignments.length >= maxVol) continue;

      availableShifts.push({
        ...shift,
        currentVolunteers: assignments.length,
        event: {
          eventId: evt.eventId,
          name: evt.name,
          date: evt.date,
          description: evt.description || '',
        },
      });
    }
  }

  // Sort by event date, then shift start time
  availableShifts.sort((a, b) => {
    const dateCompare = (a.event.date || '').localeCompare(b.event.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.timeStart || '').localeCompare(b.timeStart || '');
  });

  return ok(availableShifts);
}

async function mySignUp(authContext, body) {
  const { userId, orgId } = authContext;
  const { shift_id: shiftId } = body;

  if (!shiftId) {
    return badRequest('shift_id is required');
  }

  // Find the shift — we need to find which event it belongs to
  // The shift's pk is EVENT#<eventId>, sk is SHIFT#<shiftId>
  // We don't know the eventId, so we need to look it up via the body or search.
  // Since shifts have eventId stored on the item, we can use GSI or we check body.
  // Alternative: the frontend may not pass eventId. Let's check if we can find the shift by scanning.
  // Better approach: require event_id in the body, or use the shift item's eventId.
  // For now, let's check if body has event_id, otherwise we need another approach.
  const eventId = body.event_id;
  if (!eventId) {
    return badRequest('event_id is required');
  }

  const shiftItem = await db.get(`EVENT#${eventId}`, `SHIFT#${shiftId}`);
  if (!shiftItem) return notFound('Shift not found');
  if (shiftItem.orgId !== orgId) return forbidden();

  // Check the user isn't already assigned
  const existingAssignments = await db.query(`SHIFT#${shiftId}`, 'ASSIGN#');
  const alreadyAssigned = existingAssignments.some((a) => a.userId === userId);
  if (alreadyAssigned) {
    return badRequest('You are already signed up for this shift');
  }

  // Check capacity
  if (shiftItem.maxVolunteers && existingAssignments.length >= shiftItem.maxVolunteers) {
    return badRequest('This shift is full');
  }

  // Get user and event details
  const userItem = await db.get(`USER#${userId}`, 'METADATA');
  if (!userItem) return notFound('User not found');

  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');

  const assignmentId = uuidv4();
  const now = new Date().toISOString();

  const shiftAssign = {
    pk: `SHIFT#${shiftId}`,
    sk: `ASSIGN#${assignmentId}`,
    entityType: 'Assignment',
    assignmentId,
    shiftId,
    eventId,
    userId,
    orgId,
    locationId: null,
    locationName: null,
    userName: userItem.name,
    userEmail: userItem.email,
    eventName: eventItem ? eventItem.name : '',
    shiftTimeStart: shiftItem.timeStart,
    shiftTimeEnd: shiftItem.timeEnd,
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
  };

  const userAssign = {
    pk: `USER#${userId}`,
    sk: `ASSIGN#${assignmentId}`,
    entityType: 'Assignment',
    assignmentId,
    shiftId,
    eventId,
    userId,
    orgId,
    locationId: null,
    locationName: null,
    userName: userItem.name,
    userEmail: userItem.email,
    eventName: eventItem ? eventItem.name : '',
    eventDate: eventItem ? eventItem.date : '',
    shiftTimeStart: shiftItem.timeStart,
    shiftTimeEnd: shiftItem.timeEnd,
    shiftName: shiftItem.name || '',
    status: 'accepted',
    GSI1PK: `ASSIGN#${assignmentId}`,
    GSI1SK: `USER#${userId}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactWrite([
    { Put: { Item: shiftAssign } },
    { Put: { Item: userAssign } },
  ]);

  return created(shiftAssign);
}

module.exports = {
  listByEvent,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  sendInvites,
  mySchedule,
  myUpdateAssignment,
  myAvailableShifts,
  mySignUp,
};
