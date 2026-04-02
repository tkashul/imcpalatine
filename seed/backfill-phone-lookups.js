/**
 * backfill-phone-lookups.js
 * Creates PHONE#<digits> lookup records in DynamoDB for existing users
 * who have a phone number stored and a real email address.
 * Safe to re-run — skips users who already have a PHONE# record.
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.DYNAMODB_TABLE || 'imc-volunteer-planner';
const REGION = process.env.AWS_REGION || 'us-east-2';

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

async function getAllUsers() {
  const users = [];
  let lastKey;
  do {
    const resp = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'entityType = :t',
      ExpressionAttributeValues: { ':t': 'User' },
      ExclusiveStartKey: lastKey,
    }));
    users.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return users;
}

async function run() {
  console.log('Scanning for users with phone numbers...');
  const users = await getAllUsers();
  console.log(`Found ${users.length} users`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.phone) { skipped++; continue; }
    // Skip synthetic volunteer.local emails — they have no real email
    if (!user.email || user.email.endsWith('@volunteer.local')) { skipped++; continue; }

    const digits = user.phone.replace(/\D/g, '');
    if (digits.length < 10) { skipped++; continue; }

    // Check if PHONE# record already exists
    const existing = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { pk: `PHONE#${digits}`, sk: 'METADATA' },
    }));

    if (existing.Item) {
      console.log(`  SKIP ${user.name} — PHONE#${digits} already exists`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `PHONE#${digits}`,
        sk: 'METADATA',
        entityType: 'PhoneLookup',
        userId: user.userId,
        orgId: user.orgId,
        email: user.email,
        createdAt: now,
        updatedAt: now,
      },
    }));

    console.log(`  CREATED PHONE#${digits} → ${user.name} (${user.email})`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

run().catch(console.error);
