const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, badRequest, noContent, unauthorized } = require('../shared/response');
const { generateMagicLink, verifyToken, createSession, hashPassword, verifyPassword, FRONTEND_URL } = require('../shared/auth');
const { sendMagicLink } = require('../shared/email');

async function handleMagicLink(body) {
  const email = body.email;
  const orgId = body.orgId || process.env.ORG_ID;
  if (!email || !orgId) {
    return badRequest('email is required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up user by email
  let emailItem = await db.get(`EMAIL#${normalizedEmail}`, 'METADATA');

  if (!emailItem) {
    // Create new volunteer user
    const userId = uuidv4();
    const now = new Date().toISOString();

    const userItem = {
      pk: `USER#${userId}`,
      sk: 'METADATA',
      entityType: 'User',
      userId,
      orgId,
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0],
      role: 'volunteer',
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
      name: normalizedEmail.split('@')[0],
      role: 'volunteer',
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

    emailItem = emailLookup;
  }

  // Look up org for name
  const orgItem = await db.get(`ORG#${orgId}`, 'METADATA');
  const orgName = orgItem ? orgItem.name : 'IMC Palatine';

  const magicLinkUrl = await generateMagicLink(normalizedEmail, orgId);
  await sendMagicLink(normalizedEmail, magicLinkUrl, orgName);

  return ok({ message: 'Magic link sent. Check your email.' });
}

async function handleVerify(queryParams, body) {
  const token = (queryParams && queryParams.token) || (body && body.token);
  if (!token) {
    return badRequest('Token is required');
  }

  const result = await verifyToken(token);
  if (!result) {
    return unauthorized('Invalid or expired token');
  }

  const sessionToken = await createSession(result.userId, result.orgId, result.role);

  // Return session token and user info as JSON
  return ok({
    session_token: sessionToken,
    user: {
      userId: result.userId,
      orgId: result.orgId,
      email: result.email,
      role: result.role,
    },
  });
}

async function handleLogout(authContext) {
  if (!authContext) {
    return unauthorized();
  }

  if (authContext.sessionToken) {
    await db.delete_(`SESSION#${authContext.sessionToken}`, 'METADATA');
  }

  return noContent();
}

async function handlePasswordLogin(body) {
  const email = body.email;
  const password = body.password;
  if (!email || !password) {
    return badRequest('email and password are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up user by email
  const emailItem = await db.get(`EMAIL#${normalizedEmail}`, 'METADATA');
  if (!emailItem) {
    return unauthorized('Invalid email or password');
  }

  const userId = emailItem.userId;
  const userItem = await db.get(`USER#${userId}`, 'METADATA');
  if (!userItem) {
    return unauthorized('Invalid email or password');
  }

  if (!userItem.passwordHash) {
    return unauthorized('Invalid email or password');
  }

  let valid = false;
  try {
    valid = verifyPassword(password, userItem.passwordHash);
  } catch (err) {
    return unauthorized('Invalid email or password');
  }

  if (!valid) {
    return unauthorized('Invalid email or password');
  }

  const sessionToken = await createSession(userId, userItem.orgId, userItem.role || 'volunteer');

  return ok({
    session_token: sessionToken,
    user: {
      userId,
      orgId: userItem.orgId,
      email: normalizedEmail,
      role: userItem.role || 'volunteer',
      name: userItem.name,
    },
  });
}

async function handleSetPassword(authContext, body) {
  if (!authContext || authContext.role !== 'admin') {
    return unauthorized('Admin access required');
  }

  const password = body.password;
  if (!password) {
    return badRequest('password is required');
  }

  const passwordHash = hashPassword(password);
  await db.update(`USER#${authContext.userId}`, 'METADATA', { passwordHash });

  return ok({ message: 'Password set' });
}

module.exports = { handleMagicLink, handleVerify, handleLogout, handlePasswordLogin, handleSetPassword };
