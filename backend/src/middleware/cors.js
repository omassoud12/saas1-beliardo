export function cors(request, response, next) {
  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim());
  const origin = request.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Business-Id");
  response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

  if (request.method === "OPTIONS") return response.sendStatus(204);
  return next();
}
