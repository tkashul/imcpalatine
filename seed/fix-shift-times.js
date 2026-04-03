/**
 * fix-shift-times.js
 * 1. Sets correct timeStart/timeEnd on all existing shifts (were created with buggy UI)
 * 2. Adds new 13:30-18:30 shift for Apr 4 and Apr 11
 * 3. Deletes the blank test shift from Apr 12
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.DYNAMODB_TABLE || 'imc-volunteer-planner';
const REGION = process.env.AWS_REGION || 'us-east-2';
const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

async function setShiftTimes(eventId, shiftId, timeStart, timeEnd) {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: `EVENT#${eventId}`, sk: `SHIFT#${shiftId}` },
    UpdateExpression: 'SET timeStart = :s, timeEnd = :e, updatedAt = :u',
    ExpressionAttributeValues: {
      ':s': timeStart,
      ':e': timeEnd,
      ':u': new Date().toISOString(),
    },
  }));
  console.log(`  SET ${timeStart}-${timeEnd} on SHIFT#${shiftId.substring(0,8)}`);
}

async function addShift(eventId, orgId, timeStart, timeEnd, maxVolunteers) {
  const shiftId = uuidv4();
  const now = new Date().toISOString();
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: `EVENT#${eventId}`,
      sk: `SHIFT#${shiftId}`,
      entityType: 'Shift',
      shiftId,
      eventId,
      orgId,
      name: '',
      description: '',
      timeStart,
      timeEnd,
      maxVolunteers,
      createdAt: now,
      updatedAt: now,
    },
  }));
  console.log(`  ADDED shift ${timeStart}-${timeEnd} (shiftId=${shiftId.substring(0,8)}) to EVENT#${eventId.substring(0,8)}`);
  return shiftId;
}

async function run() {
  const ORG_ID = '06d8653f-26e3-4858-b684-cf34cc4efd7c';

  // ── Palm/Willow Sunday Mar 29 (68044e23) ──────────────────────────────
  console.log('\nPalm Sunday Mar 29:');
  await setShiftTimes('68044e23-4243-4b46-a800-d22e15d05f63', '3d89dd6b-4b08-4db3-ac66-e686ffdec798', '07:00', '10:00');
  await setShiftTimes('68044e23-4243-4b46-a800-d22e15d05f63', '95d6ce5f-7c61-4745-b570-6ca0433236ae', '09:00', '12:00');
  await setShiftTimes('68044e23-4243-4b46-a800-d22e15d05f63', '7ece89f5-66c6-4adf-81f0-47cc86f06745', '11:00', '14:00');

  // ── Holy Saturday Apr 4 (37e07173) ───────────────────────────────────
  console.log('\nHoly Saturday Apr 4:');
  await setShiftTimes('37e07173-d2e2-46a4-afdd-435699d9bf63', '3c96e57e-f1ba-4ea5-8e22-90fba58a515d', '07:00', '10:00');
  await setShiftTimes('37e07173-d2e2-46a4-afdd-435699d9bf63', '43f7f43e-810b-43d5-bc0d-bcd53e2727da', '09:00', '12:00');
  await setShiftTimes('37e07173-d2e2-46a4-afdd-435699d9bf63', '309fc2ad-fe10-4e79-93db-acc90318862c', '11:00', '14:00');
  await setShiftTimes('37e07173-d2e2-46a4-afdd-435699d9bf63', '0d7d688f-d59b-4bc3-8a98-8421995ae5aa', '13:00', '16:00');
  await setShiftTimes('37e07173-d2e2-46a4-afdd-435699d9bf63', '822118a6-debe-4c9c-bd51-131e2d2dc14a', '15:00', '18:30');
  // Add new 1:30–6:30 PM shift
  await addShift('37e07173-d2e2-46a4-afdd-435699d9bf63', ORG_ID, '13:30', '18:30', 12);

  // ── Gregorian Easter / Julian Willow Sunday Apr 5 (0d49a850) ─────────
  console.log('\nGregorian Easter Apr 5:');
  await setShiftTimes('0d49a850-bc91-4d45-9095-09b124185bba', 'cbf6a7e5-a9a2-4749-a8a8-2a164c5f5f9b', '07:00', '10:00');
  await setShiftTimes('0d49a850-bc91-4d45-9095-09b124185bba', 'df221534-7749-4632-a51d-fcd893229d36', '09:00', '12:00');
  await setShiftTimes('0d49a850-bc91-4d45-9095-09b124185bba', '88e82a18-83a3-4c3e-82d1-07b15ed89bee', '11:00', '14:00');

  // ── Julian Holy Saturday Apr 11 (af3fbdd4) ───────────────────────────
  console.log('\nJulian Holy Saturday Apr 11:');
  await setShiftTimes('af3fbdd4-10c9-44f4-a29c-6a8656bc54c1', '169f1a73-f31a-4e60-bffd-0319b92d8409', '11:00', '14:00');
  await setShiftTimes('af3fbdd4-10c9-44f4-a29c-6a8656bc54c1', '9e149f92-032f-4eaf-beff-add07b383e9e', '13:00', '16:00');
  await setShiftTimes('af3fbdd4-10c9-44f4-a29c-6a8656bc54c1', 'a97d5f5b-8e3d-4dc3-a58e-1ee4f4700c0c', '15:00', '18:30');
  // Add new 1:30–6:30 PM shift
  await addShift('af3fbdd4-10c9-44f4-a29c-6a8656bc54c1', ORG_ID, '13:30', '18:30', 12);

  // ── Julian Easter Apr 12 (3584f4aa) ──────────────────────────────────
  console.log('\nJulian Easter Apr 12:');
  await setShiftTimes('3584f4aa-bc35-44df-aff5-2fb7473a0560', '965b90fb-7a57-4432-8d94-c3b944464cd3', '07:00', '10:00');
  await setShiftTimes('3584f4aa-bc35-44df-aff5-2fb7473a0560', 'a0ca2e41-1772-430b-9260-fd0793ad9286', '09:00', '12:00');
  await setShiftTimes('3584f4aa-bc35-44df-aff5-2fb7473a0560', '2e8935ec-7244-4a55-8eb7-a5296afe098b', '11:00', '14:00');
  // Delete blank test shift
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { pk: 'EVENT#3584f4aa-bc35-44df-aff5-2fb7473a0560', sk: 'SHIFT#cdddb126-efb4-4c86-9647-597358d99f8d' },
  }));
  console.log('  DELETED test shift cdddb126');

  console.log('\nDone!');
}

run().catch(console.error);
