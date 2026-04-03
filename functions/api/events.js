const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, created, noContent, badRequest, notFound, forbidden } = require('../shared/response');

async function listEvents(authContext) {
  const { orgId } = authContext;
  const events = await db.query(`ORG#${orgId}`, 'EVENT#');

  // Sort by date ascending
  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Attach shift + assignment counts to each event
  for (const ev of events) {
    const shifts = await db.query(`EVENT#${ev.eventId}`, 'SHIFT#');
    let totalSlots = 0;
    let filledSlots = 0;
    let pendingCount = 0;
    for (const shift of shifts) {
      totalSlots += shift.maxVolunteers || 0;
      const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
      filledSlots += assignments.length;
      pendingCount += assignments.filter(a => a.status === 'pending').length;
    }
    ev.shift_count = shifts.length;
    ev.total_slots = totalSlots;
    ev.filled_slots = filledSlots;
    ev.pending_count = pendingCount;
  }

  return ok(events);
}

async function createEvent(authContext, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { name, date, description, status } = body;
  if (!name || !date) {
    return badRequest('name and date are required');
  }

  const eventId = uuidv4();
  const now = new Date().toISOString();
  const { orgId } = authContext;

  // Event metadata item
  const eventItem = {
    pk: `EVENT#${eventId}`,
    sk: 'METADATA',
    entityType: 'Event',
    eventId,
    orgId,
    name,
    date,
    description: description || '',
    status: status || 'draft',
    createdBy: authContext.userId,
    createdAt: now,
    updatedAt: now,
  };

  // ORG index item for listing
  const orgEventItem = {
    pk: `ORG#${orgId}`,
    sk: `EVENT#${eventId}`,
    entityType: 'OrgEvent',
    eventId,
    orgId,
    name,
    date,
    description: description || '',
    status: status || 'draft',
    GSI1PK: `EVENT#${eventId}`,
    GSI1SK: `ORG#${orgId}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactWrite([
    { Put: { Item: eventItem } },
    { Put: { Item: orgEventItem } },
  ]);

  return created(eventItem);
}

async function getEvent(authContext, eventId) {
  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  // Get all shifts for this event
  const shifts = await db.query(`EVENT#${eventId}`, 'SHIFT#');

  // Get all locations for this event
  const locations = await db.query(`EVENT#${eventId}`, 'LOCATION#');

  // Get all assignments for each shift
  const shiftsWithAssignments = [];
  for (const shift of shifts) {
    const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
    shiftsWithAssignments.push({
      ...shift,
      assignments,
    });
  }

  return ok({
    ...eventItem,
    shifts: shiftsWithAssignments,
    locations,
  });
}

async function updateEvent(authContext, eventId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  const allowedFields = ['name', 'date', 'description', 'status'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  const updated = await db.update(`EVENT#${eventId}`, 'METADATA', updates);

  // Also update the ORG index item
  await db.update(`ORG#${authContext.orgId}`, `EVENT#${eventId}`, updates);

  return ok(updated);
}

async function deleteEvent(authContext, eventId) {
  if (authContext.role !== 'admin') return forbidden();

  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  // Gather all child items to delete
  const shifts = await db.query(`EVENT#${eventId}`, 'SHIFT#');
  const locations = await db.query(`EVENT#${eventId}`, 'LOCATION#');

  const operations = [];

  // Delete event metadata
  operations.push({ Delete: { Key: { pk: `EVENT#${eventId}`, sk: 'METADATA' } } });

  // Delete org index item
  operations.push({ Delete: { Key: { pk: `ORG#${authContext.orgId}`, sk: `EVENT#${eventId}` } } });

  // Delete all shifts and their assignments
  for (const shift of shifts) {
    operations.push({ Delete: { Key: { pk: `EVENT#${eventId}`, sk: `SHIFT#${shift.shiftId}` } } });

    const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
    for (const assign of assignments) {
      operations.push({ Delete: { Key: { pk: `SHIFT#${shift.shiftId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
      operations.push({ Delete: { Key: { pk: `USER#${assign.userId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
    }
  }

  // Delete all locations
  for (const loc of locations) {
    operations.push({ Delete: { Key: { pk: `EVENT#${eventId}`, sk: `LOCATION#${loc.locationId}` } } });
  }

  // TransactWrite has a 100-item limit; batch if needed
  if (operations.length <= 100) {
    await db.transactWrite(operations);
  } else {
    // Fall back to batch deletes
    const deleteItems = operations.map((op) => ({
      DeleteRequest: { Key: op.Delete.Key },
    }));
    await db.batchWrite(deleteItems);
  }

  return noContent();
}

module.exports = { listEvents, createEvent, getEvent, updateEvent, deleteEvent };
