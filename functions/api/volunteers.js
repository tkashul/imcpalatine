const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, created, noContent, badRequest, notFound, forbidden } = require('../shared/response');

async function listVolunteers(authContext) {
  const { orgId } = authContext;
  const users = await db.query(`ORG#${orgId}`, 'USER#');

  // Sort by name
  users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return ok(users);
}

async function createVolunteer(authContext, body) {
  if (authContext.role !== 'admin') return forbidden();

  const { name, email, phone, role } = body;
  if (!name || !email) {
    return badRequest('name and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const { orgId } = authContext;

  // Check if email already exists
  const existing = await db.get(`EMAIL#${normalizedEmail}`, 'METADATA');
  if (existing) {
    return badRequest('A user with this email already exists');
  }

  const userId = uuidv4();
  const now = new Date().toISOString();
  const userRole = role || 'volunteer';

  const userItem = {
    pk: `USER#${userId}`,
    sk: 'METADATA',
    entityType: 'User',
    userId,
    orgId,
    email: normalizedEmail,
    name,
    phone: phone || '',
    role: userRole,
    createdAt: now,
    updatedAt: now,
  };

  const emailLookup = {
    pk: `EMAIL#${normalizedEmail}`,
    sk: 'METADATA',
    entityType: 'EmailLookup',
    userId,
    orgId,
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  };

  const orgUserItem = {
    pk: `ORG#${orgId}`,
    sk: `USER#${userId}`,
    entityType: 'OrgUser',
    userId,
    orgId,
    email: normalizedEmail,
    name,
    phone: phone || '',
    role: userRole,
    GSI1PK: `USER#${userId}`,
    GSI1SK: `ORG#${orgId}`,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactWrite([
    { Put: { Item: userItem } },
    { Put: { Item: emailLookup } },
    { Put: { Item: orgUserItem } },
  ]);

  return created(userItem);
}

async function updateVolunteer(authContext, volunteerId, body) {
  if (authContext.role !== 'admin') return forbidden();

  const userItem = await db.get(`USER#${volunteerId}`, 'METADATA');
  if (!userItem) return notFound('Volunteer not found');
  if (userItem.orgId !== authContext.orgId) return forbidden();

  const allowedFields = ['name', 'phone', 'role'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest('No valid fields to update');
  }

  const updated = await db.update(`USER#${volunteerId}`, 'METADATA', updates);

  // Also update the ORG index item
  await db.update(`ORG#${authContext.orgId}`, `USER#${volunteerId}`, updates);

  return ok(updated);
}

async function deleteVolunteer(authContext, volunteerId) {
  if (authContext.role !== 'admin') return forbidden();

  const userItem = await db.get(`USER#${volunteerId}`, 'METADATA');
  if (!userItem) return notFound('Volunteer not found');
  if (userItem.orgId !== authContext.orgId) return forbidden();

  const operations = [
    { Delete: { Key: { pk: `USER#${volunteerId}`, sk: 'METADATA' } } },
    { Delete: { Key: { pk: `EMAIL#${userItem.email}`, sk: 'METADATA' } } },
    { Delete: { Key: { pk: `ORG#${authContext.orgId}`, sk: `USER#${volunteerId}` } } },
  ];

  // Find and delete all assignments for this user
  const assignments = await db.query(`USER#${volunteerId}`, 'ASSIGN#');
  for (const assign of assignments) {
    operations.push({ Delete: { Key: { pk: `USER#${volunteerId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
    if (assign.shiftId) {
      operations.push({ Delete: { Key: { pk: `SHIFT#${assign.shiftId}`, sk: `ASSIGN#${assign.assignmentId}` } } });
    }
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

module.exports = { listVolunteers, createVolunteer, updateVolunteer, deleteVolunteer };
