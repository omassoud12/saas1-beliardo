export function sendSuccess(response, { statusCode = 200, data = {}, message = "" } = {}) {
  return response.status(statusCode).json({ success: true, data, message });
}
