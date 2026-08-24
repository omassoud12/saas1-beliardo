export function errorHandler(error, _request, response, _next) {
  const statusCode = Number(error.statusCode) || 500;
  const isOperational = statusCode < 500;

  if (!isOperational) console.error(error);

  response.status(statusCode).json({
    success: false,
    data: null,
    message: isOperational ? error.message : "Internal server error",
    error: {
      code: error.code ?? "INTERNAL_ERROR",
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
