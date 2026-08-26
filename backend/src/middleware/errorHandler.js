export function errorHandler(error, _request, response, _next) {
  const statusCode = Number(error.statusCode) || 500;
  const isOperational = statusCode < 500 || error.name === "AppError";
  const exposeInternalError = process.env.NODE_ENV !== "production";

  if (!isOperational) console.error(error);

  response.status(statusCode).json({
    success: false,
    data: null,
    message: isOperational || exposeInternalError ? error.message : "Internal server error",
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      ...(error.details ? { details: error.details } : {}),
      ...(exposeInternalError && error.hint ? { hint: error.hint } : {}),
    },
  });
}
