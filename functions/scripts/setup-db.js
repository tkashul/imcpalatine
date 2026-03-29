const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
} = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.TABLE_NAME || 'imc-volunteer-planner';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function waitForTable() {
  console.log('Waiting for table to become active...');
  let active = false;
  while (!active) {
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    if (desc.Table.TableStatus === 'ACTIVE') {
      active = true;
    } else {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log('Table is active.');
}

async function createTable() {
  console.log(`Creating table: ${TABLE_NAME}`);

  await client.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  console.log('Table creation initiated.');
}

async function enableTTL() {
  console.log('Enabling TTL on expiresAt...');
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: TABLE_NAME,
        TimeToLiveSpecification: {
          AttributeName: 'expiresAt',
          Enabled: true,
        },
      })
    );
    console.log('TTL enabled.');
  } catch (err) {
    if (err.name === 'ValidationException' && err.message.includes('already enabled')) {
      console.log('TTL already enabled.');
    } else {
      throw err;
    }
  }
}

async function createInitialOrg() {
  const orgId = uuidv4();
  const now = new Date().toISOString();

  const orgItem = {
    pk: `ORG#${orgId}`,
    sk: 'METADATA',
    entityType: 'Organization',
    orgId,
    name: 'Immaculate Conception BVM Ukrainian Catholic Parish',
    shortName: 'IMC Palatine',
    address: '745 S Burlington Ave, Palatine, IL 60067',
    phone: '(847) 991-0820',
    email: 'office@imcpalatine.org',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: orgItem,
    })
  );

  return orgId;
}

async function main() {
  try {
    const exists = await tableExists();
    if (exists) {
      console.log(`Table ${TABLE_NAME} already exists.`);
    } else {
      await createTable();
      await waitForTable();
      await enableTTL();
    }

    console.log('\nCreating initial organization record...');
    const orgId = await createInitialOrg();

    console.log('\n========================================');
    console.log('  Setup Complete');
    console.log('========================================');
    console.log(`  Table:  ${TABLE_NAME}`);
    console.log(`  Region: ${REGION}`);
    console.log(`  Org ID: ${orgId}`);
    console.log('');
    console.log('  Set this in your Lambda environment:');
    console.log(`    ORG_ID=${orgId}`);
    console.log('========================================\n');
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

main();
