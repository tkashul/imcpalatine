const crypto = require('crypto');
const db = require('./db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://volunteer.imcpalatine.org';
const MAGIC_LINK_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;

async function generateMagicLink(email, orgId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_MINUTES * 60;

  await db.put({
    pk: `TOKEN#${token}`,
    sk: 'METADATA',
    entityType: 'MagicToken',
    email: email.toLowerCase(),
    orgId,
    token,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return `${FRONTEND_URL}/auth/verify?token=${token}`;
}

async function verifyToken(token) {
  const tokenItem = await db.get(`TOKEN#${token}`, 'METADATA');
  if (!tokenItem) return null;

  const nowEpoch = Math.floor(Date.now() / 1000);
  if (tokenItem.expiresAt < nowEpoch) {
    await db.delete_(`TOKEN#${token}`, 'METADATA');
    return null;
  }

  const email = tokenItem.email;
  const orgId = tokenItem.orgId;

  // Look up user by email
  const emailItem = await db.get(`EMAIL#${email}`, 'METADATA');
  if (!emailItem) {
    await db.delete_(`TOKEN#${token}`, 'METADATA');
    return null;
  }

  const userId = emailItem.userId;
  const userItem = await db.get(`USER#${userId}`, 'METADATA');
  if (!userItem) {
    await db.delete_(`TOKEN#${token}`, 'METADATA');
    return null;
  }

  // Delete the token after use
  await db.delete_(`TOKEN#${token}`, 'METADATA');

  return {
    userId,
    orgId,
    email,
    role: userItem.role || 'volunteer',
  };
}

async function createSession(userId, orgId, role) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;

  await db.put({
    pk: `SESSION#${token}`,
    sk: 'METADATA',
    entityType: 'Session',
    userId,
    orgId,
    role,
    token,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return token;
}

async function requireAuth(event) {
  const headers = event.headers || {};
  // Case-insensitive header lookup
  let authHeader = null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization') {
      authHeader = value;
      break;
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const session = await db.get(`SESSION#${token}`, 'METADATA');
  if (!session) return null;

  const nowEpoch = Math.floor(Date.now() / 1000);
  if (session.expiresAt < nowEpoch) {
    await db.delete_(`SESSION#${token}`, 'METADATA');
    return null;
  }

  return {
    userId: session.userId,
    orgId: session.orgId,
    role: session.role,
    email: session.email,
    sessionToken: token,
  };
}

async function requireAdmin(event) {
  const auth = await requireAuth(event);
  if (!auth) return null;
  if (auth.role !== 'admin') return null;
  return auth;
}

module.exports = {
  generateMagicLink,
  verifyToken,
  createSession,
  requireAuth,
  requireAdmin,
  FRONTEND_URL,
};
