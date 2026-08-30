import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { createRateLimitStore } from "../config/redis.js";

function limiter({ windowMs, limit, identifier, code, message, keyGenerator, skip }) {
  const store = createRateLimitStore(identifier);
  return rateLimit({
    windowMs,
    limit,
    identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
    ...(store ? { store } : {}),
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(skip ? { skip } : {}),
    message,
    handler: (_request, response, _next, options) => response.status(options.statusCode).json({
      success: false,
      data: null,
      message,
      error: { code },
    }),
  });
}

const tenantKey = (request) => request.auth?.businessId ?? "missing-business";
const actorKey = (request) => `${request.auth?.businessId ?? "missing-business"}:${request.auth?.userId ?? "missing-user"}`;

export function createApiRateLimiter({ windowMs = 5 * 60_000, limit = 300 } = {}) {
  return limiter({
    windowMs,
    limit,
    identifier: "api",
    code: "API_RATE_LIMITED",
    message: "Too many API requests. Please try again shortly.",
    skip: (request) => request.method === "OPTIONS" || request.path === "/api/health",
  });
}

export function createPdfGenerationRateLimiter({ windowMs = 60_000, limit = 2 } = {}) {
  return limiter({
    windowMs,
    limit,
    identifier: "pdf-generation",
    code: "PDF_RATE_LIMITED",
    message: "Too many PDF generation attempts. Please wait a minute and retry.",
    keyGenerator: tenantKey,
  });
}

export function createPdfDownloadRateLimiter({ windowMs = 60_000, limit = 30 } = {}) {
  return limiter({
    windowMs,
    limit,
    identifier: "pdf-download",
    code: "PDF_DOWNLOAD_RATE_LIMITED",
    message: "Too many PDF downloads. Please wait a minute and retry.",
    keyGenerator: tenantKey,
  });
}

export function createSensitiveIpRateLimiter({ identifier = "sensitive-ip", windowMs = 15 * 60_000, limit = 20 } = {}) {
  return limiter({
    windowMs,
    limit,
    identifier,
    code: "SENSITIVE_ACTION_RATE_LIMITED",
    message: "Too many attempts. Please wait and try again.",
  });
}

export function createSensitiveActorRateLimiter({ identifier = "sensitive-actor", windowMs = 60_000, limit = 20 } = {}) {
  return limiter({
    windowMs,
    limit,
    identifier,
    code: "SENSITIVE_ACTION_RATE_LIMITED",
    message: "Too many sensitive operations. Please wait and retry.",
    keyGenerator: actorKey,
  });
}

export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
export const apiRateLimiter = createApiRateLimiter();
export const pdfGenerationRateLimiter = createPdfGenerationRateLimiter();
export const pdfDownloadRateLimiter = createPdfDownloadRateLimiter();
export const invitationAcceptanceRateLimiter = createSensitiveIpRateLimiter({ identifier: "invitation-accept", limit: 10 });
export const passwordUpdateRateLimiter = createSensitiveIpRateLimiter({ identifier: "password-update", limit: 10 });
export const invitationMutationRateLimiter = createSensitiveActorRateLimiter({ identifier: "invitation-mutation", limit: 10 });
export const platformMutationRateLimiter = createSensitiveActorRateLimiter({ identifier: "platform-mutation", limit: 15 });
export const sessionMutationRateLimiter = createSensitiveActorRateLimiter({ identifier: "session-mutation", limit: 60 });
export const analyticsRateLimiter = createSensitiveActorRateLimiter({ identifier: "analytics", limit: 30 });
