import { logEvent } from "../shared/utils/logger.js";

export function errorHandler(error, _request, response, _next) {
  const statusCode = Number(error.statusCode) || 500;
  const isOperational = statusCode < 500 || error.name === "AppError";
  const exposeInternalError = process.env.NODE_ENV !== "production";

  if (statusCode >= 500) {
    logEvent("error", "request_failed", {
      requestId: _request.requestId,
      method: _request.method,
      path: _request.path,
      userId: _request.auth?.userId,
      businessId: _request.auth?.businessId,
      errorName: error.name,
      errorCode: error.code,
    });
  }

  response.status(statusCode).json({
    success: false,
    data: null,
    message: isOperational || exposeInternalError ? error.message : "Internal server error",
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      ...(error.details && (isOperational || exposeInternalError) ? { details: error.details } : {}),
      ...(exposeInternalError && error.hint ? { hint: error.hint } : {}),
    },
  });
}
