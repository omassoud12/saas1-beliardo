import { AppError } from "../errors/AppError.js";

export function throwDatabaseError(error) {
  if (!error) return;
  if (error.code === "23505") {
    throw new AppError(409, "A conflicting record already exists", "CONFLICT");
  }
  if (error.code === "23503") {
    throw new AppError(400, "A referenced record does not exist", "INVALID_REFERENCE");
  }
  throw error;
}
