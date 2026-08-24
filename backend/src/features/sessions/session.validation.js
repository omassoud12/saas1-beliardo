const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function success(data) {
  return { success: true, data };
}

function failure(...errors) {
  return { success: false, errors };
}

function parseDate(value, field, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return { value: undefined };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${field} must be a valid ISO date` };
  return { value: date.toISOString() };
}

function parseRate(value, { optional = true } = {}) {
  if ((value === undefined || value === null || value === "") && optional) return { value: undefined };
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 999) {
    return { error: "hourlyRate must be between 0 and 999" };
  }
  return { value: rate };
}

export function validateSessionId(request) {
  return uuidPattern.test(request.params.id)
    ? success({ sessionId: request.params.id })
    : failure("id must be a valid UUID");
}

export function validateCreateSession(request) {
  const stationId = request.body?.stationId;
  const rate = parseRate(request.body?.hourlyRate);
  const errors = [];
  if (typeof stationId !== "string" || !uuidPattern.test(stationId)) {
    errors.push("stationId must be a valid UUID");
  }
  if (rate.error) errors.push(rate.error);
  return errors.length ? failure(...errors) : success({ stationId, hourlyRate: rate.value });
}

export function validateStartSession(request) {
  const idResult = validateSessionId(request);
  const startTime = parseDate(request.body?.startTime, "startTime");
  const errors = [...(idResult.errors ?? [])];
  if (startTime.error) errors.push(startTime.error);
  return errors.length
    ? failure(...errors)
    : success({ sessionId: request.params.id, startTime: startTime.value });
}

export function validateUpdateSession(request) {
  const idResult = validateSessionId(request);
  const rate = parseRate(request.body?.hourlyRate);
  const startTime = parseDate(request.body?.startTime, "startTime");
  const errors = [...(idResult.errors ?? [])];
  if (rate.error) errors.push(rate.error);
  if (startTime.error) errors.push(startTime.error);
  if (rate.value === undefined && startTime.value === undefined) {
    errors.push("Provide hourlyRate or startTime");
  }
  return errors.length
    ? failure(...errors)
    : success({ sessionId: request.params.id, hourlyRate: rate.value, startTime: startTime.value });
}

export function validateCompletedSessions(request) {
  const from = parseDate(request.query.from, "from");
  const to = parseDate(request.query.to, "to");
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit);
  const errors = [];
  if (from.error) errors.push(from.error);
  if (to.error) errors.push(to.error);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push("limit must be between 1 and 100");
  if (from.value && to.value && from.value >= to.value) errors.push("from must be before to");
  return errors.length ? failure(...errors) : success({ from: from.value, to: to.value, limit });
}
