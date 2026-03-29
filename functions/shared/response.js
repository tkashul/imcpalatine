const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(statusCode, body) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  };

  if (body !== null && body !== undefined) {
    response.body = JSON.stringify(body);
  } else {
    response.body = '';
  }

  return response;
}

function ok(body) {
  return json(200, body);
}

function created(body) {
  return json(201, body);
}

function noContent() {
  return json(204, null);
}

function badRequest(msg) {
  return json(400, { error: msg });
}

function unauthorized(msg) {
  return json(401, { error: msg || 'Unauthorized' });
}

function forbidden(msg) {
  return json(403, { error: msg || 'Forbidden' });
}

function notFound(msg) {
  return json(404, { error: msg || 'Not found' });
}

function serverError(msg) {
  return json(500, { error: msg || 'Internal server error' });
}

function parseBody(event) {
  if (!event.body) return {};
  let raw = event.body;
  if (event.isBase64Encoded) {
    raw = Buffer.from(raw, 'base64').toString('utf-8');
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = {
  json,
  ok,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  parseBody,
  CORS_HEADERS,
};
