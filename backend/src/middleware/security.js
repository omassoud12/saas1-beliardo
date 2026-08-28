import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

function limiter({ windowMs, limit, identifier, code, message, keyGenerator, skip }) {
  return rateLimit({
    windowMs,
    limit,
    identifier,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
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

export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
});
export const apiRateLimiter = createApiRateLimiter();
export const pdfGenerationRateLimiter = createPdfGenerationRateLimiter();
export const pdfDownloadRateLimiter = createPdfDownloadRateLimiter();
