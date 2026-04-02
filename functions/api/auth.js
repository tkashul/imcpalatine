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

async function handlePhoneMagicLink(body) {
  const phone = body.phone;
  if (!phone) {
    return badRequest('phone is required');
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return badRequest('Invalid phone number');
  }

  const phoneLookup = await db.get(`PHONE#${digits}`, 'METADATA');
  if (!phoneLookup) {
    return badRequest('No account found for that phone number. Please sign up or contact your administrator.');
  }

  const email = phoneLookup.email;
  const orgId = phoneLookup.orgId || process.env.ORG_ID;

  const orgItem = await db.get(`ORG#${orgId}`, 'METADATA');
  const orgName = orgItem ? orgItem.name : 'IMC Palatine';

  const magicLinkUrl = await generateMagicLink(email, orgId);
  await sendMagicLink(email, magicLinkUrl, orgName);

  // Return masked email so UI can say "sent to j***@gmail.com"
  const atIdx = email.indexOf('@');
  const masked = email[0] + '***' + email.slice(atIdx);

  return ok({ message: 'Magic link sent.', maskedEmail: masked });
}

async function handleSignup(body) {
  const { name, phone, email } = body;
  if (!name || !email) {
    return badRequest('name and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const orgId = process.env.ORG_ID;

  // Check email not already registered
  const existingEmail = await db.get(`EMAIL#${normalizedEmail}`, 'METADATA');
  if (existingEmail) {
    return badRequest('An account with this email already exists. Try signing in.');
  }

  const digits = phone ? phone.replace(/\D/g, '') : '';

  // Check phone not already registered
  if (digits) {
    const existingPhone = await db.get(`PHONE#${digits}`, 'METADATA');
    if (existingPhone) {
      return badRequest('An account with this phone number already exists. Try signing in.');
    }
  }

  const userId = uuidv4();
  const now = new Date().toISOString();

  const userItem = {
    pk: `USER#${userId}`,
    sk: 'METADATA',
    entityType: 'User',
    userId,
    orgId,
    email: normalizedEmail,
    name: name.trim(),
    phone: digits,
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
    name: name.trim(),
    phone: digits,
    role: 'volunteer',
    GSI1PK: `USER#${userId}`,
    GSI1SK: `ORG#${orgId}`,
    createdAt: now,
    updatedAt: now,
  };

  const writes = [
    { Put: { Item: userItem } },
    { Put: { Item: emailLookup } },
    { Put: { Item: orgUserItem } },
  ];

  if (digits) {
    writes.push({
      Put: {
        Item: {
          pk: `PHONE#${digits}`,
          sk: 'METADATA',
          entityType: 'PhoneLookup',
          userId,
          orgId,
          email: normalizedEmail,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  }

  await db.transactWrite(writes);

  const orgItem = await db.get(`ORG#${orgId}`, 'METADATA');
  const orgName = orgItem ? orgItem.name : 'IMC Palatine';

  const magicLinkUrl = await generateMagicLink(normalizedEmail, orgId);
  await sendMagicLink(normalizedEmail, magicLinkUrl, orgName);

  return ok({ message: 'Account created! Check your email for a sign-in link.' });
}

module.exports = { handleMagicLink, handleVerify, handleLogout, handlePasswordLogin, handleSetPassword, handlePhoneMagicLink, handleSignup };
