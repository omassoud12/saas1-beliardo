import { AppError } from "../shared/errors/AppError.js";

export function validateRequest(validator) {
  return (request, _response, next) => {
    const result = validator(request);
    if (!result.success) {
      return next(new AppError(400, "Request validation failed", "VALIDATION_ERROR", result.errors));
    }

    request.validated = result.data;
    return next();
  };
}
