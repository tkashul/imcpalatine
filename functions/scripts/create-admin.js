#!/usr/bin/env node

/**
 * Create an admin user for IMC Volunteer Planner.
 *
 * Usage:
 *   node functions/scripts/create-admin.js --email tom@example.com --name "Tom Kashul" --org-id <ORG_ID>
 *   node functions/scripts/create-admin.js --email tom@example.com --name "Tom Kashul" --phone "8475551234" --org-id <ORG_ID>
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../shared/db');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[++i].toLowerCase().trim();
    } else if (argv[i] === '--name' && argv[i + 1]) {
      args.name = argv[++i].trim();
    } else if (argv[i] === '--phone' && argv[i + 1]) {
      args.phone = argv[++i].replace(/\D/g, '');
    } else if (argv[i] === '--org-id' && argv[i + 1]) {
      args.orgId = argv[++i].trim();
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.email) {
    console.error('Error: --email is required');
    console.error('Usage: node create-admin.js --email <email> --name <name> --org-id <orgId> [--phone <phone>]');
    process.exit(1);
  }
  if (!args.name) {
    console.error('Error: --name is required');
    process.exit(1);
  }
  if (!args.orgId) {
    console.error('Error: --org-id is required');
    process.exit(1);
  }

  // Check if email already exists
  const existing = await db.get('EMAIL#' + args.email, 'METADATA');
  if (existing) {
    console.error('Error: A user with email "' + args.email + '" already exists (userId: ' + existing.userId + ')');
    process.exit(1);
  }

  // Verify org exists
  const org = await db.get('ORG#' + args.orgId, 'METADATA');
  if (!org) {
    console.error('Error: Organization "' + args.orgId + '" not found. Run setup-db first.');
    process.exit(1);
  }

  const userId = uuidv4();
  const now = new Date().toISOString();

  // User profile record
  const userItem = {
    pk: 'USER#' + userId,
    sk: 'METADATA',
    entityType: 'User',
    userId: userId,
    orgId: args.orgId,
    email: args.email,
    name: args.name,
    phone: args.phone || '',
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  };

  // Org membership record
  const orgUserItem = {
    pk: 'ORG#' + args.orgId,
    sk: 'USER#' + userId,
    entityType: 'OrgUser',
    userId: userId,
    orgId: args.orgId,
    email: args.email,
    name: args.name,
    phone: args.phone || '',
    role: 'admin',
    GSI1PK: 'USER#' + userId,
    GSI1SK: 'ORG#' + args.orgId,
    createdAt: now,
    updatedAt: now,
  };

  // Email lookup record
  const emailItem = {
    pk: 'EMAIL#' + args.email,
    sk: 'METADATA',
    entityType: 'EmailLookup',
    userId: userId,
    orgId: args.orgId,
    email: args.email,
    createdAt: now,
    updatedAt: now,
  };

  // Write all three records transactionally
  await db.transactWrite([
    { Put: { Item: userItem } },
    { Put: { Item: orgUserItem } },
    { Put: { Item: emailItem } },
  ]);

  console.log('');
  console.log('Admin user created successfully.');
  console.log('');
  console.log('  User ID : ' + userId);
  console.log('  Email   : ' + args.email);
  console.log('  Name    : ' + args.name);
  console.log('  Phone   : ' + (args.phone || '(none)'));
  console.log('  Org ID  : ' + args.orgId);
  console.log('  Role    : admin');
  console.log('');
  console.log('The admin can now log in via magic link at the frontend URL.');
}

main().catch(function (err) {
  console.error('Failed to create admin:', err.message);
  process.exit(1);
});
