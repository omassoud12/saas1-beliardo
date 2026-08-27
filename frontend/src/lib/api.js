import { supabase } from "./supabase";
import { createAuthenticatedRequestKey, createInFlightRequestCache } from "./inFlightRequests";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
const getRequests = createInFlightRequestCache();
const cancelRequests = createInFlightRequestCache();
const endRequests = createInFlightRequestCache();
let sessionRequest;

async function getAuthenticatedSession() {
  if (!sessionRequest) {
    sessionRequest = supabase.auth.getSession().finally(() => { sessionRequest = null; });
  }
  const { data, error } = await sessionRequest;
  if (error || !data.session?.access_token) throw new Error("Authentication is required");
  return data.session;
}

function requestTenantId(headers) {
  if (headers instanceof Headers) return headers.get("X-Business-Id") ?? "";
  const entry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === "x-business-id");
  return entry?.[1] ?? "";
}

export async function apiRequest(path, options = {}) {
  if (!supabase) throw new Error("Supabase frontend environment variables are required");
  const session = await getAuthenticatedSession();
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "GET" && !options.signal) {
    const key = createAuthenticatedRequestKey({
      accessToken: session.access_token,
      userId: session.user.id,
      tenantId: requestTenantId(options.headers),
      path,
    });
    return getRequests.run(key, () => performApiRequest(path, options, session));
  }
  return performApiRequest(path, options, session);
}

async function performApiRequest(path, options, session) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message ?? "API request failed");
    error.code = payload.error?.code;
    error.details = payload.error?.details;
    error.hint = payload.error?.hint;
    throw error;
  }
  return payload;
}

export async function fetchStations() {
  const payload = await apiRequest("/stations");
  return payload.data.stations;
}

export async function syncStations(stations) {
  const payload = await apiRequest("/stations", {
    method: "PUT",
    body: JSON.stringify({ stations }),
  });
  return payload.data.stations;
}

export async function fetchActiveSessions() {
  const payload = await apiRequest("/sessions/active");
  return {
    sessions: payload.data.sessions,
    finishedToday: Number(payload.data.finishedToday) || 0,
    businessDate: payload.data.businessDate,
    nextBusinessDayAt: payload.data.nextBusinessDayAt,
  };
}

export async function createSession(stationId, hourlyRate) {
  const payload = await apiRequest("/sessions", { method: "POST", body: JSON.stringify({ stationId, hourlyRate }) });
  return payload.data.session;
}

export async function startSession(sessionId, startTime) {
  const payload = await apiRequest(`/sessions/${sessionId}/start`, { method: "POST", body: JSON.stringify({ startTime }) });
  return payload.data.session;
}

export async function pauseSession(sessionId) {
  const payload = await apiRequest(`/sessions/${sessionId}/pause`, { method: "POST", body: "{}" });
  return payload.data.session;
}

export async function resumeSession(sessionId) {
  const payload = await apiRequest(`/sessions/${sessionId}/resume`, { method: "POST", body: "{}" });
  return payload.data.session;
}

export async function updateSession(sessionId, values) {
  const payload = await apiRequest(`/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify(values) });
  return payload.data.session;
}

export function endSession(sessionId, endedAt) {
  return endRequests.run(sessionId, async () => {
    const payload = await apiRequest(`/sessions/${sessionId}/end`, {
      method: "POST",
      body: JSON.stringify(endedAt ? { endedAt } : {}),
    });
    return payload.data.session;
  });
}

export function cancelSession(sessionId) {
  return cancelRequests.run(sessionId, async () => {
    const payload = await apiRequest(`/sessions/${sessionId}/cancel`, { method: "POST", body: "{}" });
    return payload.data.session;
  });
}

export async function deleteSession(sessionId) {
  await apiRequest(`/sessions/${sessionId}`, { method: "DELETE" });
}

export async function fetchMyAccess() {
  const payload = await apiRequest("/access/me");
  return payload.data.access;
}

export async function acceptEmployeeInvitation(token) {
  const payload = await apiRequest("/employees/invitations/accept", { method: "POST", body: JSON.stringify({ token }) });
  return payload.data.membership;
}

export async function completePasswordSetup() {
  await apiRequest("/access/password-configured", { method: "POST", body: "{}" });
}

export async function fetchEmployees() {
  const [employees, invitations] = await Promise.all([
    apiRequest("/employees"), apiRequest("/employees/invitations"),
  ]);
  return { employees: employees.data.employees, invitations: invitations.data.invitations };
}

export async function inviteEmployee(email) {
  const payload = await apiRequest("/employees/invitations", { method: "POST", body: JSON.stringify({ email }) });
  return payload.data.invitation;
}

export async function resendEmployeeInvitation(invitationId) {
  await apiRequest(`/employees/invitations/${invitationId}/resend`, { method: "POST", body: "{}" });
}

export async function revokeEmployeeInvitation(invitationId) {
  await apiRequest(`/employees/invitations/${invitationId}`, { method: "DELETE" });
}

export async function updateEmployeeStatus(userId, action) {
  await apiRequest(`/employees/${userId}/status`, { method: "PATCH", body: JSON.stringify({ action }) });
}

export async function fetchPlatformOwners() {
  const payload = await apiRequest("/platform/owners");
  return payload.data.owners;
}

export async function fetchPlatformUsers() {
  const payload = await apiRequest("/platform/users");
  return payload.data.users;
}

export async function updateOwnerStatus(userId, action) {
  await apiRequest(`/platform/owners/${userId}/status`, { method: "PATCH", body: JSON.stringify({ action }) });
}

export async function removePlatformUser(userId) {
  await apiRequest(`/platform/users/${userId}`, { method: "DELETE" });
}

export async function updatePlatformUserStatus(userId, action) {
  await apiRequest(`/platform/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ action }) });
}
