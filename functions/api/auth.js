const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');
const { ok, badRequest, noContent, unauthorized } = require('../shared/response');
const { generateMagicLink, verifyToken, createSession, FRONTEND_URL } = require('../shared/auth');
const { sendMagicLink } = require('../shared/email');

async function handleMagicLink(body) {
  const { email, orgId } = body;
  if (!email || !orgId) {
    return badRequest('email and orgId are required');
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

async function handleVerify(queryParams) {
  const token = queryParams.token;
  if (!token) {
    return badRequest('Token is required');
  }

  const result = await verifyToken(token);
  if (!result) {
    return unauthorized('Invalid or expired token');
  }

  const sessionToken = await createSession(result.userId, result.orgId, result.role);

  // Redirect to frontend with session token
  return {
    statusCode: 302,
    headers: {
      Location: `${FRONTEND_URL}/auth/callback?session=${sessionToken}`,
      'Access-Control-Allow-Origin': '*',
    },
    body: '',
  };
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

module.exports = { handleMagicLink, handleVerify, handleLogout };
