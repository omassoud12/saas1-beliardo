import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getMyAccess } from "./access.controller.js";

const router = Router();
router.get("/me", authenticate, getMyAccess);
export default router;
