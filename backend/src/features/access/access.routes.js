import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getMyAccess, markPasswordConfigured } from "./access.controller.js";

const router = Router();
router.get("/me", authenticate, getMyAccess);
router.post("/password-configured", authenticate, markPasswordConfigured);
export default router;
