import { Router } from "express";
import { sendSuccess } from "../../shared/utils/response.js";

const router = Router();
router.get("/", (_request, response) => sendSuccess(response, {
  data: { status: "ok", timestamp: new Date().toISOString() },
}));

export default router;
