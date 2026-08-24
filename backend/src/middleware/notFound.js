export function notFound(request, response) {
  response.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
    error: { code: "NOT_FOUND" },
  });
}
