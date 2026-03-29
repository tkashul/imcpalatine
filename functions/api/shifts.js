const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, created, noContent, badRequest, notFound, forbidden } = require('../shared/response');

async function createShift(authContext, eventId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { timeStart, timeEnd, maxVolunteers, name, description } = body;
  if (!timeStart || !timeEnd) {
    return badRequest('timeStart and timeEnd are required');
  }
  if (!maxVolunteers || maxVolunteers < 1) {
    return badRequest('maxVolunteers must be at least 1');
  }

  // Verify event exists and belongs to org
  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  const shiftId = uuidv4();
  const now = new Date().toISOString();

  const shiftItem = {
    pk: `EVENT#${eventId}`,
    sk: `SHIFT#${shiftId}`,
    entityType: 'Shift',
    shiftId,
    eventId,
    orgId: authContext.orgId,
    name: name || '',
    description: description || '',
    timeStart,
    timeEnd,
    maxVolunteers,
    createdAt: now,
    updatedAt: now,
  };

  await db.put(shiftItem);

  return created(shiftItem);
}

async function updateShift(authContext, shiftId, body) {
  if (authContext.role !== 'admin') return forbidden();

  // Find the shift — we need to know the eventId to construct the key
  // Look up via GSI or scan. Since we don't have a direct lookup, we store eventId in the item.
  // We need to find the shift by its shiftId. Query the GSI.
  // Alternative: require eventId in the body or path. Since the handler receives shiftId,
  // we need a way to find it. We'll use the body.eventId if provided, or search.
  const { eventId } = body;
  if (!eventId) {
    return badRequest('eventId is required');
  }

  const shiftItem = await db.get(`EVENT#${eventId}`, `SHIFT#${shiftId}`);
  if (!shiftItem) return notFound('Shift not found');
  if (shiftItem.orgId !== authContext.orgId) return forbidden();

  const allowedFields = ['name', 'description', 'timeStart', 'timeEnd', 'maxVolunteers'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  const updated = await db.update(`EVENT#${eventId}`, `SHIFT#${shiftId}`, updates);
  return ok(updated);
}

async function deleteShift(authContext, shiftId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const eventId = body ? body.eventId : null;
  if (!eventId) {
    return badRequest('eventId is required');
  }

  const shiftItem = await db.get(`EVENT#${eventId}`, `SHIFT#${shiftId}`);
  if (!shiftItem) return notFound('Shift not found');
  if (shiftItem.orgId !== authContext.orgId) return forbidden();

  // Delete shift and all its assignments
  const assignments = await db.query(`SHIFT#${shiftId}`, 'ASSIGN#');

  const operations = [
    { Delete: { Key: { pk: `EVENT#${eventId}`, sk: `SHIFT#${shiftId}` } } },
  ];

  for (const assign of assignments) {
    operations.push({ Delete: { Key: { pk: `SHIFT#${shiftId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
    operations.push({ Delete: { Key: { pk: `USER#${assign.userId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
  }

  if (operations.length <= 100) {
    await db.transactWrite(operations);
  } else {
    const deleteItems = operations.map((op) => ({
      DeleteRequest: { Key: op.Delete.Key },
    }));
    await db.batchWrite(deleteItems);
  }

  return noContent();
}

module.exports = { createShift, updateShift, deleteShift };
