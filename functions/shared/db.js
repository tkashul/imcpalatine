const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.TABLE_NAME || 'imc-volunteer-planner';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

async function put(item) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return item;
}

async function get(pk, sk) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
  );
  return result.Item || null;
}

async function query(pk, skPrefix, options = {}) {
  const {
    limit,
    scanForward = true,
    filterExpression,
    expressionValues = {},
    indexName,
  } = options;

  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':skPrefix': skPrefix,
      ...expressionValues,
    },
    ScanIndexForward: scanForward,
  };

  if (indexName) {
    params.IndexName = indexName;
    params.KeyConditionExpression = 'GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)';
  }

  if (limit) params.Limit = limit;
  if (filterExpression) params.FilterExpression = filterExpression;

  const items = [];
  let lastKey;

  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new QueryCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
    if (limit && items.length >= limit) break;
  } while (lastKey);

  return limit ? items.slice(0, limit) : items;
}

async function update(pk, sk, updates) {
  const now = new Date().toISOString();
  const fields = { ...updates, updatedAt: now };

  const expressionParts = [];
  const expressionNames = {};
  const expressionValues = {};
  let idx = 0;

  for (const [key, value] of Object.entries(fields)) {
    idx++;
    const nameKey = `#f${idx}`;
    const valueKey = `:v${idx}`;
    expressionParts.push(`${nameKey} = ${valueKey}`);
    expressionNames[nameKey] = key;
    expressionValues[valueKey] = value;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

async function delete_(pk, sk) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk, sk },
    })
  );
}

async function batchWrite(items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const requestItems = chunk.map((item) => {
      if (item.DeleteRequest) {
        return { DeleteRequest: item.DeleteRequest };
      }
      return { PutRequest: { Item: item } };
    });

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: requestItems,
        },
      })
    );
  }
}

async function transactWrite(operations) {
  const transactItems = operations.map((op) => {
    if (op.Put) {
      return { Put: { TableName: TABLE_NAME, ...op.Put } };
    }
    if (op.Update) {
      return { Update: { TableName: TABLE_NAME, ...op.Update } };
    }
    if (op.Delete) {
      return { Delete: { TableName: TABLE_NAME, ...op.Delete } };
    }
    if (op.ConditionCheck) {
      return { ConditionCheck: { TableName: TABLE_NAME, ...op.ConditionCheck } };
    }
    return op;
  });

  await docClient.send(
    new TransactWriteCommand({ TransactItems: transactItems })
  );
}

module.exports = { put, get, query, update, delete_, batchWrite, transactWrite, TABLE_NAME };
