#!/usr/bin/env node

/**
 * Set a password for an existing user.
 *
 * Usage:
 *   node functions/scripts/set-password.js --email <email> --password <password>
 */

const db = require('../shared/db');
const { hashPassword } = require('../shared/auth');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[++i].toLowerCase().trim();
    } else if (argv[i] === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.email) {
    console.error('Error: --email is required');
    console.error('Usage: node functions/scripts/set-password.js --email <email> --password <password>');
    process.exit(1);
  }
  if (!args.password) {
    console.error('Error: --password is required');
    console.error('Usage: node functions/scripts/set-password.js --email <email> --password <password>');
    process.exit(1);
  }

  // Look up user by email
  const emailItem = await db.get('EMAIL#' + args.email, 'METADATA');
  if (!emailItem) {
    console.error('Error: No user found with email "' + args.email + '"');
    process.exit(1);
  }

  const userId = emailItem.userId;

  // Verify user record exists
  const userItem = await db.get('USER#' + userId, 'METADATA');
  if (!userItem) {
    console.error('Error: User record not found for userId "' + userId + '"');
    process.exit(1);
  }

  // Hash and store password
  const passwordHash = hashPassword(args.password);
  await db.update('USER#' + userId, 'METADATA', { passwordHash });

  console.log('');
  console.log('Password set successfully.');
  console.log('');
  console.log('  User ID : ' + userId);
  console.log('  Email   : ' + args.email);
  console.log('  Name    : ' + (userItem.name || '(none)'));
  console.log('  Role    : ' + (userItem.role || 'volunteer'));
  console.log('');
}

main().catch(function (err) {
  console.error('Failed to set password:', err.message);
  process.exit(1);
});
