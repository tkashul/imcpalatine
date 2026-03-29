const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, created, noContent, badRequest, notFound, forbidden } = require('../shared/response');

async function createLocation(authContext, eventId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { name, description, capacity } = body;
  if (!name) {
    return badRequest('name is required');
  }

  // Verify event exists and belongs to org
  const eventItem = await db.get(`EVENT#${eventId}`, 'METADATA');
  if (!eventItem) return notFound('Event not found');
  if (eventItem.orgId !== authContext.orgId) return forbidden();

  const locationId = uuidv4();
  const now = new Date().toISOString();

  const locationItem = {
    pk: `EVENT#${eventId}`,
    sk: `LOCATION#${locationId}`,
    entityType: 'Location',
    locationId,
    eventId,
    orgId: authContext.orgId,
    name,
    description: description || '',
    capacity: capacity || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.put(locationItem);

  return created(locationItem);
}

async function updateLocation(authContext, locationId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { eventId } = body;
  if (!eventId) {
    return badRequest('eventId is required');
  }

  const locationItem = await db.get(`EVENT#${eventId}`, `LOCATION#${locationId}`);
  if (!locationItem) return notFound('Location not found');
  if (locationItem.orgId !== authContext.orgId) return forbidden();

  const allowedFields = ['name', 'description', 'capacity'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  const updated = await db.update(`EVENT#${eventId}`, `LOCATION#${locationId}`, updates);
  return ok(updated);
}

async function deleteLocation(authContext, locationId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const eventId = body ? body.eventId : null;
  if (!eventId) {
    return badRequest('eventId is required');
  }

  const locationItem = await db.get(`EVENT#${eventId}`, `LOCATION#${locationId}`);
  if (!locationItem) return notFound('Location not found');
  if (locationItem.orgId !== authContext.orgId) return forbidden();

  // Delete the location
  await db.delete_(`EVENT#${eventId}`, `LOCATION#${locationId}`);

  // Find assignments referencing this location and clear their locationId
  // Query all shifts for this event, then all assignments for each shift
  const shifts = await db.query(`EVENT#${eventId}`, 'SHIFT#');
  for (const shift of shifts) {
    const assignments = await db.query(`SHIFT#${shift.shiftId}`, 'ASSIGN#');
    for (const assign of assignments) {
      if (assign.locationId === locationId) {
        await db.update(`SHIFT#${shift.shiftId}`, `ASSIGN#${assign.assignmentId}`, {
          locationId: null,
          locationName: null,
        });
        await db.update(`USER#${assign.userId}`, `ASSIGN#${assign.assignmentId}`, {
          locationId: null,
          locationName: null,
        });
      }
    }
  }

  return noContent();
}

module.exports = { createLocation, updateLocation, deleteLocation };
