export function createInFlightRequestCache() {
  const requests = new Map();

  return {
    run(key, factory) {
      if (requests.has(key)) return requests.get(key);
      const request = Promise.resolve()
        .then(factory)
        .finally(() => requests.delete(key));
      requests.set(key, request);
      return request;
    },
  };
}

export function createAuthenticatedRequestKey({ accessToken, userId, tenantId = "", path }) {
  return `${userId}:${tenantId}:${accessToken}:${path}`;
}
